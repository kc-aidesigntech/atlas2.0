-- Fix front-end/back-end contract gap: the single-pane bootstrap calls
-- atlas.fn_get_my_navigator_station_context(), but that function (and its backing
-- atlas.navigator_partner_assignments table) were defined only in migration
-- 20260528000500_navigator_partner_station_linkage.sql, which never reached this
-- project. The RPC therefore 404'd (PostgREST PGRST202), and -- now that the RLS
-- bootstrap timeout is fixed -- that missing RPC was the next fail-loud error
-- blocking the workspace from loading for every signed-in user.
--
-- This migration recreates only the bootstrap-critical pieces (the linkage table
-- and the read-only station-context RPC). It deliberately does NOT redefine
-- atlas.fn_can_access_partner_scope, which already exists in a hardened form on
-- this project and must not be regressed.

-- Durable navigator -> partner-organization mapping (drives "my station").
create table if not exists atlas.navigator_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  navigator_person_id uuid not null references atlas.people(id) on delete cascade,
  partner_id uuid not null references atlas.partners(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (navigator_person_id, partner_id, starts_on)
);

create index if not exists idx_navigator_partner_assignments_partner
  on atlas.navigator_partner_assignments (partner_id, starts_on desc);
create index if not exists idx_navigator_partner_assignments_navigator
  on atlas.navigator_partner_assignments (navigator_person_id, starts_on desc);
create unique index if not exists ux_navigator_partner_assignments_active_navigator
  on atlas.navigator_partner_assignments (navigator_person_id)
  where ends_on is null;

-- Secure the table consistently with the database-first model: reads are scoped
-- to the administrator or the navigator themselves; writes flow only through the
-- SECURITY DEFINER access-matrix RPC, never directly from anon/authenticated.
alter table atlas.navigator_partner_assignments enable row level security;
revoke all on atlas.navigator_partner_assignments from anon, authenticated;
grant select on atlas.navigator_partner_assignments to authenticated;

drop policy if exists navigator_partner_assignments_select_scoped on atlas.navigator_partner_assignments;
create policy navigator_partner_assignments_select_scoped
  on atlas.navigator_partner_assignments
  for select to authenticated
  using (
    coalesce(((auth.jwt() -> 'app_metadata') ->> 'atlas_role'), '') = 'administrator'
    or navigator_person_id = atlas.fn_current_person_id()
  );

-- Self-service station-context resolver consumed by the workspace bootstrap.
-- SECURITY DEFINER so it can resolve across partners/stations/counties while the
-- caller only ever sees their own active assignment.
create or replace function atlas.fn_get_my_navigator_station_context()
returns table (
  partner_id uuid,
  organization_name text,
  station_id uuid,
  station_name text,
  county_name text
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  ),
  active_assignment as (
    select npa.partner_id
    from atlas.navigator_partner_assignments npa
    join current_person cp on cp.person_id = npa.navigator_person_id
    where npa.ends_on is null
    order by npa.starts_on desc, npa.created_at desc
    limit 1
  )
  select
    p.id as partner_id,
    p.organization_name,
    station.station_id,
    station.station_name,
    station.county_name
  from active_assignment assignment
  join atlas.partners p on p.id = assignment.partner_id
  left join lateral (
    select ps.id as station_id, ps.station_name, c.county_name
    from atlas.partner_stations ps
    left join atlas.counties c on c.id = ps.county_id
    where ps.partner_id = p.id and ps.is_active = true
    order by ps.created_at asc
    limit 1
  ) station on true;
$$;

revoke all on function atlas.fn_get_my_navigator_station_context() from public;
grant execute on function atlas.fn_get_my_navigator_station_context() to authenticated;

notify pgrst, 'reload schema';
