---
name: spec-task-implementation
description: Implement one authorized task from a spec, adding relevant tests and real verification evidence, updating task state, and stopping without starting another task.
---

# Implement one spec task

Implement only the task identified by the user, following its spec, technical plan, and applicable repository instructions. Add relevant tests, run the required checks, record real evidence, update that task's state, and stop.

Work with the user in Spanish. Preserve the project's existing languages and conventions for code, documentation, and product messages. When no convention exists, use English for new documentation.

The project uses SDD: the spec defines behavior and acceptance, the plan defines implementation and verification, and `tasks.md` divides the increment into executable work. Integrated spec validation may be a separate task or later stage. Completing one task does not validate the whole spec or authorize the next task.

## Identify the authorized task

Use the path and ID supplied by the user, such as `specs/001-example/tasks.md` and `T02`. If either is missing, consult the existing tracking mechanism. If one candidate is unambiguous, identify it before acting; if several exist, ask for precision.

If the task is already complete, determine whether the user asked to correct it, repeat verification, or continue another task. Never choose the next task automatically.

Authorization for `Tn` permits changes necessary for that task, its tests, and pertinent documentation. Keep every other task out of scope unless the user explicitly expands the request.

## Read context before editing

1. Read `AGENTS.md` and instructions applying to affected paths.
2. Read the task, dependencies, and its **Done when** condition.
3. Read related requirements and acceptance in `spec.md`.
4. Read relevant decisions, contracts, and checks in `plan.md`.
5. Inspect affected implementation and existing tests.

Consult architecture/schema for responsibilities and persistence, flows/design for interaction, `quality-project` for selected criteria, global privacy decisions and relevant data-protection sections for data/controls, and verification guidance when needed to perform a planned check. Read only enough context for this task; do not reload the complete spec strategy routinely.

If an essential source is missing, state what is blocked and request the needed information. Continue independent authorized work where possible.

## Execution rules

- Preserve agreed scope, behavior, and decisions.
- Reuse appropriate code and project patterns before adding another solution.
- Preserve unrelated changes and work in progress; never clean or revert them to make the tree look clean.
- Keep changes surgical and readable; avoid unrelated refactors or formatting.
- Resolve routine details within the plan. Ask when a choice changes scope, behavior, or a material technical decision.
- Do not alter requirements or weaken tests to make an incorrect implementation pass.
- Use isolated test data; never expose secrets or run destructive checks against real data.
- Existing permission to run a deployment command is not authorization to deploy.
- Do not create a per-increment verification file or duplicate suite.
- Execute one task and stop.

## Procedure

### 1. Check the starting state

Inspect local changes and target paths. Identify what belongs to other work and how to avoid overwriting it. Check real dependencies; a completed checkbox is not enough if required code or contracts are absent.

If an incomplete dependency would require another task, record the block and do not expand execution. Minor preparation explicitly included in `Tn` is allowed.

Run relevant initial checks when they help distinguish pre-existing failures from changes. Avoid rerunning the whole suite without a reason. Record the task objective, requirements, and checks that determine closure.

### 2. Write relevant tests first

For behavior changes, add or extend the planned tests before the functional change. Derive expected results from the spec and agreed examples. Cover the main case and task-relevant errors or boundaries.

Run those tests before implementation and verify that they detect the missing or incorrect behavior. Diagnose environment, import, and discovery failures; a setup failure alone does not prove a good test. If a test already passes, determine whether behavior is already implemented, a scenario is missing, or the assertion is insufficient. Do not manufacture failures or duplicate existing work.

When an entry point does not exist, a minimal in-scope structure may be needed to run the test. Verify afterward that the test detects the pending result.

For documentation, visual, or configuration tasks where review is the appropriate method, define expected steps/results first and explain why test-first does not apply. Visual tasks may still need state or interaction tests when those behaviors are in scope.

### 3. Implement the behavior

Implement according to the plan, conventions, and agreed references. Keep rules in the planned location and preserve existing consumer contracts. Handle prior data, partial failures, and retries when required.

For UI, implement relevant states and align presentation with agreed flow/design. For persistence or permissions, enforce controls in the component that actually owns the rule.

If implementation reveals a new decision:

- Resolve local details compatible with the plan and note material adjustments.
- Surface behavior contradictions before choosing an interpretation.
- Propose material changes and keep dependent work pending.
- Continue independent work within `Tn` when useful.

Do not replace a required integration with a permanent simulation merely to satisfy a demonstration.

### 4. Run checks and correct failures

Run task checks and those required by the plan/instructions, plus relevant regression for affected components. Run the full suite when required by the project or user; otherwise choose scope according to dependencies and risk and record it.

Include build, types, lint, integration, manual review, or other committed methods when applicable. Zero discovered tests is not evidence of verification.

Confirm checks execute intended scenarios, assert relevant results and prohibited effects, do not calculate expected values by simply copying the implementation, and use mocks without hiding the integration they claim to verify. Distinguish success, failure, omission, and instability.

Fix failures introduced by `Tn` and repeat affected checks. Investigate instability rather than repeating indefinitely. For unrelated pre-existing failures, record evidence and relationship to the done condition. If a mandatory check still fails, keep the task pending unless project rules explicitly resolve that status.

If environment, access, or tools are missing, attempt only safe authorized preparation. If verification remains blocked, state exactly what is missing and what was checked.

### 5. Review the final change

Inspect the diff for implementation, tests, and documentation. Confirm it satisfies `Tn`, preserves prior behavior, and contains no accidental changes. Pay special attention to data, permissions, and critical areas identified in the plan.

Do not remove, weaken, or disable tests to hide failures. Changed expectations require support from spec decisions. After any adjustment following a successful check, rerun affected checks.

When human review is required, leave concrete material ready and identify it as pending; agent self-review is not human approval.

### 6. Record documentation and evidence

Update only documents included in `Tn`. In `tasks.md`, record concise evidence associated with the task or shared checks:

- Covered requirements and acceptance criteria.
- Commands or steps actually executed.
- Relevant environment and code revision/state.
- Results, including failures or omissions.
- Links to artifacts or long logs when available.
- Limitations and pending review.

If changes are uncommitted, say so and identify the base revision when available. Do not claim checks include a commit when they include local modifications. Do not create a commit merely for evidence unless authorized.

For manual review, record expected and observed results. Keep evidence free of unnecessary sensitive data and avoid embedding large logs.

### 7. Determine task state

Mark `[x]` only when `Done when` is satisfied, mandatory relevant checks ran, and required reviews are complete for `Tn`.

If any mandatory condition is missing, keep `[ ]` and state whether it is in progress or blocked, what was implemented, and what remains. A task may complete while an explicitly separate integrated validation task remains, but keep that dependency visible. Completing `Tn` never marks the spec validated or authorizes another task.

### 8. Report and stop

Report:

- Task ID and state.
- Changes and covered requirements.
- Tests/checks executed and real results.
- Anything unverified or pending.
- Where evidence was recorded.
- Decisions needed to resolve blocks.

Include useful commands and concise results, with links to relevant files or artifacts.

If successful, also explain the implementation so the developer can learn from it:

- How modified components collaborate from input to outcome.
- Main files/functions and their responsibilities.
- Important language/framework mechanisms, defined plainly and tied to this task.
- Tests, including data setup, actions, results, fixtures, and mock purpose.
- If no tests were written, why and how the result was checked.

Adjust depth to the task's complexity and the user's stated knowledge. Use short excerpts of real code only when helpful; do not reproduce entire files or turn the response into an unrelated tutorial. Explain the final result and rationale, not every attempt.

Stop after `Tn`. Do not start the next task.

## Completion

Before finishing, confirm:

- The executed task is the authorized one.
- Changes trace to requirements and plan.
- Relevant tests were written first or the exception is explained.
- Implementation and checks cover the committed result.
- The diff was reviewed and unrelated work preserved.
- Results correspond to the final checked state.
- `tasks.md` state is supported by evidence.
- Blocks and limitations are visible.
- No other task was started.

If resumed later, re-check current code and evidence before continuing; do not repeat changes or reuse results from an older code state.
