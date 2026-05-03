create table if not exists atlas.partner_troubleshooting_grants (
  partner_id uuid primary key references atlas.partners (id) on delete cascade,
  allowed_menus text[] not null default '{}',
  allow_write boolean not null default false,
  updated_by_person_id uuid references atlas.people (id),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.admin_troubleshooting_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_person_id uuid not null references atlas.people (id),
  target_person_id uuid not null references atlas.people (id),
  target_role text not null,
  partner_id uuid references atlas.partners (id),
  partner_grant_snapshot jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create or replace view atlas.v_admin_troubleshooting_targets as
select
  p.id as person_id,
  p.display_name,
  p.email,
  array_remove(array_agg(distinct r.role_key), null) as role_keys,
  max(part.id) filter (where part.primary_contact_email is not null and lower(part.primary_contact_email) = lower(p.email)) as partner_id,
  max(part.organization_name) filter (where part.primary_contact_email is not null and lower(part.primary_contact_email) = lower(p.email)) as partner_organization_name
from atlas.people p
left join atlas.people_role_assignments pra
  on pra.person_id = p.id
 and pra.ends_on is null
left join atlas.roles r
  on r.id = pra.role_id
left join atlas.partners part
  on part.is_active = true
 and part.primary_contact_email is not null
 and lower(part.primary_contact_email) = lower(p.email)
where p.status = 'active'
group by p.id, p.display_name, p.email;

grant select, insert, update on atlas.partner_troubleshooting_grants to anon, authenticated;
grant select, insert, update on atlas.admin_troubleshooting_sessions to anon, authenticated;
grant select on atlas.v_admin_troubleshooting_targets to anon, authenticated;

notify pgrst, 'reload schema';
