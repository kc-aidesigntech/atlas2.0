# Atlas (ATLAS) 2026 Legacy Retirement Checklist

## Runtime Cutover Checklist

- [x] App root replaced with `src/features/atlas2026/AtlasShell.jsx`.
- [x] Legacy enrollment/resource/referral pages removed from mounted navigation.
- [x] Brief-native surfaces present: situational awareness, precision navigation, collective memory.
- [x] Decision-core contract introduced (`src/core/atlas2026/intel-contract.js`).
- [x] Canonical ontology and constraints defined (`src/core/atlas2026/canonical-spec.js`).
- [x] Clean-break data model and lifecycle states defined (`src/core/atlas2026/data-model.js`).
- [x] Role policy boundaries enforced in app logic (`src/core/atlas2026/policy.js`).
- [x] Firestore rules enforce read-only legacy collections and scoped canonical writes.

## Validation Checklist

- [ ] Confirm no route in User Interface (UI) links to legacy enrollment/resource/referral pages.
- [ ] Verify role-scoped actions in precision navigation for each role.
- [ ] Verify unverified memory events are visually distinct from verified events.
- [ ] Validate route recommendation explainability payload rendering.
- [ ] Validate Firestore rule behavior in emulator for all five roles.

## Post-Cutover Cleanup Tasks

- [ ] Remove unused legacy modules after one release cycle and archive in docs.
- [ ] Add server-backed ATLAS-INTEL endpoint implementation behind current contract.
- [ ] Replace demo topology with live county/station data ingestion pipeline.

