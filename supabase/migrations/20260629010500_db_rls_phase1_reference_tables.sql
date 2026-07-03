-- Database Row-Level Security (RLS) plan, Phase 1:
-- harden low-risk reference tables while keeping authenticated read paths intact
-- for single-pane and radial load chart workflows.

-- These grants ensure security-invoker views and direct table reads can continue
-- once RLS is enabled for authenticated application users.
grant select on atlas.countries to authenticated;
grant select on atlas.states to authenticated;
grant select on atlas.z_code_categories to authenticated;
grant select on atlas.z_code_category_map to authenticated;
grant select on atlas.partner_station_icons to authenticated;

alter table atlas.countries enable row level security;
alter table atlas.states enable row level security;
alter table atlas.z_code_categories enable row level security;
alter table atlas.z_code_category_map enable row level security;
alter table atlas.partner_station_icons enable row level security;

drop policy if exists countries_authenticated_select on atlas.countries;
create policy countries_authenticated_select
  on atlas.countries
  for select
  to authenticated
  using (true);

drop policy if exists states_authenticated_select on atlas.states;
create policy states_authenticated_select
  on atlas.states
  for select
  to authenticated
  using (true);

drop policy if exists z_code_categories_authenticated_select on atlas.z_code_categories;
create policy z_code_categories_authenticated_select
  on atlas.z_code_categories
  for select
  to authenticated
  using (true);

drop policy if exists z_code_category_map_authenticated_select on atlas.z_code_category_map;
create policy z_code_category_map_authenticated_select
  on atlas.z_code_category_map
  for select
  to authenticated
  using (true);

drop policy if exists partner_station_icons_authenticated_select on atlas.partner_station_icons;
create policy partner_station_icons_authenticated_select
  on atlas.partner_station_icons
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
