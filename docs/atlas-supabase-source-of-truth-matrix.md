# Atlas (ATLAS) Supabase Source Of Truth Matrix

## Scope
This matrix inventories the remaining manual, demo, JavaScript Object Notation (JSON), Comma-Separated Values (CSV), Firebase, and `localStorage` driven data planes across the repo and assigns each one to a Supabase-backed destination.

## Classification
- `existing view/table`: can move onto an already-present `atlas` schema object.
- `new table/view`: requires new schema introduced by this cutover.
- `code only`: stays in code because it is purely visual or presentation-only.

## Matrix
| Current source | Current location | Kind | Supabase destination | Notes |
| --- | --- | --- | --- | --- |
| Assigned enrollee list | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_singlepane_enrollee_profiles` | Replaces CSV bootstrap rows with active enrollment projection. |
| Enrollee domain loads | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | new table/view | `atlas.v_singlepane_enrollee_domain_loads` | Derived from active enrollee Z-codes and category mapping. |
| Enrollee load breakdown rows | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | new table/view | `atlas.v_singlepane_enrollee_domain_load_breakdown` | Preserves current per-group breakdown User Interface (UI). |
| Role menus and action menus | `src/features/atlas2026/singlepane/data-access/localCsvData.ts`, `src/features/atlas2026/data/roles.json` | new table/view | `atlas.app_role_navigation` | Canonical workflow navigation config for `singlepane` and other surfaces. |
| Timeline gates and default duration | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | new table/view | `atlas.app_config_documents(surface='singlepane', config_key='timeline_defaults')` | Workflow-driving timeline config becomes Database (DB)-owned JSON. |
| Enrollment requests | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_navigator_enrollment_requests` | Already modeled in the base schema. |
| County heatmap | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_county_z_code_heatmap` | Already modeled in the base schema. |
| Admin quality metrics | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_admin_data_quality` | Already modeled in the base schema. |
| Partner radial load | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_partner_z_code_burden` | Shared transform computes domain buckets from category counts. |
| Partner identifier search | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.v_partner_identifier_records` | Already introduced in the shared partner survey flow. |
| Service-capacity survey prompts and scale labels | `src/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog.ts` | new table/view | `atlas.app_config_documents(surface='singlepane', config_key='service_capacity_survey')` | Survey definition is now DB-backed config, not code. |
| Route candidates | `src/features/atlas2026/singlepane/data-access/localCsvData.ts` | existing view/table | `atlas.fn_rank_route_candidates`, `atlas.v_navigator_route_candidates` | Weighted route ranking now derives from active enrollee Z-code repeat counts x latest completed partner burden scores, with matched Z-group labels returned for the UI. |
| Journey strip markers | `src/features/atlas2026/singlepane/data-access/singlepaneRepository.ts` | existing view/table | `atlas.v_enrollment_station_markers`, `atlas.journey_logs` | Removes route-history dependence on local archive state. |
| Streamlined instruction BOMs | `src/features/atlas2026/data/repository.ts`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.route_builder_bom_items` | User-editable route-builder dataset becomes transactional data. |
| Streamlined routing steps | `src/features/atlas2026/data/repository.ts`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.route_builder_steps` | Replaces seeded JSON step definitions. |
| Streamlined route templates | `src/features/atlas2026/data/repository.ts`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.route_builder_templates` | Replaces seeded template JSON and enables shared writes. |
| Streamlined journey assignments | `src/features/atlas2026/data/repository.ts`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.route_builder_journey_assignments` | Replaces seeded/shared assignment data. |
| Streamlined participants | `src/features/atlas2026/data/repository.ts`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.v_route_builder_participants` | Derived from live active enrollments instead of seed files. |
| Mobile seeded participant cards and journey fallback | `apps/mobile/app/(app)/navigation.tsx`, `packages/shared/src/atlas2026/routing.ts` | new table/view | `atlas.v_route_builder_participants`, `atlas.route_builder_journey_assignments` | Mobile now uses the same shared Supabase route-builder surface. |
| Legacy participant states | `src/features/atlas2026/sample-data.js`, `src/features/atlas2026/useAtlasDecisioning.js` | new table/view | `atlas.legacy_atlas_participants` | Supabase-backed runtime state for the legacy shell. |
| Legacy capacity topology | `src/features/atlas2026/sample-data.js`, `src/features/atlas2026/useAtlasDecisioning.js` | new table/view | `atlas.legacy_atlas_capacity_nodes` | Replaces Firebase collection and in-code demo topology. |
| Legacy active routes | `src/features/atlas2026/useAtlasDecisioning.js`, `src/services/atlas2026/contract-gateway.js` | new table/view | `atlas.legacy_atlas_routes` | Replaces Firebase route collection. |
| Legacy route steps | `src/features/atlas2026/useAtlasDecisioning.js`, `src/services/atlas2026/contract-gateway.js` | new table/view | `atlas.legacy_atlas_route_steps` | Replaces Firebase route step collection. |
| Legacy memory events | `src/features/atlas2026/useAtlasDecisioning.js`, `src/services/atlas2026/contract-gateway.js` | new table/view | `atlas.legacy_atlas_memory_events` | Replaces Firebase memory collection. |
| Legacy ontology weights, audit trail, renewal roles | `src/features/atlas2026/useAtlasDecisioning.js`, `src/services/atlas2026/contract-gateway.js` | new table/view | `atlas.legacy_atlas_ontology_weights`, `atlas.legacy_atlas_ontology_audit`, `atlas.legacy_atlas_renewal_roles` | Replaces Firebase governance collections. |
| Legacy roles, phases, policy boundaries, pressure domains, ecosystem labels | `src/core/atlas2026/canonical-spec.js`, `src/core/atlas2026/policy.js` | new table/view | `atlas.app_config_documents(surface='legacy_atlas', config_key='runtime_config')` | Workflow-driving taxonomy/config moves into DB-owned JSON. |
| Theme colors and visual primitives | `packages/shared/src/atlas2026/theme.ts`, `src/features/atlas2026/components/AtlasPrimitives.tsx`, CSS variables | code only | code only | Pure presentation constants stay in code. |

## Remaining local-only behaviors after cutover
- `localStorage` account settings remain an explicit device-local draft/cache, not a source of truth.
- `localStorage` intake forms and route-assignment scratch state remain explicit user drafts until corresponding write paths are modeled server-side.
- UI-only text and visual tokens remain code-owned.
