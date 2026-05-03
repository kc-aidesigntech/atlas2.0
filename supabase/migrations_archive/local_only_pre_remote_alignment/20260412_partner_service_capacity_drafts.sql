create extension if not exists pgcrypto;

alter table atlas.partner_service_capacity_submissions
  add column if not exists draft_key text,
  add column if not exists status text not null default 'completed',
  add column if not exists completed_at timestamptz;

update atlas.partner_service_capacity_submissions
set draft_key = coalesce(draft_key, gen_random_uuid()::text);

alter table atlas.partner_service_capacity_submissions
  alter column draft_key set not null;

create unique index if not exists idx_partner_service_capacity_submissions_draft_key
  on atlas.partner_service_capacity_submissions(draft_key);

alter table atlas.partner_service_capacity_submissions
  drop constraint if exists partner_service_capacity_submissions_status_check;

alter table atlas.partner_service_capacity_submissions
  add constraint partner_service_capacity_submissions_status_check
  check (status in ('draft', 'completed'));

update atlas.partner_service_capacity_submissions
set completed_at = coalesce(completed_at, submitted_at)
where status = 'completed';

alter table atlas.partner_service_capacity_submissions
  alter column organization_name drop not null,
  alter column organization_name_normalized drop not null,
  alter column respondent_first_name drop not null,
  alter column respondent_last_name drop not null;
