-- Foundational authorization model for role-based permissions with user-level exceptions.
-- This is designed to support a phased rollout:
-- 1) legacy/public access can stay enabled via settings rows below,
-- 2) app traffic can migrate to explicit permission checks,
-- 3) legacy settings can be disabled when role mapping is fully enforced.

create table if not exists atlas.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists atlas.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references atlas.roles(id) on delete cascade,
  permission_id uuid not null references atlas.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(role_id, permission_id)
);
create index if not exists idx_role_permissions_role_id on atlas.role_permissions(role_id);
create index if not exists idx_role_permissions_permission_id on atlas.role_permissions(permission_id);

create table if not exists atlas.user_permission_exceptions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  permission_id uuid not null references atlas.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by_person_id uuid references atlas.people(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_permission_exceptions_person on atlas.user_permission_exceptions(person_id);
create index if not exists idx_user_permission_exceptions_permission on atlas.user_permission_exceptions(permission_id);

create table if not exists atlas.authorization_settings (
  setting_key text primary key,
  enabled boolean not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into atlas.authorization_settings (setting_key, enabled, description)
values
  ('allow_legacy_public_partner_capacity_read', true, 'Temporary public/select access while authz rollout is in progress.'),
  ('allow_legacy_public_partner_capacity_write', true, 'Temporary public/insert-update access while authz rollout is in progress.'),
  ('allow_legacy_public_partner_capacity_delete', true, 'Temporary public/delete access while authz rollout is in progress.')
on conflict (setting_key) do nothing;

insert into atlas.permissions (permission_key, description)
values
  ('partner_capacity_submissions.read', 'Read partner capacity submissions and derived records.'),
  ('partner_capacity_submissions.write', 'Create and update partner capacity submissions and derived records.'),
  ('partner_capacity_submissions.delete', 'Delete partner capacity submissions and derived records.')
on conflict (permission_key) do nothing;

insert into atlas.role_permissions (role_id, permission_id)
select r.id, p.id
from atlas.roles r
join atlas.permissions p on p.permission_key in (
  'partner_capacity_submissions.read',
  'partner_capacity_submissions.write',
  'partner_capacity_submissions.delete'
)
where r.role_key in ('administrator', 'partner', 'navigator')
on conflict (role_id, permission_id) do nothing;

create or replace function atlas.fn_current_person_id()
returns uuid
language sql
stable
security definer
set search_path = atlas, public
as $$
  select p.id
  from atlas.people p
  where p.external_ref = coalesce(auth.uid()::text, '')
  limit 1
$$;

create or replace function atlas.fn_authz_setting_enabled(
  target_setting_key text,
  fallback_enabled boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select coalesce(
    (
      select s.enabled
      from atlas.authorization_settings s
      where s.setting_key = target_setting_key
      limit 1
    ),
    fallback_enabled
  )
$$;

create or replace function atlas.fn_has_permission(target_permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator' then
    return true;
  end if;

  current_person := atlas.fn_current_person_id();

  if current_person is null then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    join atlas.permissions p on p.id = upe.permission_id
    where upe.person_id = current_person
      and p.permission_key = target_permission_key
      and upe.effect = 'deny'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    join atlas.permissions p on p.id = upe.permission_id
    where upe.person_id = current_person
      and p.permission_key = target_permission_key
      and upe.effect = 'allow'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return true;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.role_permissions rp on rp.role_id = pra.role_id
    join atlas.permissions p on p.id = rp.permission_id
    where pra.person_id = current_person
      and p.permission_key = target_permission_key
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

alter table atlas.partner_service_capacity_submissions enable row level security;
alter table atlas.partner_service_capacity_answers enable row level security;
alter table atlas.partner_z_code_burden_scores enable row level security;

drop policy if exists partner_service_capacity_submissions_select on atlas.partner_service_capacity_submissions;
create policy partner_service_capacity_submissions_select on atlas.partner_service_capacity_submissions
for select
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_read', true)
  or atlas.fn_has_permission('partner_capacity_submissions.read')
);

drop policy if exists partner_service_capacity_submissions_insert on atlas.partner_service_capacity_submissions;
create policy partner_service_capacity_submissions_insert on atlas.partner_service_capacity_submissions
for insert
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_service_capacity_submissions_update on atlas.partner_service_capacity_submissions;
create policy partner_service_capacity_submissions_update on atlas.partner_service_capacity_submissions
for update
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
)
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_service_capacity_submissions_delete on atlas.partner_service_capacity_submissions;
create policy partner_service_capacity_submissions_delete on atlas.partner_service_capacity_submissions
for delete
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_delete', true)
  or atlas.fn_has_permission('partner_capacity_submissions.delete')
);

drop policy if exists partner_service_capacity_answers_select on atlas.partner_service_capacity_answers;
create policy partner_service_capacity_answers_select on atlas.partner_service_capacity_answers
for select
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_read', true)
  or atlas.fn_has_permission('partner_capacity_submissions.read')
);

drop policy if exists partner_service_capacity_answers_insert on atlas.partner_service_capacity_answers;
create policy partner_service_capacity_answers_insert on atlas.partner_service_capacity_answers
for insert
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_service_capacity_answers_update on atlas.partner_service_capacity_answers;
create policy partner_service_capacity_answers_update on atlas.partner_service_capacity_answers
for update
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
)
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_service_capacity_answers_delete on atlas.partner_service_capacity_answers;
create policy partner_service_capacity_answers_delete on atlas.partner_service_capacity_answers
for delete
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_delete', true)
  or atlas.fn_has_permission('partner_capacity_submissions.delete')
);

drop policy if exists partner_z_code_burden_scores_select on atlas.partner_z_code_burden_scores;
create policy partner_z_code_burden_scores_select on atlas.partner_z_code_burden_scores
for select
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_read', true)
  or atlas.fn_has_permission('partner_capacity_submissions.read')
);

drop policy if exists partner_z_code_burden_scores_insert on atlas.partner_z_code_burden_scores;
create policy partner_z_code_burden_scores_insert on atlas.partner_z_code_burden_scores
for insert
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_z_code_burden_scores_update on atlas.partner_z_code_burden_scores;
create policy partner_z_code_burden_scores_update on atlas.partner_z_code_burden_scores
for update
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
)
with check (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_write', true)
  or atlas.fn_has_permission('partner_capacity_submissions.write')
);

drop policy if exists partner_z_code_burden_scores_delete on atlas.partner_z_code_burden_scores;
create policy partner_z_code_burden_scores_delete on atlas.partner_z_code_burden_scores
for delete
using (
  atlas.fn_authz_setting_enabled('allow_legacy_public_partner_capacity_delete', true)
  or atlas.fn_has_permission('partner_capacity_submissions.delete')
);

