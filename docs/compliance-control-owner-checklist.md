# Compliance Control-to-Owner Implementation Checklist

This checklist operationalizes `docs/executive-compliance-security-policy.md` into assigned accountability and recurring evidence expectations.

## How to Use

- Assign a named owner for each control area.
- Track status (`Not Started`, `In Progress`, `Implemented`, `Validated`).
- Link evidence artifacts (tickets, logs, reports, runbooks, approvals).
- Review at least quarterly with leadership and compliance stakeholders.

## 1) Governance and Risk Management

- [ ] **Executive Leadership** - Approve policy set and review cadence.
- [ ] **Security and Compliance** - Maintain risk register with owners, severity, due dates, and closure evidence.
- [ ] **Security and Compliance** - Run periodic risk assessments and document treatment plans.
- [ ] **Legal and Privacy** - Confirm regulatory and contractual obligations are reflected in controls.

## 2) Access Control and Identity Management

- [ ] **Engineering + IT/Security** - Enforce Role-Based Access Control (RBAC) and least privilege for all systems.
- [ ] **Engineering + IT/Security** - Require Multi-Factor Authentication (MFA) for privileged/production access.
- [ ] **IT/Security** - Complete joiner/mover/leaver workflows with auditable records.
- [ ] **Security and Compliance** - Run quarterly access reviews, including privileged accounts.
- [ ] **Engineering** - Eliminate shared accounts except approved break-glass workflows.

## 3) Change Management and Secure Software Development Life Cycle (SDLC)

- [ ] **Engineering Leadership** - Require peer review and approval for production-impacting changes.
- [ ] **Engineering** - Maintain traceability from requirement to code change to deployment.
- [ ] **Engineering + Security** - Run code/dependency/security scanning and triage findings.
- [ ] **Engineering** - Enforce environment separation and emergency-change controls.

## 4) Logging, Monitoring, and Incident Response

- [ ] **Security + Operations** - Define and collect security-relevant logs (auth, privilege, config, data access).
- [ ] **Security + Operations** - Protect log integrity and retention for audit evidence windows.
- [ ] **Operations + Security** - Maintain tested incident response runbooks and severity model.
- [ ] **Legal + Privacy + Security** - Define breach/notification decision tree and escalation contacts.
- [ ] **Security + Operations** - Run incident tabletop exercises and capture corrective actions.

## 5) Health Insurance Portability and Accountability Act (HIPAA)-Aligned Privacy and Protected Health Information (PHI) Controls

- [ ] **Privacy + Security** - Classify Personally Identifiable Information (PII)/PHI handling pathways and required safeguards.
- [ ] **Engineering + Security** - Enforce minimum necessary data access patterns in applications and support tooling.
- [ ] **Legal + Privacy** - Verify Business Associate Agreements (BAAs) are executed before PHI exchange where required.
- [ ] **Privacy Operations** - Implement intake and fulfillment workflow for privacy rights requests.
- [ ] **HR + Compliance** - Deliver annual HIPAA/privacy training and sanctions acknowledgment.

## 6) Data Security Controls

- [ ] **Security + Engineering** - Encrypt sensitive data in transit and at rest.
- [ ] **Security + Engineering** - Implement secret management and key rotation practices.
- [ ] **Operations + Security** - Maintain patching SLAs and vulnerability remediation workflow.
- [ ] **Security + Engineering** - Apply network segmentation and hardened baseline configurations.
- [ ] **Engineering** - Validate Application Programming Interface (API) protections (authz, rate limits, abuse detection, logging).

## 7) Data Lifecycle, Retention, and Disposal

- [ ] **Privacy + Legal + Security** - Publish retention schedule by data class and jurisdictional obligations.
- [ ] **Engineering + Operations** - Implement retention/expiry automation where feasible.
- [ ] **Operations + Security** - Execute secure deletion/destruction controls and retain evidence.
- [ ] **Legal** - Apply legal hold overrides when required.

## 8) Resilience and Recovery

- [ ] **Operations + Engineering** - Define and document Recovery Time Objective (RTO)/Recovery Point Objective (RPO) for critical services.
- [ ] **Operations** - Execute backup coverage and restoration test plans.
- [ ] **Operations + Security** - Run annual Business Continuity and Disaster Recovery (BC/DR) exercises and track remediation actions.

## 9) Vendor and Third-Party Risk

- [ ] **Security + Procurement + Legal** - Complete security/privacy due diligence before onboarding.
- [ ] **Legal + Privacy** - Ensure contracts include security terms, notification commitments, and data-use boundaries.
- [ ] **Security and Compliance** - Reassess high-risk vendors periodically and track findings.

## 10) Audit Readiness and Evidence Management

- [ ] **Security and Compliance** - Maintain control inventory and evidence index by control family.
- [ ] **Control Owners** - Store evidence artifacts in approved repositories with review timestamps.
- [ ] **Security and Compliance** - Perform internal readiness checks before formal audit periods.
- [ ] **Leadership** - Review unresolved findings and approve remediation priorities.

## 11) Exceptions and Enforcement

- [ ] **Security + Compliance + Leadership** - Require written exception requests with compensating controls and expiry.
- [ ] **Leadership** - Approve or reject exceptions based on documented risk acceptance.
- [ ] **Compliance** - Track exception renewals/closures and report overdue exceptions.
- [ ] **HR + Leadership + Legal** - Apply disciplinary and contractual enforcement for policy violations.

## Suggested Status Snapshot (Quarterly)

- [ ] Named owner assigned for every control line item.
- [ ] Evidence location linked for every implemented control.
- [ ] No unapproved exceptions older than approved expiration date.
- [ ] High-risk remediation items have executive-approved timelines.
- [ ] Audit readiness package updated and review-attested.
