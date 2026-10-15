-- The Heroku app connects with the Supabase secret key, which uses the
-- service_role database role. That role can bypass Row-Level Security (RLS),
-- and it still needs schema and table privileges. Usage on atlas was granted
-- only to anon and authenticated, so the fleet list failed with permission
-- denied for schema atlas.
grant usage on schema atlas to service_role;

grant select, insert, update, delete on table atlas.prayphone_devices to service_role;
grant select, insert, update, delete on table atlas.prayphone_device_logs to service_role;
grant select, insert, update, delete on table atlas.prayphone_call_sessions to service_role;
grant select, insert, update, delete on table atlas.prayphone_call_events to service_role;
grant select, insert, update, delete on table atlas.prayphone_kiosk_collections to service_role;
grant select, insert, update, delete on table atlas.prayphone_inbound_rings to service_role;
