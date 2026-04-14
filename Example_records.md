# Example Records

This document explains the Supabase example dataset added for the ATLAS schema.

The corresponding seed lives in `supabase/migrations/20260415_example_records_seed.sql`.

`SAMPLE_DATA.md` is older Firebase/Firestore-oriented sample content. This file is specifically for the newer Supabase-backed example records.

## Purpose

The example dataset was designed to make the ATLAS data model easy to inspect in a live project.

It intentionally:

- uses a small, readable set of distinct example people
- separates staff, partner contacts, and enrollees into realistic identities
- creates realistic cross-table relationships instead of isolated demo rows
- makes the root shell and partner survey flows show meaningful content

## Three Example Arcs

### 1. Sandra Morrison

- Primary theme: housing stabilization
- Primary Z-code: `Z59.1`
- Supporting partner org: `North Harbor Housing Collaborative`
- Supporting station: `North Harbor Housing Hub`
- Phase emphasis: `regulation`

Why:

- shows a housing-oriented enrollee journey
- anchors the habitat domain
- creates a strong partner capability match for housing

### 2. Marcus Thompson

- Primary theme: employment protection
- Primary Z-code: `Z56.2`
- Supporting partner org: `WorkSpring Alliance`
- Supporting station: `WorkSpring Employment Desk`
- Phase emphasis: `readiness`

Why:

- shows a work-oriented enrollee journey
- anchors the work domain
- demonstrates a second distinct partner survey and route candidate outcome

### 3. Elena Rodriguez

- Primary theme: social reintegration
- Active Z-codes: `Z59.1`, `Z56.2`, `Z60.4`
- Supporting partner org: `BridgeLine Social Support Network`
- Supporting station: `BridgeLine Community Commons`
- Phase emphasis: `renewal`

Why:

- shows a social-network-oriented journey
- anchors supervision and governance examples
- now provides a multi-parent route-ranking example instead of a single-code scenario

## Core Tables Seeded

The seed populates the current operational Supabase schema with example rows in:

- `atlas.roles`
- `atlas.people`
- `atlas.people_role_assignments`
- `atlas.countries`
- `atlas.states`
- `atlas.counties`
- `atlas.addresses`
- `atlas.partners`
- `atlas.partner_stations`
- `atlas.partner_station_icons`
- `atlas.enrollees`
- `atlas.enrollment_requests`
- `atlas.enrollments`
- `atlas.navigator_assignments`
- `atlas.z_codes`
- `atlas.z_code_categories`
- `atlas.z_code_category_map`
- `atlas.enrollee_z_codes`
- `atlas.partner_z_code_capabilities`
- `atlas.referrals`
- `atlas.route_plans`
- `atlas.route_plan_stops`
- `atlas.journey_logs`
- `atlas.timeline_settings`
- `atlas.station_metric_snapshots`
- `atlas.audit_events`
- `atlas.profile_images`
- `atlas.permissions`
- `atlas.role_permissions`
- `atlas.user_permission_exceptions`
- `atlas.authorization_settings`
- `atlas.partner_service_capacity_submissions`
- `atlas.partner_service_capacity_answers`
- `atlas.partner_z_code_burden_scores`
- `atlas.supervisor_navigator_assignments`
- `atlas.navigator_competency_assessments`
- `atlas.navigator_competency_assessment_answers`
- `atlas.app_role_navigation`
- `atlas.app_config_documents`

## Example Relationships

The identities are now deliberately separated so the sample looks like a real operating environment.

### Partner-side people

- `Maya Johnson` is the North Harbor survey respondent and contact
- `Luis Ortega` is the WorkSpring partner user and contact
- `Amina Rahman` is the BridgeLine survey respondent and contact

### Staff people

- `Noah Bennett` is the navigator assigned to all three example enrollments
- `Priya Shah` is the supervisor who oversees Noah and records competency assessments

### Enrollee people

- `Sandra Morrison` is the housing-oriented enrollee
- `Marcus Thompson` is the work-oriented enrollee
- `Elena Rodriguez` is the social-reintegration enrollee

This structure is intentional because it demonstrates that:

- partner contacts can stay on the partner side of the model
- staff roles like `navigator` and `supervisor` remain operational identities
- enrollees remain distinct from workforce or partner identities
- the system can still express cross-table relationships without unrealistic role overlap

## Partner Survey Examples

Three example partner survey records were added:

1. `North Harbor Housing Collaborative`
  Status: `completed`
   Respondent: `Maya Johnson`
   Burden signals: `Z59.1=9`, `Z56.2=4`, `Z60.4=5`
2. `WorkSpring Alliance`
  Status: `completed`
   Respondent: `Luis Ortega`
   Burden signals: `Z59.1=5`, `Z56.2=8`, `Z60.4=4`
3. `BridgeLine Social Support Network`
  Status: `completed`
   Respondent: `Amina Rahman`
   Burden signals: `Z59.1=7`, `Z56.2=6`, `Z60.4=9`

Why:

- gives the UI a concrete three-partner weighted ranking example
- demonstrates respondent identity propagation
- populates partner burden and partner capability surfaces

### Elena Route-Ranking Example

The seed now intentionally makes `Elena Rodriguez` a three-parent matching case so the mobile route board and readiness overlay have a meaningful ranked output to display.

- Elena active need vector:
  - `Z59.1`
  - `Z56.2`
  - `Z60.4`
- Partner weighted burden totals used by the ranking view:
  - `North Harbor Housing Collaborative`: `9 + 4 + 5 = 18`
  - `WorkSpring Alliance`: `5 + 8 + 4 = 17`
  - `BridgeLine Social Support Network`: `7 + 6 + 9 = 22`
- Expected ranking result:
  1. `BridgeLine Community Commons`
  2. `North Harbor Housing Hub`
  3. `WorkSpring Employment Desk`

This means Elena now demonstrates a true ranked route sheet rather than a single-parent trivial match.

## Operational Outcomes Demonstrated

The seeded records are meant to show:

- 3 example enrollees in the root shell
- 3 example enrollments with active assignments
- distinct Z-code pressure profiles
- distinct partner capability matches
- route candidate ranking with the intended partner scoring highest for each enrollee
- live partner survey history with draft/completed variation
- supervisor competency records and permission examples

## Conditional Sections

The seed migration is resilient across environments.

If the connected Supabase project also contains optional tables such as:

- `route_builder_*`
- `legacy_atlas_*`

then the migration can populate those too.

If those tables do not exist in the target project, the core operational seed still runs successfully without failing.

## What To Inspect First

If you want to understand the example graph quickly, start with:

1. `atlas.people`
2. `atlas.enrollees`
3. `atlas.enrollments`
4. `atlas.enrollee_z_codes`
5. `atlas.partners`
6. `atlas.partner_stations`
7. `atlas.partner_service_capacity_submissions`
8. `atlas.partner_z_code_burden_scores`
9. `atlas.v_singlepane_enrollee_profiles`
10. `atlas.v_navigator_route_candidates`

