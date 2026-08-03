# Atlas IT / Information Systems Documentation

Start here if you commission environments, manage identity and access, enforce security, operate integrations, or run analytics extracts.

## Operating path (recommended order)

1. [Commissioning](./commissioning.md) — bring Supabase + the web app up (survey-first or full shell).
2. [Auth and identity](./auth-and-identity.md) — providers, `atlas.people` bridge, role assignment.
3. [Security](./security.md) — database-first model, Row-Level Security (RLS), compliance, production gates.
4. [Database](./database.md) — schema map, RPCs, source-of-truth matrix.
5. [MCP consumer](./mcp-consumer.md) — Atlas ↔ Model Context Protocol (MCP) handshake (inference / reflection).
6. [Warehouse and Power BI](./warehouse-and-powerbi.md) — extract contracts and semantic model.
7. Go-live: [production-go-live-hard-gates.md](../production-go-live-hard-gates.md) and [partner-go-live-checklist.md](../partner-go-live-checklist.md).

## Quick reference

| Need | Document |
|------|----------|
| Env vars template | [`env.template`](../../env.template) |
| Full commissioning deep-dive | [HOW_TO_COMMISSION_SYSTEM.md](../HOW_TO_COMMISSION_SYSTEM.md) |
| Live RLS inventory | [rls-inventory.md](./rls-inventory.md) |
| Authoritative security model | [security-model.md](./security-model.md) |
| Compliance policy (full) | [executive-compliance-security-policy.md](../executive-compliance-security-policy.md) |
| Control owners | [compliance-control-owner-checklist.md](../compliance-control-owner-checklist.md) |
| Pilot accounts (non-production only) | [../users/pilot-guide.md](../users/pilot-guide.md) |
| Supabase migration notes | [`supabase/README.md`](../../supabase/README.md) |

## Principles

- **Database-first access.** The User Interface (UI) role switcher does not grant data. RLS and command Remote Procedure Calls (RPCs) do.
- **No pilot identities in production.** `@atlas.test` accounts and shared pilot passwords fail go-live gates.
- **Never put service-role or secret keys in `VITE_*` variables.**
- **Update this tree when infrastructure behavior changes** (see `.cursor/rules/documentation-sync-on-infra-change.mdc`).
