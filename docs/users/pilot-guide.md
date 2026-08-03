# Pilot Guide (Users + Facilitators)

This is the user-facing entry for piloting Atlas. The full technical procedures, Remote Procedure Call (RPC) mapping, and teardown steps live in the canonical [PILOT.md](../../PILOT.md) at the repository root (kept there for existing bookmarks and verification scripts).

## Before you start

1. Ask Information Technology (IT) to confirm Supabase config and that `verification/pilot_setup.sql` has been applied on a **non-production** project.
2. Run the app: `npm run dev` → workspace at `http://localhost:5173/app`.
3. Read the access rule: the role switcher changes menus only; data scope follows the signed-in login via Row-Level Security (RLS).

## Pilot logins

All four accounts share one password and have confirmed email. Created by `verification/pilot_setup.sql`.

| Role | Email | Password |
|------|-------|----------|
| Administrator | `pilot.admin@atlas.test` | `AtlasPilot2026!` |
| Navigator | `pilot.navigator@atlas.test` | `AtlasPilot2026!` |
| Supervisor | `pilot.supervisor@atlas.test` | `AtlasPilot2026!` |
| Partner | `pilot.partner@atlas.test` | `AtlasPilot2026!` |

**These accounts must never exist in production.** See [production-go-live-hard-gates.md](../production-go-live-hard-gates.md).

Anonymous persona: public landing / referral at `http://localhost:5173/`.

## Role checklists (summary)

Use the matching login **and** set the role switcher to the same role for the truest walkthrough.

### Administrator

- See full enrollee roster
- Access Matrix: roles, enrollment navigators, supervisor↔navigator edges, partner contacts
- Review admin survey history
- Confirm warehouse exports are not reachable in-app

### Navigator

- See only assigned enrollees
- Self-assign / claim from queue
- Save enrollee burden survey
- Complete regulation tests
- Competency self-assessment
- Intake / resolve Z-codes

### Supervisor

- Competency rollup for supervised navigators
- Supervision / C.R.E.A.T.E. session recording

### Partner

- Confirm **no** enrollee Protected Health Information (PHI)
- Submit service-capacity (Z-code) survey
- Partner identifier / nullification flows as applicable

### Public / anonymous

- Submit a public referral
- Confirm public Z-code reference loads
- Confirm PHI and operational tables stay locked

## Related user guides

- [navigator-guide.md](./navigator-guide.md)
- [partner-guide.md](./partner-guide.md)
- [journey-phases.md](./journey-phases.md)

## Full detail

Open [PILOT.md](../../PILOT.md) for RPC names, verified RLS scope tables, optional `verification/pilot_verify.sql` replay, and reset/teardown.
