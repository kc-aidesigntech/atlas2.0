# Partner Go-Live Checklist

Per-site commissioning checklist for the first live Atlas partner station (MVP definition: first partner site + navigator cohort). Use one copy of this checklist per organization/station.

**Parent hard gates:** [production-go-live-hard-gates.md](./production-go-live-hard-gates.md)  
**System commissioning:** [HOW_TO_COMMISSION_SYSTEM.md](./HOW_TO_COMMISSION_SYSTEM.md)  
**Harborview demo pattern (template only, not production logins):** [../demo.md](../demo.md)

---

## Hard rule before anything else

**Pilot and demo `@atlas.test` accounts must not exist in the production project.**

- Source of pilot identities: [../PILOT.md](../PILOT.md), [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md)
- Provisioning scripts (dev/staging only): `verification/pilot_setup.sql`, `verification/demo_partner_setup.sql`
- Pre-flight fail if any pilot/demo auth users remain: `verification/prod_commission_verify.sql` (section A)

Do not reuse `AtlasPilot2026!` or any shared pilot password in production. Provision real org users via the identity bridge (`auth.users` → `atlas.people.external_ref`). See [AUTH_SETUP.md](./AUTH_SETUP.md).

---

## Site identity

| Field | Value | Sign-off |
|-------|-------|----------|
| Organization legal / display name | | |
| Partner station name | | |
| County | | |
| Primary contact full name | | |
| Primary contact email (login) | | |
| Backup / secondary contact (optional) | | |
| Target go-live date | | |
| Commissioning owner (Atlas ops) | | |
| Partner site owner | | |

---

## 1. Org + station + contact login

Complete in order. Each row is a hard gate for the next step.

- [ ] Partner organization row exists in `atlas.partners` with correct display name
- [ ] Partner station row exists and links to that organization (`atlas.partner_stations` / station directory)
- [ ] Primary contact person exists in `atlas.people` with a real work email
- [ ] Auth user exists for that email (Supabase Auth); email confirmed per org policy
- [ ] Identity bridge OK: `people.external_ref = auth.uid()::text` (and/or `people.id = auth.users.id` per current bridge migration)
- [ ] Active `partner` role assignment on that person (`atlas.people_role_assignments`)
- [ ] Partner primary-contact edge set (Access Matrix → partner contacts, or equivalent RPC)
- [ ] Contact can sign in on the production app origin and reaches the partner shell (no loud RLS banner)
- [ ] Contact **cannot** see enrollee Protected Health Information (PHI)

**Verify (optional SQL):** identity and contact edges in `docs/launch-db-integrity-verification.sql` and section B of `verification/prod_commission_verify.sql`.

---

## 2. Service capacity complete

My Station must not be treated as production-ready until capacity commissioning is done.

- [ ] Partner opens **service capacity** (standalone `/service-capacity-survey` or in-shell menu)
- [ ] Header fields match org + contact (name, organization, email)
- [ ] Survey completed end-to-end (status `completed`, not left as draft)
- [ ] Completed record is read-only on reopen
- [ ] At least one completed submission appears in partner survey history for this org
- [ ] Ops confirms answers look plausible for the station’s real service lines (spot-check, not a full audit)

**Failure modes:** missing migrations / Row-Level Security (RLS) mismatch / contact email not linked to partner — see troubleshooting in [HOW_TO_COMMISSION_SYSTEM.md](./HOW_TO_COMMISSION_SYSTEM.md).

---

## 3. Specializations confirmed

Capacity answers must be clear enough that navigators can route safely.

- [ ] Z-code / domain specialties the station actually offers are marked with non-null capacity (not all “not encountered” unless intentional)
- [ ] Partner confirms specialization narrative with Ops (what they do / do not take)
- [ ] Station return signal / partner chart inputs look populated after the completed survey (Harborview demo pattern is the visual template only)
- [ ] Any known gaps documented for navigators (temporary constraints)

---

## 4. My Station enabled

Product rule (client-accepted): do not debut My Station until the station profile is clean/initiated and capacity commissioning above is done. The shell enforces this automatically — see [PARTNER_MY_STATION_DEBUT.md](./PARTNER_MY_STATION_DEBUT.md) (scored capacity entries + specialty clarity before the **my station** menu appears).

- [ ] Organization name on account settings matches the partner org used for station lookup
- [ ] Partner station profile loads (org, county, primary contact email)
- [ ] Service-capacity history shows My Station debut checklist as **ready**
- [ ] **my station** menu is available to the partner role and opens without error
- [ ] Station surface shows real station context (not only `[My Station]` placeholder with empty org)
- [ ] County Commons remains hidden (`SHOW_COUNTY_COMMONS = false` — smoke only)
- [ ] Role switcher cannot be used to dodge required surveys for non-admin users (smoke)
- [ ] Focused smoke: `node scripts/test-partner-my-station-debut.mjs`

---

## 5. First referrals claimed

- [ ] Public referral form reachable on production origin; brand treatment accepted for MVP
- [ ] Test referral submitted for this station (or first real referral with partner consent)
- [ ] Referral appears in navigator **requests to enroll** / intake queue as expected
- [ ] Assigned navigator can claim / assign-to-me successfully
- [ ] Partner can see referral workflow surfaces appropriate to partner scope (no PHI leakage)
- [ ] Ops records first successful claim timestamp and enrolment identifier

---

## Role smoke (production-like data)

Run once for the site’s real users (not pilot logins). Harborview demo seed is the **data shape** template only.

| Role | Smoke | Pass |
|------|-------|------|
| Administrator | Access matrix + roster visibility; warehouse still unreachable from app | [ ] |
| Navigator | Assigned enrollees only; regulation → readiness path; claim referral | [ ] |
| Supervisor | Competency / supervised navigators load | [ ] |
| Partner | Capacity + My Station; zero enrollee PHI | [ ] |
| Public / anon | Referral submit; Z-code reference only | [ ] |

Database-side RLS replay for pilot identities is **not** a production sign-off. For staging with pilots, use `verification/pilot_verify.sql`. For production, use `verification/prod_commission_verify.sql` plus this checklist’s real-user smoke.

---

## Sign-off

| Gate | Owner | Date | Signature / initials |
|------|-------|------|----------------------|
| Pilot/demo accounts absent from production | Engineering | | |
| Migrations + RLS verify green | Engineering | | |
| Security residuals reviewed ([security-model.md](./security-model.md)) | Engineering + Security | | |
| Regulation instrument sign-off or placeholder waiver ([production-go-live-hard-gates.md](./production-go-live-hard-gates.md#4-regulation-instruments)) | Product / Client | | |
| Capacity → My Station debut complete | Ops + Partner | | |
| First referral claimed | Ops + Navigator | | |
| **Site cleared for live traffic** | Ops lead | | |

---

## Related files

- `verification/prod_commission_verify.sql` — non-destructive production pre-flight
- `docs/launch-db-integrity-verification.sql` — identity / RPC integrity
- `docs/security-model.md` — remaining SECURITY DEFINER / storage hardening
- `src/features/atlas2026/singlepane/data/assessmentCatalog.ts` — MH-SCA / SVS instrument definitions (placeholder until waived or replaced)
