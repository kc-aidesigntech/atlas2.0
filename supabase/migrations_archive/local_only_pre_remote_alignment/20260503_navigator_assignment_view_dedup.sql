create or replace view atlas.v_navigator_assigned_enrollees as
select
  na.navigator_person_id,
  en.id as enrollment_id,
  e.id as enrollee_id,
  p.display_name as enrollee_name,
  e.case_id,
  e.current_phase,
  e.avatar_url
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
join lateral (
  select current_assignment.navigator_person_id
  from atlas.navigator_assignments current_assignment
  where current_assignment.enrollment_id = en.id
    and current_assignment.ends_on is null
  order by current_assignment.starts_on desc, current_assignment.id desc
  limit 1
) na on true
where en.status = 'active';

create or replace view atlas.v_singlepane_enrollee_profiles as
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
)
select
  e.id as enrollee_id,
  en.id as enrollment_id,
  p.display_name as full_name,
  coalesce(e.dob::text, '') as dob,
  coalesce(e.case_id, '') as case_id,
  coalesce(p.email, '') as email,
  e.avatar_url,
  coalesce(nav.display_name, 'unassigned') as assigned_navigator,
  coalesce(az.z_code_tags, '{}') as z_code_tags,
  en.start_date::text as enrollment_start_iso,
  en.target_duration_months,
  e.current_phase,
  coalesce(az.active_z_code_details, '[]'::jsonb) as active_z_code_details,
  coalesce(cp.completed_parent_codes, '{}') as completed_parent_codes
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join lateral (
  select current_assignment.navigator_person_id
  from atlas.navigator_assignments current_assignment
  where current_assignment.enrollment_id = en.id
    and current_assignment.ends_on is null
  order by current_assignment.starts_on desc, current_assignment.id desc
  limit 1
) na on true
left join atlas.people nav on nav.id = na.navigator_person_id
left join active_z_codes az on az.enrollment_id = en.id
left join completed_parents cp on cp.enrollment_id = en.id
where en.status = 'active';

grant select on atlas.v_navigator_assigned_enrollees to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_profiles to anon, authenticated;

notify pgrst, 'reload schema';
