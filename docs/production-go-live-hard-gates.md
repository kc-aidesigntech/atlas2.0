# Production Go-Live Hard Gates

Engineering and ops gates required to put a real partner site live. These are non-negotiable even when not listed in client review notes.

**Partner site checklist (per org):** [partner-go-live-checklist.md](./partner-go-live-checklist.md)  
**Commissioning runbook:** [it/commissioning.md](./it/commissioning.md) ([deep appendix](./HOW_TO_COMMISSION_SYSTEM.md))  
**Security model + residuals:** [it/security-model.md](./it/security-model.md)

---

## Gate summary

| # | Gate | Pass criteria |
|---|------|---------------|
| 1 | No pilot passwords / pilot users in production | Zero `@atlas.test` pilot/demo auth users; no shared pilot password |
| 2 | Migration + Row-Level Security (RLS) commissioning | Migrations applied; verify scripts green |
| 3 | Security residuals reviewed | Known items in `docs/it/security-model.md` acknowledged; no open high-severity PHI exposure |
| 4 | Regulation instruments | Approved instruments **or** explicit placeholder waiver |
| 5 | Role end-to-end (E2E) smoke | Admin / navigator / supervisor / partner / public on production-like data |
| 6 | Partner go-live checklist signed | [partner-go-live-checklist.md](./partner-go-live-checklist.md) complete for first site |

---

## 1. No pilot accounts in production

Pilot identities are for local/staging walkthroughs only.

| Source | What it creates | Production rule |
|--------|-----------------|-----------------|
| [../PILOT.md](../PILOT.md) | `pilot.admin@atlas.test`, `pilot.navigator@atlas.test`, `pilot.supervisor@atlas.test`, `pilot.partner@atlas.test` + password `AtlasPilot2026!` | **Must not exist** in production Auth |
| `verification/pilot_setup.sql` | Same four users + seed scope | Run only on non-production projects |
| `verification/demo_partner_setup.sql` | `demo.partner@atlas.test` (Harborview demo login) | **Must not exist** in production Auth |
| [users/pilot-guide.md](./users/pilot-guide.md) | Condensed pilot procedures | Staging/demo only |

**Pre-flight:** run section A of `verification/prod_commission_verify.sql`. Any matching row fails the gate.

**Provision real users instead:** follow [it/auth-and-identity.md](./it/auth-and-identity.md) and the identity bridge (`supabase/migrations/20260504010000_launch_identity_bridge_baseline.sql`). Every production login needs `atlas.people` + active role assignment + partner/navigator edges as applicable.

**Do not** run `pilot_setup.sql` teardown against production without an explicit ops change window and backup. Prefer Auth dashboard deletion of known pilot emails after verifying no production data depends on those person ids.

---

## 2. Migrations and RLS verify path

### Apply

1. Apply the full `supabase/migrations/` chain for the target environment (Supabase Command-Line Interface (CLI) `db push`, migration runner, or Studio — team standard).
2. Apply required seeds (Z-code taxonomy, partner capabilities as needed for the site). See [it/commissioning.md](./it/commissioning.md) and [HOW_TO_COMMISSION_SYSTEM.md](./HOW_TO_COMMISSION_SYSTEM.md).
3. Confirm `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true` only after runtime cutover objects exist and identity is commissioned. See [it/commissioning.md](./it/commissioning.md).

### Verify (non-destructive)

Run in this order against the **target** project (read-only probes; no auth user deletes):

1. `docs/launch-db-integrity-verification.sql` — identity bridge coverage, role assignment integrity, required Remote Procedure Call (RPC) signatures
2. `verification/continuity_phase1_verify.sql` — config write policies, referral update policy, regulation RPC presence
3. `verification/prod_commission_verify.sql` — pilot absence, RLS enabled on core tables, legacy public capacity toggles, security residual inventory
4. Staging-only (optional): `verification/pilot_verify.sql` under each pilot JWT — **not** for production Auth

### Production authorization toggles

After real partner users can complete capacity surveys, disable legacy public partner-capacity flags in `atlas.authorization_settings` (one at a time):

- `allow_legacy_public_partner_capacity_read`
- `allow_legacy_public_partner_capacity_write`
- `allow_legacy_public_partner_capacity_delete`

`verification/prod_commission_verify.sql` section C expects these disabled for a production pass. See also [compliance-deep-research-roadmap.md](./compliance-deep-research-roadmap.md).

---

## 3. Security residuals

Authoritative list: [it/security-model.md](./it/security-model.md) → **Known remaining hardening (follow-up)**.

Before go-live, Engineering + Security must:

- [ ] Confirm high-severity enrollee PHI exposures called out historically are closed (Phases 1–8 in `docs/it/security-model.md`)
- [ ] Acknowledge remaining `SECURITY DEFINER` reporting/ranking views (defense-in-depth follow-up; not automatic launch blockers if scoped and PHI-safe as documented)
- [ ] Acknowledge `EXECUTE` still grantable via Postgres `PUBLIC` default on some definer functions (functions self-deny `anon`; revoke is follow-up)
- [ ] Confirm Supabase Auth leaked-password protection plan and `profile-images` bucket listing tightening (ties to navigator photo upload)
- [ ] Confirm warehouse / `v_dw_*` remain `service_role` only

`verification/prod_commission_verify.sql` section D prints an inventory of definer views for the sign-off packet; it does not auto-fail on residual count.

---

## 4. Regulation instruments

Regulation gates use Mental Health – Symptom and Coping Assessment (MH-SCA) and Stress Vulnerability Scale (SVS) definitions in:

`src/features/atlas2026/singlepane/data/assessmentCatalog.ts`

Those regulation-stage entries are **placeholder instruments** until the client supplies approved content (see file comments and [users/journey-phases.md](./users/journey-phases.md)).

### Option A — Replace (preferred when content is ready)

1. Replace MH-SCA / SVS prompt sets, scales, and thresholds with approved instruments.
2. Re-verify regulation → readiness progression and weekly cadence behavior.
3. Record instrument version / approval date in the sign-off table below.

### Option B — Explicit placeholder waiver (acceptable for first launch if signed)

Client / Product must sign that first-site launch may use the current placeholder MH-SCA and SVS content for internal ATLAS regulation gates, knowing:

- Item wording and official scoring are not the final clinical instruments
- Pass thresholds are internal ATLAS gate thresholds only
- Replacement is scheduled post-MVP without blocking first-partner traffic

| Field | Value |
|-------|-------|
| Decision (A replace / B waive) | |
| Approver name / role | |
| Date | |
| Instrument version or waiver id | |
| Follow-up ticket / date for full instruments (if B) | |

Until Option A ships or Option B is signed, this hard gate is **open**.

---

## 5. Role E2E smoke

Use production-like seeded or first-site data. Do **not** use pilot passwords on the production project.

Minimum pass:

- Administrator — roster + access matrix; no warehouse UI
- Navigator — assigned scope; claim referral; regulation test submit path
- Supervisor — competency / supervision surfaces
- Partner — capacity complete; My Station; zero enrollee PHI
- Public — referral insert; reference Z-codes only

Detail checklist: [partner-go-live-checklist.md](./partner-go-live-checklist.md) → Role smoke.

---

## 6. Partner go-live checklist

Complete [partner-go-live-checklist.md](./partner-go-live-checklist.md) for the first live org:

1. Org + station + contact login  
2. Service capacity complete  
3. Specializations confirmed  
4. My Station enabled  
5. First referrals claimed  

---

## Definition of done (live)

- Production env commissioned; verify scripts green; pilot/demo Auth users absent
- Security residuals reviewed against `docs/it/security-model.md`
- Regulation instruments replaced **or** placeholder waiver signed
- First partner checklist signed through first referral claim
- County Commons absent; role roaming cannot dodge surveys (non-admin)

---

## Related verification artifacts

| Artifact | Use |
|----------|-----|
| `verification/prod_commission_verify.sql` | Production pre-flight (this gate set) |
| `docs/launch-db-integrity-verification.sql` | Identity + RPC integrity |
| `verification/continuity_phase1_verify.sql` | Continuity / write-policy probes |
| `verification/pilot_verify.sql` | Staging pilot RLS replay only |
| `verification/pilot_setup.sql` | **Never** on production |
