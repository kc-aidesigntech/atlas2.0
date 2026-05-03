-- Partner service-capacity survey bootstrap
--
-- Run this after:
-- 1. supabase/migrations/20260114_make_app_alive.sql
-- 2. supabase/seeds/seed_z_code_taxonomy.sql
--
-- Optional but recommended before production hardening:
-- - add auth-linked Row-Level Security (RLS) policies
-- - replace anon write access with authenticated or edge-function writes

create or replace function atlas.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists atlas.partner_service_capacity_submissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references atlas.partners(id) on delete set null,
  organization_name text not null,
  organization_name_normalized text not null,
  respondent_first_name text not null,
  respondent_last_name text not null,
  job_title text,
  respondent_roles text[] not null default '{}',
  other_role_text text,
  form_version text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table atlas.partner_service_capacity_submissions is
  'Raw partner-facing service-capacity survey submissions, one row per completed save.';

create index if not exists idx_partner_service_capacity_org
  on atlas.partner_service_capacity_submissions(organization_name_normalized, submitted_at desc);

create index if not exists idx_partner_service_capacity_partner
  on atlas.partner_service_capacity_submissions(partner_id, submitted_at desc);

create table if not exists atlas.partner_service_capacity_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references atlas.partner_service_capacity_submissions(id) on delete cascade,
  prompt_id text not null,
  parent_code text not null,
  z_code text not null,
  normalized_z_code text not null,
  title text not null,
  description text,
  burden_score int,
  not_encountered boolean not null default false,
  check (
    (not_encountered = true and burden_score is null) or
    (not_encountered = false and burden_score between 1 and 9)
  ),
  created_at timestamptz not null default now(),
  unique(submission_id, prompt_id)
);

comment on table atlas.partner_service_capacity_answers is
  'Per-question Z-code burden answers associated with a raw service-capacity submission.';

create index if not exists idx_partner_service_capacity_answers_submission
  on atlas.partner_service_capacity_answers(submission_id);

create index if not exists idx_partner_service_capacity_answers_z_code
  on atlas.partner_service_capacity_answers(normalized_z_code);

create table if not exists atlas.partner_z_code_burden_scores (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references atlas.partners(id) on delete cascade,
  submission_id uuid references atlas.partner_service_capacity_submissions(id) on delete set null,
  z_code_id uuid not null references atlas.z_codes(id) on delete cascade,
  z_code text not null,
  burden_score int not null check (burden_score between 1 and 9),
  derived_relation_type text check (derived_relation_type in ('specialize', 'interfere')),
  strength numeric(6,4) not null default 0.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id, z_code_id)
);

comment on table atlas.partner_z_code_burden_scores is
  'Latest normalized 1-9 burden score per partner and Z-code, derived from service-capacity surveys.';

create index if not exists idx_partner_z_code_burden_scores_partner
  on atlas.partner_z_code_burden_scores(partner_id, updated_at desc);

create index if not exists idx_partner_z_code_burden_scores_submission
  on atlas.partner_z_code_burden_scores(submission_id);

drop trigger if exists trg_partner_service_capacity_submissions_touch_updated_at
  on atlas.partner_service_capacity_submissions;
create trigger trg_partner_service_capacity_submissions_touch_updated_at
before update on atlas.partner_service_capacity_submissions
for each row execute function atlas.fn_touch_updated_at();

drop trigger if exists trg_partner_z_code_burden_scores_touch_updated_at
  on atlas.partner_z_code_burden_scores;
create trigger trg_partner_z_code_burden_scores_touch_updated_at
before update on atlas.partner_z_code_burden_scores
for each row execute function atlas.fn_touch_updated_at();

grant usage on schema atlas to anon, authenticated;

grant select on atlas.z_codes to anon, authenticated;

grant select, insert, update on atlas.partners to anon, authenticated;

grant select, insert, update on atlas.partner_service_capacity_submissions to anon, authenticated;
grant select, insert, update on atlas.partner_service_capacity_answers to anon, authenticated;
grant select, insert, update on atlas.partner_z_code_burden_scores to anon, authenticated;
grant select, insert, update on atlas.partner_z_code_capabilities to anon, authenticated;
