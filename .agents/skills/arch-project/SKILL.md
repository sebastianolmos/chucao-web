---
name: arch-project
description: Create or update a project's shared architecture document from confirmed decisions, product plans, quality constraints, and implementation evidence without designing every future feature or changing code.
---

# Project architecture

Create or update `docs/architecture.md` with the project's known architecture, confirmed technical decisions, and unresolved questions. The architecture explains shared system boundaries and constraints for later specification work; it does not pre-design every feature or build the system.

Work with the user in Spanish unless they request another language. Write the document in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording where translation would change meaning.

## Scope and boundaries

This stage documents the known or agreed stack, platforms, responsibilities, connections, services, constraints, and conceptual data model. It ends with the architecture document. Do not create feature specs, detailed plans for every increment, implementation tasks, or code.

Update only `docs/architecture.md` unless the user explicitly requests additional changes. Do not modify code, dependencies, migrations, infrastructure, or unrelated documents. Point out related updates that may be needed without making them.

Do not add backend services, databases, accounts, queues, caches, microservices, layers, repositories, deployments, diagrams, ADRs, or a `constitution.md` merely to fill a template. A logical component does not imply a separate process, service, repository, or deployment.

## Inputs and evidence

Read:

- `docs/global-plan.md` for product scope, capabilities, constraints, privacy decisions, and open questions.
- `docs/quality-project.md` for selected quality criteria, their interpretation, and when they apply.
- `docs/architecture.md`, if it exists.
- Applicable repository instructions and technical decisions supplied by the user.

If code exists, inspect only relevant manifests, configuration, structure, contracts, and storage definitions. Avoid repository-wide exploration without a concrete question. Consult flows, designs, or existing spec plans only when they clarify an architectural decision.

Open original quality or privacy catalog entries only when needed to clarify a referenced criterion or assess a risk introduced by a new decision. Do not load or reproduce all catalogs by default.

If a needed document or decision is missing, ask for its location or the relevant decision and continue with independent work. Do not invent missing content or present an assessment that depends on unavailable information as complete.

Treat code as evidence of what is implemented, not automatic evidence of the intended decision. If code and documentation disagree, record the discrepancy; do not silently make the implementation the new policy.

## Procedure

### 1. Reconstruct the known system

Identify target platforms, distribution or execution model, initial capabilities, and shared constraints. Record confirmed technologies and, when there is an implementation, check the relevant manifests/configuration for actual tools and versions. Do not invent exact versions for unselected technologies; link manifests or lockfiles when they are the source of version detail.

Separate imposed requirements from preferences and reversible choices. Preserve explicit constraints, including learning goals, instead of replacing them only for convenience.

Distinguish decision state (`confirmed`, `proposed`, `open`) from implementation state (`existing`, `planned`, `unknown`). A technology can be confirmed but not yet installed.

### 2. Resolve only decisions needed now

Identify uncertainties that affect system boundaries, persistence, identity, access, providers, cost, or platforms. For each material question, state:

- What must be decided and why.
- Which part of the project depends on it.
- Whether it must be decided now or can wait for a specific spec.
- A recommendation and, when useful, one or two alternatives with tradeoffs.

Do not compare technologies exhaustively when the stack is already agreed. If advice depends on current compatibility, pricing, availability, or capabilities, consult official documentation and record the source and date. If this cannot be verified, state the limitation.

Ask brief questions only when answers materially affect architecture. Continue independent work while waiting, do not treat silence as approval, and do not ask again for decisions already authorized.

### 3. Describe components and communication

Identify only the main components needed to explain the existing or agreed system. For each, describe its responsibility and boundary, where it runs or what consumes it, main dependencies/connections, and whether it exists or is planned.

Use terminology appropriate to the product: UI and local logic, CLI and persistence, library and consumer, client and service, or another real arrangement. Distinguish business logic, presentation, storage, and integrations only where it improves understanding; do not require a separate folder, class, or service for each responsibility.

Explain important information flows: caller and callee, known mechanism, and which component validates, authorizes, or persists. Do not assume HTTP or a self-hosted server. Include local calls, files, IPC, APIs, events, or managed services when they apply.

For each external service, state its purpose, data received, delegated responsibility, operational dependency, and decision state. Distinguish selected services from candidates. Identify trust boundaries and where privileged credentials belong. An external dependency does not remove the application's responsibility for its access rules.

Include a compact Mermaid diagram only when it clarifies relationships or trust boundaries. Mark planned elements and avoid diagrams that merely repeat a simple list. Do not design future endpoints, messages, or contracts unless they are already agreed and constrain the system; link existing executable contracts.

### 4. Describe conceptual data and ownership

Document only known entities, relationships, and invariants: what each entity represents, confirmed relationships/cardinalities, who owns or may operate on the data, the source of truth, and rules such as resource membership or identity preservation.

Distinguish functional ownership of resources from legal controller/processor roles. If identity and content use separate systems, explain their conceptual linkage. Do not assume a mutable attribute such as email is a stable identifier.

Record local or remote persistence when agreed, without inventing a database where files or another mechanism suffice. Do not enumerate future columns, indexes, keys, tables, cascades, or migrations. Preserve only confirmed details that are architecturally important; defer the rest to the relevant spec plan. When storage is implemented, link executable migrations or definitions instead of maintaining a duplicate schema in this document.

### 5. Translate quality and privacy into technical constraints

Consider only selected quality criteria and privacy decisions that constrain architecture. For each relevant consequence, record its real source ID, resulting technical constraint or responsibility, decision state, when it must be resolved, and any uncertainty requiring later investigation.

Possible consequences, only where applicable, include enforcing permissions where the resource is controlled, keeping privileged keys out of clients, accounting for identity and content systems in deletion, making core logic testable without unnecessary interface dependencies, supporting committed platforms, and accounting for data or cost when selecting providers.

Do not copy the global plan or catalog criteria. Explain architectural consequences and reference their sources. A chosen mechanism is not evidence of compliance; for example, intending to use authorization does not prove permissions work. Test cases, tools, and commands belong in the relevant spec plan.

Testability does not require containers, interfaces, dependency-injection frameworks, or a complex architecture. If a criterion conflicts with the global plan or another selected criterion, present the discrepancy and options; do not weaken the criterion or expand the product silently.

### 6. Record important decisions

Keep shared decisions that explain the system's shape. Use stable IDs such as `ARCH-01` for important decisions, not for every observation. For each, record concise context, decision, state, rationale, and consequences. Include rejected alternatives only when they explain a meaningful choice.

Include brief technical principles only when they add useful architectural guidance, such as separating core rules from UI details when appropriate, introducing infrastructure only for justified needs, making trust/access boundaries explicit, and updating the architecture when a spec changes responsibilities or relationships. Do not impose a fixed number, declare principles immutable, or duplicate the global plan's general process rules.

## Document structure

Create or update `docs/architecture.md` using these sections, merging or adapting them to avoid repetition:

1. **Status and sources** — date, documented scope, source references, and distinction between existing and planned architecture.
2. **Technical context and constraints** — platforms, distribution, shared constraints, and link to the global plan.
3. **Agreed stack** — confirmed technologies, responsibility, state, and version references where available.
4. **Components and responsibilities** — logical boundaries and known execution/deployment boundaries.
5. **Communication and external services** — connections, dependencies, trust boundaries, and optional diagram.
6. **Conceptual data model and access** — entities, relationships, sources of truth, ownership, and general access rules.
7. **Cross-cutting technical constraints** — architectural consequences of selected quality criteria and privacy decisions.
8. **Architectural decisions** — important decisions, rationale, consequences, and useful technical principles.
9. **Open decisions and deferred detail** — question, impact, resolution condition or relevant spec, and owner if known.
10. **Implementation references and significant changes** — links to existing executable schemas/contracts and notable architecture changes.

Keep sections as concise as the decisions allow. If a section does not apply, say so briefly when its absence could be confusing; do not invent components to fill it.

## Review and delivery

Compare the document with the global scope and provisional slice order: describing the product's conceptual architecture does not imply building it all before the first increment. Preserve existing confirmed decisions, IDs, and valid references. Provide a complete draft and identify new decisions that need review. A proposal is not an approval, and implementation is not validated without evidence.

The document should make clear:

- The confirmed stack, target platforms, and main responsibilities.
- Which decisions are confirmed, proposed, or open, and what is actually implemented.
- Why each documented connection or external service is needed.
- How known data relates, who owns it, and how access is governed.
- Which quality and privacy constraints affect the design.
- Any discrepancy between documentation and code.
- The impact and resolution timing of open questions.
- That no exhaustive schema or speculative work for every future spec has been designed.
- Whether the document can guide the next stage or is blocked by a decision.

Deliver a link to the document, a brief summary, and only decisions needing attention. Stop at this stage; do not proceed to flows, design, `AGENTS.md`, specs, or implementation.

## Evolution with specifications

A spec may propose new components, tables, contracts, or relationship changes in its technical plan. Do not describe a proposal as implemented. When a shared decision is confirmed, mark it as planned; after implementation and validation, update its status and executable references. Keep spec-local details out of global architecture unless they become shared rules.

When a prior decision changes, retain a concise note of what replaced it and why. Keep the architectural explanation aligned with the system; migrations and executable definitions remain the source of concrete schema detail.
