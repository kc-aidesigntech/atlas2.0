# ATLAS SQL RPC Contracts

Structured Query Language (SQL) Remote Procedure Calls (RPCs) in the `atlas` schema, with inputs, side effects, and the permission each one checks.

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
| `atlas.fn_navigator_assign_enrollment_to_self` | `target_enrollment_id` | Adds caller's navigator assignment for enrollment if missing | `authenticated`; system admin or `t3a` / `t2b` by assignment or claim |
| `atlas.fn_navigator_unassign_enrollment_from_self` | `target_enrollment_id` | Ends caller's navigator assignment for enrollment | `authenticated`; system admin or `t3a` / `t2b` by assignment or claim |

"Admin claim enforced" means `fn_require_admin_claim()`, which raises unless `atlas.fn_is_system_admin()` is true (`t4plus` claim or active assignment; legacy `administrator` claim accepted). Role keys are the Residency tiers; see [tiers.md](./tiers.md).

## Non-assignment operational RPCs (active usage)

| RPC | Inputs | Side Effects | Permissions |
| --- | --- | --- | --- |
| `atlas.fn_access_matrix_save_person_roles` | `target_person_id`, `target_role_keys[]` | Normalizes legacy literals, closes open assignments not requested (`ends_on = current_date - 1`), inserts missing ones, marks the highest-ranked tier primary (`20261104190700`) | `authenticated`, admin claim enforced |
| `atlas.fn_can_access_warmline_agent` | none | none (read-only) | `authenticated`; `fn_has_permission('warmline_agent.access')` — seeded on `t2b`, `t3a`, `t4`, `t4plus`; other tiers only with an allow exception |
| `atlas.fn_create_prayphone_handoff` | none | inserts a 60-second single-use code | `authenticated`; caller must pass `fn_can_access_warmline_agent` |
| `atlas.fn_consume_prayphone_handoff` | `target_code` | marks that code used and returns the user id | `service_role` only |
| `atlas.fn_admin_set_warmline_access` | `target_person_id`, `next_effect` (`allow`/`deny`/`clear`) | writes `permission_exceptions` | `authenticated`, admin claim |
| `atlas.fn_supervisor_set_navigator_warmline_access` | `target_navigator_person_id`, `enabled` | allow/clear exception on roster navigator | `authenticated`; system admin, or `t4` / `t4plus` with the target on their open roster |
| `atlas.fn_list_warmline_access` | `target_person_ids[]` | none (read-only) | `authenticated`; system admin sees all, everyone sees own row, `t4` / `t4plus` see roster navigators |

## Tier RPCs

Full descriptions, the permission table, and the `fn_wallet_overview` JavaScript Object Notation (JSON) shape are in [tiers.md](./tiers.md).

| RPC | Inputs | Side Effects | Permissions |
| --- | --- | --- | --- |
| `atlas.fn_set_person_tier` | `target_person_id`, `tier_key` | Ends other active tier assignments, makes the tier assignment primary, upserts `people_tiers` as `active` | `authenticated`; `fn_can_manage_tiers()` (system admin or active `t4` / `t4plus`) |
| `atlas.fn_mark_tier_alum` | `target_person_id` | Ends active tier assignments; `people_tiers.tier_status = 'alum'`, `tier_key` kept | `authenticated`; `fn_can_manage_tiers()` |
| `atlas.fn_grant_designation` | `target_person_id`, `designation` | Inserts `tier_designations` row; target must be active `t2b` or higher | `authenticated`; `fn_can_manage_tiers()` |
| `atlas.fn_revoke_designation` | `target_person_id`, `designation` | Deletes that `tier_designations` row | `authenticated`; `fn_can_manage_tiers()` |
| `atlas.fn_my_tier` | none | none (read-only) | `authenticated` |
| `atlas.fn_my_permissions` | none | none (read-only) | `authenticated` |
| `atlas.fn_enroll_in_cohort` | `cohort_id`, `target_person_id` | Inserts `ips_cohort_enrollments` row; trigger moves active `t1` to `t2` | `authenticated`; system admin or `supervision.give` |
| `atlas.fn_create_sponsorship` | `sponsor_person_id`, `sponsored_person_id` | Inserts active `sponsorships` row (existing active pair returned) | `authenticated`; `sponsorship.give` as the sponsor, or system admin / `supervision.give` for any sponsor |
| `atlas.fn_issue_competency_card` | `target_person_id`, `card_id`, `assessment_id?` | Upserts `people_competency_cards` row | `authenticated`; system admin or `supervision.give` |
| `atlas.fn_upsert_lead` | `payload jsonb` | Inserts or updates one `leads` row | `authenticated`; system admin or `leads.engage` |
| `atlas.fn_wallet_overview` | none | none (read-only) | `authenticated`; caller's own rows only |
| `atlas.fn_update_partner_station` | `target_station_id`, `payload jsonb` (`station_name`, `capacity_total`, `capacity_available`) | Updates the keys present on one `partner_stations` row; returns the row as JSON | `authenticated`; system admin or `partner_profile.write` |
| `atlas.fn_set_route_plan_stop_status` | `target_stop_id`, `next_status` (`planned` / `active` / `completed` / `blocked`) | Sets `route_plan_stops.status`; returns the row as JSON | `authenticated`; system admin or `partner_milestones.write` |

Assignment closers (`fn_set_person_tier`, `fn_mark_tier_alum`, `fn_access_matrix_save_person_roles`) write `ends_on = current_date - 1`; readers (`fn_has_permission`, `fn_caller_role_keys`, `fn_is_system_admin`, `fn_my_tier`) count an assignment through its `ends_on` day (`20261104190600_tier_followups.sql`).
