-- Phase 2 canonical read cutover support:
-- - enrich canonical views with full UI-facing enrollee fields
-- - keep view names stable and non-breaking for repository cutover

create or replace view atlas.v_active_navigator_assignment_edges
with (security_invoker = true)
as
select
  na.enrollment_id,
  en.enrollee_id,
  na.navigator_person_id,
  nav.display_name as navigator_name,
  na.station_id,
  ps.station_name,
  ps.partner_id,
  part.organization_name as partner_name,
  e.county_id,
  c.county_name,
  na.starts_on,
  p.display_name as enrollee_name,
  e.case_id,
  e.current_phase,
  e.avatar_url
from atlas.navigator_assignments na
join atlas.enrollments en on en.id = na.enrollment_id
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join atlas.people nav on nav.id = na.navigator_person_id
left join atlas.partner_stations ps on ps.id = na.station_id
left join atlas.partners part on part.id = ps.partner_id
left join atlas.counties c on c.id = e.county_id
where na.ends_on is null
  and en.status = 'active';
create or replace view atlas.v_active_enrollment_roster
with (security_invoker = true)
as
with active_z_codes as (
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
        'resolutionNote', ez.resolution_note
      )
      order by z.z_code
    ) as active_z_code_details
  from atlas.enrollee_z_codes ez
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
    join atlas.z_codes z on z.id = ez.z_code_id
    where ez.ended_at is null
    group by ez.enrollment_id, upper('Z' || substring(z.z_code from 2 for 2))
    having bool_and(coalesce(ez.is_resolved, false))
  ) resolved_by_parent
  group by resolved_by_parent.enrollment_id
),
active_navigators as (
  select
    edges.enrollment_id,
    array_agg(distinct edges.navigator_person_id) as navigator_person_ids,
    array_agg(distinct edges.navigator_name order by edges.navigator_name) as navigator_names
  from atlas.v_active_navigator_assignment_edges edges
  group by edges.enrollment_id
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
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join atlas.counties c on c.id = e.county_id
left join active_navigators on active_navigators.enrollment_id = en.id
left join active_z_codes on active_z_codes.enrollment_id = en.id
left join completed_parents on completed_parents.enrollment_id = en.id
where en.status = 'active';
create or replace view atlas.v_enrollment_assignment_board
with (security_invoker = true)
as
select
  roster.enrollment_id,
  roster.enrollee_id,
  roster.enrollee_name,
  roster.case_id,
  roster.current_phase,
  roster.county_id,
  roster.county_name,
  roster.navigator_person_ids,
  roster.navigator_names,
  roster.assigned_navigator as assigned_navigator_label
from atlas.v_active_enrollment_roster roster;
notify pgrst, 'reload schema';
