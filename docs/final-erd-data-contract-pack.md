# Final ERD + Data Contract Pack (Phase 7)

## Domain decomposition

- `identity_access`
  - `people`, `roles`, `people_role_assignments`
  - contract views: `v_dw_dim_person_role_active`, `v_dw_rls_principal_scope`
- `care_graph`
  - `enrollments`, `navigator_assignments`, `supervisor_navigator_assignments`, `partner_contact_assignments`
  - contract views: `v_active_enrollment_roster`, `v_active_navigator_assignment_edges`, `v_active_supervisor_assignment_edges`, `v_active_partner_contact_edges`
- `clinical_journey`
  - `journey_logs`, `route_plan_stops` (and related route planning tables)
  - contract views: `v_enrollment_station_markers`, `v_dw_fact_journey_events`
- `assessments`
  - unified: `assessment_submissions`, `assessment_answers`, `assessment_participants`
  - parity checks: `v_assessment_submission_parity`, `v_assessment_answer_parity`

## Canonical warehouse contracts

- Dimensions:
  - `v_dw_dim_county`
  - `v_dw_dim_partner_station`
  - `v_dw_dim_person_role_active`
- Facts:
  - `v_dw_fact_enrollment_snapshot`
  - `v_dw_fact_assignment_edges_daily`
  - `v_dw_fact_journey_events`
  - `v_dw_fact_assessment_submissions`
  - `v_dw_fact_assessment_answers`
  - `v_dw_kpi_daily`

## Compatibility wrappers (one release window)

- `v_singlepane_enrollee_profiles` -> wrapper over `v_active_enrollment_roster`
- `v_navigator_assigned_enrollees` -> wrapper over `v_active_navigator_assignment_edges`

Compatibility status is tracked in `v_legacy_decommission_readiness`.

## Explicit drop policy

No destructive drop is executed in this phase. Before any legacy object drop:

1. Verify parity views return `is_in_sync = true`.
2. Verify app read paths no longer reference legacy objects.
3. Obtain explicit approval for destructive migration.

## Export + ETL controls

- Watermark table: `dw_export_watermarks`
- Watermark helper function: `fn_dw_mark_pipeline_success(...)`
- Operational runbook: `docs/warehouse-etl-runbook.md`
