# Atlas (ATLAS)

ATLAS is a role-based care coordination and navigation platform centered on the 2026 operating model (`Regulation -> Readiness -> Renewal`), with a single-pane workflow for rapid field operations.

## Executive and Operations Brief

ATLAS is designed as an operating system for accountable care navigation, where policy, field execution, and data governance are treated as one continuous control loop. The product is intentionally structured so executive leadership can see strategic posture, operations can execute with speed and consistency, and administrators can enforce compliance without disrupting frontline throughput.

### Policy Design Intent

- **Operational safety first**: All workflows prioritize immediate stabilization and risk containment before progression.
- **Role-bound execution**: Navigator, partner, and administrator scopes are explicit and enforced.
- **Evidence-backed movement**: Progression across phases is linked to measurable outputs and logged milestones.
- **Governance by design**: Authorization, exceptions, and rollout toggles are implemented as first-class infrastructure.
- **Cross-platform continuity**: Web and mobile are aligned through shared TypeScript contracts and data wrappers.

### Strategic Achievement Snapshot

- Implemented role-based platform shell for `Navigator`, `Partner`, and `Administrator` operating contexts.
- Expanded role model to include `Supervisor` for navigator competency governance and team burden oversight.
- Established Supabase/Postgres foundation for partner capacity surveys and burden/capability updates.
- Implemented authorization foundation (`permissions`, `role_permissions`, exceptions, and policy toggles).
- Added monorepo direction for web + mobile (`Vite` + `Expo/React Native`) with shared package structure.

### System Operating Model

```mermaid
flowchart LR
  A[Regulation<br/>stabilize risk] --> B[Readiness<br/>build capacity]
  B --> C[Renewal<br/>sustain contribution]
  C --> D[Feedback and Audit]
  D --> A
```

### End-to-End Process Flow

```mermaid
sequenceDiagram
  participant Nav as Navigator
  participant Ops as Operations Control
  participant Partner as Partner Station
  participant Atlas as ATLAS Platform
  participant Data as Supabase/Atlas Schema

  Nav->>Atlas: Intake or select enrollee
  Atlas->>Data: Load assignments, requests, and context views
  Atlas->>Ops: Display risk/readiness posture
  Nav->>Atlas: Build/assign route and next safe move
  Atlas->>Partner: Issue route-aligned service request
  Partner->>Atlas: Submit capacity and burden updates
  Atlas->>Data: Persist logs, submissions, and capabilities
  Data-->>Ops: Surface metrics, quality, and governance signals
```

### Governance and Access Control Structure

```mermaid
flowchart TD
  U[Authenticated User] --> R{Role Context}
  R --> N[Navigator Scope]
  R --> P[Partner Scope]
  R --> A[Administrator Scope]

  A --> G[Authorization Settings and Exceptions]
  G --> L[RLS and Permission Policies]
  N --> L
  P --> L

  L --> DB[(Atlas Schema Data Objects)]
  DB --> Q[Operational and Audit Views]
```

## Current Product State

- Primary app shell is `src/features/atlas2026/singlepane/SinglePaneApp.tsx` via `src/RootApp.jsx`
- Standalone partner survey route is available at `/service-capacity-survey`
- Narrow/mobile route planning now uses an Metropolitan Transportation Authority (MTA)-inspired symbolic route board and applies the same visual system inside the readiness route-planning overlay
- Supabase/Postgres is active for survey and capacity workflows
- Authorization foundation is now in place (roles, permissions, user exceptions, Row-Level Security (RLS) toggles)
- Runtime data path is Supabase/Postgres

Documentation hub: [`docs/README.md`](./docs/README.md).

## Visual Direction

The User Interface (UI) is intentionally dark and operational, not pastel/civic-light.

- Base surface: black-first (`SP_COLORS.bg = #000000`)
- Reference palette model: `references/NYC-subway-pantone-colors.jpg`
- Accent colors align with subway-inspired signal tones in `src/features/atlas2026/shared/theme.ts`
- Typography and casing follow the current shell behavior (including lowercase UI treatment from `src/index.css`)

## Core Workflows

- **Navigator**
  - assigned enrollees
  - requests to enroll
  - route planning with z-code-aware partner ranking
  - symbolic mobile route board for narrow-screen route inspection
  - station and county context
- **Partner**
  - service-capacity survey and burden/capability updates
  - station profile context
- **Supervisor**
  - assigned navigator oversight and competency tracking
  - navigator assessments aligned to Z-code parent themes
  - rolling weighted competency average using last three assessments (`3x most recent + 2x prior + 1x previous`)
  - supervisor shell parity: milestone strip-map and team-level radial burden view
- **Administrator**
  - admin-only operations panels
  - data controls, governance scaffolding, and policy toggles

Detailed behavior spec: [`docs/users/README.md`](./docs/users/README.md) (users) and [`docs/it/README.md`](./docs/it/README.md) (IT)

## Technical Setup

- React 18 + Vite (web)
- Expo + React Native (mobile)
- Tailwind + Radix primitives
- Supabase JS client (`@supabase/supabase-js`) for Postgres/Application Programming Interface (API) integration
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

Start here:

- [`docs/it/database.md`](./docs/it/database.md) — schema / RPC index
- [`docs/it/security.md`](./docs/it/security.md) — security / RLS / compliance index
- [`docs/atlas-2026-database-model.md`](./docs/atlas-2026-database-model.md) — canonical model
- [`supabase/README.md`](./supabase/README.md) — migration notes

Key authz components now implemented:

- `atlas.permissions`
- `atlas.role_permissions`
- `atlas.user_permission_exceptions`
- `atlas.authorization_settings`
- `atlas.supervisor_navigator_assignments`
- `atlas.navigator_competency_assessments`
- `atlas.navigator_competency_assessment_answers`

Phased rollout toggles:

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

## Migrations

Apply the full live chain under `supabase/migrations/` in timestamp order. Prefer that folder over any embedded list in older docs. Commissioning entry point: [`docs/it/commissioning.md`](./docs/it/commissioning.md).

## Useful Scripts

- `npm run data:partner-capabilities` - builds partner capability seed artifact
- `npm run test:route-ranking` - validates route ranking behavior, including the three-parent Elena Rodriguez example

## Example Ranking Scenario

The seeded demo now includes a concrete weighted ranking case for `Elena Rodriguez`:

- active Z-code parents represented by child codes: `Z59.1`, `Z56.2`, `Z60.4`
- three completed partner surveys across the same codes
- expected ranking:
  1. `BridgeLine Community Commons`
  2. `North Harbor Housing Hub`
  3. `WorkSpring Employment Desk`

This scenario is intended to make the mobile route board and readiness routing overlay easy to inspect without guessing at synthetic UI-only data.

## Documentation Map

**Start here:** [`docs/README.md`](./docs/README.md)

| Audience | Entry |
|----------|-------|
| IT / Information Systems (IS) | [`docs/it/README.md`](./docs/it/README.md) |
| End users | [`docs/users/README.md`](./docs/users/README.md) |
| Pilot (full procedures) | [`PILOT.md`](./PILOT.md) |
| Archive (obsolete) | [`docs/archive/README.md`](./docs/archive/README.md) |

Root markdown files other than `README.md` and `PILOT.md` are redirect stubs to `docs/it/` or `docs/users/`.

## Contribution Guidance

When making changes:

- Preserve the single-pane operational interaction model unless explicitly changing IA.
- Keep role boundaries strict (navigator vs partner vs administrator).
- Treat authorization and data policy changes as migration-backed, reviewed infrastructure work.
- Update docs in the same Pull Request (PR) when behavior or architecture changes.
- Follow `docs/writing-standards.md`, including required first-use acronym expansion in every file.
- Prefer adding or editing under `docs/it/` or `docs/users/` — do not expand root-level markdown.

