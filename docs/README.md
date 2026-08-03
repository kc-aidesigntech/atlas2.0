# Atlas Documentation Hub

This is the single entry point for Atlas documentation. Prefer these trees over root-level markdown (root files are stubs that redirect here).

## Choose your audience

| Audience | Start here | What you get |
|----------|------------|--------------|
| Information Technology (IT) / Information Systems (IS) | [it/README.md](./it/README.md) | Commissioning, auth, security, database, Model Context Protocol (MCP), warehouse/Power BI, go-live |
| End users (navigator, partner, supervisor, admin) | [users/README.md](./users/README.md) | Day-to-day workflows, journey phases, pilot walkthrough |
| Engineering / product | Sections below | Specs, persistence matrices, branding, writing standards |
| Executive / compliance | [it/security.md](./it/security.md) | Policy, control owners, production hard gates |

## Canonical trees

```text
docs/
  README.md                 ← you are here
  it/                       ← IT / IS operating docs
  users/                    ← role and workflow docs
  archive/                  ← obsolete / historical (do not use for ops)
```

## Engineering and product (kept, not duplicated)

| Doc | Use when |
|-----|----------|
| [atlas-2026-canonical-spec.md](./atlas-2026-canonical-spec.md) | Product constraints |
| [atlas-2026-database-model.md](./atlas-2026-database-model.md) | Schema architecture overview |
| [final-erd-data-contract-pack.md](./final-erd-data-contract-pack.md) | Entity Relationship Diagram (ERD) / warehouse contracts |
| [atlas-supabase-source-of-truth-matrix.md](./atlas-supabase-source-of-truth-matrix.md) | Which data plane owns what |
| [SINGLEPANE_PERSISTENCE_MATRIX.md](./SINGLEPANE_PERSISTENCE_MATRIX.md) | UI control → persistence mapping |
| [sql-rpc-contracts.md](./sql-rpc-contracts.md) | Command Remote Procedure Call (RPC) inventory |
| [ZCODE_Master.md](./ZCODE_Master.md) | Z-code taxonomy |
| [Example_records.md](./Example_records.md) | Supabase example seed records |
| [demo.md](./demo.md) | Demo partner-station fixture plan |
| [assignment-identity-continuity-integration-scenarios.md](./assignment-identity-continuity-integration-scenarios.md) | Identity/assignment test scenarios |
| [MAKE_APP_ALIVE.md](./MAKE_APP_ALIVE.md) | Historical execution spec (prefer `it/` + `users/` for ops) |
| [QA.md](./QA.md) | Quality / release checklist (verify against current Supabase runtime) |
| [atlas-branding-style-specification.md](./atlas-branding-style-specification.md) | Visual system |
| [repository-organization-standards.md](./repository-organization-standards.md) | Paths and naming |
| [writing-standards.md](./writing-standards.md) | Acronym and writing rules |

## Archived

Obsolete Firebase-era, duplicate, or time-boxed reports live under [archive/README.md](./archive/README.md). Do not commission or train from archived docs.

## Writing rules

Follow [writing-standards.md](./writing-standards.md) and the acronym first-use rule on every new or edited file.
