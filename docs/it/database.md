# Database Documentation Index (IT)

## Start here

| Document | Use when |
|----------|----------|
| [atlas-2026-database-model.md](../atlas-2026-database-model.md) | Canonical schema architecture and authorization foundation |
| [final-erd-data-contract-pack.md](../final-erd-data-contract-pack.md) | Entity Relationship Diagram (ERD) / warehouse contract pack |
| [sql-rpc-contracts.md](../sql-rpc-contracts.md) | Command Remote Procedure Call (RPC) inventory |
| [atlas-supabase-source-of-truth-matrix.md](../atlas-supabase-source-of-truth-matrix.md) | Which plane owns which data |
| [SQL_SCHEMA.md](../SQL_SCHEMA.md) | Expanded human-readable schema map (may lag migrations) |
| [SQL_SCHEMA_ENGINEERING.md](../SQL_SCHEMA_ENGINEERING.md) | Table-by-table engineering notes (appendix) |
| [sql-simplification-and-warehouse-blueprint.md](../sql-simplification-and-warehouse-blueprint.md) | Canonical views and warehouse blueprint |
| [`supabase/README.md`](../../supabase/README.md) | Migration chain notes |
| [`supabase/migrations_archive/README.md`](../../supabase/migrations_archive/README.md) | Why some migrations are archived |

## Ops rule

Prefer the live `supabase/migrations/` timestamps over any document’s embedded migration list when they disagree. Update the commissioning appendix when the chain changes.
