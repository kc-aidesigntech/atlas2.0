-- System-administrator fast path: every object that tested the JSON Web Token
-- (JWT) claim app_metadata.atlas_role = 'administrator' (or an assigned
-- role_key = 'administrator') now calls atlas.fn_is_system_admin(), defined in
-- 20261104190000_tier_roles.sql. Each definition below is the latest one from
-- the earlier migrations with only the admin predicate swapped; every other
-- predicate is unchanged. Row-Level Security (RLS) policies are dropped and
-- re-created; functions and views use create or replace.
--
-- Checklist (rewritten here):
--   Functions
--     [x] atlas.fn_has_permission(text)                       (from 20260411041933)
--     [x] atlas.fn_require_admin_claim()                      (from 20260503175511)
--     [x] atlas.fn_access_matrix_save_person_roles(uuid,text[]) (from 20260503175511;
--         primary role = highest atlas.fn_tier_rank)
--     [x] atlas.fn_can_access_enrollment_as_staff(uuid)       (from 20260530130000)
--     [x] atlas.fn_list_active_enrollment_roster()            (from 20260720034500)
--     [x] atlas.fn_list_active_enrollment_roster(uuid[])      (from 20261004040625;
--         delegates to the zero-argument function, re-created unchanged)
--     [x] atlas.fn_workspace_record_revisions()               (from 20261004040625)
--     [x] atlas.fn_can_manage_prayphone_fleet()               (from 20261004223000;
--         supervisor -> t4, t4plus)
--   Views
--     [x] atlas.v_active_enrollment_roster                    (from 20260720034500;
--         thin wrapper, re-created unchanged)
--     [x] atlas.v_dw_rls_principal_scope                      (from 20260504002000;
--         staff set = the seven tier keys, partner set = t4plus + partner)
--   Policies (drop + create; source migration in parentheses)
--     [x] people_admin_all, enrollees_admin_all, enrollments_admin_all,
--         partner_stations_admin_all, journey_logs_admin_all           (20260413030025)
--     [x] profile_images_admin_all, storage_profile_images_admin_insert /
--         _update / _delete                                            (20260413030101)
--     [x] profile_images_authenticated_select/insert/update/delete_scoped,
--         enrollee_burden_submissions_select/insert/update/delete_scoped (20260504012000)
--     [x] demo_access_events_select_admin                              (20260504013000)
--     [x] enrollee_z_codes_staff_select                                (20260530120000;
--         enrollee_z_codes_staff_insert was dropped in 20260530125000, not re-created)
--     [x] app_role_navigation_admin_write                              (20260530121000)
--     [x] navigator_assignments_select_scoped,
--         supervisor_navigator_assignments_select_scoped               (20260530127000)
--     [x] assessment_submissions_select_scoped, assessment_answers_select_scoped,
--         assessment_participants_select_scoped                        (20260530129000)
--     [x] app_config_documents_admin_write                             (20260620133800)
--     [x] partner_service_capacity_deletion_log_admin_select           (20260628125500)
--     [x] user_permission_exceptions_admin_select, authorization_settings_admin_select,
--         timeline_settings_admin_all, enrollment_requests_admin_all, referrals_admin_all,
--         route_plans_admin_all, route_plan_stops_admin_all, audit_events_admin_select
--                                                                      (20260804170000)
--   Left alone (no admin literal, or owned by a later plan item):
--     storage_profile_images_authenticated_read, enrollee_burden_answers_*_scoped,
--     enrollment_requests_staff_select and other navigator/supervisor literals (item 5).
--
-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Returns true for a system admin, then applies deny / allow exceptions and
-- role_permissions for the caller's active assignments.
create or replace function atlas.fn_has_permission(target_permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person uuid;
begin
  if atlas.fn_is_system_admin() then
    return true;
  end if;

  current_person := atlas.fn_current_person_id();

  if current_person is null then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    join atlas.permissions p on p.id = upe.permission_id
    where upe.person_id = current_person
      and p.permission_key = target_permission_key
      and upe.effect = 'deny'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    join atlas.permissions p on p.id = upe.permission_id
    where upe.person_id = current_person
      and p.permission_key = target_permission_key
      and upe.effect = 'allow'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return true;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.role_permissions rp on rp.role_id = pra.role_id
    join atlas.permissions p on p.id = rp.permission_id
    where pra.person_id = current_person
      and p.permission_key = target_permission_key
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

-- Raises 42501 unless the caller is a system admin.
create or replace function atlas.fn_require_admin_claim()
returns void
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_is_system_admin() then
    raise exception 'administrator role required'
      using errcode = '42501';
  end if;
end;
$$;

-- Replaces a person's active role assignments with target_role_keys and marks
-- the highest-ranked tier key (atlas.fn_tier_rank) as primary; when no key is a
-- tier key, the alphabetically first key is primary.
create or replace function atlas.fn_access_matrix_save_person_roles(
  target_person_id uuid,
  target_role_keys text[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_keys text[] := coalesce(target_role_keys, '{}'::text[]);
  next_role_ids uuid[] := '{}'::uuid[];
  primary_role_id uuid;
begin
  perform atlas.fn_require_admin_claim();

  -- Legacy literals in the request map to their tier keys before lookup.
  select coalesce(array_agg(distinct atlas.fn_normalize_role_key(k.role_key)), '{}'::text[])
  into normalized_keys
  from unnest(normalized_keys) as k(role_key);

  select coalesce(array_agg(r.id), '{}'::uuid[])
  into next_role_ids
  from atlas.roles r
  where r.role_key = any(normalized_keys);

  update atlas.people_role_assignments pra
  set ends_on = current_date, is_primary = false
  where pra.person_id = target_person_id
    and pra.ends_on is null
    and (
      array_length(next_role_ids, 1) is null
      or not (pra.role_id = any(next_role_ids))
    );

  -- Inserts an open assignment for each requested role the person does not
  -- already hold open. The unnest alias is qualified so the subquery compares
  -- pra.role_id against the requested role, not against itself.
  insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on, ends_on)
  select gen_random_uuid(), target_person_id, next_role.role_id, false, current_date, null
  from unnest(next_role_ids) as next_role(role_id)
  where not exists (
    select 1
    from atlas.people_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = next_role.role_id
      and pra.ends_on is null
  );

  update atlas.people_role_assignments
  set is_primary = false
  where person_id = target_person_id
    and ends_on is null;

  -- Highest tier rank wins; rank 0 keys (partner, enrollee) sort after tiers
  -- and then alphabetically.
  select r.id
  into primary_role_id
  from atlas.roles r
  where r.role_key = any(normalized_keys)
  order by atlas.fn_tier_rank(r.role_key) desc, r.role_key asc
  limit 1;

  if primary_role_id is not null then
    update atlas.people_role_assignments
    set is_primary = true
    where person_id = target_person_id
      and role_id = primary_role_id
      and ends_on is null;
  end if;
end;
$$;

-- Returns true for a system admin without evaluating the assignment lookups;
-- otherwise true for the assigned navigator or the supervising supervisor.
create or replace function atlas.fn_can_access_enrollment_as_staff(target_enrollment_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'atlas', 'public'
as $function$
  select case
    -- System-admin fast path: full staff access, skip per-row assignment lookups.
    when atlas.fn_is_system_admin() then true
    else exists (
      with current_person as (
        select atlas.fn_current_person_id() as person_id
      )
      select 1
      from current_person cp
      where cp.person_id is not null
        and (
          -- Navigator assignment scope.
          exists (
            select 1
            from atlas.navigator_assignments na
            where na.enrollment_id = target_enrollment_id
              and na.navigator_person_id = cp.person_id
              and na.ends_on is null
          )
          or
          -- Supervisor scope through active navigator edges.
          exists (
            select 1
            from atlas.navigator_assignments na
            join atlas.supervisor_navigator_assignments sna
              on sna.navigator_person_id = na.navigator_person_id
             and sna.ends_on is null
            where na.enrollment_id = target_enrollment_id
              and na.ends_on is null
              and sna.supervisor_person_id = cp.person_id
          )
        )
    )
  end;
$function$;

-- Builds the active roster once; the is_admin CTE now reads fn_is_system_admin().
create or replace function atlas.fn_list_active_enrollment_roster()
returns table (
  enrollment_id uuid,
  enrollment_status text,
  start_date date,
  target_duration_months integer,
  enrollee_id uuid,
  enrollee_person_id uuid,
  enrollee_name text,
  enrollee_email text,
  case_id text,
  current_phase text,
  county_id uuid,
  county_name text,
  dob text,
  avatar_url text,
  navigator_person_ids uuid[],
  navigator_names text[],
  assigned_navigator text,
  z_code_tags text[],
  active_z_code_details jsonb,
  completed_parent_codes text[]
)
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $function$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  ),
  is_admin as (
    select atlas.fn_is_system_admin() as value
  ),
  -- Single set of enrollment ids the caller may see (same branches as the staff helper).
  accessible_enrollments as (
    select en.id as enrollment_id
    from atlas.enrollments en
    cross join is_admin ia
    where en.status = 'active'
      and ia.value

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and na.navigator_person_id = cp.person_id
      and na.ends_on is null

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    join atlas.supervisor_navigator_assignments sna
      on sna.navigator_person_id = na.navigator_person_id
     and sna.ends_on is null
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and sna.supervisor_person_id = cp.person_id
      and na.ends_on is null
  ),
  active_z_codes as (
    select
      ez.enrollment_id,
      array_agg(z.z_code order by z.z_code) as z_code_tags,
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
      ) as active_z_code_details
    from atlas.enrollee_z_codes ez
    join accessible_enrollments ae on ae.enrollment_id = ez.enrollment_id
    join atlas.z_codes z on z.id = ez.z_code_id
    left join atlas.partners rp on rp.id = ez.resolution_partner_id
    where ez.ended_at is null
    group by ez.enrollment_id
  ),
  completed_parents as (
    select
      resolved_by_parent.enrollment_id,
      array_agg(resolved_by_parent.parent_code order by resolved_by_parent.parent_code) as completed_parent_codes
    from (
      select
        ez.enrollment_id,
        upper('Z' || substring(z.z_code from 2 for 2)) as parent_code
      from atlas.enrollee_z_codes ez
      join accessible_enrollments ae on ae.enrollment_id = ez.enrollment_id
      join atlas.z_codes z on z.id = ez.z_code_id
      where ez.ended_at is null
      group by ez.enrollment_id, upper('Z' || substring(z.z_code from 2 for 2))
      having bool_and(coalesce(ez.is_resolved, false))
    ) resolved_by_parent
    group by resolved_by_parent.enrollment_id
  ),
  active_navigators as (
    select
      na.enrollment_id,
      array_agg(distinct na.navigator_person_id) as navigator_person_ids,
      array_agg(distinct nav.display_name order by nav.display_name) as navigator_names
    from atlas.navigator_assignments na
    join accessible_enrollments ae on ae.enrollment_id = na.enrollment_id
    left join atlas.people nav on nav.id = na.navigator_person_id
    where na.ends_on is null
    group by na.enrollment_id
  )
  select
    en.id as enrollment_id,
    en.status as enrollment_status,
    en.start_date,
    en.target_duration_months,
    e.id as enrollee_id,
    p.id as enrollee_person_id,
    p.display_name as enrollee_name,
    coalesce(p.email, '') as enrollee_email,
    e.case_id,
    e.current_phase,
    e.county_id,
    c.county_name,
    coalesce(e.dob::text, '') as dob,
    e.avatar_url,
    coalesce(active_navigators.navigator_person_ids, '{}'::uuid[]) as navigator_person_ids,
    coalesce(active_navigators.navigator_names, '{}'::text[]) as navigator_names,
    coalesce(array_to_string(active_navigators.navigator_names, ', '), 'unassigned') as assigned_navigator,
    coalesce(active_z_codes.z_code_tags, '{}'::text[]) as z_code_tags,
    coalesce(active_z_codes.active_z_code_details, '[]'::jsonb) as active_z_code_details,
    coalesce(completed_parents.completed_parent_codes, '{}'::text[]) as completed_parent_codes
  from atlas.enrollments en
  join accessible_enrollments ae on ae.enrollment_id = en.id
  join atlas.enrollees e on e.id = en.enrollee_id
  join atlas.people p on p.id = e.person_id
  left join atlas.counties c on c.id = e.county_id
  left join active_navigators on active_navigators.enrollment_id = en.id
  left join active_z_codes on active_z_codes.enrollment_id = en.id
  left join completed_parents on completed_parents.enrollment_id = en.id
  where en.status = 'active';
$function$;

revoke all on function atlas.fn_list_active_enrollment_roster() from public;
grant execute on function atlas.fn_list_active_enrollment_roster() to authenticated;

-- Thin wrapper over the zero-argument roster; re-created so the view binds to
-- the definition above.
create or replace view atlas.v_active_enrollment_roster
with (security_invoker = true)
as
select *
from atlas.fn_list_active_enrollment_roster();

grant select on atlas.v_active_enrollment_roster to authenticated;

-- Filters the zero-argument roster to the requested ids; no admin literal of
-- its own, re-created unchanged.
create or replace function atlas.fn_list_active_enrollment_roster(p_enrollment_ids uuid[])
returns table (
  enrollment_id uuid,
  enrollment_status text,
  start_date date,
  target_duration_months integer,
  enrollee_id uuid,
  enrollee_person_id uuid,
  enrollee_name text,
  enrollee_email text,
  case_id text,
  current_phase text,
  county_id uuid,
  county_name text,
  dob text,
  avatar_url text,
  navigator_person_ids uuid[],
  navigator_names text[],
  assigned_navigator text,
  z_code_tags text[],
  active_z_code_details jsonb,
  completed_parent_codes text[]
)
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $function$
  select roster.*
  from atlas.fn_list_active_enrollment_roster() roster
  where roster.enrollment_id = any(p_enrollment_ids);
$function$;

revoke all on function atlas.fn_list_active_enrollment_roster(uuid[]) from public;
grant execute on function atlas.fn_list_active_enrollment_roster(uuid[]) to authenticated;

-- Returns one revision per visible enrollment plus two clocks; the is_admin
-- CTE now reads fn_is_system_admin().
create or replace function atlas.fn_workspace_record_revisions()
returns table (
  dataset text,
  record_id text,
  revision text
)
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $function$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  ),
  is_admin as (
    select atlas.fn_is_system_admin() as value
  ),
  accessible_enrollments as (
    select en.id as enrollment_id
    from atlas.enrollments en
    cross join is_admin ia
    where en.status = 'active'
      and ia.value

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and na.navigator_person_id = cp.person_id
      and na.ends_on is null

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    join atlas.supervisor_navigator_assignments sna
      on sna.navigator_person_id = na.navigator_person_id
     and sna.ends_on is null
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and sna.supervisor_person_id = cp.person_id
      and na.ends_on is null
  ),
  z_code_fingerprints as (
    select
      ez.enrollment_id,
      md5(string_agg(
        concat_ws(
          ':',
          ez.id::text,
          ez.z_code_id::text,
          coalesce(ez.is_resolved, false)::text,
          coalesce(ez.resolution_at::text, ''),
          coalesce(ez.ended_at::text, ''),
          coalesce(ez.effective_at::text, ''),
          coalesce(ez.resolution_note, ''),
          coalesce(ez.code_review_status, ''),
          coalesce(ez.confidence_level::text, '')
        ),
        ',' order by ez.id
      )) as fingerprint
    from atlas.enrollee_z_codes ez
    join accessible_enrollments ae on ae.enrollment_id = ez.enrollment_id
    group by ez.enrollment_id
  ),
  navigator_fingerprints as (
    select
      na.enrollment_id,
      md5(string_agg(
        concat_ws(
          ':',
          na.navigator_person_id::text,
          coalesce(na.starts_on::text, ''),
          coalesce(na.ends_on::text, '')
        ),
        ',' order by na.navigator_person_id
      )) as fingerprint
    from atlas.navigator_assignments na
    join accessible_enrollments ae on ae.enrollment_id = na.enrollment_id
    group by na.enrollment_id
  )
  select
    'enrollment'::text as dataset,
    en.id::text as record_id,
    md5(concat_ws(
      '|',
      coalesce(en.status, ''),
      coalesce(en.start_date::text, ''),
      coalesce(en.target_duration_months::text, ''),
      coalesce(e.current_phase, ''),
      coalesce(e.case_id, ''),
      coalesce(e.dob::text, ''),
      coalesce(e.avatar_url, ''),
      coalesce(e.updated_at::text, ''),
      coalesce(p.display_name, ''),
      coalesce(p.email, ''),
      coalesce(p.updated_at::text, ''),
      coalesce(z_code_fingerprints.fingerprint, ''),
      coalesce(navigator_fingerprints.fingerprint, '')
    )) as revision
  from atlas.enrollments en
  join accessible_enrollments ae on ae.enrollment_id = en.id
  join atlas.enrollees e on e.id = en.enrollee_id
  join atlas.people p on p.id = e.person_id
  left join z_code_fingerprints on z_code_fingerprints.enrollment_id = en.id
  left join navigator_fingerprints on navigator_fingerprints.enrollment_id = en.id
  where en.status = 'active'

  union all

  select
    'role_navigation'::text,
    'singlepane'::text,
    coalesce(max(updated_at)::text, '')
  from atlas.app_role_navigation
  where surface = 'singlepane'

  union all

  select
    'app_config'::text,
    'singlepane'::text,
    coalesce(max(updated_at)::text, '')
  from atlas.app_config_documents
  where surface = 'singlepane';
$function$;

revoke all on function atlas.fn_workspace_record_revisions() from public;
grant execute on function atlas.fn_workspace_record_revisions() to authenticated;

-- Returns true for a system admin, then for a t4 / t4plus claim, then for an
-- active t4 / t4plus assignment (the former supervisor literal).
create or replace function atlas.fn_can_manage_prayphone_fleet()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person uuid;
  role_claim text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if atlas.fn_is_system_admin() then
    return true;
  end if;

  -- Normalized JWT claim fast path for the supervisor tiers.
  role_claim := atlas.fn_normalize_role_key(coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', ''));
  if role_claim in ('t4', 't4plus') then
    return true;
  end if;

  current_person := atlas.fn_current_person_id();
  if current_person is null then
    return false;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person
      and r.role_key in ('t4', 't4plus')
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

comment on function atlas.fn_can_manage_prayphone_fleet() is
  'True for a system admin or an active t4 / t4plus (Supervisor / Coordinator). Navigators who can sit the warm line still cannot open fleet settings.';

revoke all on function atlas.fn_can_manage_prayphone_fleet() from public;
grant execute on function atlas.fn_can_manage_prayphone_fleet() to authenticated;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Maps each principal to county / partner scope for Business Intelligence (BI)
-- row filters. The county branch keeps every tier key; the partner branch keeps
-- t4plus and partner. Role keys are normalized so a legacy literal still lands
-- in its tier branch.
create or replace view atlas.v_dw_rls_principal_scope
with (security_invoker = true)
as
with principal_roles as (
  select
    p.id as person_id,
    lower(coalesce(p.email, '')) as principal_email,
    atlas.fn_normalize_role_key(pra.role_key) as role_key
  from atlas.people p
  join atlas.v_dw_dim_person_role_active pra on pra.person_id = p.id
),
county_scope as (
  select
    pr.person_id,
    pr.principal_email,
    pr.role_key,
    roster.county_id,
    null::uuid as partner_id
  from principal_roles pr
  left join atlas.v_active_navigator_assignment_edges edges on edges.navigator_person_id = pr.person_id
  left join atlas.v_active_enrollment_roster roster on roster.enrollment_id = edges.enrollment_id
  where pr.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
),
partner_scope as (
  select
    pr.person_id,
    pr.principal_email,
    pr.role_key,
    null::uuid as county_id,
    pce.partner_id
  from principal_roles pr
  join atlas.v_active_partner_contact_edges pce on pce.contact_person_id = pr.person_id
  where pr.role_key in ('t4plus', 'partner')
)
select distinct
  scoped.person_id,
  scoped.principal_email,
  scoped.role_key,
  scoped.county_id,
  scoped.partner_id
from (
  select * from county_scope
  union all
  select * from partner_scope
) scoped;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Core domain admin policies (from 20260413030025_make_app_alive.sql).
drop policy if exists people_admin_all on atlas.people;
create policy people_admin_all on atlas.people
for all
using (atlas.fn_is_system_admin());

drop policy if exists enrollees_admin_all on atlas.enrollees;
create policy enrollees_admin_all on atlas.enrollees
for all
using (atlas.fn_is_system_admin());

drop policy if exists enrollments_admin_all on atlas.enrollments;
create policy enrollments_admin_all on atlas.enrollments
for all
using (atlas.fn_is_system_admin());

drop policy if exists partner_stations_admin_all on atlas.partner_stations;
create policy partner_stations_admin_all on atlas.partner_stations
for all
using (atlas.fn_is_system_admin());

drop policy if exists journey_logs_admin_all on atlas.journey_logs;
create policy journey_logs_admin_all on atlas.journey_logs
for all
using (atlas.fn_is_system_admin());

-- Profile image table and storage admin policies (from 20260413030101_profile_images.sql).
drop policy if exists profile_images_admin_all on atlas.profile_images;
create policy profile_images_admin_all on atlas.profile_images
for all
using (atlas.fn_is_system_admin());

drop policy if exists storage_profile_images_admin_insert on storage.objects;
create policy storage_profile_images_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and atlas.fn_is_system_admin()
);

drop policy if exists storage_profile_images_admin_update on storage.objects;
create policy storage_profile_images_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-images'
  and atlas.fn_is_system_admin()
)
with check (
  bucket_id = 'profile-images'
  and atlas.fn_is_system_admin()
);

drop policy if exists storage_profile_images_admin_delete on storage.objects;
create policy storage_profile_images_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-images'
  and atlas.fn_is_system_admin()
);

-- Profile image scoped policies (from 20260504012000_launch_rls_scope_tightening.sql);
-- the admin term in each OR chain now calls fn_is_system_admin().
drop policy if exists profile_images_authenticated_select_scoped on atlas.profile_images;
create policy profile_images_authenticated_select_scoped
on atlas.profile_images
for select
to authenticated
using (
  atlas.fn_is_system_admin()
  or exists (
    select 1
    from atlas.enrollees e
    where e.id = profile_images.enrollee_id
      and e.person_id = atlas.fn_current_person_id()
  )
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
);

drop policy if exists profile_images_authenticated_insert_scoped on atlas.profile_images;
create policy profile_images_authenticated_insert_scoped
on atlas.profile_images
for insert
to authenticated
with check (
  storage_bucket = 'profile-images'
  and (
    atlas.fn_is_system_admin()
    or exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = profile_images.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  )
);

drop policy if exists profile_images_authenticated_update_scoped on atlas.profile_images;
create policy profile_images_authenticated_update_scoped
on atlas.profile_images
for update
to authenticated
using (
  atlas.fn_is_system_admin()
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
)
with check (
  storage_bucket = 'profile-images'
  and (
    atlas.fn_is_system_admin()
    or exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = profile_images.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  )
);

drop policy if exists profile_images_authenticated_delete_scoped on atlas.profile_images;
create policy profile_images_authenticated_delete_scoped
on atlas.profile_images
for delete
to authenticated
using (
  atlas.fn_is_system_admin()
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
);

-- Enrollee burden survey submission policies (from 20260504012000_launch_rls_scope_tightening.sql).
-- The *_answers_* policies on that table call fn_can_manage_enrollee_burden_submission
-- and carry no admin literal, so they are not touched here.
drop policy if exists enrollee_burden_submissions_select_scoped on atlas.enrollee_burden_survey_submissions;
create policy enrollee_burden_submissions_select_scoped
on atlas.enrollee_burden_survey_submissions
for select
to authenticated
using (
  atlas.fn_is_system_admin()
  or respondent_person_id = atlas.fn_current_person_id()
  or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
);

drop policy if exists enrollee_burden_submissions_insert_scoped on atlas.enrollee_burden_survey_submissions;
create policy enrollee_burden_submissions_insert_scoped
on atlas.enrollee_burden_survey_submissions
for insert
to authenticated
with check (
  atlas.fn_is_system_admin()
  or (
    respondent_person_id = atlas.fn_current_person_id()
    and atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  )
);

drop policy if exists enrollee_burden_submissions_update_scoped on atlas.enrollee_burden_survey_submissions;
create policy enrollee_burden_submissions_update_scoped
on atlas.enrollee_burden_survey_submissions
for update
to authenticated
using (
  atlas.fn_is_system_admin()
  or respondent_person_id = atlas.fn_current_person_id()
)
with check (
  atlas.fn_is_system_admin()
  or (
    respondent_person_id = atlas.fn_current_person_id()
    and atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  )
);

drop policy if exists enrollee_burden_submissions_delete_scoped on atlas.enrollee_burden_survey_submissions;
create policy enrollee_burden_submissions_delete_scoped
on atlas.enrollee_burden_survey_submissions
for delete
to authenticated
using (
  atlas.fn_is_system_admin()
  or respondent_person_id = atlas.fn_current_person_id()
);

-- Demo access event admin read (from 20260504013000_launch_intake_durability_and_audit.sql).
drop policy if exists demo_access_events_select_admin on atlas.demo_access_events;
create policy demo_access_events_select_admin
on atlas.demo_access_events
for select
to authenticated
using (atlas.fn_is_system_admin());

-- Enrollee Z-code staff read (from 20260530120000_security_phase1_core_domain_scope.sql).
-- enrollee_z_codes_staff_insert was dropped in 20260530125000 (RPC-only writes) and
-- is not re-created here.
drop policy if exists enrollee_z_codes_staff_select on atlas.enrollee_z_codes;
create policy enrollee_z_codes_staff_select on atlas.enrollee_z_codes
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

-- Role navigation admin write (from 20260530121000_security_phase2_close_anon_exposure.sql).
drop policy if exists app_role_navigation_admin_write on atlas.app_role_navigation;
create policy app_role_navigation_admin_write on atlas.app_role_navigation
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

-- Assignment read policies (from 20260530127000_security_phase3_assignment_read_rls.sql).
drop policy if exists navigator_assignments_select_scoped on atlas.navigator_assignments;
create policy navigator_assignments_select_scoped on atlas.navigator_assignments
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or navigator_person_id = atlas.fn_current_person_id()
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

drop policy if exists supervisor_navigator_assignments_select_scoped on atlas.supervisor_navigator_assignments;
create policy supervisor_navigator_assignments_select_scoped on atlas.supervisor_navigator_assignments
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or supervisor_person_id = atlas.fn_current_person_id()
    or navigator_person_id = atlas.fn_current_person_id()
  );

-- Assessment read policies (from 20260530129000_security_phase6_definer_view_and_table_rls.sql).
drop policy if exists assessment_submissions_select_scoped on atlas.assessment_submissions;
create policy assessment_submissions_select_scoped on atlas.assessment_submissions
  for select to authenticated
  using (
    atlas.fn_is_system_admin()
    or (enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(enrollment_id))
    or (
      enrollment_id is null and enrollee_id is not null and exists (
        select 1 from atlas.enrollments en
        where en.enrollee_id = assessment_submissions.enrollee_id
          and atlas.fn_can_access_enrollment_as_staff(en.id)
      )
    )
  );

drop policy if exists assessment_answers_select_scoped on atlas.assessment_answers;
create policy assessment_answers_select_scoped on atlas.assessment_answers
  for select to authenticated
  using (
    exists (
      select 1 from atlas.assessment_submissions s
      where s.id = assessment_answers.assessment_submission_id
        and (
          atlas.fn_is_system_admin()
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or (s.enrollment_id is null and s.enrollee_id is not null and exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id = s.enrollee_id and atlas.fn_can_access_enrollment_as_staff(en.id)
          ))
        )
    )
  );

drop policy if exists assessment_participants_select_scoped on atlas.assessment_participants;
create policy assessment_participants_select_scoped on atlas.assessment_participants
  for select to authenticated
  using (
    exists (
      select 1 from atlas.assessment_submissions s
      where s.id = assessment_participants.assessment_submission_id
        and (
          atlas.fn_is_system_admin()
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or (s.enrollment_id is null and s.enrollee_id is not null and exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id = s.enrollee_id and atlas.fn_can_access_enrollment_as_staff(en.id)
          ))
        )
    )
  );

-- Config document admin write (from 20260620133800_phase1_continuity_policy_hardening.sql).
drop policy if exists app_config_documents_admin_write on atlas.app_config_documents;
create policy app_config_documents_admin_write
  on atlas.app_config_documents
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

-- Partner capacity deletion log admin read (from 20260628125500_admin_service_capacity_submission_deletion_logging.sql).
drop policy if exists partner_service_capacity_deletion_log_admin_select on atlas.partner_service_capacity_deletion_log;
create policy partner_service_capacity_deletion_log_admin_select
on atlas.partner_service_capacity_deletion_log
for select
to authenticated
using (atlas.fn_is_system_admin());

-- Phase 2 / Phase 3 admin policies (from 20260804170000_db_rls_phase2_phase3_remaining_tables.sql).
drop policy if exists user_permission_exceptions_admin_select on atlas.user_permission_exceptions;
create policy user_permission_exceptions_admin_select
  on atlas.user_permission_exceptions
  for select
  to authenticated
  using (atlas.fn_is_system_admin());

drop policy if exists authorization_settings_admin_select on atlas.authorization_settings;
create policy authorization_settings_admin_select
  on atlas.authorization_settings
  for select
  to authenticated
  using (atlas.fn_is_system_admin());

drop policy if exists timeline_settings_admin_all on atlas.timeline_settings;
create policy timeline_settings_admin_all
  on atlas.timeline_settings
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists enrollment_requests_admin_all on atlas.enrollment_requests;
create policy enrollment_requests_admin_all
  on atlas.enrollment_requests
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists referrals_admin_all on atlas.referrals;
create policy referrals_admin_all
  on atlas.referrals
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists route_plans_admin_all on atlas.route_plans;
create policy route_plans_admin_all
  on atlas.route_plans
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists route_plan_stops_admin_all on atlas.route_plan_stops;
create policy route_plan_stops_admin_all
  on atlas.route_plan_stops
  for all
  to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists audit_events_admin_select on atlas.audit_events;
create policy audit_events_admin_select
  on atlas.audit_events
  for select
  to authenticated
  using (atlas.fn_is_system_admin());
