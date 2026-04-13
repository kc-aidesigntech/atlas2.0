# Singlepane Persistence Matrix

This matrix documents every major visible control in singlepane, its write contract, and reload path.

## Screen: Partner `referral portal`

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| `open atlas referral portal` external link | none (external destination) | n/a | no write | n/a | no in-app persistence required |

## Screen: Partner `my station`

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| Station identity (name/org/county/contact) display | `atlas.partners` + `atlas.partner_stations` + `atlas.counties` | `organization_name_normalized` from account settings | read-only join lookup | `loadPartnerStationProfile()` during bootstrap and settings save | persisted read contract active |
| `refer` button | disabled intentionally | n/a | blocked until explicit referral write contract exists | n/a | guarded (non-persistent action removed) |
| Badge circles (`56`/`57` etc.) | derived from persisted burden breakdown | partner burden breakdown subject id | read-only derived values | `fetchPartnerLoadBreakdown()` -> `partnerLoadBreakdown` | persisted read contract active |

## Screen: Partner `service capacity`

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| Draft save | `atlas.partner_service_capacity_submissions` + answers + identifier linkage | `submission_id`/`draft_key` | upsert draft survey payload | `loadPartnerServiceCapacitySurveyHistory()` | verified persisted flow |
| Complete survey | same as above with completed status | `submission_id` | draft -> completed transition | history reload + completed read-only mode | verified persisted flow |
| Draft delete | `atlas.partner_service_capacity_submissions` | `submission_id` | delete draft only | history refresh | verified persisted flow |
| Identifier match/search | `atlas.v_partner_identifier_records` | first + last name query | search-only | `searchPartnerIdentifierRecordMatches()` | persisted read contract active |

## Screen: Navigator shell

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| Action menu (`log contact`, `append route step`, `escalate risk`) | `atlas.app_config_documents` (`singlepane/route_logs/runtime-v1`) | singleton route log config row | replace payload array on append/update/delete | `loadLocalLogs()` in bootstrap | persisted contract active |
| Timeline milestone date edit/delete/reposition | same route log config doc | log id inside payload | in-place payload rewrite | bootstrap log reload | persisted contract active |
| Route planning candidate ranking / ordering | read-only derived from `atlas.partner_z_code_burden_scores` + active `atlas.enrollee_z_codes` | `enrollment_id` at query time | no direct write; partner survey completion refreshes partner burden rows and active enrollee Z-codes change the read result | `atlas.fn_rank_route_candidates()` -> `atlas.v_navigator_route_candidates` -> `loadRouteCandidates()` | persisted derived read contract active |
| Route planning `save to route context` | `atlas.app_config_documents` (`singlepane/route_assignment:{enrolleeId}/runtime-v1`) | enrollee id | per-enrollee upsert | `loadRouteAssignments()` + `useJourneyStationMarkers()` | persisted contract active |
| Admin intake data in navigator timeline anchor | `atlas.app_config_documents` (`singlepane/enrollee_intake:{enrolleeId}/runtime-v1`) | enrollee id | per-enrollee upsert | `loadEnrolleeIntakes()` -> timeline/intake hydrate | persisted contract active |
| Parent/child Z-code drill-in | persisted enrollee profile source | enrollee id | read-only interaction | `fetchSinglePaneEnrolleeProfiles()` + panel state | persisted read contract active |

## Screen: Supervisor/Admin

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| `record navigator assessment` | `atlas.navigator_competency_assessments` | assessment id | insert | `loadNavigatorCompetencyAssessments()` | persisted contract active |
| Admin intake form | `atlas.app_config_documents` (`singlepane/enrollee_intake:{enrolleeId}/runtime-v1`) | enrollee id | upsert | `loadEnrolleeIntakes()` | persisted contract active |
| Admin action labels without contracts (`set policy threshold`, `approve route template`, `audit event logs`) | blocked in UI by persisted-action filter | n/a | no write allowed | n/a | guarded (non-persistent actions removed) |

## Global operator settings

| Control | Write target | Record key | Write semantics | Reload/read path | Status |
| --- | --- | --- | --- | --- | --- |
| Account settings panel save | `atlas.app_config_documents` (`singlepane/account_settings/runtime-v1`) | fixed config key | upsert | `loadAccountSettings()` during bootstrap | persisted contract active |
| Role switch dropdown | transient UI selection | n/a | session state only (intended view-mode switch) | n/a | intentionally non-persistent view control |

## Verification Snapshot

- Build verification: `npm run build` passes after persistence refactor.
- Continuity checks run in code contracts:
  - create/update/read path exists for account settings, intake, route assignment, route logs.
  - partner service capacity draft/completed lifecycle remains Supabase-backed.
  - unsupported controls are now explicitly guarded (disabled `refer`, filtered non-persistent admin action labels).

## Live Browser Verification (This Session)

- **Passed**
  - Partner service capacity draft continuity: created/updated draft, returned to history, and observed persisted draft row `457d4b25-efea-4130-b00e-0eb56adec2d1`.
  - Reload continuity for partner draft: after `reload + short wait`, same draft row rehydrated in record management and `resume draft` re-enabled.
  - Partner `my station` guard behavior: `refer` rendered disabled as intended for no-contract action path.
- **Blocked**
  - Navigator, supervisor, and admin live click-through flows were not fully automatable in MCP snapshot mode because only `Account Settings` exposed accessible interactive refs on `/`; menu/action controls are rendered without actionable accessibility refs in this session, so deterministic click automation for those screens could not be completed via MCP interaction alone.
- **Notes**
  - One intermediate snapshot right after reload briefly showed no draft; data rehydrated after an additional wait interval, indicating async history hydration timing rather than data loss.
