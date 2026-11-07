-- Tier follow-ups after 20261104190000 … 20261104190500.
--
-- 1. The remaining functions and Row-Level Security (RLS) policies that read
--    the JSON Web Token (JWT) claim app_metadata.atlas_role = 'administrator'
--    directly now call atlas.fn_is_system_admin(), which also accepts the
--    t4plus claim and an active t4plus assignment. Each body below is the
--    applied definition with only that predicate swapped.
-- 2. ends_on boundary: the original atlas.fn_has_permission (20260411041933)
--    treats an assignment as active through its ends_on day
--    (ends_on >= current_date). fn_caller_role_keys, fn_is_system_admin, and
--    fn_my_tier are aligned to that inclusive read, and the tier closers
--    fn_tier_apply / fn_mark_tier_alum write ends_on = current_date - 1 so a
--    tier closed today stops granting today.
-- 3. fn_normalize_role_key and fn_tier_rank pin search_path.
-- 4. enrollee_burden_survey_submissions.respondent_role accepts the tier keys
--    t2b / t3a / t4 / t4plus alongside navigator / supervisor.
-- 5. Covering indexes for the foreign keys the advisor named.

-- ---------------------------------------------------------------------------
-- 3. search_path on the immutable helpers.
-- ---------------------------------------------------------------------------

-- Maps a legacy staff literal to its tier key; any other value passes through.
create or replace function atlas.fn_normalize_role_key(raw_role_key text)
returns text
language sql
immutable
set search_path = atlas, public
as $$
  select case lower(coalesce(raw_role_key, ''))
    when 'administrator' then 't4plus'
    when 'supervisor' then 't4'
    when 'navigator' then 't3a'
    else lower(coalesce(raw_role_key, ''))
  end
$$;

-- Ladder position of a tier key: t1 = 1 through t4plus = 7; other keys return 0.
create or replace function atlas.fn_tier_rank(target_role_key text)
returns integer
language sql
immutable
set search_path = atlas, public
as $$
  select case atlas.fn_normalize_role_key(target_role_key)
    when 't1' then 1
    when 't2' then 2
    when 't2b' then 3
    when 't3' then 4
    when 't3a' then 5
    when 't4' then 6
    when 't4plus' then 7
    else 0
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. ends_on boundary: inclusive reads, closers write yesterday.
-- ---------------------------------------------------------------------------

-- Returns the caller's normalized role keys: assignments active through their
-- ends_on day plus the atlas_role and atlas_roles JWT claims.
create or replace function atlas.fn_caller_role_keys()
returns text[]
language sql
stable
security definer
set search_path = atlas, public
as $$
  with claims as (
    select coalesce(auth.jwt(), '{}'::jsonb) as jwt
  ),
  keys as (
    select atlas.fn_normalize_role_key(r.role_key) as role_key
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = atlas.fn_current_person_id()
      and pra.starts_on <= current_date
      -- An assignment counts through its ends_on day (same read as fn_has_permission).
      and (pra.ends_on is null or pra.ends_on >= current_date)

    union

    select atlas.fn_normalize_role_key(c.jwt -> 'app_metadata' ->> 'atlas_role')
    from claims c
    where nullif(c.jwt -> 'app_metadata' ->> 'atlas_role', '') is not null

    union

    select atlas.fn_normalize_role_key(role_value.role_key)
    from claims c
    cross join jsonb_array_elements_text(
      case
        when jsonb_typeof(c.jwt -> 'app_metadata' -> 'atlas_roles') = 'array'
          then c.jwt -> 'app_metadata' -> 'atlas_roles'
        else '[]'::jsonb
      end
    ) as role_value(role_key)
  )
  select coalesce(array_agg(distinct k.role_key), '{}'::text[])
  from keys k
  where k.role_key <> ''
$$;

-- True when the atlas_role claim normalizes to t4plus, or the caller holds a
-- t4plus assignment active through its ends_on day.
create or replace function atlas.fn_is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select
    atlas.fn_normalize_role_key(coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '')) = 't4plus'
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = atlas.fn_current_person_id()
        and r.role_key = 't4plus'
        and pra.starts_on <= current_date
        -- An assignment counts through its ends_on day (same read as fn_has_permission).
        and (pra.ends_on is null or pra.ends_on >= current_date)
    )
$$;

-- Caller's own standing. Falls back to the highest tier assignment active
-- through its ends_on day when no people_tiers row exists yet.
create or replace function atlas.fn_my_tier()
returns table (
  tier_key text,
  tier_status text,
  is_lucid_employee boolean,
  designations text[]
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  with me as (
    select atlas.fn_current_person_id() as person_id
  ),
  from_row as (
    select pt.tier_key, pt.tier_status, pt.is_lucid_employee
    from atlas.people_tiers pt
    join me on me.person_id = pt.person_id
  ),
  from_assignment as (
    select r.role_key as tier_key, 'active'::text as tier_status, false as is_lucid_employee
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    join me on me.person_id = pra.person_id
    where r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
      and pra.starts_on <= current_date
      -- An assignment counts through its ends_on day (same read as fn_has_permission).
      and (pra.ends_on is null or pra.ends_on >= current_date)
    order by atlas.fn_tier_rank(r.role_key) desc
    limit 1
  ),
  standing as (
    select * from from_row
    union all
    select * from from_assignment where not exists (select 1 from from_row)
  )
  select
    s.tier_key,
    s.tier_status,
    s.is_lucid_employee,
    coalesce(
      (
        select array_agg(td.designation order by td.designation)
        from atlas.tier_designations td
        join me on me.person_id = td.person_id
      ),
      '{}'::text[]
    ) as designations
  from standing s
  limit 1
$$;

-- Writes the role assignment and the people_tiers row together. Other open
-- tier assignments close as of yesterday; partner and enrollee assignments are
-- untouched. Not callable by app roles; the gated RPCs and the cohort trigger
-- call it.
create or replace function atlas.fn_tier_apply(target_person_id uuid, next_tier_key text)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_tier text := atlas.fn_normalize_role_key(next_tier_key);
  v_role_id uuid;
begin
  if target_person_id is null then
    raise exception 'target_person_id is required' using errcode = '22023';
  end if;
  if atlas.fn_tier_rank(v_tier) = 0 then
    raise exception 'unknown tier key %', next_tier_key using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.people p where p.id = target_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  select r.id into v_role_id from atlas.roles r where r.role_key = v_tier limit 1;
  if v_role_id is null then
    raise exception 'tier role % is not configured in atlas.roles', v_tier using errcode = '22023';
  end if;

  -- Other open tier assignments close with ends_on = yesterday, so the
  -- inclusive reads (ends_on >= current_date) stop counting them today.
  update atlas.people_role_assignments pra
  set ends_on = current_date - 1, is_primary = false
  from atlas.roles r
  where r.id = pra.role_id
    and pra.person_id = target_person_id
    and pra.ends_on is null
    and r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
    and r.id <> v_role_id;

  -- The tier assignment becomes the only primary assignment.
  update atlas.people_role_assignments
  set is_primary = false
  where person_id = target_person_id
    and ends_on is null
    and is_primary = true
    and role_id <> v_role_id;

  if exists (
    select 1
    from atlas.people_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = v_role_id
      and pra.ends_on is null
  ) then
    update atlas.people_role_assignments
    set is_primary = true
    where person_id = target_person_id
      and role_id = v_role_id
      and ends_on is null;
  else
    insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on, ends_on)
    values (gen_random_uuid(), target_person_id, v_role_id, true, current_date, null);
  end if;

  -- The tier row is created or moved; entered_at is kept when the person is
  -- re-activated on the same tier they already hold.
  insert into atlas.people_tiers (person_id, tier_key, tier_status, entered_at, left_at)
  values (target_person_id, v_tier, 'active', now(), null)
  on conflict (person_id) do update
  set
    tier_key = excluded.tier_key,
    tier_status = 'active',
    entered_at = case
      when atlas.people_tiers.tier_key = excluded.tier_key and atlas.people_tiers.tier_status = 'active'
        then atlas.people_tiers.entered_at
      else now()
    end,
    left_at = null;
end;
$$;

revoke all on function atlas.fn_tier_apply(uuid, text) from public;

-- The active tier row becomes alum and keeps its tier_key; the open tier role
-- assignments close as of yesterday so permissions seeded on the tier stop
-- applying today.
create or replace function atlas.fn_mark_tier_alum(target_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_tiers() then
    raise exception 'tier management requires t4 or higher' using errcode = '42501';
  end if;
  if target_person_id is null then
    raise exception 'target_person_id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.people_tiers pt where pt.person_id = target_person_id) then
    raise exception 'person holds no tier' using errcode = 'P0002';
  end if;

  -- Open tier assignments close with ends_on = yesterday, so the inclusive
  -- reads (ends_on >= current_date) stop counting them today.
  update atlas.people_role_assignments pra
  set ends_on = current_date - 1, is_primary = false
  from atlas.roles r
  where r.id = pra.role_id
    and pra.person_id = target_person_id
    and pra.ends_on is null
    and r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus');

  update atlas.people_tiers
  set tier_status = 'alum',
      left_at = coalesce(left_at, now())
  where person_id = target_person_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Functions: administrator claim -> atlas.fn_is_system_admin().
-- ---------------------------------------------------------------------------

-- Source: 20260628125500_admin_service_capacity_submission_deletion_logging.sql
-- Raises unless the caller is a system admin, then logs and deletes one
-- partner service-capacity submission.
create or replace function atlas.fn_admin_delete_partner_service_capacity_submission(
  p_submission_id uuid,
  p_reason_code text,
  p_reason_other_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_submission atlas.partner_service_capacity_submissions%rowtype;
  v_answers_snapshot jsonb := '[]'::jsonb;
  v_reason_code text := lower(btrim(coalesce(p_reason_code, '')));
  v_reason_other_text text := nullif(btrim(coalesce(p_reason_other_text, '')), '');
  v_deleted_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- Raises unless the caller is a system admin.
  if not atlas.fn_is_system_admin() then
    raise exception 'only administrators may delete partner service-capacity submissions' using errcode = '42501';
  end if;

  if v_reason_code not in ('obsolete', 'not_relevant', 'mistakenly_entered', 'contained_errors', 'other') then
    raise exception 'invalid deletion reason code' using errcode = '22023';
  end if;
  if v_reason_code = 'other' and v_reason_other_text is null then
    raise exception 'other deletion reason requires detail text' using errcode = '22023';
  end if;

  select *
  into v_submission
  from atlas.partner_service_capacity_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'service-capacity submission not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(answer_row) order by answer_row.created_at), '[]'::jsonb)
  into v_answers_snapshot
  from atlas.partner_service_capacity_answers answer_row
  where answer_row.submission_id = v_submission.id;

  insert into atlas.partner_service_capacity_deletion_log (
    deleted_at,
    submission_id,
    form_version,
    status,
    organization_name,
    record_deleted,
    reason_code,
    reason_other_text,
    deleted_by_user_id,
    deleted_by_email,
    deleted_record
  ) values (
    v_deleted_at,
    v_submission.id,
    v_submission.form_version,
    v_submission.status,
    v_submission.organization_name,
    'partner_service_capacity_submissions:' || v_submission.id::text,
    v_reason_code,
    v_reason_other_text,
    auth.uid(),
    nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), ''),
    jsonb_build_object(
      'submission', to_jsonb(v_submission),
      'answers', v_answers_snapshot
    )
  );

  delete from atlas.partner_service_capacity_submissions where id = v_submission.id;

  return jsonb_build_object(
    'id', v_submission.id,
    'deletedAt', v_deleted_at,
    'recordDeleted', 'partner_service_capacity_submissions:' || v_submission.id::text,
    'reasonCode', v_reason_code,
    'reasonOtherText', v_reason_other_text
  );
end;
$$;

-- Source: 20260528000500_navigator_partner_station_linkage.sql
-- True for a system admin, a partner contact, the partner's primary-contact
-- email, or a navigator with an open partner assignment.
create or replace function atlas.fn_can_access_partner_scope(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  )
  select
    atlas.fn_is_system_admin()
    or (
      target_partner_id is not null
      and exists (
        select 1
        from current_person cp
        where cp.person_id is not null
          and (
            exists (
              select 1
              from atlas.v_active_partner_contact_edges pca
              where pca.partner_id = target_partner_id
                and pca.contact_person_id = cp.person_id
            )
            or exists (
              select 1
              from atlas.partners part
              join atlas.people person on person.id = cp.person_id
              where part.id = target_partner_id
                and part.primary_contact_email is not null
                and person.email is not null
                and lower(part.primary_contact_email) = lower(person.email)
            )
            or exists (
              select 1
              from atlas.navigator_partner_assignments npa
              where npa.partner_id = target_partner_id
                and npa.navigator_person_id = cp.person_id
                and npa.ends_on is null
            )
          )
      )
    );
$$;

-- Source: 20260530122000_security_phase3_enrollee_burden_command_rpc.sql
-- True for a system admin, the respondent, or staff with enrollment access.
create or replace function atlas.fn_can_manage_enrollee_burden_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $$
  select exists (
    select 1
    from atlas.enrollee_burden_survey_submissions s
    where s.id = target_submission_id
      and (
        atlas.fn_is_system_admin()
        or s.respondent_person_id = atlas.fn_current_person_id()
        or atlas.fn_can_access_enrollment_as_staff(s.enrollment_id)
      )
  );
$$;

-- Source: 20260530122000_security_phase3_enrollee_burden_command_rpc.sql
-- Deletes one burden draft for a system admin or its respondent.
create or replace function atlas.fn_delete_enrollee_burden_draft(target_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_person uuid := atlas.fn_current_person_id();
  v_row atlas.enrollee_burden_survey_submissions%rowtype;
begin
  select * into v_row
  from atlas.enrollee_burden_survey_submissions
  where id = target_submission_id;

  if not found or v_row.status <> 'draft' then
    return null;
  end if;

  if not (v_is_admin or v_row.respondent_person_id = v_person) then
    raise exception 'not authorized to delete burden draft %', target_submission_id
      using errcode = '42501';
  end if;

  delete from atlas.enrollee_burden_survey_submissions where id = target_submission_id;
  return target_submission_id;
end;
$$;

-- Source: 20260530123000_security_phase3_regulation_tests_command_rpc.sql
-- Deletes one regulation-test draft for a system admin or staff with
-- enrollment access.
create or replace function atlas.fn_delete_regulation_test_draft(target_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_row atlas.navigator_regulation_test_submissions%rowtype;
begin
  select * into v_row from atlas.navigator_regulation_test_submissions where id = target_submission_id;
  if not found or v_row.status <> 'draft' then
    return null;
  end if;

  if not (
    v_is_admin
    or (v_row.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(v_row.enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = v_row.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  ) then
    raise exception 'not authorized to delete regulation test %', target_submission_id
      using errcode = '42501';
  end if;

  delete from atlas.navigator_regulation_test_submissions where id = target_submission_id;
  return target_submission_id;
end;
$$;

-- Source: 20260530125000_security_phase3_zcode_intake_command_rpc.sql
-- Inserts inferred Z-codes for an enrollment; system admin or staff access.
create or replace function atlas.fn_intake_enrollment_inferred_z_codes(
  p_enrollment_id uuid,
  p_z_codes text[],
  p_source text default 'demo_ollama_inference'
)
returns text[]
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_applied text[];
begin
  if p_enrollment_id is null then
    raise exception 'enrollment_id is required' using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(p_enrollment_id)) then
    raise exception 'not authorized to intake z-codes for enrollment %', p_enrollment_id
      using errcode = '42501';
  end if;

  with norm as (
    select distinct upper(btrim(c)) as code
    from unnest(coalesce(p_z_codes, '{}')) as c
    where upper(btrim(c)) ~ '^Z\d{2}(\.\d+)?$'
  ),
  active as (
    select z.id, z.z_code
    from atlas.z_codes z
    join norm n on n.code = z.z_code
  ),
  ins as (
    insert into atlas.enrollee_z_codes (enrollment_id, z_code_id, is_resolved, resolution_at, source, ended_at)
    select p_enrollment_id, a.id, false, null, coalesce(nullif(p_source, ''), 'demo_ollama_inference'), null
    from active a
    where not exists (
      select 1 from atlas.enrollee_z_codes ez
      where ez.enrollment_id = p_enrollment_id
        and ez.z_code_id = a.id
        and ez.ended_at is null
    )
    returning 1
  )
  select coalesce(array_agg(a.z_code), '{}') into v_applied from active a;

  return v_applied;
end;
$$;

-- Source: 20260530133500_zcode_override_uncheck_log_and_rpc.sql
-- Replaces an enrollment's active Z-code set from a payload; system admin or
-- staff access.
create or replace function atlas.fn_override_enrollee_z_codes(p_enrollment_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_person_id uuid := atlas.fn_current_person_id();
  v_checked text[];
  v_unknown text[];
  v_missing_reason text[];
  v_now timestamptz := now();
begin
  if p_enrollment_id is null then
    raise exception 'enrollment_id is required' using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(p_enrollment_id)) then
    raise exception 'not authorized to override z-codes for enrollment %', p_enrollment_id
      using errcode = '42501';
  end if;

  -- Normalize checked codes from the payload (format-checked, uppercased,
  -- de-duplicated). Codes that do not exist in the catalog fail loudly rather
  -- than being silently dropped, per the app's fail-loud contract.
  select coalesce(array_agg(distinct code), '{}') into v_checked
  from (
    select upper(btrim(value #>> '{}')) as code
    from jsonb_array_elements(coalesce(p_payload -> 'checkedZCodes', '[]'::jsonb)) as value
  ) raw
  where code ~ '^Z\d{2}(\.\d+)?$';

  select coalesce(array_agg(c.code order by c.code), '{}') into v_unknown
  from unnest(v_checked) as c(code)
  where not exists (select 1 from atlas.z_codes z where z.z_code = c.code);

  if array_length(v_unknown, 1) is not null then
    raise exception 'unknown z-codes in override payload: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  -- Reasons are keyed by z-code. Every code being unchecked (active now but
  -- absent from the checked set) must carry a valid reason before anything is
  -- mutated, so the audit log can never have gaps. The reasons are parsed
  -- inline (not via a temp table) so the function stays safe to call multiple
  -- times inside a single transaction.
  with reasons as (
    select
      upper(btrim(reason ->> 'zCode')) as z_code,
      lower(btrim(reason ->> 'reasonCode')) as reason_code,
      nullif(btrim(reason ->> 'reasonText'), '') as reason_text
    from jsonb_array_elements(coalesce(p_payload -> 'uncheckReasons', '[]'::jsonb)) as reason
  )
  select coalesce(array_agg(active.z_code order by active.z_code), '{}') into v_missing_reason
  from (
    select z.z_code
    from atlas.enrollee_z_codes ez
    join atlas.z_codes z on z.id = ez.z_code_id
    where ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
      and z.z_code <> all (v_checked)
  ) active
  where not exists (
    select 1
    from reasons r
    where r.z_code = active.z_code
      and r.reason_code in ('restarting_readiness', 'entry_error', 'other')
      and (r.reason_code <> 'other' or r.reason_text is not null)
  );

  if array_length(v_missing_reason, 1) is not null then
    raise exception 'uncheck reason required for z-codes: %', array_to_string(v_missing_reason, ', ')
      using errcode = '22023';
  end if;

  -- Step 1: end (never delete) active rows that were unchecked, logging each
  -- removal. ended_at keeps resolution history intact for reporting.
  with reasons as (
    select
      upper(btrim(reason ->> 'zCode')) as z_code,
      lower(btrim(reason ->> 'reasonCode')) as reason_code,
      nullif(btrim(reason ->> 'reasonText'), '') as reason_text
    from jsonb_array_elements(coalesce(p_payload -> 'uncheckReasons', '[]'::jsonb)) as reason
  ),
  ended as (
    update atlas.enrollee_z_codes ez
    set ended_at = v_now
    from atlas.z_codes z
    where z.id = ez.z_code_id
      and ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
      and z.z_code <> all (v_checked)
    returning ez.id as enrollee_z_code_id, ez.z_code_id, z.z_code
  )
  insert into atlas.enrollee_z_code_uncheck_log (
    enrollment_id, enrollee_z_code_id, z_code_id, z_code,
    reason_code, reason_text, removed_by_auth_user_id, removed_by_person_id
  )
  select
    p_enrollment_id, ended.enrollee_z_code_id, ended.z_code_id, ended.z_code,
    r.reason_code, r.reason_text, auth.uid(), v_person_id
  from ended
  join reasons r on r.z_code = ended.z_code;

  -- Step 2: insert active rows for newly checked codes. Codes that already
  -- have an active row are left untouched so resolution state survives saves.
  insert into atlas.enrollee_z_codes (enrollment_id, z_code_id, is_resolved, resolution_at, source, ended_at)
  select p_enrollment_id, z.id, false, null, 'navigator_override', null
  from atlas.z_codes z
  where z.z_code = any (v_checked)
    and not exists (
      select 1 from atlas.enrollee_z_codes ez
      where ez.enrollment_id = p_enrollment_id
        and ez.z_code_id = z.id
        and ez.ended_at is null
    );

  -- Return the refreshed active set in the same camelCase shape as the
  -- canonical roster view, so the frontend can update state without a refetch.
  return (
    select jsonb_build_object(
      'enrollmentId', p_enrollment_id,
      'zCodeTags', coalesce(jsonb_agg(z.z_code order by z.z_code), '[]'::jsonb),
      'activeZCodeDetails', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'enrolleeZCodeId', ez.id,
            'parentCode', upper('Z' || substring(z.z_code from 2 for 2)),
            'zCode', z.z_code,
            'title', z.title,
            'description', coalesce(z.description, ''),
            'isResolved', ez.is_resolved,
            'resolutionAt', ez.resolution_at,
            'resolutionPartnerId', ez.resolution_partner_id,
            'resolutionPartnerName', rp.organization_name,
            'resolutionNote', ez.resolution_note,
            'codeReviewStatus', ez.code_review_status,
            'confidenceLevel', ez.confidence_level
          )
          order by z.z_code
        ),
        '[]'::jsonb
      )
    )
    from atlas.enrollee_z_codes ez
    join atlas.z_codes z on z.id = ez.z_code_id
    left join atlas.partners rp on rp.id = ez.resolution_partner_id
    where ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
  );
end;
$$;

-- Source: 20260530122000_security_phase3_enrollee_burden_command_rpc.sql
-- Upserts one burden survey submission and its answers; system admin or the
-- respondent with enrollment access.
create or replace function atlas.fn_save_enrollee_burden_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_person uuid := atlas.fn_current_person_id();
  v_draft_key text := coalesce(nullif(payload ->> 'draftKey', ''), gen_random_uuid()::text);
  v_status text := coalesce(nullif(payload ->> 'status', ''), 'draft');
  v_enrollment_id uuid := nullif(payload #>> '{header,enrollmentId}', '')::uuid;
  v_enrollee_id uuid := nullif(payload #>> '{header,enrolleeId}', '')::uuid;
  v_respondent_person_id uuid := nullif(payload #>> '{header,respondentPersonId}', '')::uuid;
  v_completed_at timestamptz := case
    when v_status = 'completed'
      then coalesce(nullif(payload ->> 'completedAtIso', '')::timestamptz, now())
    else null
  end;
  v_submission_id uuid;
begin
  if v_enrollment_id is null or v_enrollee_id is null then
    raise exception 'enrollment_id and enrollee_id are required' using errcode = '22023';
  end if;

  if not (
    v_is_admin
    or (
      atlas.fn_can_access_enrollment_as_staff(v_enrollment_id)
      and (v_respondent_person_id is null or v_respondent_person_id = v_person)
    )
  ) then
    raise exception 'not authorized to submit burden survey for enrollment %', v_enrollment_id
      using errcode = '42501';
  end if;

  insert into atlas.enrollee_burden_survey_submissions as s (
    draft_key, status, completed_at, enrollee_id, enrollment_id, enrollee_name,
    enrollee_case_id, respondent_person_id, respondent_name, respondent_role,
    organization_name, form_version, raw_payload
  ) values (
    v_draft_key, v_status, v_completed_at, v_enrollee_id, v_enrollment_id,
    payload #>> '{header,enrolleeName}', nullif(payload #>> '{header,enrolleeCaseId}', ''),
    coalesce(v_respondent_person_id, v_person), payload #>> '{header,respondentName}',
    payload #>> '{header,respondentRole}', nullif(payload #>> '{header,organizationName}', ''),
    coalesce(nullif(payload ->> 'formVersion', ''), 'v1'), payload
  )
  on conflict (draft_key) do update set
    status = excluded.status,
    completed_at = excluded.completed_at,
    enrollee_id = excluded.enrollee_id,
    enrollment_id = excluded.enrollment_id,
    enrollee_name = excluded.enrollee_name,
    enrollee_case_id = excluded.enrollee_case_id,
    respondent_person_id = excluded.respondent_person_id,
    respondent_name = excluded.respondent_name,
    respondent_role = excluded.respondent_role,
    organization_name = excluded.organization_name,
    form_version = excluded.form_version,
    raw_payload = excluded.raw_payload,
    updated_at = now()
  returning s.id into v_submission_id;

  delete from atlas.enrollee_burden_survey_answers where submission_id = v_submission_id;

  insert into atlas.enrollee_burden_survey_answers (
    submission_id, prompt_id, parent_code, z_code, normalized_z_code, title,
    description, burden_score, not_encountered
  )
  select
    v_submission_id,
    a ->> 'promptId',
    a ->> 'parentCode',
    a ->> 'zCode',
    a ->> 'normalizedZCode',
    a ->> 'title',
    nullif(a ->> 'description', ''),
    case
      when coalesce((a ->> 'notEncountered')::boolean, false) then null
      else nullif(a ->> 'score', '')::smallint
    end,
    coalesce((a ->> 'notEncountered')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_submission_id;
end;
$$;

-- Source: 20260620133900_phase1_regulation_rpc_validation.sql
-- Upserts one regulation-test submission and its answers; system admin or
-- staff with enrollment access.
create or replace function atlas.fn_save_regulation_test_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_draft_key text := coalesce(nullif(payload ->> 'draftKey', ''), 'reg-test-' || gen_random_uuid()::text);
  v_enrollee_id text := nullif(payload ->> 'enrolleeId', '');
  v_enrollment_id uuid := nullif(payload ->> 'enrollmentId', '')::uuid;
  v_test_type text := nullif(payload ->> 'testType', '');
  v_status text := coalesce(nullif(payload ->> 'status', ''), 'draft');
  v_total_score numeric := nullif(payload ->> 'totalScore', '')::numeric;
  v_pass_threshold numeric := coalesce(nullif(payload ->> 'passThreshold', '')::numeric, 0);
  v_passed boolean := case when payload ->> 'passed' is null then null else (payload ->> 'passed')::boolean end;
  v_id uuid;
begin
  if v_enrollee_id is null or v_test_type is null then
    raise exception 'enrolleeId and testType are required' using errcode = '22023';
  end if;

  if v_pass_threshold < 0 then
    raise exception 'passThreshold must be non-negative' using errcode = '22023';
  end if;
  if v_total_score is not null and v_total_score < 0 then
    raise exception 'totalScore must be non-negative' using errcode = '22023';
  end if;
  if v_passed is not null and v_total_score is null then
    raise exception 'passed cannot be provided when totalScore is null' using errcode = '22023';
  end if;
  if v_passed is not null and v_total_score is not null and v_passed <> (v_total_score >= v_pass_threshold) then
    raise exception 'passed does not match totalScore/passThreshold relationship' using errcode = '22023';
  end if;
  if v_status = 'completed' and (v_total_score is null or v_passed is null) then
    raise exception 'completed submissions require totalScore and passed' using errcode = '22023';
  end if;

  if not (
    v_is_admin
    or (v_enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(v_enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = v_enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  ) then
    raise exception 'not authorized to save regulation test for enrollee %', v_enrollee_id
      using errcode = '42501';
  end if;

  insert into atlas.navigator_regulation_test_submissions as s (
    draft_key, enrollee_id, enrollment_id, test_type, status, enrollee_name,
    enrollee_case_id, enrollee_email, total_score, pass_threshold, passed,
    submitted_at, updated_at
  ) values (
    v_draft_key, v_enrollee_id, v_enrollment_id, v_test_type, v_status,
    coalesce(payload ->> 'enrolleeName', ''), coalesce(payload ->> 'enrolleeCaseId', ''),
    coalesce(payload ->> 'enrolleeEmail', ''),
    v_total_score,
    v_pass_threshold,
    v_passed,
    now(), now()
  )
  on conflict (enrollee_id, test_type, draft_key) do update set
    enrollment_id = excluded.enrollment_id,
    status = excluded.status,
    enrollee_name = excluded.enrollee_name,
    enrollee_case_id = excluded.enrollee_case_id,
    enrollee_email = excluded.enrollee_email,
    total_score = excluded.total_score,
    pass_threshold = excluded.pass_threshold,
    passed = excluded.passed,
    updated_at = now()
  returning s.id into v_id;

  delete from atlas.navigator_regulation_test_answers where submission_id = v_id;

  insert into atlas.navigator_regulation_test_answers (
    submission_id, prompt_id, prompt_label, response_value
  )
  select
    v_id,
    a ->> 'promptId',
    coalesce(a ->> 'promptLabel', ''),
    nullif(a ->> 'responseValue', '')::numeric
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_id;
end;
$$;

-- Source: 20260530133000_zcode_readiness_criteria.sql
-- Updates one active enrollee Z-code's review status, confidence, and
-- resolution context; system admin or staff with enrollment access.
create or replace function atlas.fn_set_enrollee_z_code_resolution_context(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid,
  p_resolution_note text,
  p_code_review_status text default null,
  p_confidence_level text default null
)
returns table (
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text,
  code_review_status text,
  confidence_level text
)
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := atlas.fn_is_system_admin();
  v_enrollment_id uuid;
  -- Review status defaults from the legacy boolean so older save paths keep
  -- working; when provided it becomes the source of truth and the boolean is
  -- derived from it ('resolved' <=> is_resolved) so the two never drift.
  v_status text := coalesce(
    nullif(btrim(lower(p_code_review_status)), ''),
    case when p_is_resolved then 'resolved' else 'not_resolved' end
  );
  v_confidence text := nullif(btrim(lower(p_confidence_level)), '');
  v_resolved boolean;
begin
  if v_status not in ('not_resolved', 'partially_resolved', 'resolved') then
    raise exception 'invalid code review status %, expected not_resolved | partially_resolved | resolved', v_status
      using errcode = '22023';
  end if;
  if v_confidence is not null and v_confidence not in ('low', 'medium', 'high') then
    raise exception 'invalid confidence level %, expected low | medium | high', v_confidence
      using errcode = '22023';
  end if;
  v_resolved := (v_status = 'resolved');

  select ez.enrollment_id into v_enrollment_id
  from atlas.enrollee_z_codes ez
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null;

  -- Fail loudly on missing/ended rows instead of silently updating nothing.
  if v_enrollment_id is null then
    raise exception 'active enrollee z-code % not found', p_enrollee_z_code_id
      using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(v_enrollment_id)) then
    raise exception 'not authorized to update z-code resolution for enrollment %', v_enrollment_id
      using errcode = '42501';
  end if;

  return query
  update atlas.enrollee_z_codes ez
  set
    is_resolved = v_resolved,
    code_review_status = v_status,
    -- Confidence applies to whatever the current status is, so it is saved as
    -- provided (null clears) instead of being coupled to resolution state.
    confidence_level = v_confidence,
    resolution_at = case when v_resolved then now() else null end,
    resolution_partner_id = case when v_resolved then p_partner_id else null end,
    resolution_note = case when v_resolved then nullif(btrim(p_resolution_note), '') else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning
    ez.id,
    ez.is_resolved,
    ez.resolution_at,
    ez.resolution_partner_id,
    (
      select p.organization_name
      from atlas.partners p
      where p.id = ez.resolution_partner_id
    ),
    ez.resolution_note,
    ez.code_review_status,
    ez.confidence_level;
end;
$$;

-- Source: 20260530126000_security_phase3_partner_capacity_command_rpc.sql
-- Raises unless the caller is a system admin, then sets or clears the
-- nullification fields on one partner survey answer.
create or replace function atlas.fn_set_partner_survey_answer_nullification(
  p_answer_id uuid,
  p_is_nullified boolean,
  p_nullified_by_email text default null,
  p_nullified_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_row atlas.partner_service_capacity_answers%rowtype;
begin
  -- Raises unless the caller is a system admin.
  if not atlas.fn_is_system_admin() then
    raise exception 'only administrators may nullify survey answers' using errcode = '42501';
  end if;

  update atlas.partner_service_capacity_answers set
    is_nullified = p_is_nullified,
    nullified_at = case when p_is_nullified then now() else null end,
    nullified_by_email = case when p_is_nullified then nullif(btrim(p_nullified_by_email), '') else null end,
    nullified_reason = case when p_is_nullified then nullif(btrim(p_nullified_reason), '') else null end
  where id = p_answer_id
  returning * into v_row;

  if not found then
    raise exception 'answer not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'isNullified', v_row.is_nullified,
    'nullifiedAt', v_row.nullified_at,
    'nullifiedByEmail', v_row.nullified_by_email,
    'nullifiedReason', v_row.nullified_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Policies: administrator claim -> atlas.fn_is_system_admin().
-- ---------------------------------------------------------------------------

-- Source: 20260530133500_zcode_override_uncheck_log_and_rpc.sql
drop policy if exists enrollee_z_code_uncheck_log_staff_select on atlas.enrollee_z_code_uncheck_log;
create policy enrollee_z_code_uncheck_log_staff_select
  on atlas.enrollee_z_code_uncheck_log
  for select
  to authenticated
  using (
    atlas.fn_is_system_admin()
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

-- Source: 20260530124000_security_phase3_navigator_competency_command_rpc.sql
drop policy if exists navigator_competency_assessments_select_scoped on atlas.navigator_competency_assessments;
create policy navigator_competency_assessments_select_scoped on atlas.navigator_competency_assessments
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or supervisor_person_id = atlas.fn_current_person_id()
    or navigator_person_id = atlas.fn_current_person_id()
  );

drop policy if exists navigator_competency_assessment_answers_select_scoped on atlas.navigator_competency_assessment_answers;
create policy navigator_competency_assessment_answers_select_scoped on atlas.navigator_competency_assessment_answers
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.navigator_competency_assessments a
      where a.id = navigator_competency_assessment_answers.assessment_id
        and (
          atlas.fn_is_system_admin()
          or a.supervisor_person_id = atlas.fn_current_person_id()
          or a.navigator_person_id = atlas.fn_current_person_id()
        )
    )
  );

-- Source: 20260530131000_fix_navigator_station_context_contract.sql
drop policy if exists navigator_partner_assignments_select_scoped on atlas.navigator_partner_assignments;
create policy navigator_partner_assignments_select_scoped
  on atlas.navigator_partner_assignments
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or navigator_person_id = atlas.fn_current_person_id()
  );

-- Source: 20260530123000_security_phase3_regulation_tests_command_rpc.sql
drop policy if exists navigator_regulation_test_submissions_select_scoped on atlas.navigator_regulation_test_submissions;
create policy navigator_regulation_test_submissions_select_scoped on atlas.navigator_regulation_test_submissions
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or (enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = navigator_regulation_test_submissions.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  );

drop policy if exists navigator_regulation_test_answers_select_scoped on atlas.navigator_regulation_test_answers;
create policy navigator_regulation_test_answers_select_scoped on atlas.navigator_regulation_test_answers
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.navigator_regulation_test_submissions s
      where s.id = navigator_regulation_test_answers.submission_id
        and (
          atlas.fn_is_system_admin()
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id::text = s.enrollee_id
              and atlas.fn_can_access_enrollment_as_staff(en.id)
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. respondent_role accepts the tier keys next to the legacy literals.
-- ---------------------------------------------------------------------------

alter table atlas.enrollee_burden_survey_submissions
  drop constraint if exists enrollee_burden_survey_submissions_respondent_role_check;

alter table atlas.enrollee_burden_survey_submissions
  add constraint enrollee_burden_survey_submissions_respondent_role_check
  check (respondent_role in ('navigator', 'supervisor', 't2b', 't3a', 't4', 't4plus'));

-- ---------------------------------------------------------------------------
-- 5. Covering indexes for the foreign keys the advisor named.
-- ---------------------------------------------------------------------------

create index if not exists idx_ips_cohort_enrollments_enrolled_by
  on atlas.ips_cohort_enrollments(enrolled_by);
create index if not exists idx_people_competency_cards_card
  on atlas.people_competency_cards(card_id);
create index if not exists idx_people_competency_cards_assessment
  on atlas.people_competency_cards(assessment_id);
create index if not exists idx_people_competency_cards_issued_by
  on atlas.people_competency_cards(issued_by_person_id);
create index if not exists idx_secondments_partner
  on atlas.secondments(partner_id);
create index if not exists idx_tier_designations_granted_by
  on atlas.tier_designations(granted_by);

notify pgrst, 'reload schema';
