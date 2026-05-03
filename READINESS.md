# Readiness Phase Logic

## Purpose
Readiness executes the route-remediation loop against active enrollee Z-codes.

## Primary User Experience (UX) Rule
- Once an enrollee is in readiness, the only persistent quick action is `route planning`.
- This button stays overlaid in the timeline area so route planning is always one click away.

## Route Planning Requirements
- Route planning opens a ranked list of partners.
- Ranking factors partner `z burden` against the enrollee's Z-code survey profile.
- The route planning screen controls completion of routed partner steps using a simple completion checkbox.

## Z-code Remediation Timeline Behavior
- Each successful remediation adds the remediated Z-code as a circular token on the readiness strip map.
- Tokens represent historical successes and remain visible as a permanent journey log.
- Token layout starts at center and remains center-justified as additional remediations are added.

## Regression Rule (Assessment Failure)
- `MH-SCA` and `SVS` remain active checks during readiness.
- If either assessment fails at any point:
  - readiness progress is greyed out as pending regulation,
  - enrollee re-enters the regulation loop,
  - readiness resumes only after regulation gates are passed again.

## Exit Conditions from Readiness
Readiness completes when either:
- all active Z-codes are remediated, or
- an administrator manually grants `OK to proceed`.

Successful completion transitions to `renewal`.
