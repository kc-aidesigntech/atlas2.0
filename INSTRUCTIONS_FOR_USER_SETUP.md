# ATLAS User Setup Instructions

## What You Are Seeing Right Now

If `http://localhost:5173/` shows a placeholder-like shell with little or no content, that is expected when the full single-pane runtime is not commissioned yet.

There are two different runtime modes in this repo:

1. `Partner survey mode`
   - Uses Supabase for partner service-capacity survey save/load behavior.
   - Does **not** require the full single-pane runtime bootstrap tables/views.
   - Best route for immediate functional testing: `/service-capacity-survey`

2. `Full single-pane shell mode`
   - Uses Supabase runtime config, views, and dashboards for navigator, partner, supervisor, and admin shell content.
   - Requires additional migrations, config documents, runtime views, grants, and data.
   - This is what powers the main root app at `/`

## Recommended Fastest Path

If your goal is to get a working system quickly, start with the standalone partner survey first.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

The root `.env` should contain:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false
```

Important:

- Keep `SUPABASE_SECRET_KEY` server-side only.
- Leave `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false` for local dev unless you have already commissioned the full runtime shell.

## Step 3: Apply the Required Survey Migrations

For the partner survey flow, apply these migrations in order:

1. `supabase/migrations/20260114_make_app_alive.sql`
2. `supabase/migrations/20260401_profile_images.sql`
3. `supabase/migrations/20260402_partner_service_capacity_surveys.sql`
4. `supabase/migrations/20260411_grant_delete_partner_service_capacity.sql`
5. `supabase/migrations/20260411_authorization_foundation.sql`
6. `supabase/migrations/20260411_supervisor_navigator_competency.sql`
7. `supabase/migrations/20260412_partner_identifier_records.sql`
8. `supabase/migrations/20260412_partner_service_capacity_drafts.sql`
9. `supabase/migrations/20260414_zcode_master_alignment.sql`

If you want the full root-shell runtime, also apply:

10. `supabase/migrations/20260413_atlas_app_runtime_cutover.sql`

## Step 4: Apply Required Seeds

Run or import the data expected by the repo:

1. `supabase/seeds/seed_z_code_taxonomy.sql`
2. Generate partner capability seed input:

```bash
npm run data:partner-capabilities
```

Then ingest:

- `sample-data/ATLASDB-excel/partner-capabilities.seed.json`

## Step 5: Start the App

```bash
npm run dev
```

## Step 6: Test the Working Survey System

Open:

- `http://localhost:5173/service-capacity-survey`

This route forces the app into the partner survey flow directly and avoids the incomplete root-shell runtime dependency.

Expected behavior:

- record history view appears first
- resume-draft banner appears when applicable
- `+` starts a new blank record
- draft records can be reopened and edited
- completed records remain read-only

## When To Turn On `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true`

Only turn this on when all of the following are true:

1. `20260413_atlas_app_runtime_cutover.sql` has been applied
2. the `atlas.app_role_navigation` and `atlas.app_config_documents` tables exist
3. the `atlas.v_singlepane_*` runtime views exist
4. required grants and policies are in place
5. your Supabase project contains usable runtime data

After changing the flag, restart Vite:

```bash
npm run dev
```

## Why The Root App Can Still Look Empty

The root shell at `/` depends on full runtime bootstrap data for:

- enrollee profiles
- enrollee domain loads
- load breakdown views
- role navigation
- timeline config
- county/admin/partner runtime views

If those runtime tables/views are not commissioned, the root app can render with little or no meaningful content even though the survey subsystem works.

## Minimum Access / Identity Requirements

For auth-backed operation, make sure:

1. the authenticated user maps to `atlas.people.external_ref = auth.uid()::text`
2. the user has an active role assignment in `atlas.people_role_assignments`
3. the role has the required permissions through `atlas.role_permissions`
4. legacy rollout toggles remain enabled until strict auth is fully validated

Relevant rollout toggles:

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

## Quick Verification Checklist

Use this checklist after setup:

1. `npm run build` succeeds
2. `http://localhost:5173/service-capacity-survey` loads
3. creating a draft works
4. re-opening a draft works
5. completing a survey returns to history
6. completed records have no edit affordance

## If You Want The Entire Root App Working

Use `HOW_TO_COMMISSION_SYSTEM.md`.
