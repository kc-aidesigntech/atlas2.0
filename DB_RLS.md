# Database Row-Level Security (RLS) Inventory

Last updated: 2026-06-28  
Source of truth: live metadata queries against Postgres system catalogs (`pg_class`, `pg_namespace`, `pg_policies`)

## Executive Snapshot

- This document inventories **Row-Level Security (RLS)** posture for all non-system schemas in this project database.
- Coverage by schema:
  - `atlas`: 56 tables (`37` RLS enabled, `19` RLS disabled)
  - `auth`: 23 tables (`16` enabled, `7` disabled)
  - `realtime`: 2 tables (`0` enabled, `2` disabled)
  - `storage`: 8 tables (`8` enabled, `0` disabled)
  - `supabase_migrations`: 1 table (`0` enabled, `1` disabled)
  - `vault`: 1 table (`0` enabled, `1` disabled)
- Critical app risk is concentrated in **`atlas` tables with RLS disabled**.

## Atlas Schema Table Inventory

| Table | RLS | Policy Count |
|---|---:|---:|
| `addresses` | disabled | 0 |
| `app_config_documents` | enabled | 1 |
| `app_role_navigation` | enabled | 2 |
| `assessment_answers` | enabled | 1 |
| `assessment_participants` | enabled | 1 |
| `assessment_submissions` | enabled | 1 |
| `audit_events` | disabled | 0 |
| `authorization_settings` | disabled | 0 |
| `counties` | enabled | 1 |
| `countries` | disabled | 0 |
| `demo_access_events` | enabled | 2 |
| `demo_record_tags` | enabled | 1 |
| `dw_export_watermarks` | disabled | 0 |
| `enrollee_burden_survey_answers` | enabled | 4 |
| `enrollee_burden_survey_submissions` | enabled | 4 |
| `enrollee_z_code_uncheck_log` | enabled | 1 |
| `enrollee_z_codes` | enabled | 1 |
| `enrollees` | enabled | 2 |
| `enrollment_requests` | disabled | 0 |
| `enrollments` | enabled | 2 |
| `journey_logs` | enabled | 1 |
| `legacy_decommission_registry` | enabled | 0 |
| `navigator_assignments` | enabled | 1 |
| `navigator_competency_assessment_answers` | enabled | 1 |
| `navigator_competency_assessments` | enabled | 1 |
| `navigator_partner_assignments` | enabled | 1 |
| `navigator_regulation_test_answers` | enabled | 1 |
| `navigator_regulation_test_submissions` | enabled | 1 |
| `partner_service_capacity_answers` | enabled | 4 |
| `partner_service_capacity_deletion_log` | enabled | 1 |
| `partner_service_capacity_submissions` | enabled | 4 |
| `partner_station_icons` | disabled | 0 |
| `partner_stations` | enabled | 2 |
| `partner_z_code_burden_scores` | enabled | 4 |
| `partner_z_code_capabilities` | enabled | 1 |
| `partners` | enabled | 1 |
| `people` | enabled | 2 |
| `people_role_assignments` | enabled | 1 |
| `permissions` | disabled | 0 |
| `profile_images` | enabled | 5 |
| `public_referral_intake_events` | enabled | 2 |
| `referrals` | disabled | 0 |
| `role_permissions` | disabled | 0 |
| `roles` | disabled | 0 |
| `route_plan_stops` | disabled | 0 |
| `route_plans` | disabled | 0 |
| `states` | disabled | 0 |
| `station_metric_snapshots` | disabled | 0 |
| `supervisor_navigator_assignments` | enabled | 1 |
| `timeline_settings` | disabled | 0 |
| `user_permission_exceptions` | disabled | 0 |
| `z_code_categories` | disabled | 0 |
| `z_code_category_map` | disabled | 0 |
| `z_code_headers` | enabled | 1 |
| `z_code_timeline_labels` | enabled | 1 |
| `z_codes` | enabled | 1 |

## Atlas Tables With RLS Disabled (Priority Remediation Set)

`addresses`, `audit_events`, `authorization_settings`, `countries`, `dw_export_watermarks`, `enrollment_requests`, `partner_station_icons`, `permissions`, `referrals`, `role_permissions`, `roles`, `route_plan_stops`, `route_plans`, `states`, `station_metric_snapshots`, `timeline_settings`, `user_permission_exceptions`, `z_code_categories`, `z_code_category_map`

## Atlas Tables With RLS Enabled But No Policies

- `legacy_decommission_registry` (default deny-all behavior until policies are added)

## Atlas Policy Inventory (Configured Policies)

This is the currently observed policy set in `atlas`:

- `app_config_documents`: `app_config_documents_authenticated_all (ALL, authenticated)`
- `app_role_navigation`: `app_role_navigation_admin_write (ALL, authenticated)`, `app_role_navigation_authenticated_select (SELECT, authenticated)`
- `assessment_answers`: `assessment_answers_select_scoped (SELECT, authenticated)`
- `assessment_participants`: `assessment_participants_select_scoped (SELECT, authenticated)`
- `assessment_submissions`: `assessment_submissions_select_scoped (SELECT, authenticated)`
- `counties`: `counties_authenticated_select (SELECT, authenticated)`
- `demo_access_events`: `demo_access_events_insert_authenticated (INSERT, authenticated)`, `demo_access_events_select_admin (SELECT, authenticated)`
- `demo_record_tags`: `demo_record_tags_authenticated_select (SELECT, authenticated)`
- `enrollee_burden_survey_answers`: select/insert/update/delete scoped policies (4 total)
- `enrollee_burden_survey_submissions`: select/insert/update/delete scoped policies (4 total)
- `enrollee_z_code_uncheck_log`: `enrollee_z_code_uncheck_log_staff_select (SELECT, authenticated)`
- `enrollee_z_codes`: `enrollee_z_codes_staff_select (SELECT, authenticated)`
- `enrollees`: `enrollees_admin_all (ALL, public)`, `enrollees_staff_select (SELECT, authenticated)`
- `enrollments`: `enrollments_admin_all (ALL, public)`, `enrollments_staff_select (SELECT, authenticated)`
- `journey_logs`: `journey_logs_admin_all (ALL, public)`
- `navigator_assignments`: `navigator_assignments_select_scoped (SELECT, authenticated)`
- `navigator_competency_assessment_answers`: `navigator_competency_assessment_answers_select_scoped (SELECT, authenticated)`
- `navigator_competency_assessments`: `navigator_competency_assessments_select_scoped (SELECT, authenticated)`
- `navigator_partner_assignments`: `navigator_partner_assignments_select_scoped (SELECT, authenticated)`
- `navigator_regulation_test_answers`: `navigator_regulation_test_answers_select_scoped (SELECT, authenticated)`
- `navigator_regulation_test_submissions`: `navigator_regulation_test_submissions_select_scoped (SELECT, authenticated)`
- `partner_service_capacity_answers`: select/insert/update/delete scoped policies (4 total)
- `partner_service_capacity_deletion_log`: `partner_service_capacity_deletion_log_admin_select (SELECT, authenticated)`
- `partner_service_capacity_submissions`: select/insert/update/delete scoped policies (4 total)
- `partner_stations`: `partner_stations_admin_all (ALL, public)`, `partner_stations_authenticated_select (SELECT, authenticated)`
- `partner_z_code_burden_scores`: select/insert/update/delete scoped policies (4 total)
- `partner_z_code_capabilities`: `partner_z_code_capabilities_authenticated_select (SELECT, authenticated)`
- `partners`: `partners_authenticated_select (SELECT, authenticated)`
- `people`: `people_admin_all (ALL, public)`, `people_directory_select (SELECT, authenticated)`
- `people_role_assignments`: `people_role_assignments_authenticated_select (SELECT, authenticated)`
- `profile_images`: admin-all plus authenticated CRUD-scoped policies (5 total)
- `public_referral_intake_events`: `public_referral_intake_events_insert_public (INSERT, anon+authenticated)`, `public_referral_intake_events_select_staff (SELECT, authenticated)`
- `supervisor_navigator_assignments`: `supervisor_navigator_assignments_select_scoped (SELECT, authenticated)`
- `z_code_headers`: `z_code_headers_public_select (SELECT, public)`
- `z_code_timeline_labels`: `z_code_timeline_labels_public_select (SELECT, public)`
- `z_codes`: `z_codes_public_select (SELECT, anon+authenticated)`

## Managed Schema Notes (Do Not Bulk-Modify Blindly)

- `auth`, `realtime`, `storage`, `supabase_migrations`, and `vault` are Supabase-managed schemas.
- Some tables intentionally run with RLS disabled in these schemas.
- Recommendation: treat any change outside `atlas` as a controlled, vendor-aware change request.

## Safe Rollout Plan for Atlas RLS Hardening

### Phase 0: Freeze and Verify

- Snapshot current grants and policies before changes.
- Confirm application roles actually used (`anon`, `authenticated`, service role paths, custom claims).

### Phase 1: Low-Risk Reference Tables

Enable RLS first on mostly read-only/reference tables and add explicit read policies:

- `countries`, `states`, `z_code_categories`, `z_code_category_map`, `partner_station_icons`

Implementation status:

- Completed via `supabase/migrations/20260629010500_db_rls_phase1_reference_tables.sql`.
- Scope intentionally keeps `authenticated` SELECT access explicit so single-pane radial load and related reference lookups continue to function under RLS.

### Phase 2: Configuration and Authorization Tables

Enable RLS and apply strict admin-only policies:

- `roles`, `permissions`, `role_permissions`, `user_permission_exceptions`, `authorization_settings`, `timeline_settings`

### Phase 3: Workflow and Analytics Tables

Enable RLS with scoped staff/admin policies:

- `enrollment_requests`, `referrals`, `route_plans`, `route_plan_stops`, `station_metric_snapshots`, `addresses`, `audit_events`, `dw_export_watermarks`

### Phase 4: Validation and Forced RLS

- Run end-to-end role tests for `administrator`, `navigator`, `supervisor`, `partner`.
- After policy correctness is proven, selectively evaluate `FORCE ROW LEVEL SECURITY` on sensitive tables.

## Baseline SQL Playbook (Enable-Only; Policies Added Per Phase)

```sql
ALTER TABLE atlas.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.authorization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.dw_export_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.partner_station_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.route_plan_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.station_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.timeline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.user_permission_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.z_code_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas.z_code_category_map ENABLE ROW LEVEL SECURITY;
```

> Important: enabling RLS before adding at least one appropriate policy can break production paths. Roll out per phase with tests.

## Recommended Verification Queries

```sql
-- RLS flags
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema')
order by 1,2;

-- Policy inventory
select schemaname, tablename, policyname, roles, cmd
from pg_policies
order by 1,2,3;

-- RLS enabled but no policies
with t as (
  select n.nspname as schemaname, c.relname as tablename
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind='r' and c.relrowsecurity
)
select t.schemaname, t.tablename
from t
left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
where p.policyname is null
order by 1,2;
```
