# ATLAS SQL Simplification + Warehouse Blueprint

## Objectives

- Keep operational SQL manageable with small, explicit, role-safe views.
- Preserve current app behavior while creating a clean canonical access layer.
- Make County Commons and ATLAS-INTEL analytics ready for OLAP/semantic modeling.

## What Phase 1 Introduces

Migration: `supabase/migrations/20260503231500_sql_simplification_phase1_canonical_views.sql`

- Canonical active-edge views:
  - `atlas.v_active_navigator_assignment_edges`
  - `atlas.v_active_supervisor_assignment_edges`
  - `atlas.v_active_partner_contact_edges`
  - `atlas.v_active_enrollment_roster`
  - `atlas.v_enrollment_assignment_board`
- County Commons aggregate view:
  - `atlas.v_county_commons_daily_metrics`
- Warehouse-facing dimensions/facts:
  - `atlas.v_dw_dim_county`
  - `atlas.v_dw_dim_partner_station`
  - `atlas.v_dw_dim_person_role_active`
  - `atlas.v_dw_fact_enrollment_snapshot`
- ETL control table:
  - `atlas.dw_export_watermarks`
- Identity helper function:
  - `atlas.fn_current_person_id()`

These are non-breaking additions. Existing tables and legacy views stay in place.

## Phase 2 Verification And Rollback

### Verification query set

Run these against the linked project after deploying Phase 2 cutover migrations:

```sql
-- Navigator scope edge sanity
select navigator_person_id, count(*) as active_enrollment_count
from atlas.v_active_navigator_assignment_edges
group by navigator_person_id
order by active_enrollment_count desc;

-- Assignment board ownership visibility
select enrollment_id, enrollee_name, assigned_navigator_label, array_length(navigator_person_ids, 1) as navigator_count
from atlas.v_enrollment_assignment_board
order by enrollee_name
limit 50;

-- Supervisor management edges
select supervisor_person_id, navigator_person_id
from atlas.v_active_supervisor_assignment_edges
order by supervisor_person_id, navigator_person_id
limit 100;

-- Roster continuity for strip-map/timeline UX
select enrollment_id, enrollee_name, current_phase, array_length(z_code_tags, 1) as active_z_codes
from atlas.v_active_enrollment_roster
order by enrollee_name
limit 50;
```

### UI verification checklist

- Navigator main `enrollees` dropdown only lists navigator-assigned enrollees.
- Navigator `add enrollees` board shows global ownership labels and supports assign/unassign.
- Supervisor `assigned navigators` renders navigator directory and managed toggles correctly.
- Enrollee strip-map/timeline still renders with no data-loss regressions.

### Rollback note

If cutover regressions appear:

1. Repoint repository/shared-adapter reads back to legacy views (`v_singlepane_enrollee_profiles`, `v_navigator_assigned_enrollees`) in a small hotfix branch.
2. Keep canonical views deployed (no destructive rollback needed).
3. Re-run verification set above + app smoke tests, then retry cutover in a subsequent patch.

## Recommended Warehouse Path (Power BI Friendly)

Primary recommendation:
- **Landing/transform:** ELT from Supabase Postgres into a warehouse using **Airbyte/Fivetran + dbt**.
- **Warehouse engine:** **Microsoft Fabric Warehouse** (best fit with Power BI semantic models) or Synapse Dedicated SQL Pool.
- **Consumption:** Power BI semantic model on curated star schemas.

Alternative:
- Keep Postgres as source-of-truth + replicate to BigQuery/Snowflake, still model in Power BI.

## Canonical Star Schema for ATLAS-INTEL

Dimensions:
- `dim_date`
- `dim_county`
- `dim_partner`
- `dim_station`
- `dim_person` (SCD Type 2 if role/history matters)
- `dim_role`
- `dim_z_code`
- `dim_enrollment_phase`

Facts (grain-first design):
- `fact_enrollment_snapshot_daily` (1 row per enrollment per day)
- `fact_assignment_edges_daily` (navigator/supervisor/partner contacts active on day)
- `fact_zcode_resolution_events` (1 row per resolution event)
- `fact_journey_events` (1 row per journey log event)
- `fact_assessment_submissions` (1 row per submission)
- `fact_assessment_answers` (1 row per answer)

## OLAP Cube / Semantic Model Measures

County Commons:
- Active enrollees
- Active navigators
- Enrollee-to-navigator ratio
- Resolved parent Z-code count
- Journey completion events

Partner performance:
- Referral acceptance rate
- Time-to-first-action
- Service capacity burden index
- Completion throughput by station

Navigator/Supervisor performance:
- Assigned enrollee load
- Regulation test completion/pass rates
- Competency trend over time
- Supervision session cadence and coverage

## Data Contracts and ETL Rules

- Source all assignments from canonical active-edge views, not raw tables.
- Use `snapshot_date` as standard fact partition key.
- Keep IDs immutable in warehouse; avoid natural-key joins in reporting layers.
- Add SCD handling for role assignments and partner contact ownership.
- Use `dw_export_watermarks` for idempotent incremental extraction.

## Next Migration Phases

Phase 2:
- Redirect app reads to canonical views where possible.
- Add compatibility wrappers for any remaining complex legacy views.

Phase 3:
- Introduce unified assessment schema (`assessment_submissions`, `assessment_answers`).
- Dual-write from app; backfill from legacy tables.

Phase 4:
- Build warehouse extract views with stable contracts (`v_dw_*` finalized).
- Add dbt models + tests (unique, not-null, accepted values, relationship tests).

Phase 5:
- Deprecate legacy duplicate views/tables once downstream consumers are migrated.

## Governance and Quality Gates

- Every new operational table must map to:
  - one canonical active view (operational read model), and
  - one warehouse export view (analytics read model).
- Require schema tests before promoting migration:
  - key uniqueness
  - referential integrity
  - accepted value domains
  - freshness checks for snapshots
