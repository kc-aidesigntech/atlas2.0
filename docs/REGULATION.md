# Regulation Phase Logic

## Purpose
Regulation is the readiness gate. An enrollee must satisfy two assessments before progressing:

- Mental Health Self-Care Agency (MH-SCA)
- Stress Vulnerability Scale (SVS)

## Core Rules
- Both assessments can be administered an unlimited number of times during regulation.
- Both assessments remain available throughout the full journey, including readiness and renewal.
- A failed result on either assessment immediately resets the enrollee to the start of the journey flow.
- After a reset event, previously completed readiness progress is treated as inactive until regulation is re-cleared.

## Forced Weekly Cadence
- Navigators cannot skip the weekly SVS / MH-SCA review cycle.
- A cycle is satisfied only when **both** instruments have a completed submission inside the active cadence window (default: weekly).
- Completing one instrument alone never clears the due item.
- Admin can edit cadence frequency and disable the review per enrollee; new enrollees inherit the review as active by default.
- Open due items surface as required action items on the navigator My Profile surface and block route planning for the selected enrollee until both instruments are current.

## Z75 / Lucid Regulation Milestones (Tacoma)
- When both latest MH-SCA and SVS results are currently passing (stable), the clearance is also logged as a verified route-log stop under parent Z75.
- In Tacoma, the regulation provider attributed on that stop is Lucid (`Z75.4` — unavailability/inaccessibility of other helping agencies).
- If Atlas is installed in another area, the local provider that supported regulation is logged under Z75 in place of Lucid.
- The Z75 Lucid stop also appears on the participant strip with other resolved Z-code markers while regulation remains cleared.

## System Behavior Requirements
- Store each assessment attempt as a historical record (do not overwrite prior attempts).
- Track pass/fail status independently for MH-SCA and SVS.
- Compute the enrollee regulation state from latest valid test outcomes.
- Emit a `journey_reset` event whenever either assessment fails after progression has already started.
- Surface reset state to timeline rendering so downstream readiness progress can be greyed pending re-regulation.

## Transition Rule
- Transition from `regulation` to `readiness` only when both MH-SCA and SVS are currently passing.

## Renewal UI (verified, already shipped)
- Renewal renders as green lettering by default.
- When readiness is complete, the parent supplies `onRenewalTestsClick` and the renewal slot transitions to the actionable button state.
