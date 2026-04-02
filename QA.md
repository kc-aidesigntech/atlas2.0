# QA Strategy For MAKE_APP_ALIVE

## Purpose

This document turns the `MAKE_APP_ALIVE` plan into a quality, security, and compliance execution guide. It is intended to help product, engineering, design, data, and operations teams build the next version of the ATLAS experience with explicit release criteria instead of implied behavior.

This is a delivery document, not just a test checklist. It defines:

- What must be true for the product to be considered functional
- What must be true for data handling to be considered safe
- What must be true for role-based access to be considered secure
- What must be true for operational workflows to be considered auditable
- What is still underspecified and therefore cannot receive final signoff yet

## Quality Principles

- Preserve the existing single-pane interaction model unless a requirement explicitly belongs in the admin-only surface.
- Prefer deterministic backend behavior over frontend-only filtering or inferred business logic.
- Treat Supabase schema, RLS, views, and automations as the system of record.
- Make ingestion repeatable and observable; operators must be able to distinguish success, warning, and failure states.
- Make ranking behavior explainable; route recommendations must be reproducible for the same input set.
- Require least-privilege access by default and verify it at the database layer.
- Ensure that auditability exists for all admin writes and rule-driven state changes that affect care routing or partner matching.

## Scope

This QA strategy covers:

- Single-pane app behavior for navigator and partner roles
- Admin-only workflows under `/admin`
- Supabase schema, views, automations, and RLS
- Survey ingestion and partner canonicalization
- Route ranking and partner capability logic
- Timeline behavior, county commons, and heatmap recovery
- Operational logging, auditability, and release readiness

This QA strategy does not replace a legal review. It identifies product areas with likely privacy, security, and compliance implications so those can be reviewed deliberately during implementation.

## Traceability To `references/2026 (1).pdf`

This QA strategy is intentionally derived from the source architecture brief and UI/UX framing in `references/2026 (1).pdf`. The mapping below makes that relationship explicit so product decisions, engineering scope, and signoff criteria remain anchored to the reference document rather than drifting into ad hoc implementation choices.

### Source Section Correlation


| PDF section                                                 | Core source idea                                                                                                                                                                                       | QA.md sections derived from it                                                                                                                                                                                                                | Why the correlation matters                                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026 Architecture - Executive Summary` (`pp. 1-3`)         | ATLAS exists to stabilize human systems, coordinate intervention, and convert crisis into capacity while preserving an honest record of progress.                                                      | `Purpose`, `Quality Principles`, `Quality Objectives`, `Signoff Standard`                                                                                                                                                                     | This is the highest-level reason the QA document emphasizes functional coordination, auditable movement, and release criteria tied to stabilization outcomes rather than generic software completeness. |
| `ATLAS UI/UX Brief` (`pp. 4-5`)                             | ATLAS is a civic navigation system that unifies situational awareness, precision navigation, and collective memory. It must make pressure legible and actionable while preserving dignity.             | `Scope`, `System Under Test`, `Test Strategy` sections `6. Ranking Engine Verification`, `7. Timeline And Enrollment Behavior`, `8. App Integration And UX Safety`, `9. County Commons And Heatmap Recovery`, `Security And Privacy Controls` | This is the source for treating heatmaps, routing, and strip maps as first-class product contracts that all need direct QA coverage.                                                                    |
| `ATLAS UX Strategy: Navigation Under Pressure` (`pp. 6-12`) | The interface must prioritize orientation over exploration, urgency without panic, street-level legibility, and movement under pressure.                                                               | `Quality Principles`, `Quality Risks`, `Test Strategy` section `8. App Integration And UX Safety`, `Release Gates`                                                                                                                            | This is why QA.md protects the single-pane interaction model, rejects UI bloat, and treats cognitive overload or admin leakage into the main shell as quality failures rather than cosmetic issues.     |
| `Design & Ethics` and `Role-Based Calm` (`pp. 5, 8-9`)      | No scoring of people, no blame framing, role-based visibility, dignity preserved through access and presentation, sensitive information contextualized rather than exposed.                            | `Quality Principles`, `Role-Based Access Control`, `Security And Privacy Controls`, `Regulatory And Compliance Review Points`, `Release Gates`                                                                                                | This is the direct foundation for least-privilege RLS, minimized view exposure, multi-role policy testing, and privacy-first release gates.                                                             |
| `Memory as Evidence` and `Strip Maps` (`pp. 8-10`)          | Collective memory should show what happened, in what order, under what constraints, with what outcome. Strip maps preserve truth rather than impact theater.                                           | `Quality Principles`, `Automation And Auditability`, `Timeline And Enrollment Behavior`, `Signoff Standard`                                                                                                                                   | This is why timeline correctness, auditability, event ordering, and visible stall/progress states are treated as core QA concerns.                                                                      |
| `ATLAS Cognitive Contract` (`pp. 10-13`)                    | The system should answer only three questions under pressure: why is this happening, what should I do next, and are we moving or stuck. The UI should orient; the intelligence layer should interpret. | `System Under Test`, `Ranking Engine Verification`, `App Integration And UX Safety`, `Practical Working Agreement`                                                                                                                            | This is the direct rationale for keeping interpretation and routing logic out of thin clients and for validating deterministic backend behavior rather than letting each panel improvise logic.         |
| `ATLAS-INTEL / Stack Expo / Data Layer` (`pp. 14-17`)       | A canonical SQL source of truth feeds a single intelligence layer; panels are thin clients and do not own the logic.                                                                                   | `Quality Principles`, `Environment And Migration Verification`, `Schema And View Integrity`, `Performance And Reliability`, `Required Open Decisions`                                                                                         | This is why QA.md centers schema correctness, reproducible migrations, source-of-truth discipline, and explicit questions about where ranking logic actually lives.                                     |
| `Weights, SRIG, and Governance` (`pp. 18-22`)               | ATLAS governs how pressure is interpreted and relieved. It must describe pressure, not score people, and remain upstream of monetization or exclusion logic.                                           | `Security And Privacy Controls`, `Regulatory And Compliance Review Points`, `Release Gates`, `Required Open Decisions`                                                                                                                        | This is the basis for QA language around governance, provenance, audit, non-punitive interpretation, and sensitivity to how county-level and person-level data might be operationalized.                |
| `Roll-Out / Product Architecture` (`pp. 22-23`)             | ATLAS is a sovereign intelligence engine with a phased delivery path and thin interfaces that depend on a centralized interpretation layer.                                                            | `Scope`, `System Under Test`, `Test Strategy`, `Suggested Test Artifact Structure`, `Practical Working Agreement`                                                                                                                             | This is why QA.md is organized as a delivery-driving document with phase-aligned verification rather than a one-time end-of-project test pass.                                                          |


### Specific QA Commitments Anchored To The PDF

- The emphasis on `county commons`, heatmaps, and pressure visibility comes from the `Situational Awareness` framing in the UI brief.
- The emphasis on route ranking, partner specialization, interference handling, and "next safe move" logic comes from the `Precision Navigation` framing and the `Routing Logic -> What to do` section.
- The emphasis on strip maps, enrollment-relative timing, auditability, and honest progression tracking comes from `Collective Memory`, `Memory as Evidence`, and `Strip Maps -> Where we are in the journey`.
- The emphasis on role-based visibility, limited exposure, and calm presentation comes from `Role-Based Calm` and the embedded design ethics.
- The emphasis on keeping logic centralized and panels thin comes from `ATLAS-INTEL`, `Panels never own the logic`, and `Google SQL as the source of truth`.
- The emphasis on not scoring people and not turning ATLAS into a surveillance or compliance-first platform comes from `Design & Ethics`, `What ATLAS Will Not Become`, and the SRIG/weights sections.

### Interpretation Boundary

This QA document translates the PDF into implementation and verification language. Where the PDF is philosophical or strategic, `QA.md` converts that intent into software delivery constraints such as:

- deterministic routing behavior
- least-privilege data access
- explicit audit trails
- safe ingestion re-runs
- timeline truthfulness
- operator-visible failure states

If future implementation choices contradict the reference PDF in these areas, the default assumption should be that the implementation is drifting unless product leadership explicitly revises the source intent.

## System Under Test

Primary planned capabilities:

- Repository-based data access that can move from local CSV/localStorage development mode to Supabase-backed runtime without changing the shell contract
- Role-specific read models for navigator, partner, and administrator workflows
- Survey-driven partner/Z-code capability ingestion
- Automated partner candidate refresh when enrollee Z-codes change
- Date-positioned strip-map timeline driven by enrollment and journey data
- County-level heatmap and shared county commons experience
- Admin-only record management, overrides, and governance tools

Current implementation constraints visible in the codebase:

- `useSinglePaneData` currently runs through the repository abstraction, but the active runtime is still local CSV/localStorage rather than Supabase
- Administrator operations currently render inside the single-pane shell when administrator-only menus are selected; `/admin` remains a future isolation option, not the current runtime boundary
- `Route planning` now opens as an enrollee overlay, but QA still needs to verify that partner matching, overlay state, and menu restoration remain coherent across role and enrollee switches
- Timeline positioning is now intake-aware; QA must still verify that only saved administrator intake data is treated as authoritative enrollment-start input

## Quality Risks

### Product Coordination Risks

- `Account Settings` in the top-right menu is now the intended home for operator basics, role assignment, and role switching across administrator, partner, and navigator experiences. QA must verify that this remains distinct from admin record-management workflows.
- `Route planning` is now an overlay for the currently selected enrollee rather than a lower-pane section. QA must verify that partner matches remain correlated to the subject enrollee's active Z-codes.
- The timeline source of truth for `enrollment start` is now the administrator-completed onboarding `intake` form. QA must verify that intake edits update both profile data and timeline positioning consistently.

### Data Risks

- Survey org names may canonicalize inconsistently, producing duplicate or fragmented partner records.
- Repeat ingestion may create duplicate capabilities unless idempotency is designed and tested explicitly.
- Capability conflicts such as both `specialize` and `interfere` on the same partner/Z-code pair may create unstable ranking results if not normalized consistently.

### Security Risks

- Multi-role users are modeled in the schema plan, but the RLS precedence and union rules are not yet defined.
- Frontend role switching can create a false sense of access control if RLS is not enforced directly in Supabase.
- Admin workflows may leak into the single-pane shell if role menus and route structure are not reconciled early.

### Operational Risks

- If ingestion errors are not quarantined and surfaced, operations teams may not know whether downstream views are trustworthy.
- If audit events are missing or incomplete, admin overrides and automated data changes may become untraceable.
- If ranking refreshes are asynchronous without visible status, users may act on stale route recommendations.

## Quality Objectives

The system is only ready for production when all of the following are true:

- Navigators only see assigned enrollees and related route artifacts.
- Partners only see their own station, assigned referrals, and capability-related views.
- Administrators can perform management tasks without polluting navigator or partner experiences, whether those controls live in an isolated `/admin` route or in a clearly scoped administrator-only shell state.
- Partner survey ingestion is repeatable, observable, and safe to rerun.
- Route candidate ordering is deterministic and conforms to the specialization/interference rules.
- Timeline positions are based on an explicit enrollment-relative time model.
- County commons data reads are correct, permissioned, and resilient to sparse data.
- Admin mutations and rule-driven changes are auditable.

## Test Strategy

### 1. Environment And Migration Verification

Goal: ensure the baseline system is reproducible.

Tests:

- Apply all migrations to a clean Supabase project.
- Re-run the same migration chain on a fresh environment to confirm stable ordering and dependency safety.
- Seed minimum role fixtures for navigator, partner, administrator, and one multi-role user.
- Validate that development and test environments can ingest the survey dataset without manual patching.

Exit criteria:

- Migrations succeed without hand-editing SQL.
- Object creation order is stable.
- Core auth and role fixtures are available for policy testing.

### 2. Schema And View Integrity

Goal: ensure relational structure and role-specific read models are valid.

Tests:

- Validate all planned tables exist with required primary keys and foreign keys.
- Insert invalid references to confirm constraints block bad writes.
- Confirm the intended 1:1 relationship between `people` and `enrollees`.
- Query all planned navigator, partner, shared, and admin views.
- Verify empty-state behavior so zero-row cases do not break the UI contract.

Exit criteria:

- All planned objects compile and query cleanly.
- Invalid relationships fail loudly.
- Views return stable column shapes for frontend integration.

### 3. Survey Ingestion And Canonicalization

Goal: make the survey pipeline safe, repeatable, and observable.

Tests:

- Ingest the source survey one time and confirm partner, station, and capability records are created correctly.
- Re-run the same file and confirm idempotent behavior.
- Test spelling variants and organization aliases to confirm canonicalization rules or manual review flows.
- Test malformed rows, missing org names, missing Z-codes, and invalid flags.
- Verify `source`, `confidence`, and `active flag` propagation into downstream records.
- Verify unresolved records and warnings surface in admin quality and ingestion views.

Exit criteria:

- Re-runs do not create duplicates unexpectedly.
- Bad rows are either rejected with traceability or quarantined with operator visibility.
- Downstream ranking reads only active, current capability data.

### 4. Role-Based Access Control

Goal: verify least privilege at the database layer, not just in the UI.

Tests:

- Sign in as navigator and confirm access is limited to assigned enrollees and related route data.
- Sign in as partner and confirm access is limited to owned station and partner-scoped data.
- Sign in as administrator and confirm admin-only CRUD is available where intended.
- Attempt direct queries for unauthorized data without relying on client filtering.
- Attempt non-admin writes to admin paths.
- Test a multi-role user and validate behavior against an explicitly documented policy.

Exit criteria:

- No unauthorized data leakage is possible through direct database reads.
- No non-admin writes succeed against protected tables or views.
- Multi-role access behavior is documented and verified.

### 5. Automation And Auditability

Goal: ensure rule-driven behavior is reliable, observable, and traceable.

Tests:

- Insert or update `enrollee_z_codes` and verify partner candidate data refreshes.
- Assign route stops and verify `journey_logs` scaffolds are created correctly.
- Execute admin mutations and verify `audit_events` capture actor, action, target, and timestamp.
- Trigger survey updates that alter route ranking and verify refresh behavior can be observed.
- Retry failed automation paths and confirm no duplicate side effects occur.

Exit criteria:

- Automations execute consistently.
- Operational traces exist for admin actions and rule-driven mutations.
- Replays and retries do not corrupt data.

### 6. Ranking Engine Verification

Goal: prove route recommendations are correct, deterministic, and explainable.

Tests:

- Partner with `specialize` and no `interfere` must rank above a partner that only interferes.
- Partner with both `specialize` and `interfere` must be de-prioritized according to the plan.
- Tie-breakers must apply in the documented order:
  - specialization strength
  - geographic proximity or county match
  - station capacity
  - historical completion reliability
- Candidate order must update when enrollee Z-codes change.
- Inactive capabilities must be removed from ranking inputs.
- Repeated identical queries must return the same ordering.
- Empty candidate sets must return a safe, comprehensible state.

Exit criteria:

- Ranking is deterministic for identical inputs.
- Ordering matches business rules.
- Staleness behavior is defined and testable.

### 7. Timeline And Enrollment Behavior

Goal: ensure the strip-map timeline is driven by a valid temporal model.

Tests:

- Create an enrollee with a known enrollment start and verify event positions are relative to that start.
- Change timeline windows from 6 to 12 months and verify consistent rescaling.
- Insert events out of chronological order and confirm stable sort behavior.
- Test no-active-enrollment scenarios and verify fallback rules.
- Test multiple enrollment attempts for one enrollee and verify the active timeline source is explicit.
- Verify route-stop scaffolds become visible on the timeline with correct phase and status behavior.

Exit criteria:

- Timeline placement is based on documented backend semantics rather than UI assumptions.
- Edge cases are defined and pass consistently.

### 8. App Integration And UX Safety

Goal: ensure the product remains coherent while switching from local seeds to live data.

Tests:

- Verify the repository abstraction supports both the current local development path and the future Supabase-backed path without breaking the existing shell.
- Verify role changes update visible menus and accessible data correctly.
- Verify `assigned enrollees` only shows assigned enrollees for navigators.
- Verify `requests to enroll` only shows valid pending candidates.
- Verify route planning reacts to Z-code changes without requiring stale local refresh patterns.
- Verify partner radial chart values match backend category aggregates.
- Verify the referral portal external link resolves correctly.
- Verify admin controls only appear for the administrator experience and do not leak into navigator or partner views.
- If `/admin` becomes the required boundary later, verify the same management capabilities can move there without changing the core shell contract.

Exit criteria:

- The single-pane experience remains visually stable.
- The repository contract can swap data sources safely.
- Admin-only workflows are isolated correctly for the active runtime model.

### 9. County Commons And Heatmap Recovery

Goal: ensure the recovered map experience is correct and permission-safe.

Tests:

- Recover the heatmap into a reusable county-commons module.
- Validate heatmap values against `v_county_z_code_heatmap`.
- Verify county filters update dependent views consistently.
- Verify sparse or empty county data does not cause crashes or misleading visuals.
- Verify role access to county-level data is correct.

Exit criteria:

- Map behavior is stable and accurate.
- County-level data remains consistent with backend reads.

### 10. Performance And Reliability

Goal: prevent quality regressions caused by scale, latency, or repeated workflows.

Tests:

- Measure cold load performance after Supabase integration.
- Measure role switch, enrollee switch, and route refresh behavior for duplicate fetches or UI stalls.
- Run survey ingestion on realistic file sizes.
- Measure ranking query latency on representative data volumes.
- Validate visualization performance for heatmap and radial views with larger datasets.

Exit criteria:

- No major UI stalls during normal operator workflows.
- No unacceptable query or ingestion bottlenecks for expected volume.

## Security And Privacy Controls

The application appears to handle person-level referral, enrollment, routing, and service coordination data. That means the team should build with privacy-first expectations even before formal legal classification is finalized.

Required controls:

- Enforce RLS for all protected reads and writes.
- Avoid trusting client role state for authorization decisions.
- Separate admin capabilities from standard care-routing workflows.
- Minimize fields exposed in role-specific views.
- Audit all admin mutations and important automation side effects.
- Protect staging and test environments from unrestricted access to production-like personal data.
- Use least-privilege service roles for ingestion and background jobs.

Required verification:

- Confirm sensitive fields are not exposed in views that do not require them.
- Confirm logs and audit records do not accidentally leak secrets or protected content.
- Confirm external links or integrations do not transmit protected data unintentionally.

## Regulatory And Compliance Review Points

This section is a development prompt, not a legal determination. The team should explicitly review the following before production use:

- Whether any stored or displayed data qualifies as protected health information or similarly regulated sensitive information
- Whether partner and navigator workflows involve case management, referral, or vulnerability data requiring stricter access logging
- Whether retention periods, deletion requests, or legal holds must be supported
- Whether audit records must be immutable or exportable for compliance review
- Whether county-level aggregation can still reveal sensitive information in low-volume populations
- Whether survey-ingested partner capability data requires provenance tracking or approval before becoming operationally active

Recommended compliance gates:

- Security review of all RLS policies and service-role usage
- Privacy review of view contents and export surfaces
- Audit review for admin override and governance actions
- Data quality review for ingestion provenance and correction workflows

## Release Gates

Release is blocked if any of the following remain unresolved:

- RLS is not fully verified for navigator, partner, administrator, and multi-role users.
- Route ranking does not produce deterministic, rule-compliant ordering.
- Route candidate freshness is not defined well enough to test the promise of "instant" updates.
- Survey ingestion is not safe to rerun.
- Timeline positioning is not explicitly tied to a documented enrollment start rule.
- Admin capabilities are still split ambiguously between single-pane and `/admin`.
- Audit events are missing for admin writes or important rule-driven changes.

## Required Open Decisions

These items must be resolved before final QA signoff:

- What exact behavior should apply to users with multiple roles?
- What backend object is the source of truth for route candidate ranking?
- What freshness contract satisfies the product promise for route-candidate updates?
- What should happen to rejected or ambiguous survey rows?

## Suggested Test Artifact Structure

To drive development with quality from the start, implementation work should produce these artifacts alongside code:

- migration verification checklist
- RLS policy test cases
- ingestion fixtures with valid and invalid survey rows
- ranking fixtures with expected deterministic order
- timeline fixtures for 6-month and 12-month cases
- admin audit verification scenarios
- end-to-end role flow scripts for navigator, partner, and administrator

## Practical Working Agreement

Development should not treat QA as a final phase. For each milestone:

- Define the acceptance criteria before implementation starts.
- Add fixtures or test data for the targeted workflow.
- Verify security boundaries before polishing the UI.
- Verify auditability before enabling admin actions broadly.
- Do not mark a feature complete if its failure mode is still invisible to operators.

## Signoff Standard

Final signoff requires:

- passing core functional tests
- passing security and access-control tests
- passing ingestion and ranking determinism tests
- passing timeline correctness tests
- documented resolution of open architectural decisions
- explicit acceptance of remaining residual risk by product and engineering leads

