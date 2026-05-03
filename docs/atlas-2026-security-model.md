# Atlas (ATLAS) 2026 Security and Governance Model

## Role Model

- `peerNavigator`: can evaluate participants, activate routes, append memory events.
- `stationOperator`: same as peer navigator for station-level execution.
- `regionalDirector`: can evaluate and write operational updates, cannot mutate ontology.
- `governanceAdmin`: governance authority for ontology and destructive writes.
- `readOnlyFunder`: read-only observability; no operational mutation.

## Policy Boundaries

- Decision actions are scoped in `src/core/atlas2026/policy.js`.
- Contract-level behavior is defined in `src/core/atlas2026/intel-contract.js`.
- Firestore enforcement is in `firestore.rules` under `/artifacts/{appId}/atlas2026/*`.

## Datastore Posture

- Canonical write paths:
  - `atlas2026/participants`
  - `atlas2026/routes`
  - `atlas2026/memoryEvents`
  - `atlas2026/capacityTopology` (governance-managed)
  - `atlas2026/ontology` (governance-managed)
- Legacy paths are read-only for migration audit and runtime comparison.

## Safety Constraints

- No writes by unauthenticated users.
- No writes to legacy collections in clean-break mode.
- Governance-only ontology updates to prevent drift outside canonical brief constraints.

