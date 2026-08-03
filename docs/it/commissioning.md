# Commissioning Runbook (IT)

Bring Atlas from an empty Supabase project to a working app. For migration-by-migration detail and failure signatures, use the deep appendix [HOW_TO_COMMISSION_SYSTEM.md](../HOW_TO_COMMISSION_SYSTEM.md).

## Two valid targets

### Target A — Partner survey first (fastest)

Use when you need Z-code service-capacity save/load quickly.

- App route: `/service-capacity-survey`
- Does **not** require full single-pane runtime cutover
- Keep `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false` until Target B is ready

### Target B — Full single-pane runtime

Use when `/` (or `/app`) must show navigator / partner / supervisor / administrator operational content from Supabase.

- Requires the full migration chain, runtime views/grants, identity bridge, and seeded reference data
- Set `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true` only after runtime objects and identity exist

## Environment

Copy [`env.template`](../../env.template) to `.env` / `.env.local` (and to Heroku config for `atlas-simplified` when deploying).

Required for Supabase-connected paths:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...   # server / CLI commissioning only — never VITE_*
VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=false
```

Optional integrations:

- Model Context Protocol (MCP): `VITE_ATLAS_MCP_BASE_URL`, `VITE_ATLAS_MCP_BEARER` — see [mcp-consumer.md](./mcp-consumer.md)
- Maps: `VITE_GOOGLE_MAPS_API_KEY`
- AlayaCare broker (no client secrets in `VITE_*`): see `env.template`

## Procedure (summary)

1. `npm install`
2. Configure environment as above
3. Apply `supabase/migrations/` in timestamp order (Supabase Command-Line Interface (CLI) `db push`, Studio, or team runner). Prefer the live folder over any archived copies.
4. Seed Z-code / capability reference data as needed ([Example_records.md](../Example_records.md), commissioning appendix)
5. Configure Auth providers and identity bridge — [auth-and-identity.md](./auth-and-identity.md)
6. For Target B: enable bootstrap flag, sign in, confirm shell loads without silent empty states
7. Run verification: `verification/prod_commission_verify.sql` (production-like) or `verification/pilot_verify.sql` (pilot only)
8. Before any real site: [production-go-live-hard-gates.md](../production-go-live-hard-gates.md)

## Local app

```bash
npm run dev
```

- Public landing / referral: `http://localhost:5173/`
- Workspace (when commissioned): `http://localhost:5173/app`
- Standalone survey: `http://localhost:5173/service-capacity-survey`

## Common failure modes

| Symptom | Likely cause | First check |
|---------|--------------|-------------|
| Empty shell / placeholder | Target B not commissioned or bootstrap off | Migrations + `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP` |
| Red permission banner | RLS deny (expected if identity/role missing) | `atlas.people` + role assignment |
| Survey save fails | Missing survey migrations / RPC grants | Commissioning appendix migration list |
| Inference / reflection fails | MCP down or bearer mismatch | [mcp-consumer.md](./mcp-consumer.md) |

## Related

- [supabase/README.md](../../supabase/README.md)
- [database.md](./database.md)
- [security.md](./security.md)
