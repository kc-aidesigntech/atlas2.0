-- Matrix many-to-many foundation:
-- - preserve existing one-to-one UX options in the app while enabling many-to-many
--   assignment storage in the database
-- - keep legacy RPC signatures callable via wrappers to avoid breaking older clients
-- - introduce assessment participant/reviewer join tables so future workflows can
--   model multi-subject and multi-reviewer sessions without schema rewrites

create table if not exists atlas.partner_contact_assignments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references atlas.partners(id) on delete cascade,
  person_id uuid not null references atlas.people(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partner_id, person_id, starts_on)
);

create index if not exists idx_partner_contact_assignments_partner
  on atlas.partner_contact_assignments(partner_id, starts_on desc);
create index if not exists idx_partner_contact_assignments_person
  on atlas.partner_contact_assignments(person_id, starts_on desc);
create unique index if not exists ux_partner_contact_assignments_active_pair
  on atlas.partner_contact_assignments(partner_id, person_id)
  where ends_on is null;

-- Backfill active partner-contact rows from legacy single-contact fields.
insert into atlas.partner_contact_assignments (partner_id, person_id, starts_on, ends_on, is_primary)
select
  part.id,
  p.id,
  current_date,
  null,
  true
from atlas.partners part
join atlas.people p
  on part.primary_contact_email is not null
 and p.email is not null
 and lower(p.email) = lower(part.primary_contact_email)
where part.is_active = true
  and not exists (
    select 1
    from atlas.partner_contact_assignments existing
    where existing.partner_id = part.id
      and existing.person_id = p.id
      and existing.ends_on is null
  );

create table if not exists atlas.partner_service_capacity_submission_subjects (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.partner_service_capacity_submissions(id) on delete cascade,
  subject_person_id uuid not null references atlas.people(id) on delete cascade,
  subject_role text not null default 'partner_contact',
  created_at timestamptz not null default now(),
  unique (submission_id, subject_person_id, subject_role)
);

create table if not exists atlas.partner_service_capacity_submission_reviewers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.partner_service_capacity_submissions(id) on delete cascade,
  reviewer_person_id uuid not null references atlas.people(id) on delete cascade,
  reviewer_role text not null default 'administrator',
  created_at timestamptz not null default now(),
  unique (submission_id, reviewer_person_id, reviewer_role)
);

create table if not exists atlas.navigator_competency_assessment_subjects (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references atlas.navigator_competency_assessments(id) on delete cascade,
  subject_person_id uuid not null references atlas.people(id) on delete cascade,
  subject_role text not null default 'navigator',
  created_at timestamptz not null default now(),
  unique (assessment_id, subject_person_id, subject_role)
);

create table if not exists atlas.navigator_competency_assessment_reviewers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references atlas.navigator_competency_assessments(id) on delete cascade,
  reviewer_person_id uuid not null references atlas.people(id) on delete cascade,
  reviewer_role text not null default 'supervisor',
  created_at timestamptz not null default now(),
  unique (assessment_id, reviewer_person_id, reviewer_role)
);

create table if not exists atlas.navigator_regulation_test_submission_subjects (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.navigator_regulation_test_submissions(id) on delete cascade,
  subject_person_id uuid not null references atlas.people(id) on delete cascade,
  subject_role text not null default 'enrollee',
  created_at timestamptz not null default now(),
  unique (submission_id, subject_person_id, subject_role)
);

create table if not exists atlas.navigator_regulation_test_submission_reviewers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.navigator_regulation_test_submissions(id) on delete cascade,
  reviewer_person_id uuid not null references atlas.people(id) on delete cascade,
  reviewer_role text not null default 'navigator',
  created_at timestamptz not null default now(),
  unique (submission_id, reviewer_person_id, reviewer_role)
);

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
join atlas.navigator_assignments na
  on na.enrollment_id = en.id
 and na.ends_on is null
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
),
active_navigators as (
  select
    na.enrollment_id,
    array_agg(distinct nav.display_name order by nav.display_name) as navigator_names
  from atlas.navigator_assignments na
  join atlas.people nav on nav.id = na.navigator_person_id
  where na.ends_on is null
  group by na.enrollment_id
)
select
  e.id as enrollee_id,
  en.id as enrollment_id,
  p.display_name as full_name,
  coalesce(e.dob::text, '') as dob,
  coalesce(e.case_id, '') as case_id,
  coalesce(p.email, '') as email,
  e.avatar_url,
  coalesce(array_to_string(active_navigators.navigator_names, ', '), 'unassigned') as assigned_navigator,
  coalesce(az.z_code_tags, '{}') as z_code_tags,
  en.start_date::text as enrollment_start_iso,
  en.target_duration_months,
  e.current_phase,
  coalesce(az.active_z_code_details, '[]'::jsonb) as active_z_code_details,
  coalesce(cp.completed_parent_codes, '{}') as completed_parent_codes
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join active_navigators on active_navigators.enrollment_id = en.id
left join active_z_codes az on az.enrollment_id = en.id
left join completed_parents cp on cp.enrollment_id = en.id
where en.status = 'active';

grant select, insert, update, delete on atlas.partner_contact_assignments to anon, authenticated;
grant select, insert, update, delete on atlas.partner_service_capacity_submission_subjects to anon, authenticated;
grant select, insert, update, delete on atlas.partner_service_capacity_submission_reviewers to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_competency_assessment_subjects to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_competency_assessment_reviewers to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_regulation_test_submission_subjects to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_regulation_test_submission_reviewers to anon, authenticated;
grant select on atlas.v_navigator_assigned_enrollees to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_profiles to anon, authenticated;

create or replace function atlas.fn_access_matrix_save_enrollment_navigators(
  target_enrollment_id uuid,
  target_navigator_person_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_ids uuid[] := coalesce(target_navigator_person_ids, '{}'::uuid[]);
begin
  perform atlas.fn_require_admin_claim();

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and ends_on is null
    and not (navigator_person_id = any(normalized_ids));

  insert into atlas.navigator_assignments (id, enrollment_id, navigator_person_id, starts_on, ends_on, station_id)
  select gen_random_uuid(), target_enrollment_id, ids.person_id, current_date, null, null
  from (
    select distinct person_id
    from unnest(normalized_ids) as person_id
  ) ids
  where not exists (
    select 1
    from atlas.navigator_assignments current_row
    where current_row.enrollment_id = target_enrollment_id
      and current_row.navigator_person_id = ids.person_id
      and current_row.ends_on is null
  );
end;
$$;

create or replace function atlas.fn_access_matrix_save_enrollment_navigator(
  target_enrollment_id uuid,
  target_navigator_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_access_matrix_save_enrollment_navigators(
    target_enrollment_id,
    case
      when target_navigator_person_id is null then '{}'::uuid[]
      else array[target_navigator_person_id]
    end
  );
end;
$$;

create or replace function atlas.fn_access_matrix_save_navigator_supervisors(
  target_navigator_person_id uuid,
  target_supervisor_person_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_ids uuid[] := coalesce(target_supervisor_person_ids, '{}'::uuid[]);
begin
  perform atlas.fn_require_admin_claim();

  update atlas.supervisor_navigator_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and ends_on is null
    and not (supervisor_person_id = any(normalized_ids));

  insert into atlas.supervisor_navigator_assignments (id, navigator_person_id, supervisor_person_id, starts_on, ends_on)
  select gen_random_uuid(), target_navigator_person_id, ids.person_id, current_date, null
  from (
    select distinct person_id
    from unnest(normalized_ids) as person_id
  ) ids
  where not exists (
    select 1
    from atlas.supervisor_navigator_assignments current_row
    where current_row.navigator_person_id = target_navigator_person_id
      and current_row.supervisor_person_id = ids.person_id
      and current_row.ends_on is null
  );
end;
$$;

create or replace function atlas.fn_access_matrix_save_supervisor_assignment(
  target_navigator_person_id uuid,
  target_supervisor_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_access_matrix_save_navigator_supervisors(
    target_navigator_person_id,
    case
      when target_supervisor_person_id is null then '{}'::uuid[]
      else array[target_supervisor_person_id]
    end
  );
end;
$$;

create or replace function atlas.fn_access_matrix_save_partner_contacts(
  target_partner_id uuid,
  target_primary_contact_person_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_ids uuid[] := coalesce(target_primary_contact_person_ids, '{}'::uuid[]);
  selected_primary record;
begin
  perform atlas.fn_require_admin_claim();

  update atlas.partner_contact_assignments
  set ends_on = current_date, is_primary = false
  where partner_id = target_partner_id
    and ends_on is null
    and not (person_id = any(normalized_ids));

  insert into atlas.partner_contact_assignments (id, partner_id, person_id, starts_on, ends_on, is_primary)
  select gen_random_uuid(), target_partner_id, ids.person_id, current_date, null, false
  from (
    select distinct person_id
    from unnest(normalized_ids) as person_id
  ) ids
  where not exists (
    select 1
    from atlas.partner_contact_assignments existing
    where existing.partner_id = target_partner_id
      and existing.person_id = ids.person_id
      and existing.ends_on is null
  );

  update atlas.partner_contact_assignments
  set is_primary = false
  where partner_id = target_partner_id
    and ends_on is null;

  if array_length(normalized_ids, 1) is null then
    update atlas.partners
    set
      primary_contact_first_name = null,
      primary_contact_last_name = null,
      primary_contact_email = null,
      updated_at = now()
    where id = target_partner_id;
    return;
  end if;

  select p.id, p.first_name, p.last_name, p.email
  into selected_primary
  from atlas.people p
  where p.id = any(normalized_ids)
  order by p.display_name asc nulls last, p.email asc nulls last
  limit 1;

  if selected_primary is null then
    raise exception 'primary contact person not found'
      using errcode = 'P0002';
  end if;

  update atlas.partner_contact_assignments
  set is_primary = true
  where partner_id = target_partner_id
    and person_id = selected_primary.id
    and ends_on is null;

  update atlas.partners
  set
    primary_contact_first_name = selected_primary.first_name,
    primary_contact_last_name = selected_primary.last_name,
    primary_contact_email = selected_primary.email,
    updated_at = now()
  where id = target_partner_id;
end;
$$;

create or replace function atlas.fn_access_matrix_save_partner_primary_contact(
  target_partner_id uuid,
  target_primary_contact_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_access_matrix_save_partner_contacts(
    target_partner_id,
    case
      when target_primary_contact_person_id is null then '{}'::uuid[]
      else array[target_primary_contact_person_id]
    end
  );
end;
$$;

revoke all on function atlas.fn_access_matrix_save_enrollment_navigators(uuid, uuid[]) from public;
revoke all on function atlas.fn_access_matrix_save_enrollment_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_access_matrix_save_navigator_supervisors(uuid, uuid[]) from public;
revoke all on function atlas.fn_access_matrix_save_supervisor_assignment(uuid, uuid) from public;
revoke all on function atlas.fn_access_matrix_save_partner_contacts(uuid, uuid[]) from public;
revoke all on function atlas.fn_access_matrix_save_partner_primary_contact(uuid, uuid) from public;

grant execute on function atlas.fn_access_matrix_save_enrollment_navigators(uuid, uuid[]) to authenticated;
grant execute on function atlas.fn_access_matrix_save_enrollment_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_access_matrix_save_navigator_supervisors(uuid, uuid[]) to authenticated;
grant execute on function atlas.fn_access_matrix_save_supervisor_assignment(uuid, uuid) to authenticated;
grant execute on function atlas.fn_access_matrix_save_partner_contacts(uuid, uuid[]) to authenticated;
grant execute on function atlas.fn_access_matrix_save_partner_primary_contact(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
