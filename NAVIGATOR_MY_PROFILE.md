# NAVIGATOR_MY_PROFILE

## Purpose

Defines the canonical semantics for the navigator **my profile** surface so supervision tracking, interpretation, and follow-up actions stay stable across updates.

## Supervision Tracking Model

- Navigator supervision tracking is a three-prong model:
  1. **Individual Placement and Support Core Competencies (IPSCC)** service-user surveys captured at point of care after each encounter.
  2. **Individual Placement and Support (IPS) self-assessments** completed weekly before supervision sessions.
  3. **Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.)** supervision notes submitted by both supervisor and supervisee for each session.
- The profile compiles quantitative and qualitative signals over time to depict:
  - competency development
  - degree of self-awareness (alignment between self-ratings and service-user ratings)
  - supervision coaching opportunities

## Section Semantics

### Section 1 — Ratings/Reviews

- Displays IPSCC averages per competency, derived from service-user responses collected at point of care.
- IPSCC response scale (Likert):
  - 1 = strongly disagree
  - 2 = disagree
  - 3 = unsure
  - 4 = agree
  - 5 = strongly agree
- Competency mapping is canonical and must not drift without explicit policy change:
  - Competency 1 (Connection): items 1, 2, 3, 4, 9, 10
  - Competency 2 (Shifting focus from helping to learning together): item 3
  - Competency 3 (Worldview awareness): item 5
  - Competency 4 (Shift from individual to relationship): items 2, 4, 9
  - Competency 5 (Mutuality): items 4, 5, 7, 9
  - Competency 6 (Shift from fear to hope and possibility): items 4, 10
  - Competency 7 (Moving towards versus moving away from): items 6, 8, 10
  - Competency 8 (Self-reflection): items 1, 2
  - Competency 9 (Give and receive feedback): items 3, 7
  - Competency 10 (Co-reflection): items 9, 10

### Section 2 — Self-Awareness

- Depicts the correlations between:
  - point-of-care IPSCC competency averages from service users, and
  - weekly IPS self-assessment competency averages completed before supervision.
- Correlation output must remain interpretable by competency and in aggregate.
- Primary interpretation objective: assess how strongly navigators' self-perception matches how service users experience care delivery.

### Section 3 — Workshop Focus

- Displays qualitative insights derived from structured C.R.E.A.T.E. supervision notes.
- Each supervision session stores paired submissions (supervisor + supervisee) using the handout form structure:
  - participants (peer specialist and supervisor)
  - mode of supervision (in-person / online / phone call)
  - date and duration
  - Connect prompt yes/no indicator (focused, minimized distractions, active listening)
  - Recognize notes
  - Encourage notes
  - Acknowledge notes
  - Train notes
  - Empower notes
  - C.R.E.A.T.E. action plan
  - peer specialist signature/date
  - supervisor signature/date
- Insights summarize what is currently being workshopped, where alignment exists, and where coaching focus should increase.

## Pickup Queue Placement Policy

- Enrollees needing pickup must be rendered at the top of the assignment board when present.
- When there are no enrollees needing pickup:
  - the pickup section is collapsed by default
  - users can expand it on demand
  - expanded rows still support assigning a navigator for someone already picked up by another navigator

## Continuity Policy

- Do not change section definitions, competency mappings, correlation intent, or pickup placement behavior without updating this document in the same work session.
