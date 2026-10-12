-- Point-of-care surveys and C.R.E.A.T.E. session open/close.
-- Existing encounter rows stay on the legacy one-score-per-competency reading.
-- Existing session rows were finished forms, so they default to closed.

alter table atlas.navigator_ipscc_encounter_submissions
  add column if not exists instrument text not null default 'legacy-competency-aligned';

alter table atlas.navigator_create_sessions
  add column if not exists status text not null default 'closed',
  add column if not exists opened_by_role text not null default 'navigator',
  add column if not exists opened_by_name text not null default '',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_name text not null default '';

alter table atlas.navigator_create_sessions
  drop constraint if exists navigator_create_sessions_status_check;

alter table atlas.navigator_create_sessions
  add constraint navigator_create_sessions_status_check
  check (status in ('open', 'closed'));

alter table atlas.navigator_create_sessions
  drop constraint if exists navigator_create_sessions_opened_by_role_check;

alter table atlas.navigator_create_sessions
  add constraint navigator_create_sessions_opened_by_role_check
  check (opened_by_role in ('navigator', 'supervisor'));
