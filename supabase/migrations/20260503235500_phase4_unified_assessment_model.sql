-- Phase 4 assessment model unification:
-- - introduce unified submission/answer/participant tables
-- - backfill from legacy assessment tables
-- - keep legacy write paths via trigger-based dual-write

create table if not exists atlas.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_type text not null check (
    assessment_type in ('partner_service_capacity', 'enrollee_burden', 'navigator_regulation_test', 'navigator_competency')
  ),
  source_submission_id uuid,
  status text not null default 'completed',
  form_version text,
  enrollment_id uuid references atlas.enrollments(id) on delete set null,
  enrollee_id uuid references atlas.enrollees(id) on delete set null,
  partner_id uuid references atlas.partners(id) on delete set null,
  navigator_person_id uuid references atlas.people(id) on delete set null,
  supervisor_person_id uuid references atlas.people(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  unique (assessment_type, source_submission_id)
);

create table if not exists atlas.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_submission_id uuid not null references atlas.assessment_submissions(id) on delete cascade,
  source_answer_id uuid,
  prompt_id text not null,
  parent_code text,
  z_code text,
  normalized_z_code text,
  title text,
  description text,
  numeric_score numeric,
  not_encountered boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_assessment_answers_submission_prompt_norm
  on atlas.assessment_answers (assessment_submission_id, prompt_id, coalesce(normalized_z_code, ''));

create table if not exists atlas.assessment_participants (
  id uuid primary key default gen_random_uuid(),
  assessment_submission_id uuid not null references atlas.assessment_submissions(id) on delete cascade,
  person_id uuid references atlas.people(id) on delete set null,
  participant_role text not null,
  created_at timestamptz not null default now(),
  unique (assessment_submission_id, person_id, participant_role)
);

create or replace function atlas.fn_sync_submission_to_unified(
  p_assessment_type text,
  p_source_submission_id uuid,
  p_status text,
  p_form_version text,
  p_enrollment_id uuid,
  p_enrollee_id uuid,
  p_partner_id uuid,
  p_navigator_person_id uuid,
  p_supervisor_person_id uuid,
  p_submitted_at timestamptz,
  p_updated_at timestamptz,
  p_metadata jsonb,
  p_raw_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  unified_id uuid;
begin
  insert into atlas.assessment_submissions (
    assessment_type, source_submission_id, status, form_version, enrollment_id, enrollee_id, partner_id,
    navigator_person_id, supervisor_person_id, submitted_at, updated_at, metadata, raw_payload
  )
  values (
    p_assessment_type, p_source_submission_id, coalesce(p_status, 'completed'), p_form_version, p_enrollment_id, p_enrollee_id, p_partner_id,
    p_navigator_person_id, p_supervisor_person_id, coalesce(p_submitted_at, now()), coalesce(p_updated_at, coalesce(p_submitted_at, now())),
    coalesce(p_metadata, '{}'::jsonb), p_raw_payload
  )
  on conflict (assessment_type, source_submission_id)
  do update set
    status = excluded.status,
    form_version = excluded.form_version,
    enrollment_id = excluded.enrollment_id,
    enrollee_id = excluded.enrollee_id,
    partner_id = excluded.partner_id,
    navigator_person_id = excluded.navigator_person_id,
    supervisor_person_id = excluded.supervisor_person_id,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at,
    metadata = excluded.metadata,
    raw_payload = excluded.raw_payload
  returning id into unified_id;

  return unified_id;
end;
$$;

insert into atlas.assessment_submissions (assessment_type, source_submission_id, status, form_version, partner_id, submitted_at, updated_at, metadata, raw_payload)
select 'partner_service_capacity', s.id, s.status, s.form_version, s.partner_id, s.submitted_at, coalesce(s.updated_at, s.submitted_at),
       jsonb_build_object('organizationName', s.organization_name, 'respondentEmail', s.respondent_email), s.raw_payload
from atlas.partner_service_capacity_submissions s
on conflict (assessment_type, source_submission_id) do nothing;

insert into atlas.assessment_submissions (assessment_type, source_submission_id, status, form_version, enrollment_id, enrollee_id, submitted_at, updated_at, metadata, raw_payload)
select 'enrollee_burden', s.id, s.status, s.form_version, s.enrollment_id, s.enrollee_id, s.submitted_at, s.updated_at,
       jsonb_build_object('respondentPersonId', s.respondent_person_id, 'respondentRole', s.respondent_role), s.raw_payload
from atlas.enrollee_burden_survey_submissions s
on conflict (assessment_type, source_submission_id) do nothing;

insert into atlas.assessment_submissions (assessment_type, source_submission_id, status, form_version, enrollment_id, enrollee_id, submitted_at, updated_at, metadata)
select 'navigator_regulation_test', s.id, s.status, s.test_type, s.enrollment_id, e.enrollee_id, s.submitted_at, s.updated_at,
       jsonb_build_object('draftKey', s.draft_key, 'passed', s.passed, 'passThreshold', s.pass_threshold)
from atlas.navigator_regulation_test_submissions s
left join atlas.enrollments e on e.id = s.enrollment_id
on conflict (assessment_type, source_submission_id) do nothing;

insert into atlas.assessment_submissions (assessment_type, source_submission_id, status, form_version, navigator_person_id, supervisor_person_id, submitted_at, updated_at, metadata)
select 'navigator_competency', s.id, 'completed', s.form_version, s.navigator_person_id, s.supervisor_person_id, s.assessed_at, s.created_at,
       jsonb_build_object('notes', s.notes)
from atlas.navigator_competency_assessments s
on conflict (assessment_type, source_submission_id) do nothing;

insert into atlas.assessment_answers (assessment_submission_id, source_answer_id, prompt_id, parent_code, z_code, normalized_z_code, title, description, numeric_score, not_encountered, created_at)
select us.id, a.id, a.prompt_id, a.parent_code, a.z_code, a.normalized_z_code, a.title, a.description, a.burden_score, a.not_encountered, a.created_at
from atlas.partner_service_capacity_answers a
join atlas.assessment_submissions us on us.assessment_type = 'partner_service_capacity' and us.source_submission_id = a.submission_id
on conflict (assessment_submission_id, prompt_id, coalesce(normalized_z_code, '')) do nothing;

insert into atlas.assessment_answers (assessment_submission_id, source_answer_id, prompt_id, parent_code, z_code, normalized_z_code, title, description, numeric_score, not_encountered, created_at)
select us.id, a.id, a.prompt_id, a.parent_code, a.z_code, a.normalized_z_code, a.title, a.description, a.burden_score, a.not_encountered, a.created_at
from atlas.enrollee_burden_survey_answers a
join atlas.assessment_submissions us on us.assessment_type = 'enrollee_burden' and us.source_submission_id = a.submission_id
on conflict (assessment_submission_id, prompt_id, coalesce(normalized_z_code, '')) do nothing;

insert into atlas.assessment_answers (assessment_submission_id, source_answer_id, prompt_id, title, numeric_score, created_at)
select us.id, a.id, a.prompt_id, a.prompt_label, a.response_value, a.created_at
from atlas.navigator_regulation_test_answers a
join atlas.assessment_submissions us on us.assessment_type = 'navigator_regulation_test' and us.source_submission_id = a.submission_id
on conflict (assessment_submission_id, prompt_id, coalesce(normalized_z_code, '')) do nothing;

insert into atlas.assessment_answers (assessment_submission_id, source_answer_id, prompt_id, parent_code, z_code, normalized_z_code, title, description, numeric_score, created_at)
select us.id, a.id, a.parent_code || ':' || a.z_code, a.parent_code, a.z_code, a.normalized_z_code, a.title, a.description, a.competency_score, a.created_at
from atlas.navigator_competency_assessment_answers a
join atlas.assessment_submissions us on us.assessment_type = 'navigator_competency' and us.source_submission_id = a.assessment_id
on conflict (assessment_submission_id, prompt_id, coalesce(normalized_z_code, '')) do nothing;

insert into atlas.assessment_participants (assessment_submission_id, person_id, participant_role)
select us.id, s.respondent_person_id, s.respondent_role
from atlas.enrollee_burden_survey_submissions s
join atlas.assessment_submissions us on us.assessment_type = 'enrollee_burden' and us.source_submission_id = s.id
where s.respondent_person_id is not null
on conflict (assessment_submission_id, person_id, participant_role) do nothing;

insert into atlas.assessment_participants (assessment_submission_id, person_id, participant_role)
select us.id, s.navigator_person_id, 'navigator'
from atlas.navigator_competency_assessments s
join atlas.assessment_submissions us on us.assessment_type = 'navigator_competency' and us.source_submission_id = s.id
on conflict (assessment_submission_id, person_id, participant_role) do nothing;

insert into atlas.assessment_participants (assessment_submission_id, person_id, participant_role)
select us.id, s.supervisor_person_id, 'supervisor'
from atlas.navigator_competency_assessments s
join atlas.assessment_submissions us on us.assessment_type = 'navigator_competency' and us.source_submission_id = s.id
on conflict (assessment_submission_id, person_id, participant_role) do nothing;

create or replace function atlas.fn_trg_sync_partner_service_capacity_submission_unified()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_sync_submission_to_unified(
    'partner_service_capacity', new.id, new.status, new.form_version, null, null, new.partner_id, null, null,
    new.submitted_at, coalesce(new.updated_at, new.submitted_at),
    jsonb_build_object('organizationName', new.organization_name, 'respondentEmail', new.respondent_email),
    new.raw_payload
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_partner_service_capacity_submission_unified on atlas.partner_service_capacity_submissions;
create trigger trg_sync_partner_service_capacity_submission_unified
after insert or update on atlas.partner_service_capacity_submissions
for each row execute function atlas.fn_trg_sync_partner_service_capacity_submission_unified();

create or replace function atlas.fn_trg_sync_enrollee_burden_submission_unified()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_sync_submission_to_unified(
    'enrollee_burden', new.id, new.status, new.form_version, new.enrollment_id, new.enrollee_id, null, null, null,
    new.submitted_at, new.updated_at,
    jsonb_build_object('respondentPersonId', new.respondent_person_id, 'respondentRole', new.respondent_role),
    new.raw_payload
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_enrollee_burden_submission_unified on atlas.enrollee_burden_survey_submissions;
create trigger trg_sync_enrollee_burden_submission_unified
after insert or update on atlas.enrollee_burden_survey_submissions
for each row execute function atlas.fn_trg_sync_enrollee_burden_submission_unified();

create or replace view atlas.v_assessment_submission_parity
with (security_invoker = true)
as
with legacy_counts as (
  select 'partner_service_capacity'::text as assessment_type, count(*)::bigint as legacy_row_count from atlas.partner_service_capacity_submissions
  union all
  select 'enrollee_burden'::text, count(*)::bigint from atlas.enrollee_burden_survey_submissions
  union all
  select 'navigator_regulation_test'::text, count(*)::bigint from atlas.navigator_regulation_test_submissions
  union all
  select 'navigator_competency'::text, count(*)::bigint from atlas.navigator_competency_assessments
),
unified_counts as (
  select assessment_type, count(*)::bigint as unified_row_count
  from atlas.assessment_submissions
  group by assessment_type
)
select
  l.assessment_type,
  l.legacy_row_count,
  coalesce(u.unified_row_count, 0) as unified_row_count,
  (l.legacy_row_count = coalesce(u.unified_row_count, 0)) as is_in_sync
from legacy_counts l
left join unified_counts u on u.assessment_type = l.assessment_type;

create or replace view atlas.v_assessment_answer_parity
with (security_invoker = true)
as
with legacy_counts as (
  select 'partner_service_capacity'::text as assessment_type, count(*)::bigint as legacy_row_count from atlas.partner_service_capacity_answers
  union all
  select 'enrollee_burden'::text, count(*)::bigint from atlas.enrollee_burden_survey_answers
  union all
  select 'navigator_regulation_test'::text, count(*)::bigint from atlas.navigator_regulation_test_answers
  union all
  select 'navigator_competency'::text, count(*)::bigint from atlas.navigator_competency_assessment_answers
),
unified_counts as (
  select s.assessment_type, count(*)::bigint as unified_row_count
  from atlas.assessment_submissions s
  join atlas.assessment_answers a on a.assessment_submission_id = s.id
  group by s.assessment_type
)
select
  l.assessment_type,
  l.legacy_row_count,
  coalesce(u.unified_row_count, 0) as unified_row_count,
  (l.legacy_row_count = coalesce(u.unified_row_count, 0)) as is_in_sync
from legacy_counts l
left join unified_counts u on u.assessment_type = l.assessment_type;

grant select on atlas.assessment_submissions to authenticated;
grant select on atlas.assessment_answers to authenticated;
grant select on atlas.assessment_participants to authenticated;
grant select on atlas.v_assessment_submission_parity to authenticated;
grant select on atlas.v_assessment_answer_parity to authenticated;

notify pgrst, 'reload schema';
