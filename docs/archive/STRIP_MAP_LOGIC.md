# Strip Map Logic

## Purpose

The strip map is the visible memory of the enrollee journey. It must preserve both progression and regression without deleting history.

## Regulation Loop

- `MH-SCA` and `SVS` are always available regulation assessments.
- Every completed assessment attempt appears on the regulation segment as a labeled circle:
  - `MH-SCA`
  - `SVS`
- Circle color rules:
  - green = passed
  - red = failed
- The latest completed attempt for each test type is the active gate input.

## Regulation Clearance

- Regulation is cleared only when the latest completed `MH-SCA` passes and the latest completed `SVS` passes.
- When regulation is cleared, show a white checkmark inside a white circle below the regulation control.
- Clearing regulation unlocks readiness visuals and route-planning access.

## Regression / Relapse

- If either latest completed regulation assessment fails after readiness has already begun:
  - the regulation clearance checkmark disappears
  - readiness visuals are hidden
  - readiness history remains persisted
  - the enrollee is treated as back in the regulation loop until both tests pass again

## Readiness Visibility Rule

- Readiness progress is hidden, not deleted, while regulation is not currently cleared.
- Route-planning quick actions remain unavailable while regulation is uncleared.
- Once both latest tests pass again, the hidden readiness history becomes visible again.

## Design Intent

- The strip map should make regression legible without erasing what actually happened.
- Regulation tests are first-class journey events, not hidden side records.
- The strip map logic is gate-driven and must remain aligned with `REGULATION.md` and `READINESS.md`.
