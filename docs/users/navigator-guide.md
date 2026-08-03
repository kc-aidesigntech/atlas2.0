# Navigator Guide (Users)

How navigators (and supervisors reviewing navigator competency) use My Profile and related workflows.

## Access reminder

Your signed-in identity controls enrollee data via Row-Level Security (RLS). The role switcher only changes layout — it does not expand your caseload.

## My Profile layout (top to bottom)

1. Profile photo / identity chrome
2. Enrollment assignment board (including pickup queue)
3. Competency dashboard
4. Remaining profile sections / overlays

### Pickup queue

- Enrollees needing pickup render at the top of the assignment board when present.
- When none need pickup: the pickup section is collapsed by default (expandable). Expanded rows can still support assigning a navigator for someone already picked up by another navigator.

## Supervision tracking (three-prong model)

1. **Intentional Peer Support Core Competencies (IPSCC)** service-user surveys after each encounter (point of care).
2. **IPSCC self-assessments** completed weekly before supervision (same ten competencies and 1–5 scales).
3. **Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.)** supervision notes from supervisor and supervisee each session.

The profile compiles these signals for competency development, self-awareness (self vs service-user alignment), and coaching focus.

### Section 1 — Ratings / reviews

- IPSCC averages per competency from service-user responses.
- Source instrument: `references/IPS_self_assessment.pdf`.
- One score per competency (1–5); wording under each number is competency-specific.
- Presentation mirrors the Z-code burden survey: one competency card at a time.

Competency catalog (canonical order): Connection; Shifting the focus from Helping to Learning Together; Worldview; Shifting the focus from the Individual to the Relationship; Mutuality; Shifting the focus from fear to hope and possibility; Moving Towards versus Moving Away From; Self-Reflection; Able to Give and Receive Feedback; Co-Reflection.

### Section 2 — Self-awareness

Correlates point-of-care IPSCC averages with weekly self-assessment scores — how closely self-perception matches service-user experience.

### Section 3 — Workshop focus

Qualitative insights from paired C.R.E.A.T.E. notes (participants, mode, date/duration, Connect indicator, Recognize / Encourage / Acknowledge / Train / Empower notes, action plan, signatures).

## Day-to-day clinical loop

1. Keep regulation instruments current — see [journey-phases.md](./journey-phases.md).
2. When regulation is cleared, use **route planning** for Z-code remediation.
3. Capture burden / IPSCC / assessment work from the enrollee surfaces as prompted.
4. Complete weekly self-assessment before supervision; participate in C.R.E.A.T.E. sessions.

## Profile navigation cards

Active rail cards start with **enrollee** (IPSCC ratings). Additional cards follow `NavigatorMyProfilePanel` `CARD_DEFS` with `isActiveOnProfileRail`.

## Pilot practice

Use the navigator login and checklist in [pilot-guide.md](./pilot-guide.md).
