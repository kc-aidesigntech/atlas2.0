# Regulation Phase Logic

## Purpose
Regulation is the readiness gate. An enrollee must satisfy two assessments before progressing:

- `MH-SCA`
- `SVS`

## Core Rules
- Both assessments can be administered an unlimited number of times during regulation.
- Both assessments remain available throughout the full journey, including readiness and renewal.
- A failed result on either assessment immediately resets the enrollee to the start of the journey flow.
- After a reset event, previously completed readiness progress is treated as inactive until regulation is re-cleared.

## System Behavior Requirements
- Store each assessment attempt as a historical record (do not overwrite prior attempts).
- Track pass/fail status independently for `MH-SCA` and `SVS`.
- Compute the enrollee regulation state from latest valid test outcomes.
- Emit a `journey_reset` event whenever either assessment fails after progression has already started.
- Surface reset state to timeline rendering so downstream readiness progress can be greyed pending re-regulation.

## Transition Rule
- Transition from `regulation` to `readiness` only when both `MH-SCA` and `SVS` are currently passing.
