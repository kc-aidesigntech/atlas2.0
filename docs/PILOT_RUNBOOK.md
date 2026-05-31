# Atlas Pilot Runbook

This runbook sets you up to run a complete pilot of the Atlas single-pane
application with one login per role and a checklist of the transactions each
role can exercise. It reflects the database-first access model: the User
Interface (UI) role is a presentation toggle, while the data each login can see
or change is enforced by Row-Level Security (RLS) on the signed-in identity.

## 1. Pilot logins

All four accounts share one password and have confirmed email. They were created
by `verification/pilot_setup.sql` (re-run that script to recreate or reset them).

| Role | Email | Password | Seeded scope |
|------|-------|----------|--------------|
| Administrator | `pilot.admin@atlas.test` | `AtlasPilot2026!` | Full access (app_metadata `atlas_role=administrator`) |
| Navigator | `pilot.navigator@atlas.test` | `AtlasPilot2026!` | Assigned to 2 enrollees (Sandra Morrison ATLAS-EX-001, Marcus Thompson ATLAS-EX-002) |
| Supervisor | `pilot.supervisor@atlas.test` | `AtlasPilot2026!` | Supervises all navigators; sees competency rollups |
| Partner | `pilot.partner@atlas.test` | `AtlasPilot2026!` | Primary contact of "Atlas Pilot Partner Org" |

Local app URL: `http://localhost:5173/app` (the dev server runs via `npm run dev`).

## 2. How roles work in the app (important)

- After signing in, use the **role switcher** in the top navigation to shape the
  UI as administrator / supervisor / partner / navigator. The switcher only
  changes the layout and available menus — it does **not** grant data access.
- **Data scope is bound to the signed-in identity.** A partner login that toggles
  the UI to "navigator" still sees zero enrollee Protected Health Information
  (PHI), because RLS scopes every read to that identity. This is by design.
- For the truest pilot of each role, sign in with the matching login **and** set
  the role switcher to the same role.

## 3. Per-role transaction checklist

Each transaction below lists the UI action, the server command Remote Procedure
Call (RPC) it invokes, and the expected result. All writes go through validated
`SECURITY DEFINER` RPCs; direct table writes are revoked.

### Administrator (`pilot.admin@atlas.test`)
- [ ] **See all enrollees** — Enrollees screen shows the full roster (4 profiles).
- [ ] **Access matrix: set a person's roles** — Admin → Access Matrix → change roles → save. RPC `fn_access_matrix_save_person_roles(target_person_id, target_role_keys[])`.
- [ ] **Assign a navigator to an enrollment** — Access Matrix → enrollment navigators → save. RPC `fn_access_matrix_save_enrollment_navigators`.
- [ ] **Assign supervisor → navigators** — Access Matrix → supervisors → save. RPC `fn_access_matrix_save_navigator_supervisors`.
- [ ] **Set partner primary contacts** — Access Matrix → partner contacts → save. RPC `fn_access_matrix_save_partner_contacts`.
- [ ] **Review Z-code domain survey history** — Admin portal survey history loads (admin-only).
- [ ] **Confirm warehouse is hidden** — no data-warehouse export views are reachable (service-role only).

### Navigator (`pilot.navigator@atlas.test`)
- [ ] **See only assigned enrollees** — dropdown lists Sandra Morrison and Marcus Thompson only.
- [ ] **Claim an enrollment from the queue / self-assign** — RPC `fn_navigator_assign_enrollment_to_self(target_enrollment_id)`.
- [ ] **Save an enrollee burden survey** — open an enrollee → burden survey → submit. RPC `fn_save_enrollee_burden_submission(payload)`.
- [ ] **Take a regulation/renewal test** — Regulation Tests → submit. RPC `fn_save_regulation_test_submission(payload)`.
- [ ] **Record a competency self-assessment** — RPC `fn_save_navigator_competency_assessment(payload)`.
- [ ] **Intake inferred Z-codes for an enrollment** — RPC `fn_intake_enrollment_inferred_z_codes(p_enrollment_id, p_z_codes[], p_source)`.
- [ ] **Resolve a Z-code (attribute to a partner)** — RPC `fn_set_enrollee_z_code_resolution(...)`.

### Supervisor (`pilot.supervisor@atlas.test`)
- [ ] **See supervised navigators' competency rollup** — Supervision board populated.
- [ ] **Toggle a managed navigator** — supervision board → manage. RPC `fn_access_matrix_save_navigator_supervisors` (admin path) / supervision session save.
- [ ] **Record a supervision session / competency assessment** — RPC `fn_save_navigator_competency_assessment(payload)`.

### Partner (`pilot.partner@atlas.test`)
- [ ] **Confirm no enrollee PHI is visible** — enrollee data is empty for this login.
- [ ] **Submit the partner service capacity (Z-code) survey** — RPC `fn_save_partner_service_capacity(payload)`.
- [ ] **Ensure a partner identifier record** — RPC `fn_ensure_partner_identifier(first, last, org, email)`.
- [ ] **Nullify a partner survey answer** — RPC `fn_set_partner_survey_answer_nullification(...)`.

### Public / anonymous (no login)
- [ ] **Submit a public referral** — visit `/` (public landing) → Referral Portal → submit. Writes to `public_referral_intake_events` (anon `INSERT`).
- [ ] **Verify reference data renders** — public Z-code reference loads (anon may read `z_codes` / `z_code_headers`).
- [ ] **Confirm the rest is locked** — no PHI, partner, config, or warehouse data is reachable while logged out.

## 4. Verify alignment without clicking (optional)

Run `verification/pilot_verify.sql` (one block per identity) to replay each
screen's underlying read under each pilot identity's RLS context and print an
ok / row-count / error table. Use it to confirm scoping after any data change.

## 5. Reset / teardown

- **Reset pilot data:** re-run `verification/pilot_setup.sql` (idempotent — it
  deletes and recreates the four logins and their seeded scope).
- **Remove the pilot entirely:** run the cleanup (section 1) of
  `verification/pilot_setup.sql` without the inserts, or delete the four
  `pilot.*@atlas.test` users from the Supabase dashboard (Authentication → Users),
  which cascades their identities; then remove the "Atlas Pilot Partner Org"
  partner row.

## 6. Notes / known follow-ups

- These logins use the non-deliverable `@atlas.test` domain with email
  pre-confirmed; they are for piloting only and should not exist in production.
- A few reporting/aggregate `SECURITY DEFINER` views (county heatmap, data
  quality, route candidates) and three command RPCs remain executable beyond the
  strictly necessary role; see `docs/security-model.md` "Known remaining
  hardening". These do not expose direct enrollee PHI but are tracked for
  tightening.
