# ATLAS SQL RPC Contracts

## Assignment RPCs

| RPC | Inputs | Side Effects | Permissions |
| --- | --- | --- | --- |
| `atlas.fn_access_matrix_save_enrollment_navigators` | `target_enrollment_id`, `target_navigator_person_ids[]` | Ends removed active navigator assignments and inserts missing active rows for enrollment | `authenticated`, admin claim enforced by `fn_require_admin_claim()` |
| `atlas.fn_access_matrix_save_navigator_supervisors` | `target_navigator_person_id`, `target_supervisor_person_ids[]` | Ends removed active supervisor assignments and inserts missing active rows for navigator | `authenticated`, admin claim enforced |
| `atlas.fn_access_matrix_save_partner_contacts` | `target_partner_id`, `target_primary_contact_person_ids[]` | Reconciles active partner contact edge set, sets primary contact edge, syncs legacy `partners.primary_contact_*` | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_assign_enrollment_navigator` | `target_enrollment_id`, `target_navigator_person_id` | Adds navigator to active enrollment edge set while preserving existing assignments | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_unassign_enrollment_navigator` | `target_enrollment_id`, `target_navigator_person_id` | Ends one active enrollment<->navigator edge row (`ends_on = current_date`) | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_assign_supervisor_navigator` | `target_navigator_person_id`, `target_supervisor_person_id` | Adds supervisor to active navigator edge set while preserving existing assignments | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_unassign_supervisor_navigator` | `target_navigator_person_id`, `target_supervisor_person_id` | Ends one active supervisor<->navigator edge row (`ends_on = current_date`) | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_assign_partner_contact` | `target_partner_id`, `target_contact_person_id` | Adds contact to partner edge set while preserving existing assignments | `authenticated`, admin claim enforced |
| `atlas.fn_assignment_unassign_partner_contact` | `target_partner_id`, `target_contact_person_id` | Removes contact from partner edge set and reapplies contact reconciliation | `authenticated`, admin claim enforced |
| `atlas.fn_navigator_assign_enrollment_to_self` | `target_enrollment_id` | Adds caller's navigator assignment for enrollment if missing | `authenticated`, caller must map to navigator role |
| `atlas.fn_navigator_unassign_enrollment_from_self` | `target_enrollment_id` | Ends caller's navigator assignment for enrollment | `authenticated`, caller must map to navigator role |

## Non-assignment operational RPCs (active usage)

| RPC | Inputs | Side Effects | Permissions |
| --- | --- | --- | --- |
| `atlas.fn_access_matrix_save_person_roles` | `target_person_id`, `target_role_keys[]` | Reconciles role assignments and related enrollment/person consistency hooks | `authenticated`, admin claim enforced |
| `fn_set_enrollee_z_code_resolution_context` | resolution input fields | Updates enrollee z-code resolution state and metadata | `authenticated`, RLS/RPC grants |
