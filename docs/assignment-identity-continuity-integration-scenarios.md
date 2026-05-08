# Assignment And Identity Continuity Integration Scenarios

This checklist validates continuity across assignment governance, identity linkage, signup approval, and policy-gated runtime behavior.

## Scenario 1: Multi-Select Assign And Unassign Parity

1. Sign in as an administrator and open `governance` -> `Navigator to enrollee coverage`.
2. For one active enrollee, select two navigators in the multi-select control.
3. Confirm both assignments appear in `Live access matrix` for the same enrollment.
4. Switch to a navigator account and open `enrollees` -> `add enrollees`.
5. Confirm the card shows:
   - `assignment: assigned`
   - `[2] navigators`
   - `already assigned to a navigator` (unless assigned to viewer).
6. Return to admin and remove one navigator from the same enrollee.
7. Confirm the matrix, navigator assignment board, and navigator `my profile` queue all refresh to the new count without manual reload.

Expected result: assignment edge writes remain in sync across governance card, matrix, navigator board, and profile view.

## Scenario 2: De-Assignment Propagation

1. In `Live access matrix`, remove all navigators from one enrollment.
2. Confirm the same enrollment immediately reads `Unassigned` in admin coverage card.
3. Open navigator assignment board and verify the card reads:
   - `assignment: unassigned`
   - no navigator chips
   - `not yet assigned`.

Expected result: occupancy derives from assignment edges/counts only, not stale roster labels.

## Scenario 3: Signup Continuity And Pending Approval

1. Sign in with a brand-new email that has no prior directory record.
2. Open admin `People and role directory`.
3. Verify a person record exists for that email with:
   - `approvalState: pending`
   - deterministic `identityGroupId`
   - `linkedEmails` containing the signup email.
4. Click `approved ✓` in the directory editor and save.

Expected result: new auth signups auto-link to a durable person record; admin can approve via checkmark workflow.

## Scenario 4: Email Linking To One Identity Group

1. Open one person in `Directory editor`.
2. Add a second email in `linked emails` and save.
3. Sign in with that second email.
4. Confirm runtime policy resolution and directory lookups map to the same person identity group.

Expected result: multiple emails can represent one individual identity while preserving a single policy/approval source.

## Scenario 5: Policy-Gated Runtime Access

1. In admin directory, edit a target person and set these toggles to `block`:
   - `screen`: `assignmentBoard`
   - `action`: `assignmentBoard.assignSelf`
   - `action`: `assignmentBoard.viewNavigatorNames`
2. Impersonate/sign in as that user.
3. Confirm:
   - assignment board surface is hidden or shows policy-blocked message,
   - assign/unassign button is disabled with policy messaging,
   - navigator-name reveal is unavailable from assignment count link.
4. Re-enable toggles and confirm behavior is restored without data loss.

Expected result: policy controls enforce screen/card/action capabilities consistently at runtime.
