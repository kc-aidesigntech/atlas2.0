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
- Runtime authorization and Row-Level Security (RLS) live in Supabase/Postgres (see `docs/it/rls-inventory.md` and authorization tables).

## Datastore Posture

- Canonical runtime store is Supabase/Postgres under the Atlas schema.
- Legacy Firebase/Firestore seed tooling under `scripts/` is offline-only and not part of the web runtime.

## Safety Constraints

- No writes by unauthenticated users.
- No writes to legacy collections in clean-break mode.
- Governance-only ontology updates to prevent drift outside canonical brief constraints.

