alter table atlas.enrollee_z_codes
  add column if not exists resolution_partner_name text;

update atlas.enrollee_z_codes ez
set resolution_partner_name = coalesce(ez.resolution_partner_name, p.organization_name)
from atlas.partners p
where ez.resolution_partner_id = p.id
  and ez.resolution_partner_name is null;

drop function if exists atlas.fn_set_enrollee_z_code_resolution(uuid, boolean, uuid, text);

create or replace function atlas.fn_set_enrollee_z_code_resolution(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid default null,
  p_partner_name text default null,
  p_resolution_note text default null
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text
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
    resolution_at = case when p_is_resolved then now() else null end,
    resolution_partner_id = case when p_is_resolved then p_partner_id else null end,
    resolution_partner_name = case when p_is_resolved then nullif(btrim(p_partner_name), '') else null end,
    resolution_note = case when p_is_resolved then nullif(btrim(p_resolution_note), '') else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning
    ez.id,
    ez.is_resolved,
    ez.resolution_at,
    ez.resolution_partner_id,
    coalesce(
      ez.resolution_partner_name,
      (
        select p.organization_name
        from atlas.partners p
        where p.id = ez.resolution_partner_id
      )
    ),
    ez.resolution_note;
end;
$$;

create or replace view atlas.v_singlepane_enrollee_profiles as
with zcode_tags as (
  select
    en.id as enrollment_id,
    array_agg(distinct upper(z.z_code) order by upper(z.z_code)) as z_code_tags
  from atlas.enrollments en
  join atlas.enrollee_z_codes ez on ez.enrollment_id = en.id and ez.ended_at is null
  join atlas.z_codes z on z.id = ez.z_code_id
  where en.status = 'active'
  group by en.id
),
active_zcode_details as (
  select
    ez.enrollment_id,
    jsonb_agg(
      jsonb_build_object(
        'enrolleeZCodeId', ez.id,
        'parentCode', upper('Z' || substring(z.z_code from 2 for 2)),
        'zCode', upper(z.z_code),
        'title', z.title,
        'description', coalesce(z.description, ''),
        'isResolved', ez.is_resolved,
        'resolutionAt', ez.resolution_at,
        'resolutionPartnerId', ez.resolution_partner_id,
        'resolutionPartnerName', coalesce(ez.resolution_partner_name, rp.organization_name),
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
  to_char(p.date_of_birth, 'YYYY-MM-DD') as dob,
  en.case_id,
  u.email,
  pi.public_url as avatar_url,
  coalesce(nav.display_name, '') as assigned_navigator,
  coalesce(zt.z_code_tags, '{}'::text[]) as z_code_tags,
  coalesce(az.active_z_code_details, '[]'::jsonb) as active_z_code_details,
  coalesce(cp.completed_parent_codes, '{}'::text[]) as completed_parent_codes,
  coalesce(en.start_date, en.created_at)::date::text as enrollment_start_iso,
  9 as target_duration_months,
  'regulation'::text as current_phase
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join auth.users u on u.id = p.user_id
left join atlas.navigator_assignments na on na.enrollment_id = en.id and na.ended_at is null
left join atlas.people nav on nav.id = na.navigator_person_id
left join atlas.profile_images pi on pi.person_id = p.id and pi.is_primary = true
left join zcode_tags zt on zt.enrollment_id = en.id
left join active_zcode_details az on az.enrollment_id = en.id
left join completed_parents cp on cp.enrollment_id = en.id
where en.status = 'active';

grant execute on function atlas.fn_set_enrollee_z_code_resolution(uuid, boolean, uuid, text, text) to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_profiles to anon, authenticated;
