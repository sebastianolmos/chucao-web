---
name: create-agents
description: Create or update a concise, project-specific AGENTS.md and only the necessary agent adapter from confirmed project conventions, commands, architecture, and quality requirements.
---

# Prepare project agent instructions

Create or update `AGENTS.md` at the repository root as a concise reference for everyday work. Keep it generic across agent providers while adapting it to the actual project. If the selected agent requires another entry file, create only the necessary adapter.

Work with the user in Spanish unless they request another language. Write generated files in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording where translation would change meaning.

This task prepares instructions only. Do not implement features, install tools, create pipelines, or modify unrelated files to complete the document.

## Inputs and reconnaissance

Read applicable existing instructions, including any `AGENTS.md`, `CLAUDE.md`, or equivalent that may be updated. Preserve useful rules and specific extensions after reviewing them; do not overwrite them blindly.

Consult, when present:

- `docs/global-plan.md` for purpose, principles, constraints, and confirmed decisions.
- `docs/architecture.md` for confirmed stack and organization.
- `docs/quality-project.md` for selected quality requirements.
- Relevant sections of `docs/app-flow.md` and `docs/design.md`.
- README, manifests, scripts, tool configuration, and CI for real commands.
- The actual `specs/` structure and status conventions.

Read code only as needed to confirm conventions or paths. Do not load the entire repository or catalogs without a concrete reason. If there is no code yet, say so and do not treat planned architecture as evidence of executable commands.

Identify the target agent when already specified. If it is not specified, create `AGENTS.md` and ask about an adapter only when that decision is needed. Do not create files for every possible agent.

## Resulting document rules

Keep the document brief, concrete, and verifiable; approximately 60–120 lines when the project permits. Include stable facts, operational rules, and references. Exclude tutorials, complete catalogs, conversation history, and copies of source prompts.

Do not import rules from another project. Language, dependencies, commands, and tooling must come from actual project evidence or confirmed decisions. Do not reference `docs/constitution.md`; global principles and technical decisions belong in their existing documents. Do not turn routine decisions into repeated permission requests.

Do not claim Markdown instructions provide a technical security barrier. Do not invent files, commands, tools, skills, or automatic loading mechanisms. Keep one authoritative version of shared rules.

## Procedure

### 1. Summarize the project and conventions

Write two or three sentences covering the product purpose, type, and known structure or stack. Distinguish implemented facts from planned architecture where relevant.

Include only important working conventions: code, documentation, and message languages; formatters; relevant organization; and confirmed restrictions on dependencies or interfaces. Reference detailed source documents instead of copying them. If a convention is not established, do not state it as mandatory; ask only when the omission materially affects upcoming work.

### 2. Record real commands

Find commands for running, building, type-checking, testing, formatting, and linting when those capabilities exist. For each relevant command, state its working directory, purpose, and essential prerequisites without secrets. Distinguish checks from commands that modify files, such as formatters.

Verify command definitions in scripts or configuration. When safe and useful in the authorized environment, execution may provide evidence, but distinguish defined from successfully executed. Never run deployments, destructive migrations, or scripts with unknown effects merely to test them. Record missing environment or unavailable checks.

If no test or build command is configured, state that fact; do not invent commands based on the language or stack. Do not install a test suite for this task.

### 3. Define active-work discovery

State this decision rule:

1. Use the spec and task named in the current request.
2. If none are named, consult the existing tracking mechanism and its status.
3. If there is exactly one unambiguous candidate, identify it before acting.
4. If there are multiple candidates or insufficient information, ask for clarification before changing code.

Do not select a spec from the highest folder number, newest date, or first unchecked item. Do not keep a permanently “active” path in `AGENTS.md`.

For implementation, read the selected increment's `spec.md`, `plan.md`, relevant `tasks.md` task, and required dependencies or decisions. Follow the repository's real structure; if it does not exist yet, describe the intended convention as planned. Planning or documentation work does not require inventing an active spec. For small authorized fixes outside the cycle, preserve scope and ask only when a functional decision is missing.

### 4. Define conditional reading

Include a concise map like this, adapted to actual project paths:

| Work | Read relevant context |
| --- | --- |
| Scope, priorities, or slice selection | Global plan and actual capability status |
| Shared technical decisions | Affected architecture sections |
| Navigation, states, or interaction | Related app flows |
| Presentation and visual components | Design and relevant mockups |
| Persistence | Conceptual ownership rules and executable schema/migrations |
| Increment quality | Applicable quality-project criteria |
| New data, purposes, providers, or exposure | Global privacy decisions and relevant data-protection catalog sections |
| Verification planning or review | Relevant verification catalog sections |
| Scope changes affecting quality | Quality catalog and project selection |

Make reading conditional by task rather than requiring every document on every turn. Read more when a concrete dependency requires it. If catalogs exist at `docs/catalog/verification.md`, `docs/catalog/data-protection.md`, or `docs/catalog/quality.md`, reference them conditionally; do not import all their contents automatically.

Verification criteria should be distributed through the spec, plan, and tasks. Do not create a verification file for every spec.

### 5. Set autonomy and boundaries

Allow routine details within agreed scope to be resolved using existing patterns without repeated confirmation. Request intervention when a missing decision changes behavior, scope, important dependencies, shared architecture, contracts, data processing, or cost. Proceed within the limits of already authorized decisions.

Before destructive actions, publication, access to real data, or external effects, confirm authorization. Preparation does not authorize deployment.

Require the agent to:

- Preserve unrelated changes and never revert them without authorization.
- Avoid secrets and unnecessary real data.
- Avoid expanding functionality.
- Never weaken tests or quality criteria to hide failures.
- Never change requirements retroactively to match an incorrect implementation.
- Never rewrite these rules to bypass a boundary.

Allow updates to task states, evidence, and affected documentation within authorized work. Substantive requirement or decision changes require explicit resolution; do not prohibit legitimate maintenance of specs or tasks.

### 6. Define verification and completion

For implementation, work on the authorized task and its dependencies without automatically moving to unrelated functionality. Run applicable project checks and required checks, scaled to change and risk rather than imposing the entire suite on every documentation change.

Record commands run, results, and limitations. Distinguish passed, failed, skipped, and not-run checks. If a check fails, diagnose and correct within scope; if blocked, explain why and do not mark work complete while mandatory verification remains pending.

Require a concise completion report covering:

- What changed and which task or criterion it addresses.
- What was checked and the result.
- What was not checked and remains pending.
- What decision or human review is still needed.
- What documentation or state was updated.

Do not require full logs in every response; link or reference detailed evidence when available.

### 7. Prepare only necessary adapters

Check the selected agent's supported instruction mechanism using current official documentation when needed. Do not assume imports, filenames, or hierarchy work identically across agents.

For Claude Code, if an adapter is needed, create `CLAUDE.md` beside `AGENTS.md` containing the actual line `@AGENTS.md`, outside a code block. Preserve existing Claude-specific instructions and avoid duplicating common rules. If the configuration already loads `AGENTS.md`, do not add a redundant bridge.

For other agents, use their supported mechanism and keep common rules in `AGENTS.md` where possible. If imports are unavailable, explain the limitation and the required reference method; do not promise automatic synchronization. Do not use imports for every conditional document.

### 8. Review and deliver

Review paths, commands, duplicate rules, contradictions, and references to absent documents. Mark future paths as planned rather than available. Ensure the rules do not require loading all context or approval for every action, while retaining clear limits for material decisions.

Create only `AGENTS.md` and adapters that are actually necessary. Deliver the complete files, links, operational decisions, and commands or loading mechanisms that could not be verified. Do not proceed to slice selection or implementation.

## Suggested `AGENTS.md` structure

Adapt this structure to keep the file short:

1. **Project** — purpose and where details live.
2. **Commands** — real commands and execution prerequisites.
3. **Conventions** — confirmed shared rules.
4. **Active work** — how to locate the spec and task, including out-of-cycle work.
5. **Read as needed** — conditional context map.
6. **Working boundaries** — autonomy, limits, and decision changes.
7. **Verification and completion** — checks and final reporting.

Do not copy this skill's procedure into the generated file.

## Maintenance and delivery

Provide links to `AGENTS.md` and any adapter, summarize operational decisions, and identify unverified commands or loading mechanisms. Distinguish inspected, executed, and pending work.

Update the instructions when commands, structure, conventions, or shared rules change; do not use them as a daily progress log. Keep increment states and evidence in the increment documents. Review subdirectory-specific instructions when they appear; do not create nested instruction files in advance.

When a rule applies only to one area or needs a long procedure, keep a concise reference and place the detail in the project's appropriate mechanism. Do not fragment instructions without a real need.
