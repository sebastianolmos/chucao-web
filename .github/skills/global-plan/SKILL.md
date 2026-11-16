---
name: global-plan
description: Create or update a product-level global plan and project quality criteria from user requirements and repository evidence, stopping before specs, architecture, or implementation.
---

# Global project planning

Create or update the product’s global planning documents using the user’s requirements and available project evidence. This skill ends at global planning: do not write feature specs, detailed architecture, implementation plans, task lists, or code.

Work with the user in Spanish unless they request another language. Write the documents in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording where translation would change meaning.

## Deliverables and boundaries

Produce:

- `docs/global-plan.md`: problem, users, outcomes, capabilities and scope, constraints, principles, data-protection decisions, provisional vertical-slice order, proposals and open questions, and significant changes.
- `docs/quality-project.md`: selected and conditional quality criteria, relevant exclusions, applicability questions, evidence expectations, and significant changes.

Do not create a constitution, separate roadmap, per-criterion files, or other documents unless requested or necessary. Do not execute an underlying product task, implement features, or imply that writing a plan makes the product compliant or its criteria satisfied.

## Procedure

### 1. Inspect inputs and project state

Read:

- The user’s requirements, decisions, and supplied materials.
- Applicable repository instructions.
- `docs/catalog/quality.md` and `docs/catalog/data-protection.md`.
- Existing versions of both deliverables, if present.

Consult existing architecture, flows, designs, specs, or code only when needed to verify current capabilities or constraints. Do not assume these materials exist or describe a feature as implemented without evidence.

If either catalog is missing, ask for its location or contents and continue with independent work. Do not invent catalog criteria, IDs, or versions, and do not call the selection complete. If product information is incomplete, preserve known facts and identify what needs resolution.

Preserve existing decisions, stable IDs, valid references, and evidence when updating documents. Do not discard useful product detail to fit a template.

### 2. Understand the product and resolve material ambiguity

Extract the problem, real users or consumers, primary scenarios, product context, intended capabilities, and constraints. Look especially for uncertainties that could change the MVP, data processing, public/private access, platforms, providers, costs, or risks.

Ask a brief, focused set of questions (preferably no more than five) when answers materially affect these decisions. State the consequence of each question and offer options where useful. Do not ask for information already present.

While waiting, draft independent sections. Mark affected sections as draft; silence is not approval. Record non-blocking questions with the stage by which they must be resolved. Distinguish facts, confirmed decisions, agent proposals, and open questions throughout.

### 3. Define product scope

In `global-plan.md`, describe:

- The problem and need.
- Actual users, roles, or consumers; avoid invented personas.
- Goals and observable outcomes without fabricated numeric targets.
- Capabilities with stable IDs such as `CAP-01`, their scope status (MVP, later, or explicitly out of scope), and delivery status.
- Known constraints: platform, budget, timeline, operations, mandated technologies, and learning goals.

Keep the agreed MVP intact. If it is too broad for one increment, divide it into manageable slices. If reducing the MVP seems beneficial, record the reduction as a proposal with its rationale; do not silently change scope. A capability may span multiple slices, and a slice may support multiple capabilities.

### 4. Record data-protection decisions

Use the data-protection catalog to identify product-level decisions and cite its real IDs and source reference in `global-plan.md`. Consider relevant people, data categories and purposes, necessary versus optional data, sensitive data or minors, responsibilities and legal questions, external services, initial visibility and access, retention and deletion, rights handling, prerequisites for real data or public access, and changes that trigger reconsideration.

Keep the inventory conceptual, not a data schema. Consider files, telemetry, logs, and other processing even if the product has no accounts or database. Distinguish legal obligations, engineering controls, and voluntary product choices. Do not declare legal compliance merely because a decision is documented.

For material legal conclusions, check a current official source and record its date and reference. If that is not possible or context is missing, state the uncertainty and when it must be resolved; never invent obligations, exceptions, or deadlines. Do not treat an obligation as optional just because the product is an MVP. If necessary, propose limiting or delaying the affected capability and explain the consequences.

### 5. Select project quality criteria

Review all entries in the quality catalog for applicability, but include only:

- Selected criteria.
- Conditional criteria tied to a relevant future capability or decision.
- Relevant exclusions that could otherwise look accidental.
- Unresolved applicability questions.

For every selected criterion, record its catalog ID, observable product-specific interpretation, applicable capabilities/interfaces/resources, concrete event by which it must be met, high-level expected evidence, and check status (`pending` or `verified` with evidence). If only part of a compound criterion applies, state which part. “Selected” does not mean “satisfied”; intentions, planned configuration, and chosen dependencies are not verification evidence.

Identify the exact catalog source in `quality-project.md` by path and declared version. If no version is declared, use a commit that represents that exact file, or its SHA-256 hash when local changes mean no commit represents it, and record the consultation date. Do not invent a version or cite a commit that omits local changes. Also reference the privacy catalog in `global-plan.md`.

When quality and privacy overlap, reference the same decision or control instead of creating duplicate implementations or checks. Do not design a full verification suite, test commands, or detailed tests at this stage.

### 6. Order provisional vertical slices

Propose an order based on dependencies, user value, and uncertainty reduction. Each slice must have a stable ID, observable user/consumer result, capabilities covered, principal boundary, real dependencies, relevant pending decisions, and quality/privacy conditions it activates.

A vertical slice is a bounded, observable result that crosses the necessary layers; it is not a technical layer, fixed-duration sprint, or necessarily the whole MVP. Avoid slices such as “build the whole backend/database/frontend.” A separate investigation or enablement slice is acceptable only if bounded, justified, and explicit about what result it unlocks.

Do not impose a fixed slice count or invented durations. Detail near-term slices more than distant ones. Bring forward costly-to-reverse decisions without prebuilding the full solution. Do not design detailed schemas, modules, endpoints, undecided stack, pipelines, or implementation tasks; record already-confirmed technical choices only as constraints.

### 7. Add working principles

Include about seven brief, verifiable principles in `global-plan.md`, adapted to the project:

- Bounded increments produce observable results.
- Implementation matches agreed requirements.
- Ambiguous affected behavior is resolved before implementation.
- Testing and review are proportional to change and risk.
- Check evidence is retained.
- Human review focuses on critical changes.
- Affected documentation is updated when the product changes.

Do not turn these into detailed agent instructions or add unagreed architecture rules. Require an explicit rationale for changing these principles.

### 8. Draft and review the documents

Use these sections, adapting presentation for readability without dropping required information.

`docs/global-plan.md`:

1. **Document status and sources** — date, review state, principal sources, and exact privacy-catalog reference.
2. **Problem, users, and context.**
3. **Goals and observable outcomes.**
4. **Capabilities and scope** — stable IDs, description, MVP/later/out of scope, and delivery status.
5. **Constraints and confirmed decisions.**
6. **Working principles.**
7. **Data protection decisions** — conceptual inventory, source IDs, impact, status, and resolution point.
8. **Provisional slice sequence** — outcomes, covered capabilities, boundaries, dependencies, and activation conditions.
9. **Proposals and open questions** — decision needed, consequences, owner if known, and deadline/stage.
10. **Significant changes** — concise record of scope, priority, or decision changes.

Keep decision state (confirmed/proposed/open) distinct from delivery state (planned/in progress/validated). For existing products, cite specs or other evidence before claiming a capability is covered. A capability is not complete merely because one of its slices is finished.

`docs/quality-project.md`:

1. **Scope and source** — product/scope, date, and quality-catalog path plus version or exact commit/hash.
2. **Selected criteria** — source ID, concrete interpretation, scope, required-by event, expected evidence, and status.
3. **Conditional criteria and open applicability questions** — activation condition and review stage.
4. **Relevant exclusions** — source ID, reason, and change that would trigger reconsideration.
5. **Significant changes** — selection or interpretation changes and rationale.

Use concise entries or tables. Do not create empty rows for every catalog criterion. Add local IDs only when a catalog criterion needs subdivision or the product has a genuine local requirement; retain source IDs and label local requirements clearly.

Check coherence across MVP, constraints, privacy, quality requirements, and slice order. If a criterion implies an unplanned capability or procedure, expose the consequence and offer the minimal alternative without treating it as approved. Do not add speculative features such as accounts, organizations, dashboards, CAPTCHA, services, or infrastructure merely because a catalog mentions a risk.

The planning documents should make clear:

- Problem, users, and MVP boundary are understandable.
- Requirements are preserved or changes are explicit.
- Assumptions are not presented as confirmed decisions.
- Criteria have observable interpretations and required-by events.
- Relevant privacy decisions affect the plan.
- Slices are vertical, result-oriented, and have justified dependencies.
- Blocking next-step questions are distinguished from questions that can wait.
- Detailed architecture, implementation tasks, and speculative functionality are absent.
- Documents agree and avoid unnecessary duplication.
- Final state distinguishes a complete draft from a plan reviewed by the user.

### 9. Deliver and maintain

Present links to both documents, a brief summary of the organized scope, and only decisions needing attention. Provide complete drafts before asking for review. Do not proceed to architecture, specs, or implementation, and do not re-ask for decisions the user has already confirmed.

For later updates, revise affected sections when scope, priorities, data, users, providers, or dependencies change. Preserve stable IDs and log significant changes; do not rebuild the plan from scratch. When an increment closes, update capability coverage only with references to its spec and evidence. When a catalog changes, compare its actual differences before revising selections; a new catalog version does not automatically make every criterion applicable.
