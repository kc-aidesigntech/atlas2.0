-- Performance: set-scoped SECURITY DEFINER roster for bootstrap.
--
-- Context: `atlas.v_active_enrollment_roster` is `security_invoker = true`, so every
-- join/CTE row evaluates base-table Row-Level Security (RLS). Policies on
-- enrollments / enrollees / people / enrollee_z_codes / navigator_assignments each
-- call `atlas.fn_can_access_enrollment_as_staff`, which multiplies into an
-- O(people × enrollments × helpers) plan. Under authenticated sessions that blows
-- past the role `statement_timeout` (Postgres 57014) and PostgREST returns HTTP 500
-- on `/rest/v1/v_active_enrollment_roster` — the single-pane bootstrap failure
-- signature. The administrator CASE short-circuit in
-- `20260530130000_perf_enrollment_access_admin_fastpath` helped admins but did not
-- remove the nested per-row policy evaluation for navigator/supervisor (or for
-- concurrent role-prefetch storms).
--
-- Fix: compute the roster once inside a STABLE SECURITY DEFINER function that
-- bypasses nested invoker RLS, then apply staff scope with a set-based filter that
-- matches `fn_can_access_enrollment_as_staff` semantics (administrator / assigned
-- navigator / supervising supervisor). The public view becomes a thin wrapper so
-- existing PostgREST clients keep the same path and column contract.

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
    select coalesce(((auth.jwt() -> 'app_metadata') ->> 'atlas_role'), '') = 'administrator' as value
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

-- Thin wrapper keeps the existing PostgREST resource path and column names.
-- security_invoker remains true so callers still need SELECT on the view; the
-- expensive base-table RLS fan-out no longer runs because the body is a definer RPC.
create or replace view atlas.v_active_enrollment_roster
with (security_invoker = true)
as
select *
from atlas.fn_list_active_enrollment_roster();

grant select on atlas.v_active_enrollment_roster to authenticated;
