# NAVIGATOR_MY_PROFILE

## Purpose

Defines the canonical semantics for the navigator **my profile** surface so supervision tracking, interpretation, and follow-up actions stay stable across updates.

## Supervision Tracking Model

- Navigator supervision tracking is a three-prong model:
  1. **Intentional Peer Support Core Competencies (IPSCC)** service-user surveys captured at point of care after each encounter.
  2. **IPSCC self-assessments** completed weekly before supervision sessions (same ten competencies and rating scales as the IPSCC tool).
  3. **Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.)** supervision notes submitted by both supervisor and supervisee for each session.
- The profile compiles quantitative and qualitative signals over time to depict:
  - competency development
  - degree of self-awareness (alignment between self-ratings and service-user ratings)
  - supervision coaching opportunities

## Section Semantics

### Section 1 — Ratings/Reviews

- Displays IPSCC averages per competency, derived from service-user responses collected at point of care.
- Source instrument: `references/IPS_self_assessment.pdf` (Intentional Peer Support Core Competencies self-assessment tool, 1-4-17).
- Response model: **one score per competency (1–5)**. The wording under each number is competency-specific — not a generic Likert agree/disagree scale.
- Survey presentation mirrors the Z-code burden survey: one competency card at a time, score buttons 1–5, selected scale text shown under the score, with the worked example for that level.
- Competency catalog (canonical order):
  1. Connection
  2. Shifting the focus from Helping to Learning Together
  3. Worldview: Awareness of Own and Other's Worldview
  4. Shifting the focus from the Individual to the Relationship
  5. Mutuality
  6. Shifting the focus from fear to hope and possibility
  7. Moving Towards versus Moving Away From
  8. Self-Reflection
  9. Able to Give and Receive Feedback
  10. Co-Reflection

### Section 2 — Self-Awareness

- Depicts the correlations between:
  - point-of-care IPSCC competency averages from service users, and
  - weekly IPSCC self-assessment competency scores completed before supervision.
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

## Profile Layout Order

- Navigator My Profile main-column order is:
  1. Profile photo / identity chrome
  2. Enrollment assignment board (tucked under the photo)
  3. First divider (profile chrome bottom border)
  4. Competency dashboard (IPSCC / self-awareness / C.R.E.A.T.E. signals)
  5. Remaining profile sections / overlays

## Profile Navigation Cards

Active rail cards:
  1. **enrollee** (Section 1 — IPSCC ratings/reviews)
  2. Additional cards follow `NavigatorMyProfilePanel` `CARD_DEFS` with `isActiveOnProfileRail`.
