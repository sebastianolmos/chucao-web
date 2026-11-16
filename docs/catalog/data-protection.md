# Data Protection Catalog

## Purpose and scope

Criteria and checks for privacy, personal-data processing, and applicable obligations across web, desktop, mobile, CLI, libraries, and other software.

**Legal scope:** Chilean Law 19.628, including the amendments introduced by Law 21.719 effective **1 December 2026**. Legal references checked on **13 November 2026**. Confirm the law in force on the processing date, applicable sector rules, other jurisdictions, and current authority guidance.

This catalog combines legal requirements with engineering practices. The checks are implementation examples, not verbatim legal mandates or an exhaustive compliance assessment. Select controls according to actual processing and risk. A legal obligation cannot be waived merely because a project is small; optional complexity should not be added without a reason.

For selected criteria, record **Met / Pending / Not applicable**, a short rationale, and evidence. “Not applicable” requires a reason; missing tooling is not one. Resolve material uncertainty about legal applicability before enabling the affected processing.

## Criteria and checks

### DP01. Applicability and accountability

**Criterion:** Identify applicable rules, the controller deciding purposes and means, processors acting on its behalf, and the person responsible for handling privacy matters.

**Check:** Consider activities, people, locations, and statutory exceptions. Do not infer exemption from being free, lacking a database, or using foreign hosting. A personal-activity exception requires analysis; a public portfolio application is not automatically exempt. Programming the software does not automatically make its developer the controller.

### DP02. Data inventory and lifecycle

**Criterion:** Know which personal data is collected, generated, received, and disclosed, whose data it is, and where it travels.

**Check:** Include accounts, files, IP addresses, device identifiers, activity, inferences, logs, email, telemetry, and people mentioned by users. Trace devices, servers, databases, caches, queues, backups, and vendors through deletion. Inspect changed fields, payloads, events, and integrations for unrecorded data flows. Pseudonymized or hashed identifiers are not automatically anonymous.

### DP03. Purpose, necessity, and lawful basis

**Criterion:** Give each processing purpose a documented lawful basis and collect only necessary data. Separate service delivery, security, analytics, and marketing.

**Check:** Remove “just in case” fields; distinguish required and optional inputs. Inspect actual requests, responses, storage, and logs for excess data. Assess new uses before activation. Terms acceptance and public availability do not authorize unrestricted reuse. Where relying on legitimate interests, document the interest and assessment of effects on people's rights.

### DP04. Sensitive data and minors

**Criterion:** Identify special categories and age-related restrictions before processing them.

**Check:** Detect health, biometric, and other sensitive data, including inferred information and user uploads. Determine applicable permissions, age rules, guardian involvement, and restrictions. Verify relevant collection and access controls. A generic consent checkbox is insufficient; avoid collecting identity or age evidence beyond what is necessary.

### DP05. Providers and international transfers

**Criterion:** Understand each recipient's role, processing conditions, and the lawful mechanism for international transfers.

**Check:** Record data sent, purposes, processing locations, subprocessors, retention, incident notification, and deletion or return arrangements. Review applicable processing agreements and transfer safeguards. Include hosting, identity, email, analytics, support, and AI services. Inspect actual outbound traffic and test relevant deletion paths. A vendor's popularity, certification, or chosen hosting region alone does not establish compliance.

### DP06. Consent and withdrawal

**Criterion:** Where consent is the basis, obtain a prior, informed, specific, freely given affirmative choice and retain proportionate evidence.

**Check:** Test acceptance, refusal, and accessible withdrawal, separately for distinct purposes where appropriate. Verify consent-dependent processing does not start before acceptance and stops after withdrawal, including queued work and vendor processing. Record what was accepted and when, with the notice version. Distinguish withdrawal from account closure and retention justified by another lawful basis.

### DP07. Cookies, SDKs, and telemetry

**Criterion:** Device storage, tracking, diagnostics, and third-party SDKs must match declared purposes and applicable legal requirements.

**Check:** Inspect network activity and device storage on first launch, before choices, after refusal, and after withdrawal. Disable unnecessary collection; gate processing requiring consent. Include crash reports, embedded content, advertising identifiers, and session replay. Do not assume every cookie requires consent or that a banner alone makes tracking lawful.

### DP08. Accurate and accessible privacy information

**Criterion:** Keep understandable privacy information consistent with actual processing. Under the applicable Chilean regime, publish the required information permanently through a website or equivalent medium, including policy date and version.

**Check:** Cover controller/contact details, data and sources, purposes and lawful bases, recipients, retention, rights and complaint channels, applicable transfers, withdrawal, automated decisions, and security information at an appropriate level. Check access without an account, working links, and updates after processing changes. A particular URL or footer placement is a design choice.

### DP09. Notice at collection

**Criterion:** Explain the immediate use of requested data clearly at the point of collection, with access to full privacy information.

**Check:** Review registration, uploads, forms, permissions, and imported data flows. Ensure the explanation is available before submission and matches the requested fields and purpose. For graphical interfaces, test visibility and link access; provide an appropriate equivalent for other interfaces. A privacy notice does not itself obtain consent.

### DP10. Privacy defaults, authorization, and isolation

**Criterion:** Default exposure and permissions must be limited to what is necessary. Enforce access at the trusted component controlling the resource.

**Check:** Start with a new account and examine visibility, sharing, and optional uses. Attempt cross-user and, where applicable, cross-organization access, modification, download, and deletion directly through interfaces. Include searches, exports, files, background jobs, and administrator access. For local software, examine device permissions and shared storage. Hidden buttons are not access controls.

### DP11. Identity and account lifecycle

**Criterion:** Define where identity, credentials, sessions, and user content live and how they remain linked.

**Check:** Trace registration, login, recovery, and social login through every provider. Change an email address and confirm ownership persists without exposing another account's resources. Test account linking if supported. With two sessions, verify the distinct effects of local logout, all-session revocation, and account deletion, including previously issued sessions and credentials.

### DP12. Security controls and encrypted transport

**Criterion:** Protect confidentiality, integrity, availability, and recovery with measures proportionate to the data and risk.

**Check:** Review secrets, credential handling, session protections, dependencies, and access privileges. For deployed network flows carrying personal data or credentials, verify authenticated encryption such as TLS; for web endpoints, check HTTPS, valid certificates, and Secure session cookies. Assess encryption at rest and key access. Define where MFA is required, including vendor administration, and verify enforcement and recovery. TLS and MFA are engineering controls; do not describe universal 2FA as an explicit mandate of Law 21.719.

### DP13. Accidental disclosure

**Criterion:** Personal data must not leak through auxiliary outputs or unrestricted copies.

**Check:** Inspect errors, URLs, browser history, caches, emails, notifications, temporary files, object storage, exports, logs, and observability tools. Redact unnecessary values and restrict recipients, access, and retention. Verify that diagnostic output does not expose credentials or other users' data. Consider shared-device behavior where relevant.

### DP14. Retention, erasure, and account deletion

**Criterion:** Set justified retention periods or rules, starting events, deletion methods, and applicable exceptions for each data category.

**Check:** Test expiry and erasure across identity providers, application content, files, indexes, caches, and vendors. Distinguish closure, suspension, soft deletion, and actual erasure. A deleted flag alone is insufficient evidence. Detect partial failures and support safe retry. Restrict justified retained records and expire them when their purpose ends. Validate any claimed anonymization against re-identification risk.

### DP15. Rights handling, access, and portability

**Criterion:** Provide an accessible process for applicable data-subject rights, with ownership, proportionate identity verification, response deadlines, and secure delivery.

**Check:** Submit a synthetic request; verify acknowledgment, data location, completeness, response tracking, and absence of third-party disclosure. Check applicable deadlines, extensions, refusals, and escalation rules rather than assuming one deadline covers every request. Test structured export and portability where legally applicable; portability and access have different conditions. A workable manual process may suffice where permitted; dedicated automation is not always necessary.

### DP16. Accuracy and rectification

**Criterion:** Keep data appropriate and accurate for its purpose, and propagate corrections where required.

**Check:** Correct a test record and verify subsequent outputs, replicas, caches, integrations, and imports. Ensure stale values are not silently restored. Notify recipients of corrections when required and track failures. Preserve only justified historical records with appropriate restrictions.

### DP17. Objection, restriction, and processing suspension

**Criterion:** Give applicable objections and temporary processing restrictions an operational effect.

**Check:** Verify marketing, analytics, scheduled work, queued messages, and vendor flows respect restrictions. Distinguish stopping use from deleting storage. Test the handling of a restriction request while another rights request is pending, including its applicable response time. Retain only the minimal information necessary to enforce the restriction and other lawful obligations.

### DP18. Backups and restoration

**Criterion:** Recovery must preserve privacy decisions and maintain justified backup retention.

**Check:** Document backup access, expiry, and how erasure or restrictions apply to retained copies. Test restoration when the mechanism changes or risk warrants it. Reapply deletions and restrictions before restored data returns to normal use. Ensure recovery does not silently reactivate accounts, permissions, or prohibited processing. Do not promise immediate removal from backups if the actual mechanism differs.

### DP19. Development, testing, and AI tools

**Criterion:** Auxiliary environments and tools must not receive unnecessary personal data or production access.

**Check:** Prefer synthetic data. Review fixtures, prompts, screenshots, tickets, logs, repositories, and agent permissions. Separate environments and restrict credentials. Assess providers' storage, training use, retention, and onward transfers before sending personal data. Sanitization must remove identifying content, not just names. Keep verification evidence itself free of unnecessary personal data.

### DP20. High-risk processing and automated decisions

**Criterion:** Assess privacy risk and any required impact assessment before the affected processing begins. Identify automated decisions with legal or similarly significant effects.

**Check:** Reassess when scale, monitoring, sensitive data, minors, profiling, or technology changes. Check statutory impact-assessment triggers and current guidance; document the conclusion and mitigations. For qualifying automated decisions, verify applicable transparency, explanation, human intervention, and review mechanisms. Test that review can actually change an outcome rather than merely acknowledge a complaint.

### DP21. Incident detection and response

**Criterion:** Assign responsibility for detection, containment, investigation, evidence preservation, recovery, and required notifications.

**Check:** Confirm alerts, contacts, provider escalation, and a concise response procedure. Run proportionate exercises. Record affected data, people, impact, actions, and notification decisions. Determine the authority and affected-person notification triggers and timing under applicable law; do not import a deadline from another jurisdiction by default.

## Evidence and unresolved obligations

Link applicable criteria to tests, configurations, contracts, decisions, or reproducible manual reviews. Recheck affected controls when processing changes; do not repeat every manual check for every commit.

A passing technical test does not establish a lawful basis, validate a contract, or prove overall legal compliance. Keep unresolved obligations visible, including an owner and required resolution point. Do not mark a criterion met solely because a feature, vendor setting, policy draft, or planned test exists.

## Legal references

- [Law 19.628 — consolidated text effective 1 December 2026](https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2026-12-01).
- [Law 21.719 — amendments and transitional provisions](https://www.bcn.cl/leychile/navegar?idNorma=1209272).

Reference areas: scope and principles (arts. 1–3); rights and automated decisions (arts. 4–11); lawful processing (arts. 12–13); transparency, privacy by design, security, and incidents (arts. 14–14 sexies); processors and impact assessments (arts. 15 bis–15 ter); special categories (arts. 16–16 quinquies); international transfers (arts. 27–29). Check the applicable text and supplementary rules for case-specific requirements.
