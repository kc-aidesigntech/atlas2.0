# Repository Cutover Map

This is the implementation map used for the clean-break transition.

## Decomposition Performed

1. Retired monolithic User Interface (UI) entrypoint in `src/App.jsx` and replaced with `src/features/atlas2026/AtlasShell.jsx`.
2. Established decision-core modules under `src/core/atlas2026/`:
   - `canonical-spec.js`
   - `data-model.js`
   - `intel-contract.js`
   - `policy.js`
3. Introduced feature orchestration layer under `src/features/atlas2026/`:
   - `sample-data.js`
   - `useAtlasDecisioning.js`
   - `AtlasShell.jsx`

## Brief-Native Surface Mapping

- Situational awareness: pressure vectors and explainability snapshot.
- Precision navigation: route recommendation list with interference controls.
- Collective memory: verification-gated strip events.

## Legacy Flow Retirement

- Legacy enrollees/resources/referrals dashboard pathways are no longer mounted in app root.
- Legacy app behavior remains in git history only; runtime entrypoint now serves 2026-native command center.

