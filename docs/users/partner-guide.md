# Partner Guide (Users)

How partner organizations use service-capacity commissioning and **My Station**.

## Access reminder

Partner identities do **not** receive enrollee Protected Health Information (PHI) through the app. Row-Level Security (RLS) enforces that even if someone toggles the on-screen role switcher.

## First-time debut (My Station unlock)

My Station appears in the partner top menu only when **all** of the following are true:

1. **Station profile initiated** — organization identity exists on the partner station profile.
2. **Service-capacity entries complete** — at least one completed burden/service-capacity survey includes scored Z-code answers (not only “not encountered”).
3. **Specialization clarity** — the latest completed burden survey yields at least one parent-code specialty group (child Z-code burden score above 6).

Debut is driven by the burden/service-capacity form (`2026-z-burden-v2`). Domain-spectrum surveys can still be completed but do not unlock My Station specialty coins.

### Operator flow (first partner go-live)

1. Information Technology (IT) provisions org + station + contact login.
2. Partner opens **service capacity** and completes the burden survey with real capacity entries.
3. Confirm specialty coins would render (at least one score above 6).
4. Return to the partner workspace — **My Station** appears in the top menu.
5. Claim/process referrals from the referral portal / station surfaces.

Full production checklist for IT/ops: [partner-go-live-checklist.md](../partner-go-live-checklist.md).

## My Station timeline markers

- **Z-code stage marker** — aggregate per scoped enrollee and active Z-code for the enrollee’s current phase.
- Marker id format: `<source>-<enrollee-id>-<z-code>`.
- Date precedence: referral queue timestamp, then route assignment timestamp, then inferred phase-entry timestamp.
- Every marker must open a record inspector (enrollee name + drill-in). Uninspectable markers are bugs.

### Rendering rules

- Same visual grammar as enrollee timeline markers (full-size on-track circles, Z-code center text, definition callout, coin color by parent Z-code).
- Synthetic placeholders (`Z0.0`, `Z1.0`, `Z2.0`) are never allowed.
- Source lineage (`referred` / `active`) remains inside inspector details.
- Horizontal collisions stack into lanes grouped by phase + parent + child Z-code.
- Aggregate mode includes an in-context **(i)** policy badge explaining marker semantics.

## MVP exclusions

CardHolders / Alum subheader is **skipped for MVP** (no membership source of truth in-repo). Revisit after first-partner go-live if required.

## Verification (engineering)

```bash
node scripts/test-partner-my-station-debut.mjs
```

## Pilot practice

Use the partner login and checklist in [pilot-guide.md](./pilot-guide.md). Demo fixture plan: [demo.md](../demo.md).
