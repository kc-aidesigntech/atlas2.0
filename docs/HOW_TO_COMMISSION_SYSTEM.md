# How To Commission Atlas (ATLAS)

## Purpose

This document is the commissioning runbook for bringing the repo from local development into a fully functioning Supabase-backed ATLAS system.

It covers:

- environment configuration
- database migration order
- runtime cutover requirements
- access and identity integrity
- verification steps
- common failure modes

## Commissioning Strategy

There are two valid commissioning targets.

## Target A: Partner Survey First

Choose this when you need the partner Z-code service-capacity workflow working quickly.

This target powers:

- `http://localhost:5173/service-capacity-survey`

This target does **not** require the full single-pane runtime cutover.

## Target B: Full Single-Pane Runtime

Choose this when you need the main app shell at `/` to render real Supabase-backed operational content for:

- navigator
- partner
- supervisor
- administrator

This target requires the runtime cutover migration and seeded runtime data.

## 1. Provision Supabase

Create or choose a Supabase project and make sure you have:

- project Uniform Resource Locator (URL)
- publishable key
- service or secret key for admin-side commissioning work

Set these in the root `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false
```

Notes:

- `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false` is the safe local default.
- Turn it on only after the full runtime cutover has been completed.

## 2. Apply Database Migrations

Apply migrations in this order:

1. `supabase/migrations/20260114_make_app_alive.sql`
2. `supabase/migrations/20260401_profile_images.sql`
3. `supabase/migrations/20260402_partner_service_capacity_surveys.sql`
4. `supabase/migrations/20260411_grant_delete_partner_service_capacity.sql`
5. `supabase/migrations/20260411_authorization_foundation.sql`
6. `supabase/migrations/20260411_supervisor_navigator_competency.sql`
7. `supabase/migrations/20260412_partner_identifier_records.sql`
8. `supabase/migrations/20260412_partner_service_capacity_drafts.sql`
9. `supabase/migrations/20260413_atlas_app_runtime_cutover.sql`

You can apply them with your normal Supabase workflow:

- Supabase Studio Structured Query Language (SQL) editor
- migration runner already used by your team
- Supabase Command-Line Interface (CLI), if installed in your environment

## 3. Apply Seeds and Derived Data

Required seed/setup work:

1. Run `supabase/seeds/seed_z_code_taxonomy.sql`
2. Generate partner capability seed input:

```bash
npm run data:partner-capabilities
```

3. Import:

- `sample-data/ATLASDB-excel/partner-capabilities.seed.json`

## 4. Understand What Each Migration Unlocks

## Survey and partner-capacity layer

These migrations enable the partner survey system:

- `20260402_partner_service_capacity_surveys.sql`
- `20260411_grant_delete_partner_service_capacity.sql`
- `20260412_partner_identifier_records.sql`
- `20260412_partner_service_capacity_drafts.sql`

These support:

- survey save/load
- draft vs completed status
- survey history
- partner identifier lookup
- respondent email capture
- partner table contact propagation

## Authorization layer

`20260411_authorization_foundation.sql` introduces:

- `atlas.permissions`
- `atlas.role_permissions`
- `atlas.user_permission_exceptions`
- `atlas.authorization_settings`

It also establishes the Row-Level Security (RLS) and permission model used by the survey subsystem.

## Supervisor layer

`20260411_supervisor_navigator_competency.sql` introduces:

- `atlas.supervisor_navigator_assignments`
- `atlas.navigator_competency_assessments`
- `atlas.navigator_competency_assessment_answers`
- `atlas.v_supervisor_navigator_competency_rollup`

## Full single-pane runtime layer

`20260413_atlas_app_runtime_cutover.sql` adds the runtime shell data model for the root app, including:

- `atlas.app_role_navigation`
- `atlas.app_config_documents`
- `atlas.v_singlepane_enrollee_profiles`
- `atlas.v_singlepane_enrollee_domain_load_breakdown`
- `atlas.v_singlepane_enrollee_domain_loads`

This is the migration that turns the root shell from a sparse placeholder into a data-backed operational shell.

## 5. Commission Identity Integrity

For authenticated access to work correctly:

1. every real app user must map to an `atlas.people` record
2. that record must use `people.external_ref = auth.uid()::text`
3. the person must have at least one active row in `atlas.people_role_assignments`
4. the assigned role must resolve to permissions in `atlas.role_permissions`

Without this, you may see:

- empty views
- permission-denied responses
- partial app behavior
- RLS failures on writes

## 6. Recommended Initial Access Rollout

Do **not** harden permissions immediately on day one.

Keep these authorization settings enabled while commissioning:

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

Recommended sequence:

1. Commission users and role mappings
2. Verify survey read/write
3. Verify history and drafts
4. Verify partner identifier search
5. Verify full shell reads
6. Then disable legacy flags one at a time

## 7. Commission The Root Shell

Once the runtime cutover objects exist and are populated:

1. set this in `.env`:

```env
VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true
```

2. restart the dev server:

```bash
npm run dev
```

3. open:

- `http://localhost:5173/`

You should now expect real Supabase-backed shell content instead of the sparse placeholder state.

## 8. Role-Based Verification Pass

Use the app to verify each role.

## Partner

Verify:

- `service capacity` opens the standalone survey route
- survey history loads
- draft save/resume works
- completed records are read-only

## Navigator

Verify:

- assigned enrollees populate
- route planning opens
- county commons loads
- requests to enroll load if commissioned

## Supervisor

Verify:

- assigned navigator context loads
- competency records can be created
- rollup view renders

## Administrator

Verify:

- admin menus render
- governance/system operations panels appear

## 9. Troubleshooting

## Symptom: Root app is mostly empty

Likely cause:

- `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false`
- or runtime cutover migrations were not applied
- or runtime views/tables were created but not populated

## Symptom: Standalone survey loads but saves fail

Likely cause:

- survey migrations missing
- RLS/policy mismatch
- auth user not mapped to `atlas.people.external_ref`
- legacy public write toggle disabled too early

## Symptom: DevTools shows `404` for `v_singlepane_*`

Likely cause:

- `20260413_atlas_app_runtime_cutover.sql` not applied

## Symptom: DevTools shows `401` or `permission denied`

Likely cause:

- grants missing
- auth user lacks role mapping
- permissions not resolved
- full runtime bootstrap enabled before access was commissioned

## Symptom: Partner identifier search returns nothing

Likely cause:

- `20260412_partner_identifier_records.sql` not applied
- `atlas.partners` lacks primary contact columns/data
- `atlas.v_partner_identifier_records` has no rows yet

## 10. Rapid Commissioning Checklist

Use this exact order for the fastest route to a truly working system:

1. add env vars
2. apply migrations through `20260412_partner_service_capacity_drafts.sql`
3. seed taxonomy and partner capability data
4. verify `/service-capacity-survey`
5. commission auth user to `atlas.people.external_ref`
6. verify survey read/write end to end
7. apply `20260413_atlas_app_runtime_cutover.sql`
8. populate runtime config and runtime views
9. set `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true`
10. restart app
11. verify `/`

## 11. Recommended Operating Split

Until the full runtime shell is fully commissioned:

- use `/service-capacity-survey` for partner survey work
- keep `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false`
- treat the root shell as incomplete

That gives you a working production-grade survey workflow sooner, without blocking on the entire operational runtime cutover.
