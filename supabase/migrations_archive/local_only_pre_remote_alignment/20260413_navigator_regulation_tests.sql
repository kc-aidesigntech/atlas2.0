create table if not exists atlas.navigator_regulation_test_submissions (
  id uuid primary key default gen_random_uuid(),
  draft_key text not null,
  enrollee_id text not null,
  enrollment_id uuid null,
  test_type text not null check (test_type in ('mh_sca', 'svs')),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  enrollee_name text not null,
  enrollee_case_id text not null,
  enrollee_email text not null default '',
  total_score numeric null,
  pass_threshold numeric not null,
  passed boolean null,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ux_navigator_regulation_test_draft unique (enrollee_id, test_type, draft_key)
);

create index if not exists ix_navigator_regulation_test_submissions_enrollee
  on atlas.navigator_regulation_test_submissions (enrollee_id, test_type, updated_at desc);

create table if not exists atlas.navigator_regulation_test_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.navigator_regulation_test_submissions(id) on delete cascade,
  prompt_id text not null,
  prompt_label text not null,
  response_value numeric null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ix_navigator_regulation_test_answers_submission
  on atlas.navigator_regulation_test_answers (submission_id, prompt_id);
