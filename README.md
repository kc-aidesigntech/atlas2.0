# ATLAS

ATLAS is a role-based care coordination and navigation platform centered on the 2026 operating model (`Regulation -> Readiness -> Renewal`), with a single-pane workflow for rapid field operations.

## Current Product State

- Primary app shell is `src/features/atlas2026/singlepane/SinglePaneApp.tsx` via `src/RootApp.jsx`
- Standalone partner survey route is available at `/service-capacity-survey`
- Supabase/Postgres is active for survey and capacity workflows
- Authorization foundation is now in place (roles, permissions, user exceptions, RLS toggles)
- Legacy Firebase paths still exist in the repo for specific 2026 services and migration continuity

## Visual Direction

The UI is intentionally dark and operational, not pastel/civic-light.

- Base surface: black-first (`SP_COLORS.bg = #000000`)
- Reference palette model: `references/NYC-subway-pantone-colors.jpg`
- Accent colors align with subway-inspired signal tones in `src/features/atlas2026/singlepane/theme.ts`
- Typography and casing follow the current shell behavior (including lowercase UI treatment from `src/index.css`)

## Core Workflows

- **Navigator**
  - assigned enrollees
  - requests to enroll
  - route planning with z-code-aware partner ranking
  - station and county context
- **Partner**
  - service-capacity survey and burden/capability updates
  - station profile context
- **Administrator**
  - admin-only operations panels
  - data controls, governance scaffolding, and policy toggles

Detailed behavior spec: `MAKE_APP_ALIVE.md`

## Tech Stack

- React 18 + Vite (web)
- Expo + React Native (mobile)
- Tailwind + Radix primitives
- Supabase JS client (`@supabase/supabase-js`) for Postgres/API integration
- Firebase SDK still present for legacy/transition services
- Shared cross-platform TypeScript package at `packages/shared`

## Quick Start

```bash
npm install
npm run dev
```

Mobile app (Expo):

```bash
npm run mobile:start
```

Build and preview:

```bash
npm run build
npm run preview
```

Platform targets:

- `npm run dev:web` - web dev server (Vite)
- `npm run mobile:start` - Expo dev server
- `npm run mobile:ios` - run iOS simulator (when available)
- `npm run mobile:android` - run Android emulator/device
- `npm run mobile:web` - Expo web target

## Environment Variables

Frontend runtime (required for Supabase-connected paths):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Security rule:

- Never expose service credentials in `VITE_*` vars.
- Keep `SUPABASE_SECRET_KEY` server-side only.

Notes:

- The client includes a compatibility fallback for `VITE_SUPABASE_ANON_KEY`.
- Non-`public` schema requests use PostgREST schema profiles (`atlas`).

Mobile runtime (`apps/mobile/.env`):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Database and Authorization

Start here for the current model:

- `docs/atlas-2026-database-model.md` (canonical model and authz foundation)
- `supabase/README.md` (migration order and runtime setup)
- `SQL_SCHEMA.md` (expanded schema map)

Key authz components now implemented:

- `atlas.permissions`
- `atlas.role_permissions`
- `atlas.user_permission_exceptions`
- `atlas.authorization_settings`

Phased rollout toggles:

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

## Migrations (Current Baseline)

Apply in this sequence for a new Supabase environment:

1. `supabase/migrations/20260114_make_app_alive.sql`
2. `supabase/migrations/20260401_profile_images.sql`
3. `supabase/migrations/20260402_partner_service_capacity_surveys.sql`
4. `supabase/migrations/20260411_grant_delete_partner_service_capacity.sql`
5. `supabase/migrations/20260411_authorization_foundation.sql`

## Useful Scripts

- `npm run data:partner-capabilities` - builds partner capability seed artifact
- `npm run test:route-ranking` - validates route ranking behavior

## Documentation Map

- Product behavior and execution spec: `MAKE_APP_ALIVE.md`
- Canonical 2026 technical orientation: `docs/atlas-2026-canonical-spec.md`
- Security and governance model notes: `docs/atlas-2026-security-model.md`
- Repo cutover plan: `docs/atlas-2026-repo-cutover.md`
- Seeding guide: `docs/atlas-2026-seeding.md`

## Contribution Guidance

When making changes:

- Preserve the single-pane operational interaction model unless explicitly changing IA.
- Keep role boundaries strict (navigator vs partner vs administrator).
- Treat authorization and data policy changes as migration-backed, reviewed infrastructure work.
- Update docs in the same PR when behavior or architecture changes.

