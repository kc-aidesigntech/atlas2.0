create table if not exists atlas.enrollee_burden_survey_submissions (
  id uuid primary key default gen_random_uuid(),
  draft_key text not null unique,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  completed_at timestamptz,
  enrollee_id uuid not null references atlas.enrollees (id) on delete cascade,
  enrollment_id uuid not null references atlas.enrollments (id) on delete cascade,
  enrollee_name text not null,
  enrollee_case_id text,
  respondent_person_id uuid references atlas.people (id) on delete set null,
  respondent_name text not null,
  respondent_role text not null check (respondent_role in ('navigator', 'supervisor')),
  organization_name text,
  form_version text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw_payload jsonb
);

create index if not exists enrollee_burden_survey_submissions_enrollment_idx
  on atlas.enrollee_burden_survey_submissions (enrollment_id, updated_at desc);

create index if not exists enrollee_burden_survey_submissions_enrollee_idx
  on atlas.enrollee_burden_survey_submissions (enrollee_id, updated_at desc);

create table if not exists atlas.enrollee_burden_survey_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.enrollee_burden_survey_submissions (id) on delete cascade,
  prompt_id text not null,
  parent_code text not null,
  z_code text not null,
  normalized_z_code text not null,
  title text not null,
  description text,
  burden_score smallint check (burden_score between 1 and 9),
  not_encountered boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint enrollee_burden_survey_answers_score_required
    check (not not_encountered or burden_score is null)
);

create index if not exists enrollee_burden_survey_answers_submission_idx
  on atlas.enrollee_burden_survey_answers (submission_id, normalized_z_code);

alter table atlas.enrollee_burden_survey_submissions enable row level security;
alter table atlas.enrollee_burden_survey_answers enable row level security;

drop policy if exists "enrollee burden survey submissions authenticated" on atlas.enrollee_burden_survey_submissions;
create policy "enrollee burden survey submissions authenticated"
on atlas.enrollee_burden_survey_submissions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "enrollee burden survey answers authenticated" on atlas.enrollee_burden_survey_answers;
create policy "enrollee burden survey answers authenticated"
on atlas.enrollee_burden_survey_answers
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on atlas.enrollee_burden_survey_submissions to authenticated;
grant select, insert, update, delete on atlas.enrollee_burden_survey_answers to authenticated;
