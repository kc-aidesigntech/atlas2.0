# Atlas (ATLAS)

ATLAS is a role-based care coordination and navigation platform centered on the 2026 operating model (`Regulation -> Readiness -> Renewal`), with a single-pane workflow for rapid field operations.

## Executive and Operations Brief

ATLAS is designed as an operating system for accountable care navigation, where policy, field execution, and data governance are treated as one continuous control loop. The product is intentionally structured so executive leadership can see strategic posture, operations can execute with speed and consistency, and administrators can enforce compliance without disrupting frontline throughput.

### Policy Design Intent

- **Operational safety first**: All workflows prioritize immediate stabilization and risk containment before progression.
- **Role-bound execution**: Staff scopes are the seven Residency tiers (`t1` Candidate through `t4plus` Coordinator), plus partner and enrollee; each is gated by permission key. See [`docs/tiers.md`](./docs/tiers.md).
- **Evidence-backed movement**: Progression across phases is linked to measurable outputs and logged milestones.
- **Governance by design**: Authorization, exceptions, and rollout toggles are implemented as first-class infrastructure.
- **Cross-platform continuity**: Web and mobile are aligned through shared TypeScript contracts and data wrappers.

### Strategic Achievement Snapshot

- Implemented role-based platform shell for `Navigator`, `Partner`, and `Administrator` operating contexts.
- Expanded role model to include `Supervisor` for navigator competency governance and team burden oversight.
- Replaced the staff role keys with the seven Residency tiers (`t1`, `t2`, `t2b`, `t3`, `t3a`, `t4`, `t4plus`); `navigator` / `supervisor` / `administrator` map to `t3a` / `t4` / `t4plus`. Screens gate on permission keys (`fn_my_permissions`) instead of role literals.
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
  R --> N[Tier Scope t1 to t4]
  R --> P[Partner Scope]
  R --> A[t4plus Coordinator Scope]

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
- Pray Phone is live as an Atlas staff door, not as a page inside the call engine. Tiers `t2b`, `t3a`, `t4`, and `t4plus` show a **warm line** menu and a phone icon in the top bar, to the left of Account Settings, on every menu, when the account passes `warmline_agent.access`. The icon opens `https://prayphone-68d333045316.herokuapp.com/agent` and signs in that same Supabase user. The session token is not put in the address bar. Partners do not see either control. A press of the icon always opens the agent console on prayphone-server. A green count on the icon is how many calls are waiting in the conferencer queue. Zero means that queue is empty. A kiosk `0` press turns the icon red and plays a ring. Runbook: [`docs/it/prayphone.md`](./docs/it/prayphone.md).
- Fleet (which phones are online, call sessions, street address, Wi-Fi login) is an Atlas screen for `t4` and `t4plus`: [`docs/it/fleet.md`](./docs/it/fleet.md).

Documentation hub: [`docs/README.md`](./docs/README.md).

## Visual Direction

The User Interface (UI) is intentionally dark and operational, not pastel/civic-light.

- Base surface: black-first (`SP_COLORS.bg = #000000`)
- Reference palette model: `references/NYC-subway-pantone-colors.jpg`
- Accent colors align with subway-inspired signal tones in `src/features/atlas2026/shared/theme.ts`
- Typography and casing follow the current shell behavior (including lowercase UI treatment from `src/index.css`)

## Core Workflows

Menus per tier come from `atlas.app_role_navigation` (`20261104190400_tier_navigation.sql`). Full table: [`docs/tiers.md`](./docs/tiers.md).

- **T1 Candidate / T2 Apprentice / T3 Travel Peer**
  - refer; T2 adds my wallet; T3 adds secondment schedule and sponsorships
- **T2B Peer Resident**
  - refer, my wallet, assigned enrollees, leads, warm line, respite shifts, sponsorships
- **T3A Peer Navigator** (the former navigator shell)
  - assigned enrollees
  - requests to enroll
  - route planning with z-code-aware partner ranking
  - symbolic mobile route board for narrow-screen route inspection
  - station and county context
  - **warm line** and the header phone icon (seeded `warmline_agent.access`) when the Atlas build includes the Pray Phone origin
- **Partner**
  - service-capacity survey and burden/capability updates
  - station profile context
- **T4 Supervisor** (the former supervisor shell)
  - assigned navigator oversight and competency tracking
  - navigator assessments aligned to Z-code parent themes
  - rolling weighted competency average using last three assessments (`3x most recent + 2x prior + 1x previous`)
  - supervisor shell parity: milestone strip-map and team-level radial burden view
  - cohorts and competency cards
  - **warm line**, the header phone icon, and the **fleet** menu
- **T4+ Coordinator** (the former administrator shell; system-administrator bypass)
  - admin-only operations panels
  - data controls, governance scaffolding, and policy toggles
  - partners screen (station capacity and stop status), tier picker in Admin Directory; the county heat map menu stays hidden while `SHOW_COUNTY_COMMONS` is `false`
  - **warm line**, the header phone icon, and the **fleet** menu

Detailed behavior spec: [`docs/users/README.md`](./docs/users/README.md) (users) and [`docs/it/README.md`](./docs/it/README.md) (Information Technology (IT))

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
- `VITE_ATLAS_PRAYPHONE_URL` — optional. Unset, the phone icon opens `https://prayphone-68d333045316.herokuapp.com/agent`. Set it only if that conferencer moves, then redeploy. See [`docs/it/prayphone.md`](./docs/it/prayphone.md).
- `VITE_ATLAS_FLEET_HOSTNAME` — optional hostname for the fleet screen. Unset, fleet stays at `/fleet`. See [`docs/it/fleet.md`](./docs/it/fleet.md).

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
| Pray Phone warm line and header icon | [`docs/it/prayphone.md`](./docs/it/prayphone.md) |
| Pray Phone fleet | [`docs/it/fleet.md`](./docs/it/fleet.md) |
| End users | [`docs/users/README.md`](./docs/users/README.md) |
| Pilot (full procedures) | [`PILOT.md`](./PILOT.md) |
| Archive (obsolete) | [`docs/archive/README.md`](./docs/archive/README.md) |

Root markdown files other than `README.md` and `PILOT.md` are redirect stubs to `docs/it/` or `docs/users/`.

## Contribution Guidance

When making changes:

- Preserve the single-pane operational interaction model unless explicitly changing IA.
- Keep role boundaries strict (tier vs partner vs enrollee); gate by permission key, not role literal (`.cursor/rules/tier-hierarchy.mdc`).
- Treat authorization and data policy changes as migration-backed, reviewed infrastructure work.
- Update docs in the same Pull Request (PR) when behavior or architecture changes.
- Follow `docs/writing-standards.md`, including required first-use acronym expansion in every file.
- Prefer adding or editing under `docs/it/` or `docs/users/` — do not expand root-level markdown.

