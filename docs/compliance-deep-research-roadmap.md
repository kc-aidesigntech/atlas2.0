# Compliance Deep Research Roadmap (SOC 2 + HIPAA-Aligned)

**Date:** 2026-05-03  
**Prepared by:** Documentation Specialist workflow with parallel deep-research analysis  
**Policy anchor:** `docs/executive-compliance-security-policy.md`  
**Operational checklist:** `docs/compliance-control-owner-checklist.md`

## Purpose

This roadmap translates deep-research findings into a practical 30/60/90-day implementation plan to move ATLAS toward audit-ready SOC 2 operation and HIPAA-aligned privacy/security controls.

This document is implementation guidance, not legal advice.

## Validated High-Risk Findings (Repository-Grounded)

1. Client-side secret exposure risk:
   - `src/services/alayacare-client.js`
   - `env.template`
2. Legacy public access toggles defaulted true in authorization migrations:
   - `supabase/migrations/20260411_authorization_foundation.sql`
   - `supabase/migrations/20260415_example_records_seed.sql`
3. Local browser persistence pattern for continuity/offline:
   - `src/features/atlas2026/singlepane/data-access/localStateRepository.ts`
4. Operational admin write path currently browser-centric and noted for hardening:
   - `docs/multi-role-identity-access-matrix.md`

## Target Outcome by Day 90

- Critical exposure paths remediated and verified.
- Core SOC 2 evidence loop operating (access reviews, change controls, logging evidence, incident process).
- HIPAA-aligned administrative/technical safeguards materially implemented and demonstrable.
- Control owners assigned with linked evidence artifacts for all top-priority controls.

## 30/60/90 Plan

## Day 0-30 (Containment and Governance Activation)

- [ ] **Engineering + Security:** Move third-party token exchange and secrets to server-side execution only; rotate affected secrets.
- [ ] **Engineering + DBA/Security:** Disable and verify all `allow_legacy_public_partner_capacity_*` toggles in production.
- [ ] **Security + Compliance:** Assign named control owners for each line in `docs/compliance-control-owner-checklist.md`.
- [ ] **Engineering Leadership:** Enable mandatory PR review and merge protections for production branches.
- [ ] **Security + Operations:** Establish incident severity matrix, escalation contacts, and breach decision workflow.
- [ ] **Privacy + Legal:** Start subprocessor and BAA register with critical vendors first.

**Evidence expected by Day 30**

- Secret rotation records and architecture change PRs.
- Production query/export proving unsafe toggles disabled.
- Owner-attested checklist with status for each control family.
- Branch protection screenshots or policy exports.
- Incident and breach runbook v1.
- Initial vendor/BAA inventory.

## Day 31-60 (Control Implementation and Automation)

- [ ] **Engineering + Security:** Replace browser-direct admin matrix writes with controlled server-side mutation endpoints/functions.
- [ ] **Engineering:** Introduce CI controls: build/typecheck, dependency scan, secret scan, and policy fail gates.
- [ ] **Engineering + Security:** Build integration tests for authorization/RLS deny/allow behavior on critical data paths.
- [ ] **Security + Operations:** Centralize security-relevant logs and implement baseline alerting.
- [ ] **Privacy + Legal + Engineering:** Publish retention schedule by data class and implement first deletion workflow.
- [ ] **Operations:** Define RTO/RPO and complete initial backup restore test.

**Evidence expected by Day 60**

- Deployed service-side admin mutation path with audit log records.
- CI pipeline history and policy gates.
- Test reports for key authz scenarios.
- Log-source inventory, retention config, and alert review records.
- Retention matrix and deletion runbook artifacts.
- Restore test report with corrective actions.

## Day 61-90 (Audit-Readiness and Rehearsal)

- [ ] **Security + Compliance:** Build SOC 2/HIPAA evidence index mapped to control families and owners.
- [ ] **Security + Privacy + Legal:** Run tabletop incident exercise and breach-notification dry run.
- [ ] **Engineering + Security:** Complete remediation of remaining high findings and document compensating controls for exceptions.
- [ ] **Compliance + Leadership:** Conduct internal mini-audit on sampled controls and evidence quality.
- [ ] **Leadership:** Approve ongoing quarterly operating cadence and unresolved risk acceptance decisions.

**Evidence expected by Day 90**

- Control-to-evidence index with artifact links.
- Tabletop and postmortem/corrective action records.
- Exception log with expiry and approval records.
- Internal readiness review package and leadership attestation.

## Priority Backlog (Impact-First)

1. Remove secrets from client runtime and rotate.
2. Disable legacy public access toggles and enforce permission paths.
3. Move admin data mutations behind trusted service boundary.
4. Replace sensitive local persistence behavior where data may include regulated content.
5. Stand up CI security/control gates and branch protection.
6. Implement evidence-producing access review process (quarterly).
7. Operationalize incident response and breach communications.
8. Complete vendor/BAA governance process.
9. Implement retention/deletion with legal hold workflow.
10. Establish BC/DR testing and recurring reporting.

## Governance Cadence After Day 90

- Monthly: control owner review and overdue remediation check.
- Quarterly: access reviews, risk register review, exception renewal decisions, leadership status report.
- Semiannual: incident tabletop and breach communication rehearsal.
- Annual: policy refresh, data flow revalidation, DR full restore validation.

## Suggested Reporting Metrics

- Percent of controls with assigned owner and current evidence.
- Number of overdue high-risk remediations.
- Privileged access review completion rate.
- Mean time to patch critical vulnerabilities.
- Incident response exercise completion and closure rate.
- Vendor reassessment completion rate for critical processors.
