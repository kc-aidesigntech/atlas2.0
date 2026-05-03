# Executive Compliance Policy Summary (System and Organization Controls 2 (SOC 2) + Health Insurance Portability and Accountability Act (HIPAA) + Data Security)

## Purpose

Atlas (ATLAS) maintains a single executive policy framework to govern SOC 2 readiness, HIPAA-aligned privacy/security handling of Personally Identifiable Information (PII) and Protected Health Information (PHI), and enterprise data security operations.

This summary provides leadership-facing direction. The authoritative policy is `docs/executive-compliance-security-policy.md`.

## Executive Commitments

- Operate and evidence SOC 2 controls across security, access, change, monitoring, and vendor risk.
- Enforce HIPAA-aligned controls for PII/PHI with minimum necessary access and compliant disclosures.
- Maintain a defense-in-depth data security program across people, process, and technology.
- Review compliance posture quarterly and after major legal, operational, or architecture changes.

## Scope

- All workforce members, contractors, and third-party processors.
- All applications, infrastructure, endpoints, data stores, repositories, and integrations.
- All data lifecycle phases: collect, use, transmit, store, archive, and dispose.

## Leadership Accountability

- **Executive Leadership:** approves policy, funds control operation and remediation.
- **Security and Compliance:** owns control framework, risk register, audit evidence, and reporting.
- **Engineering:** implements secure design, secure Software Development Life Cycle (SDLC), and production safeguards.
- **Operations:** owns resilience, incident response, and recovery execution.
- **Legal and Privacy:** governs HIPAA/privacy interpretations, Business Associate Agreements (BAAs), and regulatory obligations.

## Policy Baseline (What must always be true)

- Least privilege and role-based access are enforced.
- Multi-Factor Authentication (MFA) is required for privileged and production access.
- Material production changes are reviewed, approved, and traceable.
- Security-relevant activity is logged, monitored, and retained as evidence.
- Sensitive data is encrypted in transit and at rest.
- Retention and destruction controls are defined and followed.
- Incident response and breach notification procedures are documented and tested.
- Third-party vendors are assessed and contractually bound to security/privacy requirements.

## HIPAA-Aligned Requirements

- PII/PHI is classified and handled at the highest required sensitivity tier.
- Access and disclosure follow the minimum necessary principle.
- PHI exchange requires compliant contractual coverage (including BAAs where required).
- Privacy requests are tracked, validated, and fulfilled within required timelines.

## SOC 2 Operating Rhythm

- Quarterly access and control reviews.
- Periodic risk assessments and remediation tracking.
- Continuous evidence collection for control operation.
- Internal control checks before external audit windows.

## Data Security Operating Rhythm

- Ongoing vulnerability and patch management.
- Backup and restoration testing against defined recovery objectives.
- Periodic incident simulations and post-incident corrective action reviews.
- Annual validation of data inventory, flow mapping, and retention schedule fitness.

## Decision Requests for Leadership

Leadership should require regular reporting on:

- Top compliance risks and overdue remediations.
- Control exceptions and expiration dates.
- Incident trends and response maturity.
- Vendor risk posture for critical processors.
- Audit readiness status by control family.
