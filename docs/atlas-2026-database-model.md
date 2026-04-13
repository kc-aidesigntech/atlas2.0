# ATLAS 2026 Database Model

This document is the canonical architecture reference for the Supabase/Postgres `atlas` schema, including the authorization foundation introduced for role-based permissions and user-level exceptions.

It is a design and operations guide, not an executable migration.

## Migration Baseline

Apply migrations in this order for a new environment:

1. `supabase/migrations/20260114_make_app_alive.sql`
2. `supabase/migrations/20260401_profile_images.sql`
3. `supabase/migrations/20260402_partner_service_capacity_surveys.sql`
4. `supabase/migrations/20260411_grant_delete_partner_service_capacity.sql`
5. `supabase/migrations/20260411_authorization_foundation.sql`
6. `supabase/migrations/20260411_supervisor_navigator_competency.sql`
7. `supabase/migrations/20260414_zcode_master_alignment.sql`

## Domain Map

The `atlas` schema is organized into these layers:

- Identity and role assignment
  - `atlas.people`
  - `atlas.roles`
  - `atlas.people_role_assignments`
- Geography and partner network
  - `atlas.countries`, `atlas.states`, `atlas.counties`, `atlas.addresses`
  - `atlas.partners`, `atlas.partner_stations`, `atlas.partner_station_icons`
- Enrollee and care lifecycle
  - `atlas.enrollees`, `atlas.enrollment_requests`, `atlas.enrollments`
  - `atlas.navigator_assignments`, `atlas.route_plans`, `atlas.route_plan_stops`
  - `atlas.journey_logs`, `atlas.referrals`, `atlas.timeline_settings`
- Z-code intelligence and survey capacity
  - `atlas.z_codes`, `atlas.z_code_categories`, `atlas.z_code_category_map`
  - `atlas.enrollee_z_codes`, `atlas.partner_z_code_capabilities`
  - `atlas.partner_service_capacity_submissions`
  - `atlas.partner_service_capacity_answers`
  - `atlas.partner_z_code_burden_scores`
- Supervisor competency and team governance
  - `atlas.supervisor_navigator_assignments`
  - `atlas.navigator_competency_assessments`
  - `atlas.navigator_competency_assessment_answers`
  - `atlas.v_supervisor_navigator_competency_rollup`

## Authorization Foundation (New)

The authorization infrastructure is implemented in `20260411_authorization_foundation.sql`.

### Core authorization tables

- `atlas.permissions`
  - One row per permission key (for example, `partner_capacity_submissions.delete`).
- `atlas.role_permissions`
  - Maps `roles -> permissions`.
- `atlas.user_permission_exceptions`
  - Per-user allow/deny overrides with time windows (`starts_at`, `ends_at`).
- `atlas.authorization_settings`
  - Feature-toggle flags to support phased rollout from legacy access to strict permission checks.

### Permission resolution model

Permission checks follow this order:

1. **Admin bypass**: `app_metadata.atlas_role = administrator` grants access.
2. **User lookup**: map auth user to `atlas.people` via `people.external_ref = auth.uid()::text`.
3. **Deny exception wins**: active `deny` in `user_permission_exceptions` blocks access.
4. **Allow exception next**: active `allow` grants access.
5. **Role-derived permission**: active `people_role_assignments` + `role_permissions` grants access.
6. Otherwise deny.

This logic is encapsulated in:

- `atlas.fn_current_person_id()`
- `atlas.fn_authz_setting_enabled(setting_key, fallback)`
- `atlas.fn_has_permission(permission_key)`

## RLS Policy Pattern

RLS is enabled and policy-managed on survey/capacity tables:

- `atlas.partner_service_capacity_submissions`
- `atlas.partner_service_capacity_answers`
- `atlas.partner_z_code_burden_scores`

`atlas.partner_service_capacity_answers` supports two intentional completion states:

- `burden_score in 1..9` for rated answers
- `not_encountered = true` with `burden_score = null` for items that are outside the organization's work

Each action (`select`, `insert`, `update`, `delete`) allows access when either:

- corresponding legacy setting flag is enabled, or
- `atlas.fn_has_permission('<domain_permission>')` is true.

This gives immediate compatibility while the app migrates to strict permissioned access.

## Rollout Toggles

Current settings seeded by migration:

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

Recommended hardening path:

1. Confirm all authenticated users map to `atlas.people.external_ref`.
2. Verify `roles`, `role_permissions`, and exceptions are complete.
3. Disable toggles one modality at a time (`read`, then `write`, then `delete`).
4. Validate app behavior after each toggle.

## Supervisor Competency Model

Supervisor scoring follows a weighted rolling average over the three most recent navigator assessments:

- most recent assessment average score x `3`
- previous assessment average score x `2`
- third most recent assessment average score x `1`

Computed score formula:

`weighted_rolling_average = (score_1 * 3 + score_2 * 2 + score_3 * 1) / 6`

When fewer than three assessments are present, the denominator is the sum of available weights.

## Notes for API Clients

- Frontend clients use:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- For non-`public` schema calls through PostgREST, include schema profile headers:
  - `Accept-Profile: atlas` for reads
  - `Content-Profile: atlas` for writes
- `SUPABASE_SECRET_KEY` must stay server-side only (never `VITE_` prefixed).

## Related References

- `SQL_SCHEMA.md` (broad schema reference)
- `SQL_SCHEMA_ENGINEERING.md` (engineering schema notes)
- `supabase/README.md` (runtime + migration and authz rollout notes)
