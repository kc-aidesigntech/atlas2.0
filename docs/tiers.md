# Residency Tiers

The seven Residency tiers are the staff `role_key`s in `atlas.roles`. They replaced `navigator`, `supervisor`, and `administrator` in the migration set `supabase/migrations/20261104190000_tier_roles.sql` through `20261104190700_tier_partner_write_rpcs.sql`. `partner` and `enrollee` remain as non-tier roles. This page is rewritten from those migrations and from the `src/features/atlas2026` files named in each section.

Words used on this page: a **tier holder** is a person with an active `atlas.people_tiers` row. A **tier manager** is a caller for whom `atlas.fn_can_manage_tiers()` is true: a system administrator or an active `t4` / `t4plus`.

## Migrations

| File | What it does |
|------|--------------|
| `20261104190000_tier_roles.sql` | Tier role rows and constraint; remaps `navigator` / `supervisor` / `administrator` assignments to `t3a` / `t4` / `t4plus` and deletes the old rows; `people_tiers`, `tier_designations`; `fn_normalize_role_key`, `fn_tier_rank`, `fn_caller_role_keys`, `fn_is_system_admin`, `fn_can_manage_tiers`, `fn_tier_apply`, `fn_set_person_tier`, `fn_mark_tier_alum`, `fn_grant_designation`, `fn_revoke_designation`, `fn_my_tier`. |
| `20261104190100_tier_admin_fastpath.sql` | `fn_has_permission`, `fn_require_admin_claim`, `fn_access_matrix_save_person_roles`, `fn_can_access_enrollment_as_staff`, roster and revision functions, `fn_can_manage_prayphone_fleet`, `v_dw_rls_principal_scope`, and every `*_admin_*` policy call `fn_is_system_admin()`. |
| `20261104190200_tier_role_literals.sql` | Supervisor / navigator literals become tier sets; `handle_auth_user_people_sync` defaults new sign-ups to `t1`; `navigator_create_sessions.opened_by_role` and the intake-queue policies accept tier keys. |
| `20261104190300_tier_permissions.sql` | Permission keys and `role_permissions` per tier; `fn_my_permissions`. |
| `20261104190400_tier_navigation.sql` | `app_role_navigation` rows for the seven tiers; legacy rows deleted. |
| `20261104190500_tier_feature_tables.sql` | Feature tables, the T1 → T2 trigger, `referrer_person_id`, and the feature RPCs. |
| `20261104190600_tier_followups.sql` | Remaining admin predicates call `fn_is_system_admin()`; the `ends_on` rule below; `search_path` pinned on `fn_normalize_role_key` and `fn_tier_rank`; `enrollee_burden_survey_submissions.respondent_role` accepts `t2b` / `t3a` / `t4` / `t4plus` next to `navigator` / `supervisor`; covering indexes on `ips_cohort_enrollments.enrolled_by`, `people_competency_cards.card_id` / `assessment_id` / `issued_by_person_id`, `secondments.partner_id`, `tier_designations.granted_by`. |
| `20261104190700_tier_partner_write_rpcs.sql` | `fn_update_partner_station` and `fn_set_route_plan_stop_status` (partner writes gated by permission key); `fn_access_matrix_save_person_roles` closes removed assignments with `ends_on = current_date - 1`. |

### `ends_on` rule

Readers treat an assignment as active through its `ends_on` day: `fn_has_permission`, `fn_caller_role_keys`, `fn_is_system_admin`, and `fn_my_tier` all test `ends_on is null or ends_on >= current_date`. Closers therefore write yesterday: `fn_tier_apply` (so `fn_set_person_tier` and the cohort trigger), `fn_mark_tier_alum`, and `fn_access_matrix_save_person_roles` set `ends_on = current_date - 1` on the assignments they end, so a tier closed today stops granting today.

## The seven tiers

`atlas.roles.role_name` is the label column. Purpose and advancement question come from `TIER_DEFINITIONS` in `shared/tiers.ts`.

| Key | Identity | Purpose | Advancement question |
|-----|----------|---------|----------------------|
| `t1` | T1 Candidate | Refers people in and can be sponsored into an Intentional Peer Support (IPS) Core cohort. | Am I curious? |
| `t2` | T2 Apprentice | Learns the practice inside a cohort, holds a wallet, and receives supervision. | Am I learning the practice? |
| `t2b` | T2B Peer Resident | Sits the warm line, takes respite shifts, engages leads, and writes enrollee profiles. | Can I hold space for others? |
| `t3` | T3 Travel Peer | Carries the practice to a host organization on a secondment schedule. | Can I carry the practice to another site? |
| `t3a` | T3A Peer Navigator | Claims pickups, plans routes, and resolves Z-code burden with enrollees. | Can I walk a route with an enrollee? |
| `t4` | T4 Supervisor | Supervises navigators and records competency assessments. | Can I grow other peers? |
| `t4plus` | T4+ Coordinator | Stewards partners, the heat map, governance, and the fleet. | Can I steward the Residency itself? |

Ladder order is `t1 < t2 < t2b < t3 < t3a < t4 < t4plus` (`atlas.fn_tier_rank`, `tierRank`).

### Legacy claims and rows

`atlas.fn_normalize_role_key` maps `administrator` → `t4plus`, `supervisor` → `t4`, `navigator` → `t3a`; any other value passes through lower-cased. The client does the same in `normalizeRoleKey` (`singlepane/domain/roles.ts`). The migration moved every `people_role_assignments` row from the three old role rows onto the tier rows, copied their `role_permissions`, and deleted the old rows. The `roles_role_key_check` constraint now allows only the seven tier keys plus `partner` and `enrollee`.

### Tier standing: `atlas.people_tiers`

One row per person: `tier_key`, `tier_status` (`active` | `alum`), `entered_at`, `left_at`, `is_lucid_employee`. Any signed-in user reads the table. Tier managers may update `is_lucid_employee` directly; every other write goes through the Remote Procedure Calls (RPCs) below.

### Designations: `atlas.tier_designations`

One row per `(person_id, designation)`; `designation` is `warmline_operator`, `mentor`, or `group_facilitator`. `fn_grant_designation` requires the target to hold an active tier at `t2b` or higher.

## Who gets to do what

### System administrator

`atlas.fn_is_system_admin()` is true when the JavaScript Object Notation (JSON) Web Token (JWT) claim `app_metadata.atlas_role` normalizes to `t4plus`, or the caller holds an active `t4plus` assignment. `fn_has_permission` returns true for a system administrator before it reads any exception or grant, so `t4plus` passes every key, not only the seeded ones. `fn_require_admin_claim` raises unless `fn_is_system_admin()` is true.

### Permission check order

`atlas.fn_has_permission(key)`: system administrator → true; no person row → false; active `deny` exception in `user_permission_exceptions` → false; active `allow` exception → true; otherwise true when an active `people_role_assignments` row joins to `role_permissions` for that key.

`atlas.fn_my_permissions()` returns every `permission_key` for a system administrator, otherwise each key for which `fn_has_permission` is true. The client calls it once per session (`tierRepository.ts` → `useViewerPermissions.ts`) and falls back to `TIER_PERMISSION_SEED` in `shared/tiers.ts` when the RPC fails or when the pane shows a role other than the account's primary role.

### Permission table (`20261104190300_tier_permissions.sql`)

| Permission key | Tiers |
|----------------|-------|
| `referral.submit` | t1, t2, t2b, t3, t3a, t4, t4plus |
| `sponsorship.receive` | t1, t2 |
| `sponsorship.give` | t2b, t3, t3a, t4, t4plus |
| `wallet.access` | t2, t2b, t3, t3a, t4, t4plus |
| `competency_cards.view` | t2, t2b, t3, t3a, t4, t4plus |
| `supervision.receive` | t2, t2b, t3, t3a, t4, t4plus |
| `supervision.give` | t4, t4plus |
| `leads.engage` | t2b, t3a, t4, t4plus |
| `warmline_agent.access` (name kept) | t2b, t3a, t4, t4plus |
| `respite_shifts.take` | t2b, t3a, t4, t4plus |
| `enrollee_profile.write` | t2b, t3a, t4, t4plus |
| `regulation_variables.write` | t2b, t3a, t4, t4plus |
| `pickup.claim` | t3a |
| `route_plan.write` | t3a |
| `z_burden.resolve` | t3a |
| `secondment_schedule.view` | t3 |
| `partner_profile.write` | t4plus |
| `partner_milestones.write` | t4plus |
| `heatmap.view` | t4plus |
| `heatmap.toggle` | t4plus |
| `partner_capacity_submissions.read` / `.write` / `.delete` | partner (unchanged), t4plus |

### Tier sets inside rewritten functions (`20261104190200_tier_role_literals.sql`)

Functions that compared `supervisor` or `navigator` now read `atlas.fn_caller_role_keys()` (active assignments plus the `atlas_role` / `atlas_roles` claims, normalized): "supervisor" is `t4`, `t4plus`; "navigator" is `t3a`, `t2b`. This covers `fn_save_navigator_competency_assessment`, `fn_ensure_staff_person`, `fn_supervisor_set_navigator_warmline_access`, `fn_list_warmline_access`, `fn_wallet_caller_is_supervisor` / `_navigator`, the wallet claim-card functions, `fn_supervisor_claim_navigator` / `_release_navigator`, `fn_navigator_assign_enrollment_to_self` / `_unassign_`, the `enrollment_requests_staff_select` policy, and the two `public_referral_intake_events` staff policies (`t2b`, `t3a`, `t4`, `t4plus`). The `navigator_create_sessions.opened_by_role` check allows `t2b`, `t3a`, `t4`, `t4plus`, `navigator`, `supervisor`.

## Menus per tier (`20261104190400_tier_navigation.sql`)

`atlas.app_role_navigation` on surface `singlepane`, `top_menus` column. `action_menus` and `metadata` for `t3a`, `t4`, and `t4plus` were copied from the `navigator`, `supervisor`, and `administrator` rows when those existed; `t1`–`t3` have empty `action_menus`.

| Tier | `top_menus` |
|------|-------------|
| `t1` | refer |
| `t2` | refer, my wallet |
| `t2b` | refer, my wallet, assigned enrollees, leads, warm line, respite shifts, sponsorships |
| `t3` | refer, my wallet, secondment schedule, sponsorships |
| `t3a` | refer, my wallet, assigned enrollees, requests to enroll, leads, warm line, respite shifts, route planning, my station, county commons, scribe, sponsorships |
| `t4` | `t3a` list + assigned navigators, navigator assessments, team burden, cohorts, competency cards, fleet |
| `t4plus` | `t4` list + partners, system operations, governance |

Fallback `action_menus` when no legacy row existed: `t3a` route planning, log contact, append route step, escalate risk; `t4` record navigator assessment, append route step, confirm milestone; `t4plus` route planning, set policy threshold, approve route template, audit event logs.

## Feature tables (`20261104190500_tier_feature_tables.sql`)

Every table has Row-Level Security (RLS) enabled with the same pattern: the person named on the row reads it; holders of the feature's permission key read and write; `fn_is_system_admin()` does everything.

| Table | Columns of note | Read | Write |
|-------|-----------------|------|-------|
| `sponsorships` | `sponsor_person_id`, `sponsored_person_id`, `status` (`active` \| `ended`), `started_at`, `ended_at`, `note`. One active row per pair (partial unique index). | sponsor, sponsored, `sponsorship.give` | `sponsorship.give` where the caller is the sponsor |
| `ips_cohorts` | `name`, `starts_on`, `ends_on`, `status` (`planned` \| `active` \| `completed`) | enrolled person, `supervision.give` | `supervision.give` |
| `ips_cohort_enrollments` | `cohort_id`, `person_id`, `enrolled_at`, `enrolled_by`, `status` (`enrolled` \| `completed` \| `withdrawn`); unique `(cohort_id, person_id)` | self, `supervision.give` | `supervision.give` |
| `competency_cards` | catalog: `card_key`, `title`, `description`, `tier_min`. Seeded: `ips_core_complete`, `co_reflection`, `relational_practice` (t2); `hospitality`, `warmline_operator`, `group_facilitation` (t2b); `navigation_systems` (t3a); `supervision_practice` (t4) | any signed-in user | `supervision.give` |
| `people_competency_cards` | `person_id`, `card_id`, `earned_at`, `issued_by_person_id`, `assessment_id` → `navigator_competency_assessments`, `note`; unique `(person_id, card_id)` | self, `competency_cards.view`, `supervision.give` | `supervision.give` |
| `respite_shifts` | `person_id`, `site`, `starts_at`, `ends_at`, `status` (`scheduled` \| `completed` \| `cancelled`) | self, `respite_shifts.take`, `supervision.give` | `respite_shifts.take` on own rows; `supervision.give` on any |
| `secondments` | `person_id`, `host_organization`, `partner_id`, `starts_on`, `ends_on`, `status` (`planned` \| `active` \| `completed` \| `cancelled`) | self, `secondment_schedule.view`, `supervision.give` | `supervision.give` |
| `secondment_schedule` | `secondment_id`, `day_of_week` (0 Sunday – 6 Saturday), `starts_time`, `ends_time`, `location` | seconded person, `secondment_schedule.view`, `supervision.give` | `supervision.give` |
| `leads` | `person_id` (nullable), `display_name`, `phone`, `email`, `source`, `stage` (`new` \| `contacted` \| `engaged` \| `referred` \| `closed`), `owner_person_id`, `notes`, `last_contact_at` | the lead's own person, the owner, `leads.engage` | `leads.engage` |

`public_referral_intake_events.referrer_person_id` (nullable, → `atlas.people`) records who made the referral so it counts toward that person's sponsorship record.

### T1 → T2 cohort trigger

`trg_ips_cohort_enrollments_advance_tier` runs after each insert into `ips_cohort_enrollments`. When the enrolled person's `people_tiers` row is active `t1`, it calls `atlas.fn_tier_apply(person_id, 't2')`. Any other standing (no row, alum, or `t2` and above) is left as is.

### Alum

`fn_mark_tier_alum` sets `tier_status = 'alum'` and `left_at`, keeps `tier_key`, and closes every open tier role assignment with `ends_on = current_date - 1`. Permissions seeded on the tier stop applying the same day; the wallet prints the alum label (`T2 Alum`, `T3A Alum`, …) with a yellow `alum` pill. `fn_set_person_tier` on an alum re-activates them on the given tier.

### Badge and ribbon

From `shared/tiers.ts`: the **badge** is earned by an active tier at or above `t2`. The **ribbon** is earned by an active tier at or above `t2`, or by an active `t1` whose `is_lucid_employee` is true. Alum earns neither.

## RPCs

All are `security definer`, resolve the caller through `atlas.fn_current_person_id()`, and are granted to `authenticated`.

| RPC | Caller | Does |
|-----|--------|------|
| `fn_set_person_tier(target_person_id, tier_key)` | tier manager | Writes the role assignment and the `people_tiers` row together: other open tier assignments close with `ends_on = current_date - 1`, the new tier assignment becomes the only primary, the tier row is created or moved to `active`. |
| `fn_mark_tier_alum(target_person_id)` | tier manager | See **Alum** above. |
| `fn_grant_designation(target_person_id, designation)` | tier manager | Inserts a `tier_designations` row; target must hold an active tier at `t2b` or higher. Duplicate grants are ignored. |
| `fn_revoke_designation(target_person_id, designation)` | tier manager | Deletes that row. |
| `fn_my_tier()` | any signed-in | One row: `tier_key`, `tier_status`, `is_lucid_employee`, `designations text[]`. Falls back to the highest active tier assignment when no `people_tiers` row exists; zero rows when the caller holds no tier. |
| `fn_my_permissions()` | any signed-in | The caller's permission keys (see **Permission check order**). |
| `fn_enroll_in_cohort(cohort_id, target_person_id)` | system admin or `supervision.give` | Inserts the enrollment (returns the existing id when the pair exists); the trigger then advances an active `t1` to `t2`. |
| `fn_create_sponsorship(sponsor_person_id, sponsored_person_id)` | `sponsorship.give` naming self as sponsor; system admin or `supervision.give` naming anyone | Inserts an active sponsorship; returns the existing active row's id when there is one. |
| `fn_issue_competency_card(target_person_id, card_id, assessment_id default null)` | system admin or `supervision.give` | Inserts the `people_competency_cards` row; on an existing pair keeps `earned_at` and refreshes `issued_by_person_id` and `assessment_id`. `assessment_id` must be an assessment of the target. |
| `fn_upsert_lead(payload jsonb)` | system admin or `leads.engage` | Inserts (owner defaults to caller; `display_name` required) or, when `id` is present, updates only the keys present in the payload. |
| `fn_wallet_overview()` | any signed-in | One JSON document for the caller's own rows; no permission key beyond being signed in. |
| `fn_update_partner_station(target_station_id, payload jsonb)` | system admin or `partner_profile.write` | Updates `station_name`, `capacity_total`, `capacity_available` on one `partner_stations` row from the payload keys present (empty name or negative capacity raises); returns the row as JSON. |
| `fn_set_route_plan_stop_status(target_stop_id, next_status)` | system admin or `partner_milestones.write` | Sets `route_plan_stops.status` to `planned`, `active`, `completed`, or `blocked`; returns the row as JSON. |

`fn_access_matrix_save_person_roles(target_person_id, target_role_keys[])` (system admin via `fn_require_admin_claim`) normalizes legacy literals, closes open assignments not in the request with `ends_on = current_date - 1`, inserts the missing ones, and marks the highest-ranked tier key primary (rank-0 keys `partner` / `enrollee` sort after tiers, then alphabetically).

`fn_wallet_overview()` shape:

```json
{
  "tier": { "tier_key": "t2b", "tier_status": "active", "is_lucid_employee": false, "designations": ["warmline_operator"] },
  "competency_cards": [{ "card_key": "", "title": "", "earned_at": "" }],
  "sponsorships_given": [{ "id": "", "sponsored_person_id": "", "sponsored_display_name": "", "status": "", "started_at": "", "ended_at": null }],
  "sponsorships_received": [{ "id": "", "sponsor_person_id": "", "sponsor_display_name": "", "status": "", "started_at": "", "ended_at": null }],
  "respite_shifts": [{ "id": "", "site": "", "starts_at": "", "ends_at": "", "status": "" }],
  "secondments": [{ "id": "", "host_organization": "", "partner_id": null, "starts_on": "", "ends_on": null, "status": "",
                    "schedule": [{ "day_of_week": 0, "starts_time": "", "ends_time": "", "location": null }] }],
  "leads_owned_count": 0
}
```

`tier` is `null` when `fn_my_tier()` returns no row. Each list is `[]` when empty.

## Client

### Role model files

- `shared/tiers.ts` — tier keys, metadata, `TIER_PERMISSION_SEED`, badge/ribbon rules. Imports nothing else from the feature.
- `singlepane/domain/roles.ts` — legacy alias table, `normalizeRoleKey`, `isSystemAdmin` (`t4plus`), `isSupervisorTier` (`t4`, `t4plus`), `isNavigatorTier` (`t3a`, `t2b`), `workspaceExperience` (`administrator` | `supervisor` | `navigator` | `partner` | `member`; `member` covers `t1`, `t2`, `t3`). These two files are the only places role literals are compared.
- `singlepane/data-access/tierRepository.ts` — every call to the tier RPCs and the `people_tiers` / `tier_designations` reads.
- `singlepane/hooks/useViewerPermissions.ts` — `hasPermission(key)`; `permissionSource` is `rpc` or `tier-defaults`. `hasPermission` returns true for every key when the pane role is `t4plus`.
- `admin/components/TierStandingEditor.tsx` — the tier picker (`fn_set_person_tier`), **mark alum** (`fn_mark_tier_alum`), the Lucid employee checkbox (`people_tiers.is_lucid_employee`), and designation chips (`fn_grant_designation` / `fn_revoke_designation`; chips are enabled only for an active tier at `t2b` or higher). Rendered on the Admin Directory editor and the person-to-tier matrix; rows without a database person id are read-only.

### Menu label → screen id

`TIER_MENU_SCREEN_IDS` in `singlepane/data-access/singlePaneBootstrapRepository.ts` maps each stored `top_menus` label to the `activeMenu` screen id. Tier rows use the screen ids directly; older labels map onto existing screens (`assigned enrollees` → `enrollees`; `requests to enroll`, `assigned navigators`, `navigator assessments`, `my profile` → `my wallet`; `referral portal` → `refer`; `heat map` → `county commons`). The same file hides `warm line` unless the agent origin is configured and `fn_can_access_warmline_agent` is true, and hides `county commons` while the constant `SHOW_COUNTY_COMMONS` is `false` — which it is today, so the heat map menu is not shown for any tier.

### My Wallet (`singlepane/components/MyWalletPanel.tsx`)

One panel for every tier. `useWalletOverview` (`singlepane/hooks/useWalletOverview.ts`) calls `loadWalletOverview` → `fn_wallet_overview` and, when the viewer holds `supervision.receive`, `loadMySupervisor`, which reads the caller's open row in `supervisor_navigator_assignments` (`navigator_person_id` = caller, `ends_on is null`) joined to `people.display_name` (`singlepane/data-access/walletRepository.ts`). Both return null on a database that has not been migrated.

The header (`myWallet/WalletTierHeader.tsx`) always renders: avatar, name, `Tier: <identity or alum label>` (or `no tier on record`), the `active` / `alum` pill, the badge (`ZCodeBadge` with the tier code) when `earnsBadge`, a `ribbon` pill when `earnsRibbon`, a `Lucid employee` pill, one pill per designation, the tier purpose line, organization, email, and the meta lines (`Assigned enrollees` count when `enrollee_profile.write`; `Competency cards` count when that section shows). The tier row embedded in the RPC answer wins; the viewer-state tier fills in until it answers; the pane role stands in when the account holds no tier row.

Each section renders when `showsSection(key, hasRows)` is true: the viewer holds the key **and** either the tier seeds that key (`tierHasDefaultPermission`) or rows exist. A `t4plus` who holds a key only through the administrator bypass therefore does not see an empty candidate section.

| Section (title) | Permission key | Rows from |
|-----------------|----------------|-----------|
| `competency cards` | `competency_cards.view` | `fn_wallet_overview.competency_cards` |
| `my sponsor` | `sponsorship.receive` | `fn_wallet_overview.sponsorships_received` |
| `people I sponsor` | `sponsorship.give` | `fn_wallet_overview.sponsorships_given` |
| `my supervisor` | `supervision.receive` | `supervisor_navigator_assignments` open row |
| `secondment schedule` | `secondment_schedule.view` | `fn_wallet_overview.secondments` with `schedule` |
| `respite shifts` | `respite_shifts.take` | `fn_wallet_overview.respite_shifts` |
| `leads` (owned count, **open leads** button when the `leads` menu is on the role's row) | `leads.engage` | `fn_wallet_overview.leads_owned_count` |
| Navigator sections (`NavigatorMyProfilePanel`: enrollee claim circles, navigator supervision) | `enrollee_profile.write` (key alone; no row check) | existing navigator wallet reads |
| Supervisor sections (`SupervisorMyProfilePanel`: navigator claim circles, assessment rollup) | `supervision.give` (key alone; no row check) | existing supervisor wallet reads |

### Capability screens (`singlepane/components/tierFeaturePanels/`)

`SinglePaneWorkspace.tsx` renders `TierFeatureScreen` when `activeMenu` is one of `TIER_FEATURE_SCREEN_IDS` and the pane role is not `partner`. These screens and My Wallet render without a selected enrollee, so `t1`, `t2`, and `t3` shells open them. Each panel shows `TierFeatureNoAccess` (the message names the key) when its boolean is false. Reads and writes live in `singlepane/data-access/tierFeatureRepository.ts`.

| Screen id | Panel | Permission key(s) | Writes |
|-----------|-------|-------------------|--------|
| `leads` | `LeadsPanel` | `leads.engage` | `fn_upsert_lead` for every create and edit |
| `respite shifts` | `RespiteShiftsPanel` | `respite_shifts.take` | direct table writes under RLS: insert a scheduled shift for self, claim a cancelled shift (`person_id` = self, `status` = `scheduled`), set own shift `cancelled` / `completed` |
| `secondment schedule` | `SecondmentSchedulePanel` | `secondment_schedule.view` | none (read-only) |
| `partners` | `PartnersPanel` | `partner_profile.write` (station name and capacities), `partner_milestones.write` (stop status); no-access when neither | `fn_update_partner_station`; `fn_set_route_plan_stop_status`. Station list is `v_partner_station_directory`; stops are `route_plan_stops` for the station. **open organizations** jumps to the admin `system operations` screen (administrator experience only). |
| `cohorts` | `CohortsPanel` | `supervision.give` | insert into `ips_cohorts` under RLS; `fn_enroll_in_cohort` (trigger advances `t1` → `t2`) |
| `sponsorships` | `SponsorshipsPanel` | `sponsorship.give` (create as self, end own) or `sponsorship.receive` (view rows where sponsored); no-access when neither | `fn_create_sponsorship`; update `sponsorships.status` to `ended` with `ended_at` under RLS |
| `competency cards` | `CompetencyCardsPanel` | `supervision.give` | `fn_issue_competency_card`, optionally linked to one of the person's `navigator_competency_assessments` |

### Other gating points

All in `singlepane/shell/SinglePaneWorkspace.tsx` unless noted; `hasPermission` comes from `useViewerPermissions`.

| Key | Where | Effect |
|-----|-------|--------|
| `referral.submit` | `canUseReferralPortal` | The `refer` screen opens for any tier holding the key; `partner` keeps its own referral screen. |
| `pickup.claim` | `canClaimPickup` (also requires `viewerCanUseAssignmentActions`) | The wallet's pickup claim toggles and the enrollee assignment board toggles stay read-only without it. |
| `route_plan.write` | `canWriteRoutePlan`, `handleAssignCandidate` | Without the key a route candidate is highlighted but no assignment is saved. |
| `z_burden.resolve` | `canResolveZBurden` | The Z-code resolution overlay's `onToggleResolution` rejects with a message instead of writing; `EnrolleeZCodeOverridePanel.canEdit` is false. |
| `heatmap.view`, `heatmap.toggle` | passed to `ContextPanels.tsx` as `canViewHeatmap` / `canToggleHeatmap` | `CountyCommonsHeatmap` renders only when `canViewHeatmap` **and** `isCountyCommonsMenuEnabled()`; the toggle follows `canToggleHeatmap`. With `SHOW_COUNTY_COMMONS = false` the heat map is hidden for every tier, including `t4plus`. |
| `partner_profile.write`, `partner_milestones.write` | `TierFeatureScreen.tsx` → `PartnersPanel` | See the capability table. |
| `enrollee_profile.write`, `supervision.give`, and the rest | `MyWalletPanel.tsx` | See the wallet table. |

## Operational notes

1. **A `t1` has no `my wallet` menu.** The `t1` row in `app_role_navigation` is `["refer"]`, so a Candidate never opens My Wallet and never sees the `my sponsor` section. Their sponsorship is visible only on the sponsor's `people I sponsor` section and the `sponsorships` screen. `t2` is the first tier with `my wallet`.
2. **Partner self-service does not read `partner_profile.write`.** That key is seeded to `t4plus` only and is checked in `fn_update_partner_station` and the Partners panel. A partner's own screens (station view, service-capacity survey through `fn_save_partner_service_capacity`, `partner_capacity_submissions.*` keys, `fn_can_access_partner_scope`) keep their existing RLS and RPC path; `partner_stations` and `route_plan_stops` grant no direct insert or update to `authenticated`.

### Deployment notes

1. **New sign-ups default to `t1`.** `atlas.handle_auth_user_people_sync` inserts a `t1` assignment on `auth.users` insert when the person has no open assignment. Before `20261104190200` the default was `partner` (`20260510000500_signup_default_partner_role.sql`). A new account therefore lands on the `t1` menu (refer only) until a tier manager moves it.
2. **The external JWT hook must emit tier keys.** `app_metadata.atlas_role` is written outside this repository; no hook or trigger here sets it. Until that hook emits `t1` … `t4plus`, legacy values keep working through `fn_normalize_role_key` (Structured Query Language (SQL)) and `normalizeRoleKey` (client). Update the hook, then the aliases can be retired.

## Related

- Warm-line gate: [it/prayphone.md](./it/prayphone.md)
- Permission and RLS model: [it/security-model.md](./it/security-model.md)
- RPC inventory: [sql-rpc-contracts.md](./sql-rpc-contracts.md)
- Rule: `.cursor/rules/tier-hierarchy.mdc`
