grant usage on schema atlas to anon, authenticated;

create or replace view atlas.v_partner_station_directory as
select
  p.id as partner_id,
  p.organization_name,
  p.organization_name_normalized,
  ps.id as station_id,
  ps.station_name,
  c.county_name,
  p.primary_contact_first_name,
  p.primary_contact_last_name,
  p.primary_contact_email,
  ps.capacity_total,
  ps.capacity_available
from atlas.partner_stations ps
join atlas.partners p on p.id = ps.partner_id
left join atlas.counties c on c.id = ps.county_id
where ps.is_active = true;

create or replace view atlas.v_people_directory as
select
  p.id,
  p.display_name
from atlas.people p
where p.status = 'active';

grant select on atlas.v_navigator_assigned_enrollees to anon, authenticated;
grant select on atlas.v_enrollment_station_markers to anon, authenticated;
grant select on atlas.v_navigator_enrollment_requests to anon, authenticated;
grant select on atlas.v_partner_z_code_burden to anon, authenticated;
grant select on atlas.v_county_z_code_heatmap to anon, authenticated;
grant select on atlas.v_admin_data_quality to anon, authenticated;
grant select on atlas.v_partner_station_directory to anon, authenticated;
grant select on atlas.v_people_directory to anon, authenticated;

notify pgrst, 'reload schema';
