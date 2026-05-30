# Atlas Security Model

This document describes the database-first access-control model for the Atlas
application (Supabase project `qjsaedamqaqxobslboni`). It is the source of truth
for how identity maps to data and must be updated whenever grants, Row-Level
Security (RLS) policies, command Remote Procedure Calls (RPCs), or view security
modes change.

## Principles

1. **Database-first, no silent fallbacks.** The application renders exactly what
   the signed-in identity is authorized to read. A permission/RLS denial is a
   configuration error and is surfaced loudly, never disguised as an empty list.
2. **Reads via scoped RLS.** Base tables enforce RLS; reporting views are
   `security_invoker` so they inherit those policies.
3. **Writes via validated command RPCs.** Multi-step submission flows write only
   through `SECURITY DEFINER` command RPCs. Direct `INSERT/UPDATE/DELETE` grants
   are revoked from `authenticated` on those tables.
4. **Anonymous surface is minimal.** `anon` may read public reference data
   (`z_codes`, `z_code_headers`) and insert into `public_referral_intake_events`.
   Everything else requires authentication.
5. **Warehouse/internal data is service-role-only.**

## Critical invariant: invoker views require base-table SELECT grants

`security_invoker` views execute with the *caller's* privileges and RLS context.
Therefore every base table a view reads MUST grant `SELECT` to `authenticated`
(rows are then scoped by the table's RLS policy). If the grant is missing, the
view fails with `42501 permission denied` for the underlying table.

Conversely, a `SECURITY DEFINER` view executes as its owner and **bypasses RLS**.
Definer views must therefore either (a) be confined to `service_role`, or (b)
carry their own internal scoping predicates. Person-level Protected Health
Information (PHI) views were converted to `security_invoker` so base-table RLS
governs them.

## Access scoping helper functions (SECURITY DEFINER)

- `atlas.fn_current_person_id()` — resolves the caller's `people.id` from
  `auth.uid()`.
- `atlas.fn_can_access_enrollment_as_staff(enrollment_id)` — true for an
  administrator, the assigned navigator, or a supervisor over that navigator.

These are `SECURITY DEFINER` so they can read assignment tables without being
re-subjected to the RLS policies that call them (prevents recursion).

## Layered phases (applied)

- **Phase 1** — `SELECT` grants + staff-scoped RLS on core domain tables
  (`enrollments`, `enrollees`, `people`, `partner_stations`, `enrollee_z_codes`).
- **Phase 2** — revoked `anon` from PHI definer views and config/assessment/
  partner base tables; enabled RLS on config tables.
- **Phase 3** — moved every submission flow behind validated command RPCs and
  locked the tables to RPC-only writes with scoped-read RLS:
  - Enrollee burden survey — `fn_save_enrollee_burden_submission`, `fn_delete_enrollee_burden_draft`
  - Regulation/renewal tests — `fn_save_regulation_test_submission`, `fn_delete_regulation_test_draft`
  - Navigator competency — `fn_save_navigator_competency_assessment` (+ `fn_ensure_staff_person`)
  - Z-code intake — `fn_intake_enrollment_inferred_z_codes`
  - Partner service capacity — `fn_save_partner_service_capacity` (returns the id
    packet so survey-only users need no scoped read-back), `fn_ensure_partner_identifier`,
    `fn_delete_partner_service_capacity_draft`, `fn_set_partner_survey_answer_nullification`
  - Assignment tables (`navigator_assignments`, `supervisor_navigator_assignments`)
    got scoped-read RLS (writes already flow through assignment RPCs).
- **Phase 4** — locked the data-warehouse export contract (`v_dw_*`) and pipeline
  state (`dw_export_watermarks`, `fn_dw_mark_pipeline_success`) to `service_role`.
  The warehouse/Power BI connects as `service_role` (`rolbypassrls = true`).
- **Phase 5** — frontend fail-loud: `isOptionalSupabaseDataError` no longer
  classifies permission errors (`42501` / 401 / 403) as optional, so they are not
  swallowed; the single-pane bootstrap exposes an `error` surfaced as a loud
  banner instead of an empty workspace.
- **Phase 6** — converted enrollee-PHI definer views
  (`v_singlepane_enrollee_profiles`, `v_singlepane_enrollee_domain_loads`,
  `v_singlepane_enrollee_domain_load_breakdown`, `v_people_directory`) to
  `security_invoker`; enabled RLS on previously unprotected tables
  (`assessment_submissions/answers/participants` scoped to enrollment access;
  `people_role_assignments` directory-read; `counties`/`z_codes` reference read;
  `legacy_decommission_registry` service-role-only; `demo_record_tags` read-only).

## Verified behavior

- Navigator `kchristiansoncallisons@gmail.com` sees their assigned enrollee
  (Elena Rodriguez, ATLAS-EX-003) and only their accessible enrollees
  (e.g. enrollee profiles scoped 4 → 2); an unrelated authenticated user sees
  zero assignment rows and no enrollee PHI.
- Administrators retain full visibility.

## Known remaining hardening (follow-up)

These are tracked improvements; the app is functional and the high-severity PHI
exposures above are closed.

1. **Remaining `SECURITY DEFINER` reporting/ranking views** (13) — e.g.
   `v_navigator_route_candidates`, `v_county_z_code_heatmap`, `v_admin_data_quality`,
   `v_partner_station_directory`, `v_partners_page_records`,
   `v_supervisor_navigator_competency_rollup`, `v_partner_z_code_burden`,
   `v_navigator_enrollment_requests`, `v_enrollment_station_markers`. Converting
   these to `security_invoker` requires adding base-table `SELECT` grants/RLS for
   their underlying relations and reviewing scoping semantics, because some feed
   cross-partner route ranking and admin dashboards whose result sets would change.
2. **Definer functions executable by `anon`/`PUBLIC`** — command RPCs and trigger/
   sync helpers were created with the Postgres default `EXECUTE` grant to `PUBLIC`.
   Each already self-denies anonymous callers (`auth.uid()` is null), so this is
   defense-in-depth: revoke `EXECUTE` from `PUBLIC`, re-grant only to
   `authenticated` for the functions it needs (taking care to preserve grants for
   functions referenced inside RLS policy `USING` clauses).
3. **Supabase auth/storage toggles** — enable leaked-password protection; tighten
   the `profile-images` public bucket listing policy.
