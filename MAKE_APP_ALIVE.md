# make app alive

this document is the execution spec for moving the single-pane atlas experience from the current local csv/localstorage development runtime toward a production-ready supabase-backed application, while preserving the current interface simplicity.

## non-negotiables

- keep the existing single-pane shell and visual language intact.
- do not add admin complexity to navigator or partner screens.
- all data management and correction workflows live in an admin-only section.
- keep role views minimal:
  - navigator: assigned enrollees, requests to enroll, enrollee-based route planning, my station metrics, county commons.
  - partner: station profile, z-code specialties/interferences, referral execution context.
  - administrator: data operations, overrides, ingestion, policy configuration.

## key behavior requirements

### navigator behavior

- `assigned enrollees` dropdown only returns enrollees assigned to current navigator.
- `requests to enroll` shows intake-complete prospective enrollees pending assignment.
- `route planning` reacts to enrollee z-codes:
  - as z-codes are added/removed, eligible partners update immediately.
  - ranking prioritizes partners specializing in z-codes that interfere with earlier options.
- `my station` shows station-level burden and remediation trends.

### partner behavior

- partner identity is sourced from survey organization names (canonicalized).
- partner strip-map stations are shown as timeline stops based on assignment date.
- z-code circles represent current specialization set from survey/admin updates.
- partner radial chart is computed from true z-code category mappings.

### strip map behavior

- timeline is enrollment-relative and constrained to 6..12 months.
- timeline contains phase corridors:
  - regulation (first third),
  - readiness (second third),
  - renewal (final third).
- journey logs store dated milestones and power stop rendering.

### county commons behavior

- county-level z-code heatmap is shared across roles.
- visualization remains clean and compact in the existing pane.

### referral portal behavior

- for now, `referral portal` opens:
  - [atlas information exchange app](https://apps.apple.com/us/app/atlas-information-exchange/id6746423572)

## production supabase data model

the schema is defined in `supabase/migrations/20260114_make_app_alive.sql`.

### identity and access

- `atlas.roles`
- `atlas.people`
- `atlas.people_role_assignments`

### geography

- `atlas.countries`
- `atlas.states`
- `atlas.counties`
- `atlas.addresses`

### station and partner domain

- `atlas.partners`
- `atlas.partner_stations`
- `atlas.partner_station_staff`
- `atlas.partner_station_icons`

### enrollee and assignment domain

- `atlas.enrollees`
- `atlas.enrollment_requests`
- `atlas.enrollments`
- `atlas.navigator_assignments`

### z-code intelligence domain

- `atlas.z_codes`
- `atlas.z_code_categories`
- `atlas.z_code_category_map`
- `atlas.enrollee_z_codes`
- `atlas.partner_z_code_capabilities`

### routing and journey domain

- `atlas.route_plans`
- `atlas.route_plan_stops`
- `atlas.journey_logs`
- `atlas.timeline_settings`

### analytics and operations

- `atlas.station_metric_snapshots`
- `atlas.audit_events`

## automation strategy

automation SQL is in `supabase/migrations/20260114_make_app_alive.sql`.

- normalize partner organizations during ingestion.
- auto-upsert partner z-code capabilities from survey rows.
- auto-refresh route candidate ranking after enrollee z-code changes.
- auto-scaffold journey log records when route stops are assigned.
- enforce 6..12 month timeline constraints in db and app layer.

## routing rank rule (required)

ranking function: `atlas.fn_rank_route_candidates(enrollment_id uuid)`.

for each enrollee z-code:

1. highest priority: partner marks z-code as `specialize` and not `interfere`.
2. lower priority: partner marks both `specialize` and `interfere`.
3. lowest priority: partner marks only `interfere` or has no specialization.
4. tie-breakers:
   - specialization strength,
   - inverse interference load,
   - county match,
   - available station capacity.

## role-specific views

views are created in `supabase/migrations/20260114_make_app_alive.sql`.

- navigator:
  - `atlas.v_navigator_assigned_enrollees`
  - `atlas.v_navigator_enrollment_requests`
  - `atlas.v_navigator_route_candidates`
  - `atlas.v_navigator_my_station_metrics`
- partner:
  - `atlas.v_partner_station_profile`
  - `atlas.v_partner_z_code_burden`
- shared:
  - `atlas.v_county_z_code_heatmap`
- admin:
  - `atlas.v_admin_data_quality`
  - `atlas.v_admin_ingestion_status`

## security (rls)

- role claim source: `auth.jwt()` app metadata.
- navigators:
  - read assigned enrollees, related route/journey records.
- partners:
  - read own station profile and assigned referral context.
- administrators:
  - full access to atlas schema and admin views.

## app integration implementation

### data layer

- `src/lib/supabaseClient.ts` provides supabase client bootstrap.
- `src/features/atlas2026/singlepane/data-access/singlepaneRepository.ts` provides:
  - supabase-backed reads/writes where configured,
  - local-seed fallback when env vars are absent.

### single-pane usage

- `src/features/atlas2026/singlepane/useSinglePaneData.ts` now consumes repository methods instead of direct component-owned data access.
- the active runtime currently uses repository-backed local csv/localstorage data; supabase remains the target cutover mode.
- role menu actions mutate logs through repository abstraction.
- top-nav menu selection drives content panes without changing base layout.

### admin-only section

- `src/features/atlas2026/admin/AdminDataControlPanel.tsx`
- rendered only for administrator role and only when an administrator-only menu is selected.
- contains:
  - data quality checks,
  - ingestion status,
  - route override placeholders,
  - timeline/policy controls scaffolding.
- this is the current runtime boundary for admin work inside the shell; a dedicated `/admin` route is still an optional future isolation step rather than the present implementation.

### county commons heatmap

- `src/features/atlas2026/singlepane/components/CountyCommonsHeatmap.tsx`
- renders county z-group burden from aggregate view/repository data.
- kept intentionally minimal to preserve interface cleanliness.

## rollout phases

1. apply schema and view migrations in supabase.
2. run ingestion seed scripts:
   - `supabase/seeds/seed_z_code_taxonomy.sql`
   - `scripts/build-partner-capabilities.js` output into db upsert.
3. configure app env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. switch single-pane runtime to repository supabase mode.
5. validate role-scope access with test users.
6. enable admin-only operations panel.

## acceptance checklist

- navigator sees only assigned enrollees.
- requests-to-enroll list is filtered and assignable.
- route candidate order follows specialization/interference rule.
- strip map stop coordinates are enrollment-date-relative in 6..12 month windows.
- partner radial chart uses true z-code category mapping table.
- county commons heatmap loads county z-group burden data.
- admin operations are isolated from navigator/partner views.
