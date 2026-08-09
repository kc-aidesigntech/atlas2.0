# Database Row-Level Security (RLS) Inventory

Last updated: 2026-08-08  
Source of truth: live metadata queries against Postgres system catalogs (`pg_class`, `pg_namespace`, `pg_policies`)

## Executive Snapshot

- This document inventories **Row-Level Security (RLS)** posture for all non-system schemas in this project database.
- Coverage by schema:
  - `atlas`: 62 tables (`62` RLS enabled, `0` RLS disabled)
  - Managed schemas (`auth`, `realtime`, `storage`, `supabase_migrations`, `vault`) remain vendor-controlled; do not bulk-modify blindly.
- Critical app risk from **`atlas` tables with RLS disabled** is closed as of migration `20260804170000_db_rls_phase2_phase3_remaining_tables.sql`.
- Remaining advisor INFO notes: `dw_export_watermarks` and `legacy_decommission_registry` intentionally have RLS enabled with **no policies** (default deny for `anon`/`authenticated`; `service_role` bypasses RLS).

## Atlas Schema Table Inventory

| Table | RLS | Policy Count |
|---|---:|---:|
| `addresses` | enabled | 1 |
| `app_config_documents` | enabled | 4 |
| `app_role_navigation` | enabled | 2 |
| `assessment_answers` | enabled | 1 |
| `assessment_participants` | enabled | 1 |
| `assessment_submissions` | enabled | 1 |
| `audit_events` | enabled | 1 |
| `authorization_settings` | enabled | 1 |
| `counties` | enabled | 1 |
| `countries` | enabled | 1 |
| `demo_access_events` | enabled | 2 |
| `demo_record_tags` | enabled | 1 |
| `dw_export_watermarks` | enabled | 0 |
| `enrollee_burden_survey_answers` | enabled | 4 |
| `enrollee_burden_survey_submissions` | enabled | 4 |
| `enrollee_z_code_uncheck_log` | enabled | 1 |
| `enrollee_z_codes` | enabled | 1 |
| `enrollees` | enabled | 2 |
| `enrollment_requests` | enabled | 2 |
| `enrollments` | enabled | 2 |
| `journey_logs` | enabled | 1 |
| `legacy_decommission_registry` | enabled | 0 |
| `navigator_assignments` | enabled | 1 |
| `navigator_competency_assessment_answers` | enabled | 1 |
| `navigator_competency_assessments` | enabled | 1 |
| `navigator_partner_assignments` | enabled | 1 |
| `navigator_regulation_test_answers` | enabled | 1 |
| `navigator_regulation_test_submissions` | enabled | 1 |
| `navigator_ipscc_encounter_submissions` | enabled | 2 |
| `navigator_ips_self_assessments` | enabled | 2 |
| `navigator_create_sessions` | enabled | 2 |
| `navigator_create_reflections` | enabled | 2 |
| `partner_service_capacity_answers` | enabled | 4 |
| `partner_service_capacity_deletion_log` | enabled | 1 |
| `partner_service_capacity_submissions` | enabled | 4 |
| `partner_station_icons` | enabled | 1 |
| `partner_stations` | enabled | 2 |
| `partner_z_code_burden_scores` | enabled | 4 |
| `partner_z_code_capabilities` | enabled | 1 |
| `partners` | enabled | 1 |
| `people` | enabled | 2 |
| `people_role_assignments` | enabled | 1 |
| `permissions` | enabled | 1 |
| `profile_images` | enabled | 5 |
| `public_referral_intake_events` | enabled | 3 |
| `referrals` | enabled | 2 |
| `role_permissions` | enabled | 1 |
| `roles` | enabled | 1 |
| `route_plan_stops` | enabled | 2 |
| `route_plans` | enabled | 2 |
| `scribe_encounters` | enabled | 4 |
| `states` | enabled | 1 |
| `station_metric_snapshots` | enabled | 1 |
| `supervisor_navigator_assignments` | enabled | 1 |
| `supervisor_ips_assessments` | enabled | 2 |
| `timeline_settings` | enabled | 2 |
| `user_permission_exceptions` | enabled | 1 |
| `z_code_categories` | enabled | 1 |
| `z_code_category_map` | enabled | 1 |
| `z_code_headers` | enabled | 1 |
| `z_code_timeline_labels` | enabled | 1 |
| `z_codes` | enabled | 1 |

## Atlas Tables With RLS Enabled But No Policies (Intentional Deny-All)

- `legacy_decommission_registry` — internal registry; revoked from `anon`/`authenticated`
- `dw_export_watermarks` — warehouse Extract Transform Load (ETL) cursor state; `service_role` only

## Remediation History

### Phase 1 (completed): reference tables

Migration: `20260629010500_db_rls_phase1_reference_tables.sql`

- `countries`, `states`, `z_code_categories`, `z_code_category_map`, `partner_station_icons`
- Authenticated SELECT policies for single-pane / radial reference lookups

### Phase 2 + 3 (completed 2026-08-04): remaining 14 tables

Migration: `20260804170000_db_rls_phase2_phase3_remaining_tables.sql`

| Table | Policy posture | PostgREST grants |
|---|---|---|
| `roles` | authenticated SELECT | SELECT |
| `permissions` | authenticated SELECT | SELECT |
| `role_permissions` | authenticated SELECT | SELECT |
| `user_permission_exceptions` | administrator SELECT | none (SECURITY DEFINER helpers) |
| `authorization_settings` | administrator SELECT | none (SECURITY DEFINER helpers) |
| `timeline_settings` | admin ALL + staff enrollment SELECT | none |
| `enrollment_requests` | admin ALL + navigator/supervisor SELECT | none |
| `referrals` | admin ALL + staff enrollment SELECT | none |
| `route_plans` | admin ALL + staff enrollment SELECT | none |
| `route_plan_stops` | admin ALL + staff via parent plan SELECT | none |
| `station_metric_snapshots` | authenticated SELECT | none |
| `addresses` | authenticated SELECT | none |
| `audit_events` | administrator SELECT | none |
| `dw_export_watermarks` | no policies (deny-all for app roles) | none; service_role CRUD |

Also converted `atlas.fn_log_audit()` to SECURITY DEFINER so audit trigger inserts remain reliable under RLS.

Enrollment-scoped tables keep policies ready for intentional grants or `security_invoker` view conversion without newly exposing them via PostgREST.

### Scribe encounters (added 2026-08-08)

Migration: `20260808120000_atlas_scribe_encounters.sql`

| Table | Policy posture | PostgREST grants |
|---|---|---|
| `scribe_encounters` | owner-only SELECT/INSERT/UPDATE/DELETE (`created_by = auth.uid()`) | SELECT, INSERT, UPDATE, DELETE |

Point-of-care transcripts and Subjective, Objective, Assessment, Plan (SOAP) notes are sensitive, so no cross-user read path exists; audio is never stored anywhere.

## Atlas Policy Inventory (Configured Policies)

This is the currently observed policy set in `atlas` (high-level):

- `app_config_documents`: authenticated CRUD policies
- `app_role_navigation`: admin write + authenticated select
- `assessment_*`: scoped staff/admin SELECT
- `addresses`: `addresses_authenticated_select`
- `audit_events`: `audit_events_admin_select`
- `authorization_settings`: `authorization_settings_admin_select`
- `counties` / `countries` / `states`: authenticated SELECT
- `demo_access_events` / `demo_record_tags`: insert/select as previously configured
- `enrollee_burden_*`: select/insert/update/delete scoped policies
- `enrollee_z_codes` / `enrollee_z_code_uncheck_log`: staff SELECT
- `enrollees` / `enrollments`: admin ALL + staff SELECT
- `enrollment_requests`: admin ALL + navigator/supervisor SELECT
- `journey_logs`: admin ALL
- `navigator_*` / `supervisor_*` assignment and assessment tables: scoped SELECT or authenticated CRUD as previously configured
- `partner_*` capacity/capability/station tables: scoped or authenticated SELECT as previously configured
- `people` / `people_role_assignments`: admin + directory SELECT
- `permissions` / `roles` / `role_permissions`: authenticated SELECT
- `profile_images`: admin-all plus authenticated CRUD-scoped policies
- `public_referral_intake_events`: public insert + staff select
- `referrals` / `route_plans` / `route_plan_stops` / `timeline_settings`: admin + staff enrollment scope
- `scribe_encounters`: owner-only CRUD (`created_by = auth.uid()`)
- `station_metric_snapshots`: authenticated SELECT
- `user_permission_exceptions`: administrator SELECT
- `z_code_*` reference tables: public or authenticated SELECT as previously configured

## Managed Schema Notes (Do Not Bulk-Modify Blindly)

- `auth`, `realtime`, `storage`, `supabase_migrations`, and `vault` are Supabase-managed schemas.
- Some tables intentionally run with RLS disabled in these schemas.
- Recommendation: treat any change outside `atlas` as a controlled, vendor-aware change request.

## Follow-Up (Not Part Of This Table Hardening)

- Supabase security advisor still reports **ERROR** on several `SECURITY DEFINER` views (bypass base-table RLS). Convert remaining reporting views to `security_invoker` in a dedicated pass (see Phase 6 pattern in `20260530129000_security_phase6_definer_view_and_table_rls.sql`).
- Optionally evaluate `FORCE ROW LEVEL SECURITY` on sensitive tables after role end-to-end tests.

## Recommended Verification Queries

```sql
-- RLS flags
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind='r' and n.nspname = 'atlas'
order by 1,2;

-- Policy inventory
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'atlas'
order by 1,2,3;

-- RLS enabled but no policies
with t as (
  select n.nspname as schemaname, c.relname as tablename
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind='r' and c.relrowsecurity and n.nspname = 'atlas'
)
select t.schemaname, t.tablename
from t
left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
where p.policyname is null
order by 1,2;
```
