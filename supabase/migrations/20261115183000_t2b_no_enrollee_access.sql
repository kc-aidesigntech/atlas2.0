-- Peer Resident (t2b) enrollee access is removed.
--
-- This file deletes the two enrollee permission grants and the enrollee
-- capability from t2b, drops "assigned enrollees" from the t2b menu row, and
-- narrows the enrollee tier set from t3a / t2b to t3a in the functions and
-- Row-Level Security (RLS) policies that open enrollee, enrollment-request, and
-- referral-intake rows. Warm line, respite shifts, leads, sponsorship, and
-- supervision grants on t2b are not touched: fn_supervisor_claim_navigator,
-- fn_wallet_navigator_claim_cards, and the
-- navigator_create_sessions.opened_by_role check still accept t2b.

-- Raises, and so stops this file before any statement below runs, when a
-- person whose active tier assignments are t2b without t3a / t4 / t4plus holds
-- an open navigator_assignments row. Those rows need another owner first.
do $$
declare
  stranded_count integer;
begin
  select count(*)
  into stranded_count
  from atlas.navigator_assignments na
  where na.ends_on is null
    and exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = na.navigator_person_id
        and r.role_key = 't2b'
        and (pra.ends_on is null or pra.ends_on >= current_date)
    )
    and not exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = na.navigator_person_id
        and r.role_key in ('t3a', 't4', 't4plus')
        and (pra.ends_on is null or pra.ends_on >= current_date)
    );

  if stranded_count > 0 then
    raise exception '% open navigator assignment(s) belong to a Peer Resident (t2b); reassign them before removing t2b enrollee access', stranded_count
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants, capability, and menu
-- Source: 20261104190300_tier_permissions.sql,
--         20261114210000_tier_capability_screen_matrix.sql,
--         20261104190400_tier_navigation.sql
-- ---------------------------------------------------------------------------

-- Deletes the t2b rows for enrollee_profile.write and regulation_variables.write.
-- fn_has_permission and fn_my_permissions stop returning both keys for t2b.
delete from atlas.role_permissions rp
using atlas.roles r, atlas.permissions p
where r.id = rp.role_id
  and p.id = rp.permission_id
  and r.role_key = 't2b'
  and p.permission_key in ('enrollee_profile.write', 'regulation_variables.write');

-- Deletes the t2b row for the enrollee capability. fn_tier_capability_matrix
-- stops listing it, so the "enrollees" screen has no capability left on t2b.
delete from atlas.tier_capabilities
where tier_key = 't2b'
  and capability_key = 'enrollee_profiles_and_regulation';

-- Removes the "assigned enrollees" string from the t2b top_menus array. The
-- row becomes refer, my wallet, leads, warm line, respite shifts, sponsorships.
update atlas.app_role_navigation
set top_menus = top_menus - 'assigned enrollees'
where surface = 'singlepane'
  and role_key = 't2b';

-- ---------------------------------------------------------------------------
-- Wallet: navigator claims enrollees
-- Source: 20261104190200_tier_role_literals.sql
-- ---------------------------------------------------------------------------

-- True when the caller is a system admin or holds t3a by assignment or by
-- JavaScript Object Notation (JSON) Web Token (JWT) claim (the legacy navigator
-- claim normalizes to t3a). fn_wallet_enrollee_claim_cards calls this, so a
-- t2b caller now gets 'navigator role required' instead of the enrollee list.
create or replace function atlas.fn_wallet_caller_is_navigator()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t3a']::text[]
$$;

-- ---------------------------------------------------------------------------
-- Navigator self-assignment and self-unassignment
-- Source: 20261104190200_tier_role_literals.sql
-- ---------------------------------------------------------------------------

-- Opens a navigator_assignments edge from the caller to one active enrollment.
-- Auto-links the auth identity to atlas.people when missing. Caller must be a
-- system admin or hold t3a by assignment or JWT claim.
-- fn_claim_referral_queue_to_enrollment calls this function, so a referral
-- pickup by a t2b caller raises here too.
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
    or atlas.fn_caller_role_keys() && array['t3a']::text[]
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = current_person_id
        and pra.ends_on is null
        and r.role_key = 't3a'
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
-- must be a system admin or hold t3a by assignment or JWT claim.
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
    or atlas.fn_caller_role_keys() && array['t3a']::text[]
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = current_person_id
        and pra.ends_on is null
        and r.role_key = 't3a'
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

-- ---------------------------------------------------------------------------
-- Intake queue policies
-- Source: 20261104190200_tier_role_literals.sql
-- ---------------------------------------------------------------------------

-- enrollment_requests is now read by t3a / t4 / t4plus callers; t2b reads no rows.
alter policy enrollment_requests_staff_select
  on atlas.enrollment_requests
  using (
    atlas.fn_caller_role_keys() && array['t3a', 't4', 't4plus']::text[]
  );

-- Intake events are now read by system admins and t3a / t4 / t4plus callers.
-- The public insert policy is unchanged, so a t2b still submits a referral.
alter policy public_referral_intake_events_select_staff
  on atlas.public_referral_intake_events
  using (
    atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t3a', 't4', 't4plus']::text[]
  );

-- public_landing referral and partner_inquiry events are now updated by system
-- admins and t3a / t4 / t4plus callers.
alter policy public_referral_intake_events_update_staff
  on atlas.public_referral_intake_events
  using (
    (
      atlas.fn_is_system_admin()
      or atlas.fn_caller_role_keys() && array['t3a', 't4', 't4plus']::text[]
    )
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  )
  with check (
    (
      atlas.fn_is_system_admin()
      or atlas.fn_caller_role_keys() && array['t3a', 't4', 't4plus']::text[]
    )
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  );
