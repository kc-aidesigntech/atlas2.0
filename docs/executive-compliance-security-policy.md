# Executive Compliance, Health Insurance Portability and Accountability Act (HIPAA) Privacy, and Data Security Policy

**Document owner:** Executive Leadership, Security and Compliance Office  
**Effective date:** 2026-05-03  
**Review cadence:** Quarterly and upon material business, regulatory, or architecture change  
**Applies to:** All Atlas (ATLAS) workforce members, contractors, systems, and third-party processors handling ATLAS data

## 1) Policy Purpose

This policy establishes ATLAS's executive-level governance requirements for:

- System and Organization Controls 2 (SOC 2) control design and operating effectiveness.
- HIPAA-aligned protection of personally identifiable information (Personally Identifiable Information (PII)) and protected health information (Protected Health Information (PHI)).
- Organization-wide data security planning, implementation, monitoring, and continuous improvement.

This policy is mandatory and supersedes conflicting lower-level standards unless an approved exception is granted.

## 2) Scope and Applicability

This policy applies to:

- All production and non-production systems that store, process, transmit, or back up company or customer data.
- All endpoints, applications, APIs, repositories, cloud services, integrations, and data pipelines.
- All personnel and service providers with access to ATLAS data or systems.

This policy covers data in all lifecycle states: collection, use, transmission, storage, archival, sharing, and destruction.

## 3) Governance and Accountability

ATLAS maintains a formal compliance and security governance program with executive oversight.

- Executive Leadership approves this policy and provides resources for implementation.
- Security and Compliance Office maintains controls, risk tracking, and audit readiness evidence.
- Engineering leadership implements technical safeguards and secure development practices.
- Operations leadership maintains incident response, resilience, and recovery capabilities.
- Legal and privacy leadership oversees HIPAA/privacy interpretations, contracts, and regulatory response.
- All workforce members complete required training and comply with this policy.

Control ownership, evidence retention, and review history must be documented and auditable.

## 4) SOC 2 Policy Commitments

ATLAS commits to maintaining a SOC 2 program aligned with the Trust Services Criteria (TSC), including Security as the baseline and additional criteria as contracted (Availability, Confidentiality, Processing Integrity, and Privacy where applicable).

### 4.1 Control Environment and Risk Management

- Maintain formal policies, standards, and procedures approved by management.
- Perform periodic risk assessments covering threats, vulnerabilities, business impact, and control gaps.
- Track remediation plans with owners, due dates, and closure evidence.

### 4.2 Logical and Administrative Access Controls

- Enforce least privilege and role-based access control (Role-Based Access Control (RBAC)).
- Require unique user identities; shared accounts are prohibited except approved break-glass controls.
- Require multi-factor authentication (Multi-Factor Authentication (MFA)) for privileged and production access.
- Review user and privilege assignments at least quarterly and after role changes or termination.

### 4.3 Change Management and Secure Development

- Require peer review and approval for production-impacting code and infrastructure changes.
- Use source control with traceable commit and deployment history.
- Perform security testing proportionate to risk (Static Application Security Testing (SAST)/Dynamic Application Security Testing (DAST)/dependency checks/manual review as applicable).
- Separate environments and restrict direct production changes outside emergency procedures.

### 4.4 Monitoring, Logging, and Incident Response

- Log security-relevant events for access, configuration changes, data access, and privileged actions.
- Protect logs from unauthorized alteration and retain them per evidence retention requirements.
- Maintain incident response runbooks with severity classification, escalation paths, and notification obligations.
- Perform periodic incident response exercises and document lessons learned.

### 4.5 Vendor and Third-Party Risk Management

- Conduct due diligence before onboarding service providers with data access.
- Maintain contractual controls for confidentiality, security requirements, and breach notification.
- Periodically review vendor risk posture and remediate identified gaps.

## 5) HIPAA-Aligned PII and PHI Privacy Policy

ATLAS treats all health-adjacent personal data with a HIPAA-aligned privacy and security posture where required by contract, business associate relationship, or regulated operations.

### 5.1 Data Definitions and Classification

- **PII:** Any data that can identify an individual directly or indirectly.
- **PHI:** Individually identifiable health information created, received, maintained, or transmitted in regulated care contexts.
- Data must be classified at creation and handled according to its highest applicable sensitivity.

### 5.2 Minimum Necessary Standard

- Access, use, and disclosure of PII/PHI must be limited to the minimum necessary to perform an authorized function.
- Workforce members must access only data required for assigned responsibilities.
- Bulk extraction of PII/PHI requires documented business justification and approval.

### 5.3 Permitted Uses, Disclosures, and Authorization

- Use and disclosure of PHI must follow applicable legal basis, contractual terms, and internal authorization controls.
- Uses beyond operational, treatment, payment, or approved business functions require documented authorization or legal basis.
- Third-party disclosures must follow approved contractual controls and privacy review.

### 5.4 Individual Rights and Privacy Operations

- Support timely handling of privacy requests (access, amendment, accounting where applicable, and restrictions per law/contract).
- Maintain auditable request intake, validation, fulfillment, and response records.
- Coordinate Legal, Privacy, and Security review for complex or disputed requests.

### 5.5 HIPAA Administrative, Physical, and Technical Safeguards

- Maintain workforce HIPAA/privacy training and sanctions policy for non-compliance.
- Control facility and device access for systems processing PHI.
- Implement technical safeguards including access controls, audit controls, integrity controls, and transmission protections.

### 5.6 Business Associate Management

- Execute Business Associate Agreements (BAAs) where required before PHI exchange.
- Verify subcontractor flow-down obligations for downstream PHI processing.
- Maintain inventory of PHI-relevant subprocessors and contract status.

## 6) Enterprise Data Security Plan

ATLAS operates a defense-in-depth security program for all regulated and sensitive data.

### 6.1 Data Inventory and Flow Mapping

- Maintain current inventories of systems, datasets, data stores, and integration pathways.
- Document data flows for PII/PHI from ingress through deletion.
- Revalidate inventory and flow maps at least annually or after major architecture changes.

### 6.2 Data Protection Controls

- Encrypt sensitive data in transit using strong modern protocols.
- Encrypt sensitive data at rest using managed key controls and approved cryptographic standards.
- Rotate secrets/keys and restrict plaintext secret exposure.
- Use tokenization, pseudonymization, or de-identification where feasible and appropriate.

### 6.3 Endpoint, Network, and Infrastructure Security

- Harden baseline configurations for servers, cloud resources, and developer endpoints.
- Segment production and sensitive environments from lower-trust zones.
- Use managed detection/prevention controls and vulnerability scanning.
- Apply critical security patches within defined service-level timelines.

### 6.4 Application and Application Programming Interface (API) Security

- Follow secure coding standards and threat-aware design reviews.
- Validate and sanitize untrusted input and enforce strong authentication/authorization paths.
- Protect APIs with rate limiting, logging, and abuse monitoring.
- Conduct periodic penetration testing or equivalent adversarial assessments.

### 6.5 Data Lifecycle, Retention, and Disposal

- Define retention schedules by legal, contractual, and operational requirements.
- Minimize data collection and retention to what is necessary.
- Securely dispose of data at end of retention using verifiable destruction methods.
- Preserve legal holds and regulatory records as required.

### 6.6 Business Continuity and Disaster Recovery

- Maintain backup strategies for critical systems and data with restore testing.
- Define recovery time and recovery point objectives based on business criticality.
- Test continuity and recovery plans at least annually and after major incidents.

## 7) Incident, Breach, and Regulatory Notification

- All suspected security or privacy events must be reported immediately through approved incident channels.
- Security and Privacy leadership must triage and classify incidents by impact and data sensitivity.
- Breach notification timelines and recipients must follow applicable laws, BAAs, and contractual terms.
- Post-incident reviews must produce corrective actions, owners, and completion evidence.

## 8) Training and Awareness

- Security and privacy training is required at onboarding and annually thereafter.
- Role-based training is required for privileged users and teams handling PII/PHI.
- Social engineering and policy awareness reinforcement must be performed periodically.

## 9) Audit, Assurance, and Evidence Retention

- Maintain evidence repositories for SOC 2 and privacy/security audits.
- Control operation evidence must be complete, tamper-resistant, and retrievable.
- Internal control testing and management review must occur at planned intervals.
- Findings must be risk-ranked and remediated under documented corrective action plans.

## 10) Enforcement and Exceptions

- Violations of this policy may result in disciplinary action up to termination and legal escalation.
- Policy exceptions require documented risk acceptance, compensating controls, executive approval, and expiration date.
- Emergency exceptions must be reviewed retrospectively and normalized promptly.

## 11) Policy Maintenance

- This policy is reviewed at least quarterly and updated for legal, contractual, technical, or business changes.
- Significant updates require executive approval and communication to affected teams.
- Superseded versions must be retained according to records management requirements.

## 12) Related Standards and Artifacts

- `docs/atlas-2026-security-model.md`
- System-specific standards (access control, incident response, change management, vendor risk, encryption, and retention)
- Applicable contracts, BAAs, and customer security addenda

---

**Approval:** Executive Leadership  
**Next review due:** 2026-08-03
