# Atlas Pilot Guide

This document is the single source for running an end-to-end pilot of the Atlas
single-pane application. It lists the artificial login profile for every role
and gives step-by-step procedures for exercising each capability, mapped to the
screen you use and the server command Remote Procedure Call (RPC) it invokes.

Atlas enforces a **database-first** access model: the User Interface (UI) role is
only a presentation toggle, while the data each login can read or write is
enforced by Row-Level Security (RLS) on the signed-in identity. Permission
failures are surfaced loudly (a red banner), never hidden as an empty screen.

---

## 1. Prerequisites

1. **Supabase config present** in `.env` (already set for project `qjsaedamqaqxobslboni`):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true` (requires a real sign-in before the workspace loads)
2. **Dev server running:**
   ```bash
   npm run dev
   ```
   App: `http://localhost:5173/` (public landing) and `http://localhost:5173/app` (workspace).
3. **Pilot accounts provisioned** — created by `verification/pilot_setup.sql`. Re-run that
   script any time to (re)create or reset the four logins and their seed data.

---

## 2. Pilot profiles

All four accounts share one password and have confirmed email.

| Profile | Email | Password | `app_metadata.atlas_role` | Seeded scope |
|---------|-------|----------|---------------------------|--------------|
| Administrator | `pilot.admin@atlas.test` | `AtlasPilot2026!` | `administrator` | Full access to all data; warehouse exports remain service-role-only |
| Navigator | `pilot.navigator@atlas.test` | `AtlasPilot2026!` | `navigator` | Assigned to 2 enrollees: Sandra Morrison (ATLAS-EX-001), Marcus Thompson (ATLAS-EX-002) |
| Supervisor | `pilot.supervisor@atlas.test` | `AtlasPilot2026!` | `supervisor` | Supervises every navigator; sees competency rollups and supervised enrollments |
| Partner | `pilot.partner@atlas.test` | `AtlasPilot2026!` | `partner` | Primary contact of "Atlas Pilot Partner Org"; no enrollee Protected Health Information (PHI) |

**Anonymous (no login)** is also a pilot persona: the public landing page and
referral form at `http://localhost:5173/`.

### Verified scope (from RLS replay)

| Read surface | Admin | Navigator | Supervisor | Partner | Anon |
|---|---|---|---|---|---|
| Enrollee profiles (PHI) | 4 (all) | 2 (assigned) | 4 (supervised) | 0 | denied |
| Active enrollment roster | 4 | 2 | scoped | 0 | denied |
| Assessment submissions | 27 | 5 | scoped | 0 | denied |
| Partner directory / capabilities | yes | yes | yes | yes | denied |
| Competency rollup | yes | yes | yes (1) | — | denied |
| Public Z-code reference (`z_codes`) | yes | yes | yes | yes | **yes** |
| Data-warehouse views / watermarks | **denied** | **denied** | **denied** | **denied** | **denied** |

---

## 3. The role model (read this first)

- Sign in, then use the **role switcher** in the top navigation to shape the UI
  as administrator / supervisor / partner / navigator. The switcher changes only
  the menus and layout — it does **not** grant data access.
- **Data scope is bound to the signed-in identity.** A partner login toggled to
  the "navigator" UI still sees zero enrollee PHI, because RLS scopes every read
  to that identity.
- For a faithful pilot of each role, sign in with the matching login **and** set
  the role switcher to the same role.

Top-level menus per role (from `atlas.app_role_navigation`):

| Role | Top menus |
|------|-----------|
| Administrator | assigned enrollees, system operations, route planning, governance, county commons |
| Navigator | requests to enroll, referral portal, route planning, my station, county commons |
| Supervisor | assigned navigators, navigator assessments, route planning, team burden, county commons |
| Partner | referral portal, my station, service capacity, county commons |

---

## 4. Procedures by capability

Each step lists the screen/menu, the action, the command RPC invoked, and the
expected result. Writes always flow through validated `SECURITY DEFINER` RPCs.

### 4.1 Administrator — `pilot.admin@atlas.test`

1. **Full enrollee visibility**
   - Set role switcher to *administrator* → open **assigned enrollees**.
   - Expect: all 4 enrollees listed (Sandra Morrison, Marcus Thompson, Elena Rodriguez, test-reference1).
2. **Access matrix — set a person's roles**
   - **governance / system operations** → Access Matrix → pick a person → change roles → Save.
   - RPC: `fn_access_matrix_save_person_roles(target_person_id, target_role_keys[])`.
   - Expect: roles persist; row reflects new role chips on reload.
3. **Access matrix — assign navigator to an enrollment**
   - Access Matrix → enrollment navigators → choose navigator → Save.
   - RPC: `fn_access_matrix_save_enrollment_navigators`.
4. **Access matrix — assign supervisor → navigators**
   - Access Matrix → supervisors → Save. RPC: `fn_access_matrix_save_navigator_supervisors`.
5. **Access matrix — set partner primary contacts**
   - Access Matrix → partner contacts → Save. RPC: `fn_access_matrix_save_partner_contacts`.
6. **Z-code domain survey history (admin-only)**
   - **system operations** → survey history loads.
7. **Warehouse is hidden**
   - Confirm no data-warehouse export views are reachable in the UI (service-role only).

### 4.2 Navigator — `pilot.navigator@atlas.test`

1. **See only assigned enrollees**
   - Role switcher *navigator* → enrollee dropdown lists **only** Sandra Morrison and Marcus Thompson.
2. **Claim / self-assign an enrollment**
   - **requests to enroll** → pick a queued enrollment → claim.
   - RPC: `fn_navigator_assign_enrollment_to_self(target_enrollment_id)`.
   - Expect: enrollment moves into your assigned list.
3. **Enrollee burden survey**
   - Open an assigned enrollee → burden survey → complete → Submit.
   - RPC: `fn_save_enrollee_burden_submission(payload)`. Expect: submission saved, history updated.
4. **Regulation / renewal test**
   - **Regulation Tests** panel → take test → Submit. RPC: `fn_save_regulation_test_submission(payload)`.
5. **Competency self-assessment**
   - Navigator assessments → record. RPC: `fn_save_navigator_competency_assessment(payload)`.
6. **Z-code intake for an enrollment**
   - Enrollee intake → infer Z-codes → save.
   - RPC: `fn_intake_enrollment_inferred_z_codes(p_enrollment_id, p_z_codes[], p_source)`.
7. **Resolve a Z-code (attribute to a partner)**
   - Enrollee Z-code strip → resolve → choose partner.
   - RPC: `fn_set_enrollee_z_code_resolution(p_enrollee_z_code_id, p_is_resolved, p_partner_id, p_partner_name, p_resolution_note)`.

### 4.3 Supervisor — `pilot.supervisor@atlas.test`

1. **See supervised navigators**
   - Role switcher *supervisor* → **assigned navigators** lists the navigators you supervise.
2. **Navigator competency rollup**
   - **navigator assessments** / **team burden** → competency rollup populated.
3. **Record a supervision/competency assessment**
   - Navigator assessments → record session.
   - RPC: `fn_save_navigator_competency_assessment(payload)`.
4. **Scoped enrollee visibility**
   - Because you supervise navigators who cover enrollments, you can open those
     enrollees; you cannot see enrollees outside your supervised navigators.

### 4.4 Partner — `pilot.partner@atlas.test`

1. **No enrollee PHI**
   - Role switcher *partner* → confirm there is no enrollee roster/PHI for this login.
2. **Service capacity (Z-code) survey**
   - **service capacity** → complete the Z-code capacity survey → Submit.
   - RPC: `fn_save_partner_service_capacity(payload)`. Expect: submission saved for "Atlas Pilot Partner Org".
3. **Ensure a partner identifier record**
   - Triggered during capacity flow. RPC: `fn_ensure_partner_identifier(first, last, org, email)`.
4. **Nullify a survey answer**
   - Capacity history → nullify an answer with a reason.
   - RPC: `fn_set_partner_survey_answer_nullification(p_answer_id, p_is_nullified, p_nullified_by_email, p_nullified_reason)`.

### 4.5 Public / anonymous (no login)

1. **Submit a public referral**
   - Visit `http://localhost:5173/` → **Referral Portal** → fill and submit.
   - Writes to `public_referral_intake_events` via anon `INSERT`.
   - Expect: success message; the referral persists to the database (and a staff
     login can later claim it via `fn_claim_referral_queue_to_enrollment`).
2. **Public reference data renders**
   - Z-code reference content loads (anon may read `z_codes` / `z_code_headers`).
3. **Everything else is locked**
   - No PHI, partner, config, or warehouse data is reachable while logged out;
     attempts return permission denied.

---

## 5. Verify alignment without clicking

Run `verification/pilot_verify.sql` (one transaction block per identity). It
replays each screen's underlying read under that identity's RLS context and
prints an `ok / row-count / error` table. Use it to confirm scoping after any
data change. Blocks roll back (read-only).

How to run:
- **Supabase MCP:** paste one block at a time into `execute_sql`.
- **psql:** `psql "<connection string>" -f verification/pilot_verify.sql`.

Expected highlights: admin reads all (warehouse denied); navigator = 2 enrollees;
partner enrollee PHI = 0; anon only `z_codes` / `z_code_headers`.

---

## 6. Reset / teardown

- **Reset pilot data (idempotent):** re-run `verification/pilot_setup.sql`. It
  deletes and recreates the four logins, role assignments, navigator/supervisor
  assignments, and the pilot partner org.
- **Remove the pilot entirely:** delete the four `pilot.*@atlas.test` users in the
  Supabase dashboard (Authentication → Users) — this cascades their identities —
  then delete the "Atlas Pilot Partner Org" partner row and any `pilot.*` rows in
  `atlas.people`.

---

## 7. Troubleshooting

- **Red error banner on the workspace** — a real RLS/permission failure. This is
  intentional "fail-loud" behavior; the workspace will not render stale/empty data
  while masking a denial. Check the signed-in identity's role and assignments.
- **Sign-in works but no enrollees show (navigator)** — confirm
  `navigator_assignments` rows exist for that person (re-run `pilot_setup.sql`).
- **Partner cannot submit capacity** — confirm `partners.primary_contact_email`
  matches the partner login email (the pilot org is seeded this way).
- **Workspace asks to sign in repeatedly** — ensure
  `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true` and the dev server restarted
  after `.env` changes.

---

## 8. Known limitations

- These `@atlas.test` logins are pilot-only (email pre-confirmed, non-deliverable
  domain) and must not exist in production.
- A few reporting/aggregate `SECURITY DEFINER` views (county heatmap, data
  quality, route candidates) and three command RPCs remain executable beyond the
  strictly necessary role. They expose no direct enrollee PHI and self-deny
  anonymous callers; they are tracked for tightening in `docs/security-model.md`
  ("Known remaining hardening").
- Live browser automation is not wired up in this environment; the SQL replay
  harness (`verification/pilot_verify.sql`) is the authoritative per-credential
  alignment check.

---

## 9. Related files

- `verification/pilot_setup.sql` — provisions/reset the pilot logins and seed.
- `verification/pilot_verify.sql` — per-identity RLS read-scope verification.
- `docs/PILOT_RUNBOOK.md` — condensed runbook version of this guide.
- `docs/security-model.md` — the full database-first security model.
