create schema if not exists atlas;

create extension if not exists pgcrypto;

create table if not exists atlas.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key in ('navigator', 'partner', 'administrator', 'enrollee')),
  role_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists atlas.people (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  email text,
  phone text,
  person_type text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.people_role_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  role_id uuid not null references atlas.roles(id) on delete restrict,
  is_primary boolean not null default false,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now()
);
create index if not exists idx_people_role_assignments_person on atlas.people_role_assignments(person_id);
create index if not exists idx_people_role_assignments_role on atlas.people_role_assignments(role_id);

create table if not exists atlas.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique,
  iso3 text not null unique,
  country_name text not null
);

create table if not exists atlas.states (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references atlas.countries(id) on delete restrict,
  state_code text not null,
  state_name text not null,
  unique(country_id, state_code)
);

create table if not exists atlas.counties (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references atlas.states(id) on delete restrict,
  county_name text not null,
  fips_code text,
  unique(state_id, county_name)
);

create table if not exists atlas.addresses (
  id uuid primary key default gen_random_uuid(),
  line1 text not null,
  line2 text,
  city text not null,
  county_id uuid references atlas.counties(id) on delete set null,
  state_id uuid references atlas.states(id) on delete set null,
  country_id uuid references atlas.countries(id) on delete set null,
  postal_code text,
  latitude numeric(10,6),
  longitude numeric(10,6)
);

create table if not exists atlas.partners (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_name_normalized text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.partner_stations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references atlas.partners(id) on delete cascade,
  station_name text not null,
  county_id uuid references atlas.counties(id) on delete set null,
  address_id uuid references atlas.addresses(id) on delete set null,
  capacity_total int not null default 0,
  capacity_available int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_stations_partner on atlas.partner_stations(partner_id);

create table if not exists atlas.partner_station_icons (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references atlas.partner_stations(id) on delete cascade,
  icon_url text,
  icon_slug text,
  is_primary boolean not null default true
);

create table if not exists atlas.enrollees (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references atlas.people(id) on delete cascade,
  case_id text unique,
  dob date,
  avatar_url text,
  current_phase text not null default 'regulation' check (current_phase in ('regulation', 'readiness', 'renewal')),
  county_id uuid references atlas.counties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'assigned')),
  source text not null default 'referral_portal',
  notes text
);
create index if not exists idx_enrollment_requests_status on atlas.enrollment_requests(status);

create table if not exists atlas.enrollments (
  id uuid primary key default gen_random_uuid(),
  enrollee_id uuid not null references atlas.enrollees(id) on delete cascade,
  start_date date not null,
  target_duration_months int not null default 6 check (target_duration_months between 6 and 12),
  expected_end_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create or replace function atlas.fn_sync_enrollment_expected_end_date()
returns trigger
language plpgsql
as $$
begin
  new.expected_end_date := (new.start_date + make_interval(months => new.target_duration_months))::date;
  return new;
end;
$$;

drop trigger if exists trg_sync_enrollment_expected_end_date on atlas.enrollments;
create trigger trg_sync_enrollment_expected_end_date
before insert or update of start_date, target_duration_months on atlas.enrollments
for each row execute function atlas.fn_sync_enrollment_expected_end_date();

create table if not exists atlas.navigator_assignments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id) on delete cascade,
  navigator_person_id uuid not null references atlas.people(id) on delete restrict,
  station_id uuid references atlas.partner_stations(id) on delete set null,
  starts_on date not null default current_date,
  ends_on date
);
create index if not exists idx_navigator_assignments_enrollment on atlas.navigator_assignments(enrollment_id);

create table if not exists atlas.z_codes (
  id uuid primary key default gen_random_uuid(),
  z_code text not null unique,
  z_group int,
  title text not null,
  description text,
  is_active boolean not null default true
);

create table if not exists atlas.z_code_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique check (category_key in ('habitat', 'work', 'social_network')),
  category_name text not null
);

create table if not exists atlas.z_code_category_map (
  id uuid primary key default gen_random_uuid(),
  z_code_id uuid not null references atlas.z_codes(id) on delete cascade,
  category_id uuid not null references atlas.z_code_categories(id) on delete cascade,
  weight numeric(5,4) not null default 1.0 check (weight > 0 and weight <= 1.0),
  unique(z_code_id, category_id)
);

create table if not exists atlas.enrollee_z_codes (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id) on delete cascade,
  z_code_id uuid not null references atlas.z_codes(id) on delete restrict,
  is_resolved boolean not null default false,
  resolution_at timestamptz,
  source text not null default 'manual',
  effective_at timestamptz not null default now(),
  ended_at timestamptz,
  unique(enrollment_id, z_code_id, effective_at)
);
create index if not exists idx_enrollee_z_codes_active on atlas.enrollee_z_codes(enrollment_id, z_code_id) where ended_at is null;

create table if not exists atlas.partner_z_code_capabilities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references atlas.partners(id) on delete cascade,
  z_code_id uuid not null references atlas.z_codes(id) on delete cascade,
  relation_type text not null check (relation_type in ('specialize', 'interfere')),
  strength numeric(6,4) not null default 1.0,
  source text not null default 'survey',
  source_submitted_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(partner_id, z_code_id, relation_type, source)
);
create index if not exists idx_partner_z_capability_lookup on atlas.partner_z_code_capabilities(partner_id, z_code_id, relation_type);

create table if not exists atlas.referrals (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id) on delete cascade,
  referred_by_person_id uuid references atlas.people(id) on delete set null,
  station_id uuid references atlas.partner_stations(id) on delete set null,
  z_code_id uuid references atlas.z_codes(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'in_progress', 'completed', 'declined')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  referred_at timestamptz not null default now()
);

create table if not exists atlas.route_plans (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id) on delete cascade,
  created_by_person_id uuid references atlas.people(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists atlas.route_plan_stops (
  id uuid primary key default gen_random_uuid(),
  route_plan_id uuid not null references atlas.route_plans(id) on delete cascade,
  station_id uuid not null references atlas.partner_stations(id) on delete restrict,
  z_code_id uuid references atlas.z_codes(id) on delete set null,
  stop_order int not null,
  assigned_date date not null,
  target_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'blocked')),
  unique(route_plan_id, stop_order)
);

create table if not exists atlas.journey_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id) on delete cascade,
  route_plan_stop_id uuid references atlas.route_plan_stops(id) on delete set null,
  milestone_type text not null default 'intervention' check (milestone_type in ('intervention', 'verifiedMilestone', 'sustainedChange')),
  phase text not null check (phase in ('regulation', 'readiness', 'renewal')),
  label text not null,
  happened_at timestamptz not null default now(),
  station_icon_slug text,
  domains_relieved text[] not null default '{}',
  created_by_person_id uuid references atlas.people(id) on delete set null
);

create table if not exists atlas.timeline_settings (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references atlas.enrollments(id) on delete cascade,
  plan_start_date date not null,
  duration_months int not null check (duration_months between 6 and 12),
  regulation_cutoff_month int not null default 2,
  readiness_cutoff_month int not null default 4,
  updated_at timestamptz not null default now()
);

create table if not exists atlas.station_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references atlas.partner_stations(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  active_enrollments int not null default 0,
  z_codes_resolved_count int not null default 0,
  habitat_load numeric(6,2) not null default 0,
  work_load numeric(6,2) not null default 0,
  social_network_load numeric(6,2) not null default 0
);

create table if not exists atlas.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid references atlas.people(id) on delete set null,
  event_type text not null,
  entity_name text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function atlas.fn_normalize_org_name(input text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function atlas.fn_rank_route_candidates(p_enrollment_id uuid)
returns table(
  station_id uuid,
  partner_id uuid,
  station_name text,
  score numeric,
  specialize_hits int,
  conflict_hits int,
  interfere_hits int
)
language sql
stable
as $$
with active_codes as (
  select ez.z_code_id
  from atlas.enrollee_z_codes ez
  where ez.enrollment_id = p_enrollment_id
    and ez.ended_at is null
),
pairs as (
  select
    ps.id as station_id,
    ps.partner_id,
    ps.station_name,
    ac.z_code_id,
    max(case when pzc.relation_type = 'specialize' and pzc.is_active then 1 else 0 end) as has_specialize,
    max(case when pzc.relation_type = 'interfere' and pzc.is_active then 1 else 0 end) as has_interfere,
    max(case when pzc.relation_type = 'specialize' and pzc.is_active then pzc.strength else 0 end) as specialize_strength
  from atlas.partner_stations ps
  cross join active_codes ac
  left join atlas.partner_z_code_capabilities pzc
    on pzc.partner_id = ps.partner_id
   and pzc.z_code_id = ac.z_code_id
  where ps.is_active = true
  group by ps.id, ps.partner_id, ps.station_name, ac.z_code_id
),
agg as (
  select
    station_id,
    partner_id,
    station_name,
    sum(case when has_specialize = 1 and has_interfere = 0 then 1 else 0 end) as specialize_hits,
    sum(case when has_specialize = 1 and has_interfere = 1 then 1 else 0 end) as conflict_hits,
    sum(case when has_specialize = 0 and has_interfere = 1 then 1 else 0 end) as interfere_hits,
    sum(specialize_strength) as specialize_strength
  from pairs
  group by station_id, partner_id, station_name
)
select
  station_id,
  partner_id,
  station_name,
  (specialize_hits * 10.0) + (specialize_strength * 2.0) - (conflict_hits * 6.0) - (interfere_hits * 4.0) as score,
  specialize_hits,
  conflict_hits,
  interfere_hits
from agg
order by score desc, specialize_hits desc, conflict_hits asc, interfere_hits asc, station_name asc;
$$;

create or replace function atlas.fn_log_audit()
returns trigger
language plpgsql
as $$
begin
  insert into atlas.audit_events(actor_person_id, event_type, entity_name, entity_id, payload)
  values (null, tg_op, tg_table_name, coalesce(new.id::text, old.id::text), to_jsonb(coalesce(new, old)));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_route_plan_stops on atlas.route_plan_stops;
create trigger trg_audit_route_plan_stops
after insert or update or delete on atlas.route_plan_stops
for each row execute function atlas.fn_log_audit();

drop trigger if exists trg_audit_enrollee_z_codes on atlas.enrollee_z_codes;
create trigger trg_audit_enrollee_z_codes
after insert or update or delete on atlas.enrollee_z_codes
for each row execute function atlas.fn_log_audit();

create or replace view atlas.v_navigator_assigned_enrollees as
select
  na.navigator_person_id,
  en.id as enrollment_id,
  e.id as enrollee_id,
  p.display_name as enrollee_name,
  e.case_id,
  e.current_phase,
  e.avatar_url
from atlas.navigator_assignments na
join atlas.enrollments en on en.id = na.enrollment_id and en.status = 'active'
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
where na.ends_on is null;

create or replace view atlas.v_enrollment_station_markers as
select
  rps.id as route_plan_stop_id,
  rp.enrollment_id,
  rps.assigned_date::timestamptz as assigned_at,
  rps.status,
  ps.id as station_id,
  ps.station_name,
  psi.icon_slug
from atlas.route_plan_stops rps
join atlas.route_plans rp on rp.id = rps.route_plan_id
join atlas.partner_stations ps on ps.id = rps.station_id
left join atlas.partner_station_icons psi on psi.station_id = ps.id and psi.is_primary = true;

create or replace view atlas.v_navigator_enrollment_requests as
select
  er.id as request_id,
  er.submitted_at,
  er.status,
  p.display_name as prospective_enrollee,
  p.email
from atlas.enrollment_requests er
join atlas.people p on p.id = er.person_id
where er.status in ('pending', 'accepted');

create or replace view atlas.v_navigator_route_candidates as
select
  en.id as enrollment_id,
  ranked.station_id,
  ranked.partner_id,
  ranked.station_name,
  ranked.score,
  ranked.specialize_hits,
  ranked.conflict_hits,
  ranked.interfere_hits
from atlas.enrollments en
cross join lateral atlas.fn_rank_route_candidates(en.id) ranked
where en.status = 'active';

create or replace view atlas.v_navigator_my_station_metrics as
select
  ps.id as station_id,
  ps.station_name,
  sms.snapshot_at,
  sms.active_enrollments,
  sms.z_codes_resolved_count,
  sms.habitat_load,
  sms.work_load,
  sms.social_network_load
from atlas.partner_stations ps
join atlas.station_metric_snapshots sms on sms.station_id = ps.id;

create or replace view atlas.v_partner_station_profile as
select
  ps.id as station_id,
  ps.station_name,
  p.organization_name,
  ps.capacity_total,
  ps.capacity_available,
  c.county_name
from atlas.partner_stations ps
join atlas.partners p on p.id = ps.partner_id
left join atlas.counties c on c.id = ps.county_id
where ps.is_active = true;

create or replace view atlas.v_partner_z_code_burden as
select
  ps.id as station_id,
  p.id as partner_id,
  zcc.category_key,
  count(*)::int as z_code_count
from atlas.partner_stations ps
join atlas.partners p on p.id = ps.partner_id
join atlas.partner_z_code_capabilities pzc on pzc.partner_id = p.id and pzc.is_active = true and pzc.relation_type = 'specialize'
join atlas.z_code_category_map zcm on zcm.z_code_id = pzc.z_code_id
join atlas.z_code_categories zcc on zcc.id = zcm.category_id
group by ps.id, p.id, zcc.category_key;

create or replace view atlas.v_county_z_code_heatmap as
select
  c.id as county_id,
  c.county_name,
  z.z_group,
  count(*)::int as active_case_count
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.counties c on c.id = e.county_id
join atlas.enrollee_z_codes ez on ez.enrollment_id = en.id and ez.ended_at is null
join atlas.z_codes z on z.id = ez.z_code_id
where en.status = 'active'
group by c.id, c.county_name, z.z_group;

create or replace view atlas.v_admin_data_quality as
select
  'orphaned_enrollees'::text as metric,
  count(*)::bigint as count_value
from atlas.enrollees e
left join atlas.enrollments en on en.enrollee_id = e.id
where en.id is null
union all
select
  'partner_capabilities_missing_group'::text as metric,
  count(*)::bigint as count_value
from atlas.partner_z_code_capabilities pzc
join atlas.z_codes z on z.id = pzc.z_code_id
where z.z_group is null;

create or replace view atlas.v_admin_ingestion_status as
select
  p.organization_name,
  count(*) filter (where pzc.relation_type = 'specialize') as specialization_rows,
  count(*) filter (where pzc.relation_type = 'interfere') as interference_rows,
  max(pzc.created_at) as last_ingested_at
from atlas.partners p
left join atlas.partner_z_code_capabilities pzc on pzc.partner_id = p.id
group by p.organization_name;

alter table atlas.people enable row level security;
alter table atlas.enrollees enable row level security;
alter table atlas.enrollments enable row level security;
alter table atlas.partner_stations enable row level security;
alter table atlas.journey_logs enable row level security;

drop policy if exists people_admin_all on atlas.people;
create policy people_admin_all on atlas.people
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists enrollees_admin_all on atlas.enrollees;
create policy enrollees_admin_all on atlas.enrollees
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists enrollments_admin_all on atlas.enrollments;
create policy enrollments_admin_all on atlas.enrollments
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists partner_stations_admin_all on atlas.partner_stations;
create policy partner_stations_admin_all on atlas.partner_stations
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists journey_logs_admin_all on atlas.journey_logs;
create policy journey_logs_admin_all on atlas.journey_logs
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');;
