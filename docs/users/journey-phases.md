# Journey Phases (Users)

Atlas enrollee journeys move through **Regulation → Readiness → Renewal**. The strip map is the visible memory of that journey: history is kept even when progress regresses.

## Regulation (gate)

Regulation must be cleared before readiness work counts as active.

### Instruments

- Mental Health Self-Care Agency (MH-SCA)
- Stress Vulnerability Scale (SVS)

### Rules

- Both assessments can be administered many times; attempts are stored as history (never overwritten).
- Both instruments remain available through readiness and renewal.
- A failed result on either assessment resets the enrollee to the start of the journey flow; prior readiness progress is treated as inactive until regulation is re-cleared.
- Navigators cannot skip the weekly SVS / MH-SCA review cycle. A cycle is satisfied only when **both** instruments have a completed submission in the active cadence window (default: weekly).
- Completing one instrument alone never clears the due item.
- Administrators can edit cadence or disable review per enrollee; new enrollees inherit review as active by default.
- Open due items surface on navigator My Profile and block route planning until both instruments are current.

### Transition

Move from `regulation` to `readiness` only when the latest MH-SCA and latest SVS are both currently passing.

### Z75 / local regulation milestone

When both latest results are passing, clearance can also be logged as a verified route-log stop under parent Z75 (local regulation provider attribution — Lucid / `Z75.4` in Tacoma installs).

## Readiness (remediation loop)

Once in readiness, the persistent quick action is **route planning**.

- Route planning opens a ranked partner list (partner Z-burden vs enrollee Z-code profile).
- Completing routed partner steps uses a simple completion checkbox.
- Each successful remediation adds a circular Z-code token on the readiness strip (permanent journey log).
- MH-SCA and SVS remain active checks. If either fails after readiness began:
  - regulation clearance disappears
  - readiness visuals hide (history is **not** deleted)
  - route planning is unavailable until both tests pass again

### Exit

Readiness completes when all active Z-codes are remediated **or** an administrator grants “OK to proceed,” then transitions to renewal.

## Strip map behavior

| State | What you see |
|-------|----------------|
| Assessment attempt | Labeled circle on regulation segment (`MH-SCA` / `SVS`) |
| Pass | Green circle |
| Fail | Red circle |
| Regulation cleared | White checkmark treatment; readiness unlocked |
| Regression | Clearance removed; readiness hidden until re-cleared |

Design intent: make regression legible without erasing what happened.

## Renewal

Renewal User Interface (UI) renders as the onward phase after readiness completes. Treat detailed renewal instruments as evolving product surface — follow in-app prompts and administrator guidance.
