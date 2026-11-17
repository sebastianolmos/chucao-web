---
name: create-spec
description: Write or update a behavior specification for a selected vertical slice, with traceable requirements, acceptance criteria, constraints, and open questions, stopping before technical planning or implementation.
---

# Write a slice specification

Create or update `specs/<id>-<increment-name>/spec.md` for the selected slice. The spec records context, purpose, observable behavior, applicable constraints, and acceptable results. It is the first documentation stage after slice selection; clarification, technical planning, tasks, implementation, and validation follow later.

Work with the user in Spanish unless they request another language. Write the spec in English unless the user requests another language or the project has an explicit language convention. Preserve the agreed language for UI text and product message examples.

## Scope and boundaries

Use the selected slice as the source of scope. A slice is an observable result for a user or consumer crossing the necessary layers. Preserve its result and record independently useful capabilities as proposals for later increments.

This stage is documentation only. Do not write a technical plan, tasks, code, a per-spec verification file, or a separate constitution. Defer new technology, module, table, algorithm, test-tool, and CI choices to the technical plan unless an already-agreed choice constrains behavior.

Keep confirmed requirements, proposals, and open questions separate. Use precise observable language. Words such as “fast,” “secure,” or “easy” require measurable conditions or an explicit unresolved question.

## Inputs and source reading

Read applicable repository instructions and locate the selected slice from the user's request and its entry in `docs/global-plan.md`. Confirm its outcome, scope, exclusions, dependencies, and planned demonstration. If multiple candidates exist without an unambiguous selection, ask for clarification before writing slice-specific requirements; continue with context that is safe to confirm.

Read relevant sections of:

- `docs/quality-project.md` for criteria applicable to the increment.
- `docs/catalog/data-protection.md` for behavior and data-processing requirements and global privacy decisions.
- `docs/catalog/verification.md` for scenarios, observable results, failures, limits, and preservation conditions.

Use IDs, headings, and references from the slice to focus the reading. Inspect related sections when they may expose an omission, but extract only what affects this spec. If a source is missing, request its location or contents, continue independent work, and mark the affected review as pending. Do not invent IDs, versions, decisions, or inaccessible content.

Also consult, when relevant:

- `docs/app-flow.md` and `docs/design.md` for affected views, states, journeys, and presentation.
- `docs/architecture.md` for shared constraints.
- Prior specs, public contracts, or implementation for compatibility and behavior that must remain.

Record references precise enough for review: document path and section, and page/frame/node or agreed version/date for external design material when available. Distinguish acceptance-defining references from inspiration.

## Procedure

### 1. Prepare the spec location

Use the repository's existing folder convention or the path supplied by the user. If a new folder is needed, choose an unused numeric prefix and descriptive name; use `001` only when justified by actual repository state.

Check whether a spec already exists for the selected slice. Update it while preserving valid IDs and decisions. Do not overwrite another increment or create a duplicate spec for the same scope.

Record the spec ID, slice ID, title, and `Draft` status. Respect a different user- or repository-defined convention.

### 2. Resolve only initial blocking questions

Identify uncertainties affecting the objective, scope, actor, core rules, or expected result. Ask one question at a time, prioritizing the most important, with an initial maximum of six. Use available material and do not repeat resolved questions.

If enough information exists, draft directly. While questions remain, draft independent sections. After the initial question limit, retain additional issues as `[NEEDS CLARIFICATION]`, naming the affected requirement and consequence. Do not invent answers to make the document appear complete; systematic ambiguity review belongs to the clarification stage.

### 3. Define context, actors, and scope

Explain the increment's problem, relationship to global capabilities, and expected outcome. Identify actors, technical consumers, and relevant preconditions such as authentication, permissions, existing data, or platform.

Declare included and excluded behavior and existing behavior that must remain. Mark pending dependencies and their effect. Add user stories or scenarios with stable IDs such as `US-01` or `SC-01`, following project conventions.

### 4. Write identifiable requirements

Use stable IDs such as `FR-01` and `NFR-01`, preserving existing prefixes such as `RF` or `RNF`. Each requirement must state a testable obligation with condition, response, and relevant effects. Split independent obligations while keeping inseparable consequences of one operation together.

Use EARS when it improves clarity:

- Always applicable: `The system shall <response>.`
- Event: `When <event>, the system shall <response>.`
- State: `While <state>, the system shall <response>.`
- Unwanted condition: `If <unwanted condition>, then the system shall <response>.`
- Real optional capability: `Where <feature is included>, the system shall <response>.`

Use the optional form only for genuine product variability, not to leave a selected requirement undecided. Use rules or decision tables instead of forcing EARS into prose where it reduces clarity. Add input/output examples for difficult rules and keep them consistent with normative text.

### 5. Specify errors, boundaries, and preservation

Include only cases relevant to the slice:

- Validation, empty values, and size boundaries.
- Duplicates, retries, repeated operations, and idempotent effects.
- Identity, ownership, and permissions.
- Dates, time zones, ordering, and equality.
- Interruption, cancellation, failure, and recovery.
- Preservation or modification of existing data.
- Concurrency when the product must support it.

For each case, state what the actor observes and what effects are allowed or prevented. Define the required outcome before choosing a mechanism. Do not assign arbitrary numeric limits; if a value is needed, propose it with rationale and keep it unresolved until decided.

### 6. Translate quality, privacy, and verification

Turn applicable criteria and decisions into concrete slice obligations and retain the source ID beside the requirement. Group references that produce the same behavior; do not copy catalog text.

Examples include preventing access to another user's resource through any available interface, ensuring rejection creates no records or unintended changes, providing purpose information before collecting data, and defining what successful state recovery means after restart.

The spec records verifiable outcomes and constraints. The technical plan chooses unit/integration/manual methods, tools, fixtures, and commands within project policy. Distinguish requirements due when the slice closes from conditions checked only at publication or real-data use, including the required event and environment. Record unresolved material obligations or conflicts with the global selection and their impact; a small feature still needs applicable controls.

### 7. Reference flow and design

Identify affected views, states, components, and journeys using their real IDs. Record document path and section, and external page/frame/node plus version or date when available. If a tool lacks stable versioning, state the consultation date and limitation and use an identifiable export when possible.

If mockups conflict with agreed flows or rules, record the discrepancy. Do not infer functional behavior from a button's appearance. Describe only this slice's design particulars; do not duplicate the global design document.

### 8. Define acceptance criteria

Every requirement needs a clear way to decide whether it is satisfied, either directly below it or in linked criteria. Use scenarios with preconditions, action, observable result, and relevant effects; Given/When/Then is optional.

Cover the main journey plus rejection, boundary, or recovery cases that protect the committed behavior. A criterion may cover multiple requirements and a requirement may need multiple scenarios. Avoid repeating a requirement word for word when its condition and response are already sufficient; add only useful examples or complementary scenarios.

Include applicable non-functional criteria with enough evaluation context. A performance goal needs a scenario, volume, and reference environment, or an explicit question to establish them.

### 9. Record completion and open questions

State evidence needed to accept the increment:

- Applicable requirements and acceptance criteria are satisfied.
- The committed vertical journey is demonstrable.
- Identified previous behavior remains preserved.
- Blocking defects are resolved and limitations recorded.
- Required shared quality and privacy conditions are met.

Do not impose a new automated test per requirement or invent a command from a template. Preserve project automation obligations and defer concrete test design to the technical plan.

Give each unresolved issue an ID and `[NEEDS CLARIFICATION]` marker, the decision required, affected requirements, and resolution stage. Distinguish behavioral uncertainty from technical decisions deferred to planning.

### 10. Review and deliver

Check coherence across scope, stories, requirements, examples, and acceptance. Confirm references exist and no requirement depends on an invented decision. If the scope grew too large, propose a split and explain its effect without presenting the new boundary as approved.

Save the spec as a draft ready for clarification and state known blockers. If supported by the repository flow, minimally link it from the slice entry in `docs/global-plan.md`. Stop at this stage.

## Spec structure

Use this structure, merging sections when that keeps the document compact:

1. **Status and references** — spec ID, slice, state, and relevant sources.
2. **Context and objective.**
3. **Actors and preconditions.**
4. **Scope and exclusions.**
5. **Scenarios or user stories.**
6. **Functional requirements** — IDs, rules, and examples.
7. **Applicable non-functional requirements** — quality, privacy, and shared constraints with references.
8. **Errors and boundary cases** — linked to requirements without duplication.
9. **Flows and design references** — affected views, states, and versions/dates.
10. **Acceptance criteria** — linked scenarios or criteria included with requirements.
11. **Dependencies and shared constraints.**
12. **Completion criteria.**
13. **Open questions.**

Keep applicable content while omitting irrelevant empty sections.

## Completion

The draft should make clear:

- It corresponds to the selected slice and preserves its vertical result.
- Scope, exclusions, and dependencies are explicit.
- Requirements have stable IDs and observable outcomes.
- Every requirement has acceptance criteria or an identified blocking question.
- Selected errors and boundaries address concrete risks.
- Quality and privacy are translated into traceable slice obligations.
- Required sources were consulted or blocked readings are recorded.
- Flow and design references are sufficiently precise.
- Required results remain separate from later technical decisions.
- Proposals and questions are visible.
- The document is still awaiting clarification and is not approved, implemented, or validated merely because drafting is complete.

Deliver a link to the spec, summarize specified behavior, and highlight only questions or decisions needing attention. Do not claim approval, implementation, or validation from authoring alone.
