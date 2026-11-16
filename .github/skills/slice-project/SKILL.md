---
name: slice-project
description: Select and bound an implementable vertical product slice in the global plan, preserving observable value, real dependencies, quality and privacy controls, and readiness for specification.
---

# Select a project slice

Select and delimit a functional increment that can be implemented, reviewed, and evaluated as one unit. Record the selection in `docs/global-plan.md`; do not create a separate selection document.

Work with the user in Spanish unless they request another language. Write updates in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording where translation would change meaning.

The project uses specification-driven development (SDD). The global plan sets capabilities and priorities; each selected increment later receives a spec, clarification, technical plan, tasks, implementation, and validation. The initial convention is one spec per slice. A vertical slice delivers observable behavior for a user or consumer across the necessary layers; it is not a technical layer or a backend/frontend phase.

This stage ends with a bounded selection ready for specification. Do not write `spec.md`, its technical plan or tasks, implement code, or create unrelated documents.

## Inputs and evidence

Read applicable repository instructions and consult:

- `docs/global-plan.md`, especially capabilities, priorities, provisional slice order, constraints, privacy decisions, and open questions.
- `docs/quality-project.md` for criteria the increment may activate.
- Relevant prior specs and evidence of work in progress.

Consult conditionally:

- Architecture and executable definitions for dependencies or technical boundaries.
- App flows for the observable journey and result.
- Design when visual interaction affects scope.
- Relevant data-protection catalog sections when data, purpose, actors, access, or providers change.
- Quality catalog when the scope may require criteria not currently selected.
- Verification catalog when evidence for the result is uncertain.

Read only what is needed for the current selection and dependencies. If information is missing, record the limitation and request only what could materially change the choice. Preserve real IDs and distinguish confirmed information from proposals. Do not reproduce catalogs or prepare a complete test plan.

## Selection principles

- Start from the result a user or consumer obtains.
- Respect explicit priorities and explain dependencies affecting feasibility.
- Preserve a complete, demonstrable journey at the end of the increment.
- Include necessary layers without pre-building infrastructure.
- Include required controls from the moment the behavior is enabled.
- Reuse existing capabilities and confirm their state with relevant evidence.
- Treat the roadmap as provisional and document justified changes.
- Keep selected, specified, implemented, and validated states distinct.
- Keep technical depth to what is needed to judge scope and dependencies; defer contracts, tables, components, and detailed tasks to the spec plan.

## Procedure

### 1. Establish the starting point

Identify pending and partially covered capabilities and active work. Confirm relevant dependencies using documentation, validation evidence, or targeted code inspection. A checked box may need confirmation when it conflicts with observed state; do not run the entire suite merely to choose a slice.

If a slice is already in progress, state whether the request continues it, prepares a later increment, or proposes changing priority. Keep unfinished work visible and do not replace it silently.

If the user named a capability or outcome, begin by delimiting it. Otherwise compare a small set of relevant candidates when there is genuine choice.

### 2. Choose an observable outcome

Describe the increment as actor, action, and result. For each candidate worth comparing, briefly state:

- Value or need addressed.
- Existing and pending dependencies.
- Uncertainty reduced.
- Complexity and risks affecting reviewability and validation.

Use a concise comparison only when there are real alternatives. Avoid unsupported numeric scores or estimates. Recommend one slice and explain why it fits the product's current state.

### 3. Bound scope and exclusions

Specify:

- What the user can do when the increment is complete.
- Included actions and states.
- Existing behavior preserved.
- Related functionality deferred.
- Data created, read, or changed at a high level.
- Covered actors, platforms, and contexts.

Include essential failures and restrictions. For example, a private list requires preventing unauthorized access from its first activation. Do not bundle capabilities that could deliver useful results separately. Exclusions should clarify the functional boundary without removing controls required by included behavior.

### 4. Check verticality and dependencies

Trace the interaction conceptually from entry to final result. Identify involved layers/components and what is reused or changed in each. Confirm the result can be demonstrated through the real required connections, recording unavoidable simulations and what they limit.

If functionality is missing, choose a proportionate response:

- Include a minimal dependency version that preserves a bounded result.
- Select a prior slice with observable value.
- Limit the result to a legitimate product context and document the limitation.
- Define a bounded investigation or enablement slice when uncertainty prevents a reasonable functional commitment.

An investigation must have a question, expected result, and completion condition. Record it as a dependency or enablement item and explain what slice it unlocks. The functional selection may remain provisional until it is resolved.

Avoid sequences that complete all database, backend, and frontend work before delivering behavior.

### 5. Identify activated criteria and controls

Review selected quality criteria and relevant privacy decisions. For each applicable reference, record the concrete scope consequence and when it becomes required. Consider changes to permissions, persistence, personal data, external communication, interface states, costly resources, and publication.

Distinguish controls already in place from new controls needed for this increment. Group references that lead to the same outcome. If a requirement applies only at publication or real-data use, record that event and pre-publication restrictions. If a relevant criterion is absent from project selection, cite its source and record a proposed quality or privacy update.

Keep pending decisions visible. Do not copy catalog text or produce an exhaustive verification plan.

### 6. Define a demonstration scenario

Describe a concise scenario with:

- Preconditions and example data.
- Main action sequence.
- Observable result.
- Persistence or effects to verify.
- An essential rejection, limit, or recovery case.
- Required environment and dependencies.

The scenario must show that the promised result was achieved; visual appearance alone is insufficient for a save-and-retrieve journey. Distinguish what can be checked when the spec closes from publication-only verification, and state limits of manual demonstrations or simulated integrations.

### 7. Check whether the slice is manageable

Determine whether the increment can be explained, implemented, reviewed, and validated clearly. Warning signs include independent objectives, too many actors or variants, accumulated new dependencies, several major uncertainties, or a demonstration requiring many different journeys.

Split by behavior or case breadth while retaining a complete result. It may be narrowed to one operation, actor, format, or initial variant if still useful and coherent. Keep deferred capabilities explicit. Do not impose universal duration, task count, or line-count limits; if estimating, state assumptions and treat the estimate as guidance.

### 8. Register the selection

If the user selected or delegated the slice, proceed within that scope. If a material product decision remains, give a concrete recommendation and consequences. Keep proposals marked as proposals until resolved. A detail-level open question may not block selection, but state whether it blocks writing the spec.

Update the existing slice entry and its detail in `docs/global-plan.md`. Use a stable ID and preserve roadmap references. If multiple slices are selected in parallel, identify the current one and its relationship to the others; the default remains one spec per slice.

## Required global-plan entry

Add or update a compact roadmap-linked record containing:

1. **Slice ID and title.**
2. **Selection status and rationale** — selected or proposed, reason, and priority relationship.
3. **User outcome** — actor, action, and result.
4. **Capabilities covered** — existing IDs and partial/full scope.
5. **Included scope.**
6. **Deferred scope** — exclusions and remaining capabilities.
7. **Dependencies and readiness** — dependencies, evidence, and blockers.
8. **Affected layers or components** — conceptual path and reused elements.
9. **Applicable shared criteria** — IDs, consequences, and required-by event.
10. **Demonstration scenario** — steps and observable result.
11. **Open decisions and readiness for specification** — questions and resolution point.

Combine fields when that improves readability. Keep the roadmap as the source of the selection rather than duplicating the record elsewhere. Log significant order or scope changes and their reasons. Preserve future commitments when splitting a slice.

## Completion

The selected slice should:

- Produce an observable result for an actor or consumer.
- Have understandable scope and deferred work without this conversation.
- Identify dependencies and their real availability.
- Cross the necessary layers and support a demonstration.
- Reference activated criteria with concrete consequences.
- Preserve required controls while narrowing the increment.
- Be reviewable and validatable as one unit.
- Remain coherent with the global plan and product state.
- Identify open questions and whether they block the next stage.
- Distinguish selection, implementation, and validation.

Deliver a link to the updated global plan, summarize the selected result, and call out only decisions needing attention. If provisional, state what is needed before it is ready for specification. Do not proceed to spec writing.

## Later revision

If clarification or the technical plan reveals excessive scope, re-bound the slice using the same observable-result logic. Record the split, preserve IDs and useful references, and adjust dependencies.

When the spec is written, link it from the slice entry. After implementation and validation, update its status and actual capability coverage with evidence. Keep partially covered capabilities marked as partial.
