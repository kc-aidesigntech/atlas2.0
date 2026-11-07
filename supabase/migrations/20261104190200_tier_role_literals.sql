-- Tier role literals: supervisor / navigator checks become tier sets.
--
-- 20261104190000_tier_roles.sql deleted the navigator / supervisor /
-- administrator rows from atlas.roles, so every function, policy, and check
-- constraint that still compares those literals is redefined here against the
-- tier keys. The body of each object is copied from its latest definition;
-- only the role comparison changes.
--
-- Tier sets used below:
--   supervisor  -> t4, t4plus
--   navigator   -> t3a, t2b  (enrollee, wallet, assignment, referral-claim paths)
--   new sign-up -> t1
--
-- The JSON Web Token (JWT) claim app_metadata.atlas_role is written outside
-- this repository and may still carry a legacy literal, so each check reads
-- atlas.fn_caller_role_keys(), which normalizes administrator / supervisor /
-- navigator to t4plus / t4 / t3a, and atlas.fn_is_system_admin() for the
-- administrator fast path.

-- ---------------------------------------------------------------------------
-- Competency assessment command Remote Procedure Call (RPC)
-- Source: 20260530124000_security_phase3_navigator_competency_command_rpc.sql
-- ---------------------------------------------------------------------------

-- Resolves a staff person by display name for the given role key, creating the
-- person and role assignment when needed. The role key is normalized, so a
-- caller passing 'supervisor' or 'navigator' resolves to the t4 / t3a row.
-- Raises on a conflicting active role so a single identity cannot represent
-- two roles.
create or replace function atlas.fn_ensure_staff_person(p_display_name text, p_role_key text)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_name text := nullif(btrim(p_display_name), '');
  v_role_key text := atlas.fn_normalize_role_key(p_role_key);
  v_role_id uuid;
  v_person_id uuid;
  v_existing_role text;
  v_first text;
  v_last text;
begin
  if v_name is null then
    raise exception '% name is required', v_role_key using errcode = '22023';
  end if;

  -- Looks up the tier row for the normalized key.
  select id into v_role_id from atlas.roles where role_key = v_role_key limit 1;
  if v_role_id is null then
    raise exception 'role % is not configured in atlas.roles', v_role_key using errcode = '22023';
  end if;

  -- Returns the person when they already hold the requested active role.
  select p.id into v_person_id
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key = v_role_key
  where p.display_name = v_name
  limit 1;
  if v_person_id is not null then
    return v_person_id;
  end if;

  -- Raises when the person holds a different active role.
  select r.role_key into v_existing_role
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key <> v_role_key
  where p.display_name = v_name
  limit 1;
  if v_existing_role is not null then
    raise exception '% is already assigned as %. Each person can only hold one role.', v_name, v_existing_role
      using errcode = '23505';
  end if;

  -- Finds or creates the person record.
  select id into v_person_id from atlas.people where display_name = v_name limit 1;
  if v_person_id is null then
    v_first := case when position(' ' in v_name) > 0
      then btrim(substr(v_name, 1, length(v_name) - position(' ' in reverse(v_name))))
      else v_name end;
    v_last := case when position(' ' in v_name) > 0
      then btrim(substr(v_name, length(v_name) - position(' ' in reverse(v_name)) + 2))
      else 'operator' end;
    insert into atlas.people (first_name, last_name, display_name, person_type, status)
    values (coalesce(nullif(v_first, ''), v_name), coalesce(nullif(v_last, ''), 'operator'), v_name, 'staff', 'active')
    returning id into v_person_id;
  end if;

  -- Attaches the tier role when the person has no active assignment yet.
  if not exists (
    select 1 from atlas.people_role_assignments where person_id = v_person_id and ends_on is null
  ) then
    insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on, ends_on)
    values (v_person_id, v_role_id, true, current_date, null);
  end if;

  return v_person_id;
end;
$$;

-- Records a competency assessment. Caller must be a system admin or hold an
-- active t4 / t4plus role. The supervisor identity is ensured as t4 and the
-- navigator identity as t3a.
create or replace function atlas.fn_save_navigator_competency_assessment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_supervisor_id uuid;
  v_navigator_id uuid;
  v_assessment_id uuid;
begin
  -- Raises unless the caller is a system admin or holds t4 / t4plus.
  if not (
    atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t4', 't4plus']::text[]
  ) then
    raise exception 'only supervisors or administrators may record competency assessments'
      using errcode = '42501';
  end if;

  v_supervisor_id := atlas.fn_ensure_staff_person(payload ->> 'supervisorName', 't4');
  v_navigator_id := atlas.fn_ensure_staff_person(payload ->> 'navigatorName', 't3a');

  insert into atlas.navigator_competency_assessments (
    supervisor_person_id, navigator_person_id, form_version, assessed_at
  ) values (
    v_supervisor_id, v_navigator_id, coalesce(nullif(payload ->> 'formVersion', ''), 'v1'), now()
  )
  returning id into v_assessment_id;

  insert into atlas.navigator_competency_assessment_answers (
    assessment_id, parent_code, z_code, normalized_z_code, title, description, competency_score
  )
  select
    v_assessment_id,
    a ->> 'parentCode',
    a ->> 'parentCode',
    a ->> 'parentCode',
    a ->> 'theme',
    a ->> 'theme',
    (a ->> 'score')::integer
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_assessment_id;
end;
$$;

revoke execute on function atlas.fn_ensure_staff_person(text, text) from public;
revoke execute on function atlas.fn_save_navigator_competency_assessment(jsonb) from public;
grant execute on function atlas.fn_save_navigator_competency_assessment(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Warm-line supervisor grant and list
-- Source: 20260817120000_warmline_agent_capability.sql
-- fn_can_access_warmline_agent and the permission key warmline_agent.access
-- are not touched.
-- ---------------------------------------------------------------------------

-- Grants or clears a warm-line exception for one navigator. Caller must be a
-- system admin or hold an active t4 / t4plus role; non-admins must also have
-- the target on their supervisor roster.
create or replace function atlas.fn_supervisor_set_navigator_warmline_access(
  target_navigator_person_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  supervisor_id uuid;
  perm uuid;
  is_admin boolean := atlas.fn_is_system_admin();
begin
  supervisor_id := atlas.fn_current_person_id();
  if supervisor_id is null then
    raise exception 'signed-in person required' using errcode = '42501';
  end if;

  -- Raises unless the caller is a system admin or holds t4 / t4plus.
  if not is_admin
    and not (atlas.fn_caller_role_keys() && array['t4', 't4plus']::text[]) then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  -- Non-admins must have the target navigator on their open roster.
  if not is_admin then
    if not exists (
      select 1
      from atlas.supervisor_navigator_assignments sna
      where sna.supervisor_person_id = supervisor_id
        and sna.navigator_person_id = target_navigator_person_id
        and sna.ends_on is null
    ) then
      raise exception 'navigator is not on this supervisor roster' using errcode = '42501';
    end if;
  end if;

  perm := atlas.fn_warmline_permission_id();
  if perm is null then
    raise exception 'warmline_agent.access permission is missing' using errcode = 'P0001';
  end if;

  perform atlas.fn_clear_warmline_exceptions(target_navigator_person_id);
  if not coalesce(enabled, false) then
    return;
  end if;

  insert into atlas.user_permission_exceptions (
    person_id,
    permission_id,
    effect,
    reason,
    starts_at,
    ends_at,
    created_by_person_id
  ) values (
    target_navigator_person_id,
    perm,
    'allow',
    'supervisor warm-line grant',
    now(),
    null,
    supervisor_id
  );
end;
$$;

-- Lists warm-line access for the requested people. System admins see every
-- row; everyone sees their own row; active t4 / t4plus callers see navigators
-- on their open roster.
create or replace function atlas.fn_list_warmline_access(target_person_ids uuid[])
returns table(person_id uuid, has_access boolean, exception_effect text)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  viewer uuid;
  is_admin boolean;
  is_supervisor boolean;
begin
  viewer := atlas.fn_current_person_id();
  is_admin := atlas.fn_is_system_admin();
  is_supervisor := atlas.fn_caller_role_keys() && array['t4', 't4plus']::text[];

  return query
  select
    candidate.person_id,
    atlas.fn_person_has_warmline_access(candidate.person_id),
    atlas.fn_person_warmline_exception_effect(candidate.person_id)
  from unnest(coalesce(target_person_ids, '{}'::uuid[])) as candidate(person_id)
  where is_admin
    or candidate.person_id = viewer
    or (
      is_supervisor
      and exists (
        select 1
        from atlas.supervisor_navigator_assignments sna
        where sna.supervisor_person_id = viewer
          and sna.navigator_person_id = candidate.person_id
          and sna.ends_on is null
      )
    );
end;
$$;

revoke all on function atlas.fn_supervisor_set_navigator_warmline_access(uuid, boolean) from public;
revoke all on function atlas.fn_list_warmline_access(uuid[]) from public;
grant execute on function atlas.fn_supervisor_set_navigator_warmline_access(uuid, boolean) to authenticated;
grant execute on function atlas.fn_list_warmline_access(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Wallet: supervisor claims navigators
-- Source: 20261012054500_wallet_self_claim_circles.sql
-- ---------------------------------------------------------------------------

-- True when the caller is a system admin or holds t4 / t4plus by assignment or
-- JWT claim (legacy supervisor / administrator claims normalize to t4 / t4plus).
create or replace function atlas.fn_wallet_caller_is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t4', 't4plus']::text[]
$$;

-- Lists active people holding t3a or t2b as navigator claim cards, flagging the
-- ones already on the caller's open roster. Caller must pass
-- fn_wallet_caller_is_supervisor().
create or replace function atlas.fn_wallet_navigator_claim_cards()
returns table (
  person_id uuid,
  display_name text,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'navigator') as display_name,
    exists (
      select 1
      from atlas.supervisor_navigator_assignments sna
      where sna.navigator_person_id = p.id
        and sna.supervisor_person_id = current_person_id
        and sna.ends_on is null
    ) as is_mine
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key in ('t3a', 't2b')
  where coalesce(p.status, 'active') = 'active'
  order by 2;
end;
$$;

-- Opens (or reopens) the caller's supervision edge to one navigator. The target
-- must hold an active t3a or t2b role.
create or replace function atlas.fn_supervisor_claim_navigator(target_navigator_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if current_person_id is null then
    raise exception 'supervisor identity is not mapped' using errcode = '42501';
  end if;
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;
  if target_navigator_person_id is null then
    raise exception 'navigator person id is required' using errcode = '22023';
  end if;
  -- Raises when the target holds no active t3a / t2b role.
  if not exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = target_navigator_person_id
      and pra.ends_on is null
      and r.role_key in ('t3a', 't2b')
  ) then
    raise exception 'target person is not a navigator' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from atlas.supervisor_navigator_assignments sna
    where sna.navigator_person_id = target_navigator_person_id
      and sna.supervisor_person_id = current_person_id
      and sna.ends_on is null
  ) then
    return;
  end if;

  -- Reopens the latest edge when someone assigns, removes, and assigns again.
  -- A second insert would collide with the unique start date.
  update atlas.supervisor_navigator_assignments
  set ends_on = null
  where id = (
    select sna.id
    from atlas.supervisor_navigator_assignments sna
    where sna.navigator_person_id = target_navigator_person_id
      and sna.supervisor_person_id = current_person_id
    order by sna.starts_on desc
    limit 1
  );

  if found then
    return;
  end if;

  insert into atlas.supervisor_navigator_assignments (
    id,
    navigator_person_id,
    supervisor_person_id,
    starts_on,
    ends_on
  )
  values (
    gen_random_uuid(),
    target_navigator_person_id,
    current_person_id,
    current_date,
    null
  );
end;
$$;

-- Ends the caller's open supervision edge to one navigator.
create or replace function atlas.fn_supervisor_release_navigator(target_navigator_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if current_person_id is null then
    raise exception 'supervisor identity is not mapped' using errcode = '42501';
  end if;
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  update atlas.supervisor_navigator_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and supervisor_person_id = current_person_id
    and ends_on is null;
end;
$$;

revoke all on function atlas.fn_wallet_caller_is_supervisor() from public;
revoke all on function atlas.fn_wallet_navigator_claim_cards() from public;
revoke all on function atlas.fn_supervisor_claim_navigator(uuid) from public;
revoke all on function atlas.fn_supervisor_release_navigator(uuid) from public;
grant execute on function atlas.fn_wallet_caller_is_supervisor() to authenticated;
grant execute on function atlas.fn_wallet_navigator_claim_cards() to authenticated;
grant execute on function atlas.fn_supervisor_claim_navigator(uuid) to authenticated;
grant execute on function atlas.fn_supervisor_release_navigator(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Wallet: navigator claims enrollees
-- Source: 20261012061000_wallet_enrollee_claim_cards.sql
-- ---------------------------------------------------------------------------

-- True when the caller is a system admin or holds t3a / t2b by assignment or
-- JWT claim (legacy navigator / administrator claims normalize to t3a / t4plus).
create or replace function atlas.fn_wallet_caller_is_navigator()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t3a', 't2b']::text[]
$$;

-- Lists active enrollments as claim cards, flagging the ones already assigned
-- to the caller. Caller must pass fn_wallet_caller_is_navigator().
create or replace function atlas.fn_wallet_enrollee_claim_cards()
returns table (
  enrollment_id uuid,
  display_name text,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if not atlas.fn_wallet_caller_is_navigator() then
    raise exception 'navigator role required' using errcode = '42501';
  end if;

  return query
  select
    en.id,
    coalesce(nullif(trim(person.display_name), ''), nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), 'enrollee') as display_name,
    exists (
      select 1
      from atlas.navigator_assignments na
      where na.enrollment_id = en.id
        and na.navigator_person_id = current_person_id
        and na.ends_on is null
    ) as is_mine
  from atlas.enrollments en
  join atlas.enrollees enrollee on enrollee.id = en.enrollee_id
  join atlas.people person on person.id = enrollee.person_id
  where en.status = 'active'
  order by 2;
end;
$$;

revoke all on function atlas.fn_wallet_caller_is_navigator() from public;
revoke all on function atlas.fn_wallet_enrollee_claim_cards() from public;
grant execute on function atlas.fn_wallet_caller_is_navigator() to authenticated;
grant execute on function atlas.fn_wallet_enrollee_claim_cards() to authenticated;

-- ---------------------------------------------------------------------------
-- Navigator self-assignment and self-unassignment
-- Source: 20260507174000_navigator_self_assignment_identity_autolink.sql and
--         20260505160000_navigator_self_assignment_role_claim_fallback.sql
-- ---------------------------------------------------------------------------

-- Opens a navigator_assignments edge from the caller to one active enrollment.
-- Auto-links the auth identity to atlas.people when missing. Caller must be a
-- system admin or hold t3a / t2b by assignment or JWT claim.
create or replace function atlas.fn_navigator_assign_enrollment_to_self(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  auth_user_id text := nullif(auth.uid()::text, '');
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_email text := nullif(lower(coalesce(auth_claims ->> 'email', '')), '');
  fallback_display_name text := nullif(trim(coalesce(auth_claims -> 'user_metadata' ->> 'full_name', '')), '');
  fallback_first_name text;
  fallback_last_name text;
  current_person_id uuid;
  has_navigator_role boolean := false;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = auth_email)
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    if fallback_display_name is null then
      fallback_display_name := coalesce(nullif(split_part(coalesce(auth_email, ''), '@', 1), ''), 'atlas navigator');
    end if;
    fallback_first_name := coalesce(nullif(split_part(fallback_display_name, ' ', 1), ''), 'atlas');
    fallback_last_name := coalesce(nullif(trim(substring(fallback_display_name from length(fallback_first_name) + 1)), ''), 'navigator');

    insert into atlas.people (
      id,
      external_ref,
      first_name,
      last_name,
      display_name,
      email,
      person_type,
      status
    )
    values (
      gen_random_uuid(),
      auth_user_id,
      fallback_first_name,
      fallback_last_name,
      fallback_display_name,
      auth_email,
      'staff',
      'active'
    )
    on conflict (external_ref) do update
    set
      email = coalesce(atlas.people.email, excluded.email),
      display_name = coalesce(nullif(atlas.people.display_name, ''), excluded.display_name),
      updated_at = now()
    returning id into current_person_id;

    if current_person_id is null and auth_email is not null then
      select p.id
      into current_person_id
      from atlas.people p
      where lower(p.email) = auth_email
      order by p.created_at asc
      limit 1;

      if current_person_id is not null and auth_user_id is not null then
        update atlas.people
        set external_ref = coalesce(external_ref, auth_user_id),
            updated_at = now()
        where id = current_person_id;
      end if;
    end if;
  end if;

  if current_person_id is null then
    raise exception 'navigator identity is not mapped to atlas.people'
      using errcode = '42501';
  end if;

  -- fn_caller_role_keys() reads the active assignments of the person resolved
  -- by fn_current_person_id() plus the normalized atlas_role / atlas_roles
  -- claims; the direct assignment check below also covers the person row
  -- auto-linked above in this same call.
  has_navigator_role :=
    atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t3a', 't2b']::text[]
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = current_person_id
        and pra.ends_on is null
        and r.role_key in ('t3a', 't2b')
    );

  if not has_navigator_role then
    raise exception 'navigator role required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from atlas.enrollments en
    where en.id = target_enrollment_id
      and en.status = 'active'
  ) then
    raise exception 'target enrollment is not active'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from atlas.navigator_assignments na
    where na.enrollment_id = target_enrollment_id
      and na.navigator_person_id = current_person_id
      and na.ends_on is null
  ) then
    return;
  end if;

  insert into atlas.navigator_assignments (
    id,
    enrollment_id,
    navigator_person_id,
    starts_on,
    ends_on,
    station_id
  )
  values (
    gen_random_uuid(),
    target_enrollment_id,
    current_person_id,
    current_date,
    null,
    null
  );
end;
$$;

-- Ends the caller's open navigator_assignments edge to one enrollment. Caller
-- must be a system admin or hold t3a / t2b by assignment or JWT claim.
create or replace function atlas.fn_navigator_unassign_enrollment_from_self(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  auth_user_id text := nullif(auth.uid()::text, '');
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_email text := nullif(coalesce(auth_claims ->> 'email', ''), '');
  current_person_id uuid;
  has_navigator_role boolean := false;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = lower(auth_email))
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    raise exception 'navigator identity is not mapped to atlas.people'
      using errcode = '42501';
  end if;

  -- Same three-way check as fn_navigator_assign_enrollment_to_self.
  has_navigator_role :=
    atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t3a', 't2b']::text[]
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = current_person_id
        and pra.ends_on is null
        and r.role_key in ('t3a', 't2b')
    );

  if not has_navigator_role then
    raise exception 'navigator role required'
      using errcode = '42501';
  end if;

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and navigator_person_id = current_person_id
    and ends_on is null;
end;
$$;

revoke all on function atlas.fn_navigator_assign_enrollment_to_self(uuid) from public;
grant execute on function atlas.fn_navigator_assign_enrollment_to_self(uuid) to authenticated;
revoke all on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) from public;
grant execute on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) to authenticated;

-- fn_claim_referral_queue_to_enrollment (latest: 20260513044000) holds no role
-- literal; it calls fn_navigator_assign_enrollment_to_self, which is rewritten
-- above, so it is not redefined here.

-- ---------------------------------------------------------------------------
-- Auth sign-up bridge: default role becomes t1
-- Source: 20260510000500_signup_default_partner_role.sql
-- ---------------------------------------------------------------------------

-- Mirrors auth.users into atlas.people. On INSERT it also writes a t1
-- (Candidate) role assignment when the person has no active assignment yet.
create or replace function atlas.handle_auth_user_people_sync()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  default_role_id uuid;
  metadata jsonb;
  first_name_value text;
  last_name_value text;
  display_name_value text;
  email_local_part text;
  full_name_value text;
begin
  -- Reads the t1 tier row used as the default assignment.
  select r.id
  into default_role_id
  from atlas.roles r
  where r.role_key = 't1'
  limit 1;

  if tg_op = 'INSERT' then
    metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    first_name_value := nullif(trim(metadata ->> 'first_name'), '');
    last_name_value := nullif(trim(metadata ->> 'last_name'), '');

    if first_name_value is null
      and last_name_value is null
      and nullif(trim(metadata ->> 'full_name'), '') is not null
    then
      full_name_value := trim(metadata ->> 'full_name');
      if position(' ' in full_name_value) > 0 then
        first_name_value := split_part(full_name_value, ' ', 1);
        last_name_value := nullif(trim(substring(full_name_value from position(' ' in full_name_value) + 1)), '');
      else
        first_name_value := full_name_value;
        last_name_value := 'User';
      end if;
    end if;

    if first_name_value is null and last_name_value is null then
      email_local_part := nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), '');
      first_name_value := coalesce(email_local_part, 'atlas');
      last_name_value := 'User';
    end if;

    first_name_value := coalesce(first_name_value, 'atlas');
    last_name_value := coalesce(last_name_value, 'User');
    display_name_value := trim(first_name_value || ' ' || last_name_value);

    insert into atlas.people (
      id,
      external_ref,
      first_name,
      last_name,
      display_name,
      email,
      person_type,
      status
    )
    values (
      new.id,
      new.id::text,
      first_name_value,
      last_name_value,
      display_name_value,
      new.email,
      'staff',
      'active'
    )
    on conflict (id) do update
    set
      external_ref = excluded.external_ref,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      display_name = excluded.display_name,
      email = excluded.email,
      updated_at = now();

    -- Inserts the t1 assignment when no open assignment exists for this person.
    if default_role_id is not null then
      insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
      select new.id, default_role_id, true, current_date
      where not exists (
        select 1
        from atlas.people_role_assignments pra
        where pra.person_id = new.id
          and pra.ends_on is null
      );
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.email is distinct from old.email
      or new.raw_user_meta_data is distinct from old.raw_user_meta_data
    then
      metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
      update atlas.people p
      set
        external_ref = coalesce(p.external_ref, new.id::text),
        email = new.email,
        first_name = coalesce(nullif(trim(metadata ->> 'first_name'), ''), p.first_name),
        last_name = coalesce(nullif(trim(metadata ->> 'last_name'), ''), p.last_name),
        display_name = case
          when nullif(trim(concat_ws(' ', metadata ->> 'first_name', metadata ->> 'last_name')), '') is not null
            then trim(concat_ws(' ', metadata ->> 'first_name', metadata ->> 'last_name'))
          when nullif(trim(metadata ->> 'full_name'), '') is not null
            then trim(metadata ->> 'full_name')
          else p.display_name
        end,
        updated_at = now()
      where p.id = new.id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- C.R.E.A.T.E. session opened_by_role check constraint
-- Source: 20261011234109_wallet_ipscc_and_create_sessions.sql
-- ---------------------------------------------------------------------------

-- Replaces the two-literal check with the tier keys that may open a session.
-- The legacy literals stay allowed so existing rows keep passing the check.
alter table atlas.navigator_create_sessions
  drop constraint if exists navigator_create_sessions_opened_by_role_check;

alter table atlas.navigator_create_sessions
  add constraint navigator_create_sessions_opened_by_role_check
  check (opened_by_role in ('t2b', 't3a', 't4', 't4plus', 'navigator', 'supervisor'));

-- ---------------------------------------------------------------------------
-- Intake queue read policy
-- Source: 20260804170000_db_rls_phase2_phase3_remaining_tables.sql
-- ---------------------------------------------------------------------------

-- Lets t2b / t3a / t4 / t4plus callers read enrollment_requests. The admin
-- policy enrollment_requests_admin_all is rewritten by the fast-path migration.
drop policy if exists enrollment_requests_staff_select on atlas.enrollment_requests;
create policy enrollment_requests_staff_select
  on atlas.enrollment_requests
  for select
  to authenticated
  using (
    atlas.fn_caller_role_keys() && array['t2b', 't3a', 't4', 't4plus']::text[]
  );

-- ---------------------------------------------------------------------------
-- Public referral intake queue policies
-- Source: 20260504013000_launch_intake_durability_and_audit.sql (select) and
--         20260620133800_phase1_continuity_policy_hardening.sql (update)
-- Found by the literal sweep; both gate staff access by the atlas_role claim.
-- ---------------------------------------------------------------------------

-- Lets system admins and t2b / t3a / t4 / t4plus callers read intake events.
drop policy if exists public_referral_intake_events_select_staff on atlas.public_referral_intake_events;
create policy public_referral_intake_events_select_staff
  on atlas.public_referral_intake_events
  for select
  to authenticated
  using (
    atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t2b', 't3a', 't4', 't4plus']::text[]
  );

-- Lets system admins and t2b / t3a / t4 / t4plus callers update public_landing
-- referral and partner_inquiry events.
drop policy if exists public_referral_intake_events_update_staff on atlas.public_referral_intake_events;
create policy public_referral_intake_events_update_staff
  on atlas.public_referral_intake_events
  for update
  to authenticated
  using (
    (
      atlas.fn_is_system_admin()
      or atlas.fn_caller_role_keys() && array['t2b', 't3a', 't4', 't4plus']::text[]
    )
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  )
  with check (
    (
      atlas.fn_is_system_admin()
      or atlas.fn_caller_role_keys() && array['t2b', 't3a', 't4', 't4plus']::text[]
    )
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  );

notify pgrst, 'reload schema';
