---
name: plan-spec
description: Create or update the technical implementation and verification plan for a clarified slice specification, preserving traceability and stopping before task breakdown or code.
---

# Plan a specification

Create or update `specs/<id>-<increment-name>/plan.md` beside the corresponding spec. The plan explains how the clarified behavior will be implemented in the existing system and how evidence of compliance will be gathered.

Work with the user in Spanish unless they request another language. Write the plan in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and product-language examples.

This stage produces technical documentation only. Do not modify implementation, dependencies, migrations, infrastructure, `tasks.md`, or unrelated documents. Tasks are decomposed later.

## Inputs and source reading

Read applicable repository instructions and the complete target spec, including acceptance criteria, references, and clarification results. Confirm the spec and slice from the user's request and the repository tracking mechanism. If multiple specs are plausible, ask for precision and preserve the increment's folder and IDs.

Consult:

- `docs/architecture.md` for relevant decisions and boundaries.
- `docs/quality-project.md` for affected selected criteria.
- `docs/catalog/verification.md` for suitable verification methods.
- `docs/catalog/data-protection.md` for data and control details.
- Relevant slice selection and shared decisions in `docs/global-plan.md`.
- The existing `plan.md` when updating.

For UI work, consult the agreed sections and versions of `docs/app-flow.md` and `docs/design.md`. Inspect relevant code, tests, manifests, contracts, executable schema, migrations, and configuration directionally, expanding only when dependencies require it. If a source is missing, record which decision is limited and continue independently; never invent paths, IDs, or contents.

## Planning rules

Preserve the spec's scope, result, acceptance, and confirmed decisions. If a technical choice would change behavior, record the conflict and resolve it explicitly before treating the plan as agreed.

Reuse suitable project components and patterns. Justify new dependencies, abstractions, and services by the increment's needs. Distinguish existing files/components, proposed changes, and new components; proposed paths must not appear discovered.

Provide enough detail for task decomposition without redesigning the increment. Use synthetic data examples, contracts, diagrams, or brief pseudocode when they clarify a decision, but do not write full implementation. Keep detail proportional to the slice. Keep confirmed, proposed, and pending decisions visible. Do not create a constitution, duplicate test suite, or per-spec verification file.

## Procedure

### 1. Check spec readiness

Determine whether pending questions affect behavior, acceptance, or only technical choice. Resolve technical questions in the plan. If a question changes what is built or how it is accepted, ask a focused question and mark dependent sections provisional.

Identify all functional/non-functional requirements, scenarios, acceptance criteria, and constraints to cover, preserving their IDs. A “clarified” status does not replace checking for obvious contradictions.

### 2. Analyze implementation and reuse

Describe relevant existing entry points and operation paths, reusable components/functions/services/patterns, persistence and contracts, existing dependencies, tests and tools, and discrepancies between documentation and code.

Reference real paths and symbols when useful. If there is no implementation, state the starting point and treat confirmed architecture decisions as constraints. Investigate reuse before proposing duplication or restructuring; unrelated improvements remain observations, not scope.

### 3. Design changes across layers

For every affected component, state responsibility, proposed change, connections, and requirement IDs satisfied. Trace the complete path from input to outcome, including validation, rules, access control, persistence, and presentation where applicable.

Keep rules in coherent architectural locations and avoid duplicating invariants across layers. Explain where trust boundaries and limits are enforced. For UI, describe representation of agreed states and reused components, referencing design and accessibility conditions.

Use a brief diagram or sequence only when it clarifies a complex interaction.

### 4. Specify data, contracts, and compatibility

Include only definitions needed for the increment. For storage changes, describe relevant entities/fields/types/relations/constraints/invariants, justify indexes by expected queries, and include synthetic examples when useful. Link executable schema or migrations and explain existing-data handling, defaults, transformations, and recovery.

For APIs, CLIs, libraries, files, events, or other interfaces, specify relevant inputs, outputs, errors, permissions, and effects. Distinguish committed public contracts from proposed internals. Consider existing consumers and versions; describe transition order and checks when compatibility requires it.

Differentiate code rollback from data recovery. Do not promise automatic rollback when information can be lost.

### 5. Define internal behavior and failures

Explain algorithms or internal rules when their choice matters. Use concise pseudocode for complex calculations, transformations, or decisions.

Specify consistency behavior for partial failures, retries, repeated operations, and concurrency when required by the spec. Describe transaction boundaries or equivalent mechanisms and treatment of external effects. For external dependencies, define response validation, relevant errors/limits, project-controlled responsibilities, and provider guarantees.

When clocks, randomness, or other variable factors affect outcomes, state how they will be controlled for verification.

### 6. Justify decisions, dependencies, and risks

For material decisions, record context, chosen option, rationale, consequences, and state. Include a reasonable rejected alternative only when it explains a meaningful choice. Reference shared decisions instead of recreating them.

For every new dependency, state the need, why existing capability is insufficient, and maintenance/integration cost. Check official documentation when compatibility, pricing, availability, or current capability is decisive; record source and date or the inability to verify.

Record concrete risks with mitigation or checking, pending dependencies, decisions requiring intervention, and the point where they block work. For uncertainties needing experimentation, define a bounded investigation with question, expected result, and completion criterion; keep dependent planning provisional.

### 7. Translate quality and privacy into mechanisms

Map applicable requirements to mechanisms and verification points. Cover relevant authorization, validation, data protection, deletion, initial visibility, secret handling, usage limits, and other controls.

Group requirements sharing one control. State what exists, what changes, and what must be verified. Do not treat selecting a provider or installing a library as proof of meeting a criterion. Keep open product or legal dependencies explicit and do not weaken requirements for implementation convenience.

### 8. Define verification in `plan.md`

For every important behavior or risk, specify:

1. Requirement, acceptance ID, or risk.
2. Verification method and observable result.
3. Environment, real components, and simulated dependencies.
4. Data, preconditions, and preparation.
5. Expected result, including effects that must not occur.
6. Evidence to retain and execution point.
7. Human review required, when justified by risk.

Use a compact table and shared preparation notes. Local IDs such as `CHECK-01` may be used. Choose only methods that add evidence: build/types/static analysis, unit, integration, contract, UI/component state, representative end-to-end journey, regression, security/design/code review, property/mutation/performance/compatibility/recovery when their result reduces relevant uncertainty.

Distinguish reusable project tests from one-off review or demonstration. Identify existing tests to run/extend and new tests needed. Do not require one test per requirement.

Reuse real tools and commands, stating working directory and prerequisites. If a command/tool is missing, mark preparation as pending. Distinguish existing commands, proposed commands, and results actually obtained. Use synthetic or isolated data, cleanup, and controlled variable factors. Mocks control situations but do not prove real integrations; state what each boundary verifies.

If CI exists, identify checks and dependencies. If not, define reproducible local execution and consider CI only when required by agreed scope. Schedule checks needing a published environment separately and identify what they block.

Expected results must come from the spec, agreed examples, or independent references rather than implementation logic. Plan review of assertions, test discovery, omitted cases, and mocks that hide integration. Preserve existing tests and justify changed expectations. Identify focused human review for permissions, destructive migrations, core rules, or verification changes.

### 9. Ensure traceability and sequence

Include a compact map:

| Requirement / acceptance ID | Planned change | Verification reference |
| --- | --- | --- |
| Existing ID | Component, contract, or plan decision | `CHECK-ID` or precise section |

Ensure every applicable requirement has changes and verification, and every proposed change has a reason tied to the increment or necessary dependency. State a general technical order and dependencies without turning it into the task checklist.

If the plan exposes too many independent decisions or an unreviewable scope, identify a possible split and its effect without treating it as confirmed.

### 10. Identify documentation updates and close

List proposed updates to architecture, flows, design, agent commands, or global plan, with reason and timing. Distinguish planned shared decisions from implemented capability. Keep local increment details in the plan and do not duplicate executable schemas in architecture.

Review the plan against the spec and source documents, preserve valid previous decisions when updating, and record a status such as draft, ready for tasks, or pending according to actual resolution.

## Plan structure

Use this structure, merging or omitting sections when appropriate:

1. **Status and references** — spec, slice, source revision, and relevant documents.
2. **Existing implementation and reuse.**
3. **Proposed changes by component** — responsibilities, path, and requirement IDs.
4. **Data model, contracts, and compatibility.**
5. **Algorithms and failure handling.**
6. **Technical decisions and rationale.**
7. **Dependencies, risks, and open decisions.**
8. **Verification and review strategy** — methods, environment, data, expected results, evidence, and timing.
9. **Traceability and implementation sequence.**
10. **Shared documentation updates.**

## Completion

The plan should make clear:

- Scope, acceptance, and confirmed decisions are preserved.
- Existing code and reuse options were inspected or limitations are recorded.
- Proposed changes and connections complete the vertical journey.
- Data, contracts, compatibility, and failures have relevant detail.
- Material decisions are justified and proposals are identifiable.
- Every applicable requirement has traceable changes and verification.
- Verification states method, environment, data, and expected result.
- Reusable tests, reviews, and publication conditions are placed appropriately.
- Pending decisions state what they block.
- The information supports task decomposition without redesigning the increment.

A planned verification is not evidence that implementation complies. The plan's status expresses readiness for the next work stage.

Deliver a link to `plan.md`, summarize important decisions and verification strategy, and identify blockers. Do not proceed to `tasks.md` or code.

## Evolution

When an implementation decision changes, update its rationale, affected components, and checks. If required behavior changes, update the spec first and synchronize the plan.

Keep a reference to the spec revision used through the repository's identifiable mechanism; do not invent versions. During implementation, incorporate authorized technical adjustments while preserving traceability. When the slice closes, reflect confirmed shared decisions in the appropriate documents and keep validation results locatable.
