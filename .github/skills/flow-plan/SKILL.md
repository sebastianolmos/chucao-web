---
name: flow-plan
description: Create or update a product's app-flow document from user requirements, flow references, and project evidence, distinguishing agreed behavior from proposals and stopping before visual design or implementation.
---

# Application flow planning

Create or update `docs/app-flow.md` to describe the product's general navigation, main user or consumer journeys, transitions, states, and known conditions. Document how the product is used and what happens during important flows; leave detailed behavior for later specifications.

Work with the user in Spanish unless they request another language. Write the document in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording when translation would change meaning.

## First interaction: identify flow material

First determine whether the user already supplied a flow document, diagram, prototype, or clear reference. If so, use it; do not ask for it again.

If no reference is identified, ask:

> ¿Tienes algún documento o prototipo con los flujos y las vistas que quieres? Puedes adjuntarlo, pegar su contenido o indicar una ruta o enlace; preferiblemente Markdown con diagramas. Si no lo tienes, basta con que me describas cómo imaginas que una persona usaría el producto y te ayudaré a definir los recorridos mínimos.

Do not presume the answer or treat silence as confirmation that no reference exists. While waiting, you may inspect project context, but do not commit to views or transitions based on assumptions.

If material exists, read the relevant document fully or inspect the accessible prototype. Identify views/nodes, actions, decisions, states, inputs, and outputs. Preserve useful intent and detail. Distinguish explicit transitions from inferred ones: a static mockup shows a view, not necessarily what its buttons do. If a reference is inaccessible or incomplete, explain what is missing and request an export or description; do not claim to have analyzed it.

Accept diagrams, images, and narratives. Do not require a particular tool or force the user to convert everything to Markdown.

If the user has no reference, ask brief questions grouped around the main journey:

1. Who uses the product and what do they want to accomplish?
2. What do they find when they open or start it?
3. What actions do they take to reach their goal?
4. What result do they see, and what can they do next?
5. What constraints or special situations are already known?

Use the global plan where available and do not repeat answered questions. Accept informal or incomplete descriptions. Turn them into a minimal proposed set of interaction points and journeys. Explain additions and ask only about uncertainties that change behavior; do not mark unaccepted proposals as confirmed.

## Inputs and boundaries

Read, if available:

- `docs/global-plan.md` for the problem, users, capabilities, MVP, constraints, and privacy decisions.
- `docs/quality-project.md` for criteria affecting interaction, access, states, or recovery.
- `docs/app-flow.md` for the existing document to preserve or update.
- Applicable repository instructions.

Consult `docs/architecture.md` only when it clarifies relevant platforms, boundaries, or conditions. Consult existing designs or implementation when documenting current behavior. Consult original catalogs only to clarify a relevant criterion or analyze a new need; do not repeat their lists or reselect project quality.

If an important document is missing, ask for its location and continue with available information. Do not invent its contents; record which decisions remain conditioned on its absence.

This stage outputs only `docs/app-flow.md` unless the user explicitly requests other changes. Do not implement code, create a new prototype, or modify other documents. Do not proceed to visual design, agent instructions, specs, or implementation.

Distinguish confirmed, proposed, and open flows, and distinguish implemented behavior from planned behavior. Preserve confirmed requirements. If a reference conflicts with the global plan or implementation, state the discrepancy and its effect rather than silently choosing which one overrides the other.

Do not invent login, onboarding, profiles, dashboards, organizations, settings pages, or other features to fill out the flow. An obligation does not automatically require a new screen. Keep the MVP distinct from later journeys, retaining future detail the user already supplied without speculative additions.

Document observable behavior, not endpoints, tables, component structure, CSS, or visual design decisions. An empty state, error, dialog, or panel does not automatically require a separate view. For non-graphical software, describe commands, inputs, outputs, or consumer interactions instead of inventing screens.

## Procedure

### 1. Identify actors, goals, and interaction points

Extract actors, goals, entry conditions, and expected results. Identify only the views or interaction points needed for MVP journeys. Give each a stable ID such as `VIEW-01`, a purpose, and main actions. An interaction point may be a screen, dialog, CLI command, or public library operation. Preserve existing IDs; do not assign an ID to every button or enumerate every control. Link to real capability IDs from the global plan when available.

### 2. Describe general navigation

Explain how users enter, move between areas, return, exit, or finish. Include only conditions that affect behavior, such as session, role, prior selection, or data availability. Consider direct entry, back navigation, reload, or restart when relevant to the platform; do not assume every user starts at a home screen.

Distinguish navigation from data-changing actions. Opening a view and saving a resource are separate transitions even when they happen in the same screen.

### 3. Define primary journeys

Give each journey a stable ID such as `FLOW-01`. Record:

- Goal and actor.
- Capability and scope (MVP or later).
- Definition state (confirmed, proposed, or pending).
- Entry and preconditions.
- Ordered actions and observable responses.
- Conditions that change the path.
- Final result and data effects the user needs to understand.
- Relevant cancellation, exit, and recovery.
- References to criteria and decisions that actually constrain the journey.

A journey must be followable from entry to result; a disconnected list of views is not enough. Do not turn the document into an exhaustive spec. Leave unknown local details for the relevant spec.

### 4. Include relevant states and alternatives

Consider the successful path and foreseeable failures that change the experience. Include only cases relevant to the product, such as first use/no data, waiting/loading, invalid input, success or failure, cancellation/unsaved changes, missing resources, denied or expired access, network/storage/dependency failure, retry and duplicate-effect prevention, or confirmation/recovery of destructive actions.

For each relevant alternative, say what the person sees, what options they have, and what data or progress is retained. Shared behavior can be defined once and referenced. Do not claim success before an operation completes. Where persistence or an operation is asynchronous and that matters to the experience, distinguish pending from confirmed results.

If behavior is not agreed, label a proposal or ask a question; do not invent a requirement.

### 5. Reflect quality and privacy in interactions

Include observable consequences of selected criteria and decisions when they apply, such as understandable errors and recovery, information before data collection, accessible privacy information, consent and withdrawal, clarity about deletion/retention/sharing, distinctions between sign-out/session closure/account deletion, and behavior for usage limits or insufficient permissions.

Reference real IDs of quality criteria and global-plan decisions. Do not prescribe colors, typography, or layout. Hiding an action in navigation is not authorization; describe the user-facing denial without presenting navigation as a substitute for technical controls.

If a needed product or privacy decision is missing, state its impact and when it must be resolved. Do not create new legal advice or change obligations in this document.

### 6. Represent flows clearly

Use Markdown as the base. Add Mermaid only when it makes branches or state changes clearer:

- Use a navigation overview when useful and separate diagrams for complex journeys.
- Label transitions with actions or conditions.
- Avoid one oversized diagram or nodes combining a view with several decisions.
- Reuse the same IDs and names in prose and diagrams.
- Explain details that would make a diagram hard to read.
- If unable to render a diagram, do not claim visual validation.

If a navigable prototype exists, link relevant views or journeys and identify its version/date when possible. Do not invent IDs or links. The document must remain understandable without the prototype. Do not transcribe every click of a large prototype or duplicate the same detail in prose, tables, and diagrams.

### 7. Draft and review

Create or update the complete document using this structure, adapting or omitting empty sections when that improves clarity:

1. **Status, scope, and references** — date, covered MVP, sources, and definition state.
2. **Actors and entry conditions** — roles and conditions that actually change journeys.
3. **Views or interaction points** — IDs, purpose, and main actions, not a visual component inventory.
4. **Navigation overview** — brief explanation and optional diagram.
5. **Main flows** — IDs, preconditions, sequence, result, and relevant alternatives.
6. **Shared interaction rules** — common states or rules that avoid repetition.
7. **Open questions and proposed behavior** — uncertainty, consequence, and resolution point.
8. **Future flows and significant changes** — references to defined future journeys and meaningful changes.

Do not reproduce the full roadmap. Keep sources and differences between current and planned behavior explicit.

Ensure every view has a purpose and each main journey has a clear entry, result, and exit. Look for dead ends, ambiguous transitions, actions without outcomes, unapproved requirements, and contradictions between prose, diagrams, and prototypes. Check that MVP capabilities have a journey or an explicit reason not to need one; internal capabilities do not all need a view.

Deliver the complete draft before requesting review of proposals. Highlight only questions that affect meaningful decisions; do not ask the user to approve routine transitions or reconfirm settled choices.

## Delivery and maintenance

Provide a link to `docs/app-flow.md`, summarize the journeys documented, and call out pending decisions. Distinguish a prepared draft from flows confirmed by the user.

When an approved decision changes navigation, states, or observable behavior, update affected flows, preserve IDs, and record significant changes. A proposal in a spec plan is not an implemented feature. After a spec is implemented and validated, synchronize affected sections and prototype links if applicable. If prototype and product diverge, record the difference and the decision explaining it; do not assume either is automatically authoritative.
