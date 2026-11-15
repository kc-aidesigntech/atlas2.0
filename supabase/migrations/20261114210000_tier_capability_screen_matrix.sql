-- Tier, capability, and screen catalogs.
--
-- atlas.roles and atlas.permissions stay the enforcement tables that
-- atlas.fn_has_permission reads. These catalogs are the matrix the product
-- anchors to: one row per tier, one row per capability, and bridge rows for
-- which tier holds which capability and which screen that capability opens.
-- A screen is visible when the viewer holds any capability linked to it.

create table if not exists atlas.tiers (
  tier_key text primary key,
  label text not null,
  sort_order integer not null unique,
  created_at timestamptz not null default now(),
  constraint tiers_tier_key_check check (tier_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus'))
);

create table if not exists atlas.capabilities (
  capability_key text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists atlas.tier_capabilities (
  tier_key text not null references atlas.tiers (tier_key) on delete cascade,
  capability_key text not null references atlas.capabilities (capability_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tier_key, capability_key)
);

-- Expands a capability into the permission keys fn_has_permission already checks.
create table if not exists atlas.capability_permissions (
  capability_key text not null references atlas.capabilities (capability_key) on delete cascade,
  permission_key text not null references atlas.permissions (permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (capability_key, permission_key)
);

create table if not exists atlas.screens (
  screen_key text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists atlas.screen_capabilities (
  screen_key text not null references atlas.screens (screen_key) on delete cascade,
  capability_key text not null references atlas.capabilities (capability_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (screen_key, capability_key)
);

insert into atlas.tiers (tier_key, label, sort_order)
values
  ('t1', 'Candidate', 1),
  ('t2', 'Apprentice', 2),
  ('t2b', 'Peer Resident', 3),
  ('t3', 'Travel Peer', 4),
  ('t3a', 'Peer Navigator', 5),
  ('t4', 'Supervisor', 6),
  ('t4plus', 'Coordinator', 7)
on conflict (tier_key) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

insert into atlas.capabilities (capability_key, label, description)
values
  ('refer', 'Can refer', 'Submit a referral.'),
  ('be_sponsored', 'Can be sponsored', 'Be named as the sponsored person.'),
  ('wallet_and_competency_cards', 'Wallet and competency cards', 'Open My Wallet and view competency cards.'),
  ('receive_supervision', 'Receive supervision', 'Receive supervision and competency assessments.'),
  ('sponsor', 'Can sponsor', 'Sponsor another person.'),
  ('engage_leads', 'Engage leads', 'Work the leads pipeline.'),
  ('warmline_and_respite', 'Warmline and respite shifts', 'Sit the warm line and take respite shifts.'),
  ('enrollee_profiles_and_regulation', 'Enrollee profiles and regulation variables', 'Write enrollee profiles and regulation variables.'),
  ('travel_peer_schedule', 'Travel peer schedule (secondment)', 'View the secondment schedule.'),
  ('pickup_routes_z_burden', 'Pick up enrollees, plan routes, resolve z-burden', 'Claim pickups, plan routes, and resolve Z-code burden.'),
  ('supervise_users', 'Supervise users', 'Claim navigators and record supervision.'),
  ('partner_station_operations', 'Partner (station) profiles, milestones, heat map', 'Edit partner stations, milestones, and the county heat map.')
on conflict (capability_key) do update
set label = excluded.label,
    description = excluded.description;

insert into atlas.capability_permissions (capability_key, permission_key)
select capability_key, permission_key
from (
  values
    ('refer', 'referral.submit'),
    ('be_sponsored', 'sponsorship.receive'),
    ('wallet_and_competency_cards', 'wallet.access'),
    ('wallet_and_competency_cards', 'competency_cards.view'),
    ('receive_supervision', 'supervision.receive'),
    ('sponsor', 'sponsorship.give'),
    ('engage_leads', 'leads.engage'),
    ('warmline_and_respite', 'warmline_agent.access'),
    ('warmline_and_respite', 'respite_shifts.take'),
    ('enrollee_profiles_and_regulation', 'enrollee_profile.write'),
    ('enrollee_profiles_and_regulation', 'regulation_variables.write'),
    ('travel_peer_schedule', 'secondment_schedule.view'),
    ('pickup_routes_z_burden', 'pickup.claim'),
    ('pickup_routes_z_burden', 'route_plan.write'),
    ('pickup_routes_z_burden', 'z_burden.resolve'),
    ('supervise_users', 'supervision.give'),
    ('partner_station_operations', 'partner_profile.write'),
    ('partner_station_operations', 'partner_milestones.write'),
    ('partner_station_operations', 'heatmap.view'),
    ('partner_station_operations', 'heatmap.toggle')
) as expansion(capability_key, permission_key)
on conflict (capability_key, permission_key) do nothing;

-- The matrix below is the tier-to-capability bridge. t4plus does not list
-- "Supervise users"; that capability is t4. A t4plus system administrator
-- still passes every permission key through atlas.fn_is_system_admin().
insert into atlas.tier_capabilities (tier_key, capability_key)
select tier_key, capability_key
from (
  values
    ('t1', 'refer'),
    ('t1', 'be_sponsored'),
    ('t2', 'refer'),
    ('t2', 'be_sponsored'),
    ('t2', 'wallet_and_competency_cards'),
    ('t2', 'receive_supervision'),
    ('t2b', 'refer'),
    ('t2b', 'sponsor'),
    ('t2b', 'wallet_and_competency_cards'),
    ('t2b', 'receive_supervision'),
    ('t2b', 'engage_leads'),
    ('t2b', 'warmline_and_respite'),
    ('t2b', 'enrollee_profiles_and_regulation'),
    ('t3', 'refer'),
    ('t3', 'sponsor'),
    ('t3', 'wallet_and_competency_cards'),
    ('t3', 'receive_supervision'),
    ('t3', 'travel_peer_schedule'),
    ('t3a', 'refer'),
    ('t3a', 'sponsor'),
    ('t3a', 'wallet_and_competency_cards'),
    ('t3a', 'receive_supervision'),
    ('t3a', 'engage_leads'),
    ('t3a', 'warmline_and_respite'),
    ('t3a', 'enrollee_profiles_and_regulation'),
    ('t3a', 'pickup_routes_z_burden'),
    ('t4', 'refer'),
    ('t4', 'sponsor'),
    ('t4', 'wallet_and_competency_cards'),
    ('t4', 'receive_supervision'),
    ('t4', 'engage_leads'),
    ('t4', 'warmline_and_respite'),
    ('t4', 'enrollee_profiles_and_regulation'),
    ('t4', 'supervise_users'),
    ('t4plus', 'refer'),
    ('t4plus', 'sponsor'),
    ('t4plus', 'wallet_and_competency_cards'),
    ('t4plus', 'receive_supervision'),
    ('t4plus', 'engage_leads'),
    ('t4plus', 'warmline_and_respite'),
    ('t4plus', 'enrollee_profiles_and_regulation'),
    ('t4plus', 'partner_station_operations')
) as matrix(tier_key, capability_key)
on conflict (tier_key, capability_key) do nothing;

insert into atlas.screens (screen_key, label)
values
  ('refer', 'Refer'),
  ('my wallet', 'My wallet'),
  ('competency cards', 'Competency cards'),
  ('sponsorships', 'Sponsorships'),
  ('leads', 'Leads'),
  ('warm line', 'Warm line'),
  ('respite shifts', 'Respite shifts'),
  ('enrollees', 'Enrollees'),
  ('route planning', 'Route planning'),
  ('secondment schedule', 'Secondment schedule'),
  ('team burden', 'Team burden'),
  ('cohorts', 'Cohorts'),
  ('partners', 'Partners'),
  ('county commons', 'County heat map')
on conflict (screen_key) do update
set label = excluded.label;

-- Holding any linked capability is enough to open the screen.
insert into atlas.screen_capabilities (screen_key, capability_key)
select screen_key, capability_key
from (
  values
    ('refer', 'refer'),
    ('my wallet', 'wallet_and_competency_cards'),
    ('competency cards', 'wallet_and_competency_cards'),
    ('sponsorships', 'sponsor'),
    ('sponsorships', 'be_sponsored'),
    ('leads', 'engage_leads'),
    ('warm line', 'warmline_and_respite'),
    ('respite shifts', 'warmline_and_respite'),
    ('enrollees', 'enrollee_profiles_and_regulation'),
    ('route planning', 'pickup_routes_z_burden'),
    ('secondment schedule', 'travel_peer_schedule'),
    ('team burden', 'supervise_users'),
    ('cohorts', 'supervise_users'),
    ('partners', 'partner_station_operations'),
    ('county commons', 'partner_station_operations')
) as bridge(screen_key, capability_key)
on conflict (screen_key, capability_key) do nothing;

-- Keep role_permissions aligned with the matrix without removing grants that
-- sit outside it (partner capacity keys, and t4plus supervision.give).
insert into atlas.role_permissions (role_id, permission_id)
select r.id, p.id
from atlas.tier_capabilities tc
join atlas.capability_permissions cp on cp.capability_key = tc.capability_key
join atlas.roles r on r.role_key = tc.tier_key
join atlas.permissions p on p.permission_key = cp.permission_key
on conflict (role_id, permission_id) do nothing;

create or replace function atlas.fn_tier_capability_matrix()
returns table (
  tier_key text,
  capability_key text,
  capability_label text
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  select t.tier_key, c.capability_key, c.label
  from atlas.tier_capabilities tc
  join atlas.tiers t on t.tier_key = tc.tier_key
  join atlas.capabilities c on c.capability_key = tc.capability_key
  order by t.sort_order, c.capability_key;
$$;

create or replace function atlas.fn_screen_capability_matrix()
returns table (
  screen_key text,
  capability_key text
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  select sc.screen_key, sc.capability_key
  from atlas.screen_capabilities sc
  order by sc.screen_key, sc.capability_key;
$$;

revoke all on function atlas.fn_tier_capability_matrix() from public;
revoke all on function atlas.fn_screen_capability_matrix() from public;
grant execute on function atlas.fn_tier_capability_matrix() to authenticated;
grant execute on function atlas.fn_screen_capability_matrix() to authenticated;

alter table atlas.tiers enable row level security;
alter table atlas.capabilities enable row level security;
alter table atlas.tier_capabilities enable row level security;
alter table atlas.capability_permissions enable row level security;
alter table atlas.screens enable row level security;
alter table atlas.screen_capabilities enable row level security;

drop policy if exists tiers_authenticated_select on atlas.tiers;
create policy tiers_authenticated_select on atlas.tiers for select to authenticated using (true);
drop policy if exists capabilities_authenticated_select on atlas.capabilities;
create policy capabilities_authenticated_select on atlas.capabilities for select to authenticated using (true);
drop policy if exists tier_capabilities_authenticated_select on atlas.tier_capabilities;
create policy tier_capabilities_authenticated_select on atlas.tier_capabilities for select to authenticated using (true);
drop policy if exists capability_permissions_authenticated_select on atlas.capability_permissions;
create policy capability_permissions_authenticated_select on atlas.capability_permissions for select to authenticated using (true);
drop policy if exists screens_authenticated_select on atlas.screens;
create policy screens_authenticated_select on atlas.screens for select to authenticated using (true);
drop policy if exists screen_capabilities_authenticated_select on atlas.screen_capabilities;
create policy screen_capabilities_authenticated_select on atlas.screen_capabilities for select to authenticated using (true);

grant select on atlas.tiers to authenticated;
grant select on atlas.capabilities to authenticated;
grant select on atlas.tier_capabilities to authenticated;
grant select on atlas.capability_permissions to authenticated;
grant select on atlas.screens to authenticated;
grant select on atlas.screen_capabilities to authenticated;
