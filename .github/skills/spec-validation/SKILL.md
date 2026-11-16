---
name: spec-validation
description: Validate an implemented specification against real evidence, including requirements, tasks, checks, manual scenarios, and the integrated vertical journey, then issue a justified verdict.
---

# Validate a specification

Validate the requested increment by comparing its requirements, tasks, completion criteria, and implementation evidence. Check modified parts and the integrated functional journey, define reproducible manual checks, record results, and issue a justified verdict.

Work with the user and explanations in Spanish. Preserve project documentation and product-message conventions; when no convention exists, use English for persistent documentation.

The project uses SDD: `spec.md` defines behavior, `plan.md` defines implementation and verification, and `tasks.md` defines work and state. Completing every task does not by itself prove the whole increment works.

## Scope and boundaries

Identify the spec folder supplied by the user, such as `specs/001-example/`. If it is missing, consult the tracking mechanism; ask when multiple candidates are possible. Read applicable `AGENTS.md`, `spec.md`, `plan.md`, and `tasks.md`, including doubts and closure conditions.

Inspect relevant code, tests, commands, and existing evidence. Do not assume a checked checkbox means implemented or verified. Consult relevant sections of:

- `docs/catalog/verification.md`.
- `docs/catalog/data-protection.md`.
- `docs/quality-project.md`.

Consult architecture, executable schema, flows, design, and global-plan decisions when needed to interpret contracts, data, permissions, interfaces, or shared constraints. Use agreed visual-reference versions.

If an essential source is missing, state which conclusion is blocked and perform independent checks. Never invent requirements, commands, results, or approved decisions.

Do not add functionality or infrastructure, restore files to obtain a clean run, expose secrets, or run destructive production checks. Use fictitious data and isolated environments. Execute only authorized checks and routine safe preparation. Do not silently fix functional defects during validation; record them and the required work. If the user later authorizes corrections, repeat affected checks against the final state.

Do not create a per-increment `verification.md` or another mandatory permanent report. Use relevant sections of `plan.md` and `tasks.md` and link existing artifacts.

## Procedure

### 1. Determine what must be satisfied

Build a compact relationship among functional requirements, business rules, errors and boundaries, non-functional requirements, selected quality/privacy criteria, acceptance and completion criteria, tasks, affected components, and evidence.

Preserve existing IDs and include conditions outside numbered functional requirements. Review task dependencies, actual implementation, planned tests, required reviews, and done conditions. If a completed task lacks evidence, record the discrepancy and update its state with justification. Do not mark a task failed merely because an integrated check is explicitly assigned to spec closure.

One check may cover multiple requirements and one requirement may need multiple checks. If requirements conflict or are ambiguous, identify the required decision; validate unambiguous portions but do not claim the ambiguous point satisfied through an unapproved interpretation.

### 2. Define manual checks

If the user asks to prepare checks before implementation, define procedures and leave them pending; do not issue a compliance verdict. Put integrated journey, environment, data, and methods in `plan.md`; put local checks or references in relevant `tasks.md` tasks without duplicating procedures.

During final validation, reuse those procedures and fill only omissions preventing verification of agreed requirements. If expected behavior is undefined, ask for clarification rather than inventing a test result.

Select manual checks proportionally. Use them for interaction clarity, visual presentation, practical accessibility, environment integration, configuration, or operations difficult to automate. For a technical task sufficiently covered by automated checks, state why no additional manual check is needed.

Include a representative integrated journey when relevant, using real required components rather than unit-test mocks. Select only relevant empty states, errors, limits, interruptions, retries, persistence, sessions, keyboard, screen sizes, or recovery cases. Do not require browser checks for non-web software or duplicate every automated test.

For each manual check, provide:

- **ID and scope:** task or global journey, requirements, and criteria.
- **Objective:** what it demonstrates.
- **Preconditions:** software state/version, environment, services, accounts, and permissions.
- **Test data:** concrete fictitious values and required initial state.
- **Numbered steps:** precise commands or navigation.
- **Expected results:** observable results and final data/system state.
- **Evidence and cleanup:** what to record and safe cleanup/restoration.
- **Execution:** responsible person, pending/executed state, and observed result when available.

An agent-executed interaction may provide functional evidence but does not replace explicitly required human review or product acceptance. If no human result is supplied, keep it pending.

### 3. Prepare reliable execution

Identify the state under test: base revision, local changes, relevant configuration, and deployed version when applicable. If deployment does not match the reviewed code, limit conclusions explicitly.

Use real project commands and reproducible test data/services. Do not install tools or configure CI solely to fill a list. Reuse earlier evidence only when code, dependencies, configuration, environment, and scope remain relevant; repeat checks affected by changes.

### 4. Execute and assess evidence

Run planned and mandatory checks: relevant tests, regression, build, types, lint, integration, or other required methods. Run the full suite when required or justified by scope/risk.

Check the integrated journey with real required parts. Unit-test mocks do not prove persistence, services, or replaced connections. Review assertions against requirements and agreed examples. Distinguish passed, failed, omitted, not-run, and unstable checks. Zero discovered tests or high coverage does not prove compliance.

Perform manual checks possible with available tools and authorization. For developer-run checks, provide exact steps and expected results, record supplied evidence, and do not claim execution. If no response exists, keep them pending.

Review committed risks such as cross-user permissions, migrations, data loss, resource limits, or recovery. Use property, mutation, load, or other methods only when justified by the increment.

If CI exists, verify relevant change results and distinguish pending from passing. Local execution does not prove CI execution. CI absence is not automatically blocking when it is not required.

Keep pre-existing failures visible, explain their relation to the spec and mandatory controls, and do not repeat unstable checks until obtaining a favorable result without investigation.

### 5. Record results

Add a concise closing matrix to `tasks.md`, using links instead of full logs:

| Requirement or criterion | Related tasks | Test or check | Status and result | Evidence or pending reason |
| --- | --- | --- | --- | --- |
| Existing ID | Existing IDs | Reproducible name/reference | Pass / Fail / Pending / Not applicable | Observed result, reference, or reason |

Record shared date, code state, and environment once. Use “Not applicable” only with a justified inapplicability; never use it to waive a mandatory condition. Distinguish agreed exclusions from unresolved deferrals.

For each defect or block, record affected requirement, reproduction, expected and observed result, impact, and needed work. If a corrective task is needed, leave it pending with traceability and do not start it automatically.

Update task states only when evidence justifies them. Reflect increment status in the global plan using its existing mechanism; do not mark a capability complete when only partially covered. Preserve useful earlier evidence but identify evidence invalidated by later changes.

### 6. Issue the verdict

Use exactly one verdict and explain its scope:

- **Spec met:** all applicable requirements and closure criteria have sufficient evidence, and mandatory checks/reviews are complete.
- **Spec not met:** at least one demonstrated noncompliance exists; list pending checks too.
- **Validation pending or blocked:** evidence, environment, clarification, or mandatory review is missing, so a decision cannot yet be made even if executed checks passed.

If a demonstrated failure and pending checks coexist, verdict is **Spec not met**, with pending items listed. Do not use “met with pending” to hide an unverified mandatory condition.

Do not require deployment unless it is part of the increment criteria. Distinguish increment validation from readiness for a later publication-only check.

## Final response and stopping

Respond in Spanish with:

1. Verdict and increment status.
2. Requirement/task coverage, linking the matrix and detailing gaps.
3. Executed checks and real results.
4. Manual checks the developer must perform, with steps and expected results, or an explicit statement that none remain mandatory.
5. Failures, limitations, reviews, decisions, and next required action.
6. Updated documents and evidence location.

Briefly explain what confidence the evidence provides and what it does not prove. Define necessary technical terms so the developer can reproduce the checks without turning the closeout into an unrelated tutorial.

Stop after recording and reporting the result. Do not select another spec, begin corrective tasks, or publish automatically.

If validation resumes after fixes or manual results, compare new evidence with the current state and repeat affected checks while preserving still-valid evidence.
