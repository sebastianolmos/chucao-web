---
name: spec-closure
description: Close a validated specification by consolidating its evidence, updating the slice state and only affected shared documentation, and leaving the project ready for a later slice selection.
---

# Close a specification

Close the indicated spec documentally after validation. Update its slice state and only shared documentation whose facts changed because of the increment. Leave the project ready to select another slice, without selecting or implementing one automatically.

Work with the user in Spanish. Preserve the language and conventions of existing documents; when none exists, use English for persistent documentation.

The project uses SDD with one spec per vertical slice: `spec.md` defines requirements, `plan.md` defines technical design and verification, and `tasks.md` records work, states, and evidence. Validation establishes compliance; this stage consolidates that result and keeps documentation coherent.

Do not repeat full validation when current, sufficient evidence exists. Do not create a separate closure report or per-increment `verification.md`.

## 1. Identify and confirm closure readiness

Use the folder supplied by the user. If missing, consult project tracking and ask only when the target is not unambiguous.

Read applicable `AGENTS.md`, the scope and completion criteria in `spec.md`, task states and validation result in `tasks.md`, final decisions and shared-document updates in `plan.md`, and the slice entry plus relevant context in `docs/global-plan.md`.

Confirm:

- Validation concluded the spec is met and its evidence is locatable.
- Required tasks, conditions, manual checks, and reviews are complete.
- Evidence corresponds to the code state being closed, including revision and relevant local changes.
- No mandatory noncompliance is hidden as future work and no material decision remains unresolved.

All checkboxes or a user's statement that work is finished are insufficient alone. Do not add new controls merely to perform closure.

If validation is missing or there is a failure, keep the state pending and explain what must be resolved. Update only already-demonstrated facts; do not close the spec. If later changes invalidate evidence, identify affected checks and defer that portion to validation.

A feature outside agreed scope may remain pending without blocking closure. A requirement inside the spec cannot be moved elsewhere to create false compliance. Scope changes must be explicitly decided and reflected in documents and validation.

If already closed and correctly documented, report that no changes are needed. Do not add another closure entry or change dates routinely.

## 2. Determine which documentation actually changed

Start from spec changes, implemented decisions, and plan references. Inspect relevant code/configuration only to confirm a fact. Do not rewrite every project document.

Apply this selection:

| Document | Update when |
| --- | --- |
| `docs/global-plan.md` | Always check the slice entry; update it if implementation, validation, and closure are not reflected, or if covered capability/dependencies changed. |
| `specs/<id-name>/tasks.md` | Record closure if missing, preserving validation evidence and its location. |
| `docs/architecture.md` | Shared stack, service, responsibility, communication, constraint, conceptual entity, ownership, or access decisions changed. |
| `docs/app-flow.md` | Implemented journeys, views, transitions, actors, or conditions differ from the documented behavior. |
| `docs/design.md` | Shared visual rules, components, states, or design references changed and were agreed/implemented. |
| `docs/quality-project.md` | Project criterion applicability, interpretation, or required-by timing changed with justification. |
| `AGENTS.md` or equivalent | Commands, conventions, reference paths, or agent operating instructions changed. |
| Existing README/usage/operations docs | Installation, configuration, usage, maintenance, or recovery instructions became incomplete or incorrect. |

Consult other documents only for a concrete affected reference. Catalogs in `docs/catalog/` are reusable sources and are not edited to record spec completion. Do not create changelogs, ADRs, or closure reports unless the project already requires them or an authorized need exists.

If a required document for a real shared change is missing, explain the need and create only the indispensable content within scope. Do not modify implementation or tests to resolve closure findings.

## 3. Update the global plan

Preserve format and stable IDs. The slice entry should show:

- Its actual state: implemented, validated, and closed using project terminology.
- Links to the spec and validation/closure record.
- The concrete capability now covered when not obvious.
- Relevant limits and the remaining portion of broader capabilities.

Update satisfied dependencies or assumptions only from confirmed facts. Record new priorities or user decisions as proposals/questions; do not reorder the roadmap as if agreed.

Do not mark the entire MVP or a broad capability complete for a partial slice. Do not confuse closure with branch integration, publication, or production availability.

Do not copy test matrices or implementation detail into the global plan; a link to validation evidence is enough.

## 4. Update affected shared documents minimally

Document only shared decisions future specs need to know. Preserve valid future decisions as planned.

For architecture, record the implemented shared decision and rationale when relevant. If it differs from the technical plan, confirm that the difference was accepted and validated before documenting it as approved. Keep concrete schema in executable migrations/definitions and architecture at the conceptual level.

Preserve material change traceability in spec documents. Add a brief final-decision note only when needed; do not silently rewrite original requirements to match code. Do not update `spec.md` or `plan.md` only to repeat a state already maintained in `tasks.md`.

Keep any `AGENTS.md` adapter/reference mechanism consistent and maintain one common ruleset. Do not delete or move the spec directory.

## 5. Record closure without duplicating validation

Reuse the existing closure section in `tasks.md`. If absent, add a brief section containing:

- Closure state and effective date.
- Validation result and checked code state.
- Updated documents and one-sentence reason for each.
- Out-of-scope follow-ups only when they exist, linked to project tracking.

Do not copy lengthy results or maintain two evidence matrices. Preserve updates validation already made and fill only what is missing.

Record concrete follow-ups in the existing tracking mechanism, distinguishing optional improvements from agreed future obligations. Do not invent a feature list or select the next spec.

A required human review counts only when its result exists. Do not add an extra approval for routine documentation edits authorized by this request.

## 6. Review and stop

Inspect the documentation diff and confirm:

- Global state matches actually completed scope.
- Links and paths locate the spec and evidence.
- Affected documents do not contradict one another.
- Nothing is presented as deployed, approved, or tested without evidence.
- Edits preserve other work and avoid duplication.

For documentation-only changes, use only repository-required documentation checks. Do not rerun the full functional suite merely because text changed. If docs feed executable generation or code/configuration changed, identify evidence that must be renewed.

Do not commit, merge, publish, or make external changes unless explicitly authorized by the workflow or user.

## Delivery

Respond in Spanish with:

1. Whether the spec is closed or what prevents closure.
2. The capability available within validated scope.
3. Documents changed and why, with links.
4. Location of validation and closure evidence.
5. Relevant follow-ups or decisions.

Do not list every document that did not need changes. If no changes were needed because closure was already correctly reflected, state that clearly. Stop; selecting the next slice is a separate stage.
