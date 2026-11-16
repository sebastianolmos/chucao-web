---
name: spec-task-breakdown
description: Break a clarified specification and its technical plan into ordered, traceable, verifiable tasks without implementing them.
---

# Break a spec into tasks

Create or update `specs/<id>-<increment-name>/tasks.md` from the increment's spec and technical plan. Convert agreed decisions into small, ordered, checkable tasks. Each task has a concrete objective, dependencies, requirement or check references, work, verification, and a verifiable completion condition.

Work with the user in Spanish unless they request another language. Write the task document in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and product-language examples.

This stage ends with a prepared `tasks.md`. Do not implement tasks, deploy, or change infrastructure while generating the breakdown.

## Inputs and source reading

Read applicable repository instructions and the increment's:

- `spec.md`, including acceptance, exclusions, open questions, and references.
- `plan.md`, especially changes, dependencies, risks, traceability, and verification strategy.
- Existing `tasks.md`, if present, preserving IDs, states, and evidence.

Consult relevant sections of:

- `docs/catalog/verification.md`.
- `docs/catalog/data-protection.md`.
- `docs/quality-project.md`.

Use them to check that applicable obligations have concrete work and evidence. Start from the selection in the spec and plan; do not copy catalogs or add every technique.

Consult architecture, flows, design, code, tests, and configuration only to clarify paths, reusable elements, or dependencies. Confirm commands before presenting them as existing. If a source is missing, record what part of the breakdown is conditional. If the active increment is unclear, ask before modifying `tasks.md`.

## Decomposition rules

- Every task contributes to agreed scope or enables a task that does.
- Combine implementation and verification of one behavior when they can be completed together.
- Keep traceability to real requirement, acceptance, and plan-check IDs.
- Technical tasks are valid inside a vertical slice; together, tasks must complete the selected functional journey.
- Size tasks for comprehension, review, and evaluation; use 20–30 minutes only as rough guidance when estimation is reasonable.
- Split independent objectives, excessive decisions, or checks difficult to evaluate together.
- Preserve plan scope and decisions. Significant design changes must be resolved in the plan before becoming agreed work.
- Do not create a per-increment verification file or duplicate suite.
- New tasks begin pending; planning is not completion evidence.

## Procedure

### 1. Check that the plan is task-ready

Identify committed requirements, technical changes, checks, environment preparation, reviews, and documentation updates. Find open decisions that prevent defining an objective or done condition. Distinguish blockers from details the implementer may resolve within the plan.

Proceed with independent tasks. Mark dependent tasks blocked and state the missing decision. Do not hide substantial design inside a task named “implement”.

If the plan includes an investigation, make it a bounded task with question, expected result, and completion criterion. Completing it proves the investigation, not the future functionality.

### 2. Create coherent work units

Group work around small behaviors, rules, contracts, or technical outcomes. For each unit, identify changed or reused parts and scenarios to check. Mark paths as existing or proposed according to the plan.

Avoid vague tasks such as “build the backend,” “add security,” or “test everything.” State which operation, rule, connection, or evidence must be completed. Integrate a bounded vertical journey early when dependencies permit. If tasks are separated by component, explain their connection to the slice result.

### 3. Order dependencies

Assign stable IDs such as `T01` and place tasks in executable order. Distinguish task dependencies from existing project capabilities and external conditions such as test credentials or pending decisions.

Verify that referenced task IDs exist, there are no cycles, and prerequisites precede dependent work. Do not infer a dependency from list proximity; independent tasks may be identified as such without forcing parallel execution.

If a task needs multiple phases before verification, narrow it or add a meaningful intermediate check. Keep an integrated validation step visible.

### 4. Include tests with behavior changes

For functional tasks, include the planned tests and relevant checks. Reference plan check IDs such as `CHECK-01` and summarize the expected scenario/result without copying the entire strategy.

Distinguish:

- Reusable tests added or extended in the project suite.
- Existing regression checks to run.
- Manual, code, security, or design reviews.
- Technical preparation required for those checks.

A task may cover several requirements; a requirement may span tasks and receive a final integrated check. Reserve an independent test task only for a concrete reason, such as a late-available integration, E2E journey, or shared test infrastructure. Do not defer all verification to the end without justification.

### 5. Add preparation and reviews

When required by the plan, include tasks for synthetic data, fixtures, isolated storage, commands, tool configuration, or CI. Each preparation task must state what it unlocks and have a verifiable result. Do not prepare infrastructure for future capabilities outside the slice.

A suite with no discovered tests provides little evidence. For preparation, define a minimal real mechanism/configuration check; never claim success from “0 tests” or weaken failure detection to obtain it.

If CI changes are in the plan, include configuration plus execution and failure-propagation checks. If CI is not planned, retain the reproducible local execution and do not add CI automatically.

Include human reviews for identified risks, stating what is reviewed and what evidence or decision closes it. Do not invent a reviewer name.

### 6. Write done conditions

Every task must have a **Done when** line with an observable result and sufficient checks for its scope. It must state what works, which scenarios pass, and which prohibited effects are absent where relevant.

Avoid circular conditions such as “the task is implemented” or insufficient ones such as “the file exists.” Documentation tasks may close through coherence and reference review without application tests.

Use existing commands for precision. For commands to be created, reference the task that enables them and mark them proposed. Never invent a successful execution result.

Example shape, adapted only to actual project IDs and behavior:

```markdown
- [ ] T03 — Persist and retrieve an owned list
  - Objective: Make a valid list retrievable by its owner after reconnecting.
  - Depends on: T01, T02.
  - References: FR-01, AC-01; persistence plan section; CHECK-02.
  - Work: Implement the planned persistence behavior using existing access rules.
  - Verification: Extend persistence tests with two synthetic users and a new session. Check owner retrieval and denied cross-user access.
  - Done when: The owner retrieves the saved list, the other user cannot access it, and affected checks pass without regressions.
```

### 7. Cover integration, validation, and documentation

Include work needed to demonstrate the vertical journey, run relevant regression, and complete committed reviews. Final validation occurs after functional tasks and may be a closing task or clearly identified checklist.

Do not let all code tasks being checked imply the spec is validated. Closing requires the acceptance and integration evidence defined by the plan.

Include agreed documentation updates linked to the change requiring them. They may be part of a task or a separate task when substantial. Checks restricted to a published environment must state their execution event and applicability condition; keep them pending until that event.

### 8. Check coverage and proportionality

Review the set and ensure:

- Every applicable requirement and acceptance criterion maps to tasks and checks.
- Every important plan check runs in a task or closing activity.
- Quality and privacy obligations have a concrete place.
- Technical tasks enable identified work.
- Planned documentation updates are covered.
- Exclusions remain intact and tasks do not expand the slice.
- The complete journey can be demonstrated at the end.

Use a compact coverage table only if task references do not reveal gaps. Avoid maintaining two large maps with the same information. If the plan has an omission, identify the necessary correction before turning it into an implicit decision; dependent work remains provisional until resolved.

### 9. Prepare states and evidence

Use checkboxes and the repository's state convention. If none exists:

- `[ ]` means pending, in progress, or blocked, with the specific state noted.
- `[x]` means the done condition was actually checked.

A failed or unexecuted mandatory check leaves the task pending or blocked.

When updating an existing file, preserve IDs, evidence, and justified states. If changed requirements require reopening a completed task, record the reason and new pending check. Mark removed or deferred work explicitly with its reason; never mark it complete.

Include a compact section for later evidence by task or shared check. Evidence may be a command result, CI link, artifact, or manual review with expected and observed results. When one execution covers several tasks, reference it once and identify the code version/state it covers. Do not invent results during planning.

### 10. Review and deliver

Read tasks in execution order. Ensure an implementer can identify each task's objective, relevant context, work, verification, and closure. Reduce unnecessary fragmentation, correct dependencies, and preserve important review points.

Save `tasks.md` with a preparation status consistent with actual open decisions. State which tasks are blocked and by what. Finish with the complete breakdown; execution happens later.

## Suggested `tasks.md` structure

1. **Status and references** — source spec and plan, identifiable revision where available, and general blockers.
2. **Tasks** — checkboxes with IDs, objective, dependencies, references, work, verification, and Done when.
3. **Coverage notes** — only when they reveal gaps.
4. **Final validation and conditional checks** — integrated journey, regression, reviews, and deferred checks.
5. **Execution evidence** — compact space for later results.

Simple tasks may combine fields in a few lines; complex tasks should be split before descriptions become unwieldy.

## Completion

The task breakdown should make clear:

- Every task has a concrete objective and verifiable done condition.
- Dependencies are identified and ordered.
- Requirements, acceptance, and checks are traceable.
- Tests accompany relevant functionality.
- Technical preparation and reviews have a stated need.
- Integration and final validation are planned.
- Existing and proposed commands are distinguished.
- Open decisions explicitly affect dependent tasks.
- States reflect actual work and evidence.
- The set preserves a reviewable slice scope and functional outcome.

Deliver a link to `tasks.md`, summarize the work order, and highlight blockers or important reviews. Do not claim tasks are implemented because the list is complete.

## Maintenance

Update task states and evidence as tasks execute. Preserve correspondence with spec and plan. If a task reveals a new decision changing scope or design, resolve it in the appropriate document and adjust pending work. Keep a brief significant-change note.

When splitting a task, preserve useful references and do not reassign IDs already cited. When validating the spec, keep integrated results and future conditional checks locatable.
