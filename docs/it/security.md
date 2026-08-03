# Security and Compliance Index (IT / IS)

Atlas uses a **database-first** access model. The User Interface (UI) never silently invents empty data to hide a permission failure.

## Canonical security documents

| Document | Audience | Role |
|----------|----------|------|
| [security-model.md](./security-model.md) | IS / engineering | Authoritative access-control model, phases, known residuals |
| [rls-inventory.md](./rls-inventory.md) | IS / ops | Live Row-Level Security (RLS) inventory and rollout notes |
| [production-go-live-hard-gates.md](../production-go-live-hard-gates.md) | IT / IS | Non-negotiable production cutover gates |
| [executive-compliance-security-policy.md](../executive-compliance-security-policy.md) | Executive / IS | System and Organization Controls 2 (SOC 2) + Health Insurance Portability and Accountability Act (HIPAA) policy |
| [executive-compliance-policy-summary.md](../executive-compliance-policy-summary.md) | Leadership | Short policy summary |
| [compliance-control-owner-checklist.md](../compliance-control-owner-checklist.md) | Control owners | Ownership and evidence checklist |

## Principles (summary)

1. Reads via scoped RLS; reporting views use `security_invoker` where person-level Protected Health Information (PHI) is involved.
2. Writes via validated `SECURITY DEFINER` command Remote Procedure Calls (RPCs); direct table writes revoked from `authenticated` on submission tables.
3. Anonymous surface is minimal: public Z-code reference + public referral insert.
4. Warehouse / internal data-warehouse views are **service-role only**.
5. Pilot `@atlas.test` accounts must **never** exist in production.

## When security behavior changes

Update `security-model.md` and `rls-inventory.md` in the same work session, then re-check production hard gates.
