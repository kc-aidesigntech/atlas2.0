-- Navigator My Profile dedicated workflow:
-- 1) point-of-care IPSCC submissions
-- 2) weekly IPS self-assessments
-- 3) structured C.R.E.A.T.E. supervision sessions

create table if not exists atlas.navigator_ipscc_encounter_submissions (
  id uuid primary key default gen_random_uuid(),
  navigator_name text not null,
  enrollee_id text not null,
  enrollee_name text not null,
  enrollment_id text null,
  submitted_at timestamptz not null default now(),
  submitted_by text not null default 'service user',
  item_scores jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.navigator_ips_self_assessments (
  id uuid primary key default gen_random_uuid(),
  navigator_name text not null,
  week_start_iso timestamptz not null,
  submitted_at timestamptz not null default now(),
  competency_scores jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.supervisor_ips_assessments (
  id uuid primary key default gen_random_uuid(),
  supervisor_name text not null,
  navigator_name text not null,
  week_start_iso timestamptz not null,
  submitted_at timestamptz not null default now(),
  competency_scores jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.navigator_create_sessions (
  id uuid primary key default gen_random_uuid(),
  navigator_name text not null,
  supervisor_name text not null,
  session_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  supervision_mode text not null default 'in_person',
  session_duration_minutes integer null,
  connect_focused_listening boolean not null default false,
  recognize_notes text not null default '',
  encourage_notes text not null default '',
  acknowledge_notes text not null default '',
  train_notes text not null default '',
  empower_notes text not null default '',
  create_action_plan text not null default '',
  supervisor_submission text not null default '',
  supervisee_submission text not null default '',
  peer_specialist_signature text not null default '',
  peer_specialist_signed_at timestamptz null,
  supervisor_signature text not null default '',
  supervisor_signed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists navigator_ipscc_encounter_submissions_navigator_name_idx
  on atlas.navigator_ipscc_encounter_submissions (lower(navigator_name));

create index if not exists navigator_ips_self_assessments_navigator_name_idx
  on atlas.navigator_ips_self_assessments (lower(navigator_name));

create index if not exists navigator_create_sessions_navigator_name_idx
  on atlas.navigator_create_sessions (lower(navigator_name));

create index if not exists supervisor_ips_assessments_supervisor_name_idx
  on atlas.supervisor_ips_assessments (lower(supervisor_name));

create index if not exists supervisor_ips_assessments_navigator_name_idx
  on atlas.supervisor_ips_assessments (lower(navigator_name));

alter table atlas.navigator_ipscc_encounter_submissions enable row level security;
alter table atlas.navigator_ips_self_assessments enable row level security;
alter table atlas.navigator_create_sessions enable row level security;
alter table atlas.supervisor_ips_assessments enable row level security;

drop policy if exists "navigator ipscc authenticated read" on atlas.navigator_ipscc_encounter_submissions;
drop policy if exists "navigator ipscc authenticated write" on atlas.navigator_ipscc_encounter_submissions;
drop policy if exists "navigator ips self authenticated read" on atlas.navigator_ips_self_assessments;
drop policy if exists "navigator ips self authenticated write" on atlas.navigator_ips_self_assessments;
drop policy if exists "navigator create authenticated read" on atlas.navigator_create_sessions;
drop policy if exists "navigator create authenticated write" on atlas.navigator_create_sessions;
drop policy if exists "supervisor ips authenticated read" on atlas.supervisor_ips_assessments;
drop policy if exists "supervisor ips authenticated write" on atlas.supervisor_ips_assessments;

-- Row-Level Security (RLS) baseline keeps this pilot workflow available to any
-- authenticated staff account while role-specific hardening is completed.
create policy "navigator ipscc authenticated read"
  on atlas.navigator_ipscc_encounter_submissions
  for select
  to authenticated
  using (true);

create policy "navigator ipscc authenticated write"
  on atlas.navigator_ipscc_encounter_submissions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "navigator ips self authenticated read"
  on atlas.navigator_ips_self_assessments
  for select
  to authenticated
  using (true);

create policy "navigator ips self authenticated write"
  on atlas.navigator_ips_self_assessments
  for all
  to authenticated
  using (true)
  with check (true);

create policy "navigator create authenticated read"
  on atlas.navigator_create_sessions
  for select
  to authenticated
  using (true);

create policy "navigator create authenticated write"
  on atlas.navigator_create_sessions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "supervisor ips authenticated read"
  on atlas.supervisor_ips_assessments
  for select
  to authenticated
  using (true);

create policy "supervisor ips authenticated write"
  on atlas.supervisor_ips_assessments
  for all
  to authenticated
  using (true)
  with check (true);

-- Policies alone are not enough: PostgREST requires table privileges for
-- `authenticated` or reads fail with permission-denied (42501) before RLS.
grant select, insert, update, delete on table atlas.navigator_ipscc_encounter_submissions to authenticated;
grant select, insert, update, delete on table atlas.navigator_ips_self_assessments to authenticated;
grant select, insert, update, delete on table atlas.supervisor_ips_assessments to authenticated;
grant select, insert, update, delete on table atlas.navigator_create_sessions to authenticated;
