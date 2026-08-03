# Partner My Station Debut (MVP)

## Purpose

Partners must finish service-capacity commissioning before **My Station** appears in the partner top menu. This keeps first-launch sites on referral intake and capacity survey work until the station return signal is real.

## Debut requirements

My Station debuts only when all of the following are met:

1. **Station profile initiated** — organization identity is present on the partner station profile.
2. **Service-capacity entries complete** — at least one completed burden/service-capacity survey includes scored Z-code answers (not only “not encountered”).
3. **Specialization clarity** — the latest completed burden survey yields at least one parent-code specialty group (child Z-code burden score above 6).

Domain-spectrum surveys can still be completed, but they do not unlock My Station specialty coins. Debut commissioning is driven by the burden/service-capacity form (`2026-z-burden-v2`).

## Operator flow (first partner go-live)

1. Provision org + station + contact login.
2. Partner opens **service capacity** and completes the burden survey with real capacity entries.
3. Confirm specialty coins would render (at least one score above 6).
4. Return to the partner workspace — **My Station** appears in the top menu.
5. Claim/process first referrals from the referral portal / station surfaces.

For the full first-partner production checklist, see also `docs/partner-go-live-checklist.md` when present.

## CardHolders / Alum subheader — skipped for MVP

The client notes mention a CardHolders / Alum subheader. There is no existing CardHolders or Alum model, menu entry, or Application Programming Interface (API) surface in this repository, so wiring it for first launch is not easy.

**Decision for MVP:** skip CardHolders / Alum. Revisit after first-partner go-live if the client still wants a subheader and can supply the membership source of truth.

## Phase 3 checked-off items (verify only)

Do not rebuild these; smoke-check that they remain intact:

| Guard | Expected state |
|---|---|
| County Commons hidden | `SHOW_COUNTY_COMMONS = false` in `singlepaneRepository.ts` |
| Role roaming locked | Non-admin accounts cannot switch active experience |
| Role-view menu contrast | Partner role pill / menu treatment unchanged |
| Refer button placement | Profile → My Station picture icon path unchanged |
| My Station gated on clean/initiated profile | Covered by debut requirement #1 above |
| Heat map admin-only / County Commons absent | County Commons menu filtered for all roles |
| Domain spectrum ↔ radial alignment | Existing domain-spectrum mapping unchanged |

Focused verification script:

```bash
node scripts/test-partner-my-station-debut.mjs
```
