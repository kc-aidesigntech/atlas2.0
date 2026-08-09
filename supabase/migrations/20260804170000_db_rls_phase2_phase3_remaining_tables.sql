-- Database Row-Level Security (RLS) plan, Phases 2 and 3:
-- close the remaining 14 atlas tables that still had RLS disabled after Phase 1.
--
-- Access model summary:
-- - Authorization catalogs (roles/permissions) stay readable to authenticated users
--   for admin access-matrix UI; writes remain RPC/service only (no write grants).
-- - Sensitive authz config and exceptions get admin-only policies but stay without
--   table grants (SECURITY DEFINER helpers already bypass RLS).
-- - Enrollment-scoped operational tables get staff/admin policies as defense in depth
--   without newly granting PostgREST SELECT (current app paths use definer views/RPCs).
-- - Warehouse watermarks stay service_role-only (no app policies / no app grants).
-- - Audit trigger function becomes SECURITY DEFINER so inserts keep working once
--   audit_events has RLS enabled.

-- ---------------------------------------------------------------------------
-- Trigger hardening: audit inserts must not depend on the calling role's RLS.
-- ---------------------------------------------------------------------------
create or replace function atlas.fn_log_audit()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  insert into atlas.audit_events(actor_person_id, event_type, entity_name, entity_id, payload)
  values (null, tg_op, tg_table_name, coalesce(new.id::text, old.id::text), to_jsonb(coalesce(new, old)));
  return coalesce(new, old);
end;
$$;

revoke all on function atlas.fn_log_audit() from public;
grant execute on function atlas.fn_log_audit() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Phase 2: authorization / configuration tables
-- ---------------------------------------------------------------------------
-- roles already had authenticated SELECT (access matrix). permissions / role_permissions
-- are non-PHI catalogs used by SECURITY DEFINER authz helpers; explicit SELECT keeps
-- them usable if the admin UI expands beyond roles.
grant select on atlas.roles to authenticated;
grant select on atlas.permissions to authenticated;
grant select on atlas.role_permissions to authenticated;

alter table atlas.roles enable row level security;
alter table atlas.permissions enable row level security;
alter table atlas.role_permissions enable row level security;
alter table atlas.user_permission_exceptions enable row level security;
alter table atlas.authorization_settings enable row level security;

drop policy if exists roles_authenticated_select on atlas.roles;
create policy roles_authenticated_select
  on atlas.roles
  for select
  to authenticated
  using (true);

drop policy if exists permissions_authenticated_select on atlas.permissions;
create policy permissions_authenticated_select
  on atlas.permissions
  for select
  to authenticated
  using (true);

drop policy if exists role_permissions_authenticated_select on atlas.role_permissions;
create policy role_permissions_authenticated_select
  on atlas.role_permissions
  for select
  to authenticated
  using (true);

-- Exceptions and authz toggles are security-sensitive; administrators only.
-- No table grants: fn_has_permission / fn_authz_setting_enabled are SECURITY DEFINER.
drop policy if exists user_permission_exceptions_admin_select on atlas.user_permission_exceptions;
create policy user_permission_exceptions_admin_select
  on atlas.user_permission_exceptions
  for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists authorization_settings_admin_select on atlas.authorization_settings;
create policy authorization_settings_admin_select
  on atlas.authorization_settings
  for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

revoke insert, update, delete on atlas.roles from anon, authenticated;
revoke insert, update, delete on atlas.permissions from anon, authenticated;
revoke insert, update, delete on atlas.role_permissions from anon, authenticated;
revoke all on atlas.user_permission_exceptions from anon, authenticated;
revoke all on atlas.authorization_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Phase 3: workflow / analytics / address tables
-- ---------------------------------------------------------------------------
alter table atlas.timeline_settings enable row level security;
alter table atlas.enrollment_requests enable row level security;
alter table atlas.referrals enable row level security;
alter table atlas.route_plans enable row level security;
alter table atlas.route_plan_stops enable row level security;
alter table atlas.station_metric_snapshots enable row level security;
alter table atlas.addresses enable row level security;
alter table atlas.audit_events enable row level security;
alter table atlas.dw_export_watermarks enable row level security;

-- Timeline settings are enrollment-scoped Protected Health Information (PHI) config.
drop policy if exists timeline_settings_admin_all on atlas.timeline_settings;
create policy timeline_settings_admin_all
  on atlas.timeline_settings
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists timeline_settings_staff_select on atlas.timeline_settings;
create policy timeline_settings_staff_select
  on atlas.timeline_settings
  for select
  to authenticated
  using (atlas.fn_can_access_enrollment_as_staff(enrollment_id));

-- Intake queue: administrators manage; navigators/supervisors may read pending work.
drop policy if exists enrollment_requests_admin_all on atlas.enrollment_requests;
create policy enrollment_requests_admin_all
  on atlas.enrollment_requests
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists enrollment_requests_staff_select on atlas.enrollment_requests;
create policy enrollment_requests_staff_select
  on atlas.enrollment_requests
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') in ('navigator', 'supervisor')
  );

drop policy if exists referrals_admin_all on atlas.referrals;
create policy referrals_admin_all
  on atlas.referrals
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists referrals_staff_select on atlas.referrals;
create policy referrals_staff_select
  on atlas.referrals
  for select
  to authenticated
  using (atlas.fn_can_access_enrollment_as_staff(enrollment_id));

drop policy if exists route_plans_admin_all on atlas.route_plans;
create policy route_plans_admin_all
  on atlas.route_plans
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists route_plans_staff_select on atlas.route_plans;
create policy route_plans_staff_select
  on atlas.route_plans
  for select
  to authenticated
  using (atlas.fn_can_access_enrollment_as_staff(enrollment_id));

drop policy if exists route_plan_stops_admin_all on atlas.route_plan_stops;
create policy route_plan_stops_admin_all
  on atlas.route_plan_stops
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

drop policy if exists route_plan_stops_staff_select on atlas.route_plan_stops;
create policy route_plan_stops_staff_select
  on atlas.route_plan_stops
  for select
  to authenticated
  using (
    exists (
      select 1
      from atlas.route_plans rp
      where rp.id = route_plan_stops.route_plan_id
        and atlas.fn_can_access_enrollment_as_staff(rp.enrollment_id)
    )
  );

-- Station metric snapshots are aggregate operational stats, not enrollee PHI.
drop policy if exists station_metric_snapshots_authenticated_select on atlas.station_metric_snapshots;
create policy station_metric_snapshots_authenticated_select
  on atlas.station_metric_snapshots
  for select
  to authenticated
  using (true);

-- Addresses support station/partner directory lookups; keep read-only for app roles.
drop policy if exists addresses_authenticated_select on atlas.addresses;
create policy addresses_authenticated_select
  on atlas.addresses
  for select
  to authenticated
  using (true);

drop policy if exists audit_events_admin_select on atlas.audit_events;
create policy audit_events_admin_select
  on atlas.audit_events
  for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

-- Do not newly grant SELECT on enrollment-scoped / audit / address tables: they were
-- not PostgREST-exposed before (no anon/authenticated grants). Policies above are
-- ready for intentional grants or security_invoker view conversion later.
revoke all on atlas.timeline_settings from anon, authenticated;
revoke all on atlas.enrollment_requests from anon, authenticated;
revoke all on atlas.referrals from anon, authenticated;
revoke all on atlas.route_plans from anon, authenticated;
revoke all on atlas.route_plan_stops from anon, authenticated;
revoke all on atlas.station_metric_snapshots from anon, authenticated;
revoke all on atlas.addresses from anon, authenticated;
revoke all on atlas.audit_events from anon, authenticated;

-- Pipeline watermark state: service_role only (rolbypassrls). No app policies.
revoke all on atlas.dw_export_watermarks from anon, authenticated;
grant select, insert, update, delete on atlas.dw_export_watermarks to service_role;

notify pgrst, 'reload schema';
