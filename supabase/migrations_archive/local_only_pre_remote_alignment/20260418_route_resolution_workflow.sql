create or replace function atlas.fn_set_enrollee_z_code_resolution(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz
)
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  return query
  update atlas.enrollee_z_codes ez
  set
    is_resolved = p_is_resolved,
    resolution_at = case when p_is_resolved then now() else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning ez.id, ez.is_resolved, ez.resolution_at;
end;
$$;

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
        'resolutionAt', ez.resolution_at
      )
      order by z.z_code
    ) as active_z_code_details
  from atlas.enrollee_z_codes ez
  join atlas.z_codes z on z.id = ez.z_code_id
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
left join atlas.navigator_assignments na on na.enrollment_id = en.id and na.ends_on is null
left join atlas.people nav on nav.id = na.navigator_person_id
left join active_z_codes az on az.enrollment_id = en.id
left join completed_parents cp on cp.enrollment_id = en.id
where en.status = 'active';

grant execute on function atlas.fn_set_enrollee_z_code_resolution(uuid, boolean) to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_profiles to anon, authenticated;
