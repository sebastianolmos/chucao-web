---
name: clarify-spec
description: Review and clarify a slice specification by finding material ambiguity, omissions, conflicts, and unverifiable behavior, then incorporating the user's decisions into the same spec.
---

# Clarify a specification

Review `specs/<id>-<increment-name>/spec.md`, identify material requirements issues, and help resolve them with the user. Incorporate agreed decisions into that same spec. The clarification stage prepares the increment for technical planning; it does not implement the feature.

Work with the user in Spanish. Preserve the existing language of the spec and product messages. For new document content without an established convention, use the project's documented language convention.

## Review contract

Read the complete spec, including requirements, examples, acceptance criteria, exclusions, references, and open questions. Locate it from the supplied path or the repository's tracking mechanism. If multiple candidates exist without a clear selection, ask for the target; never choose the highest-numbered or newest folder automatically.

Read the corresponding slice and relevant decisions in `docs/global-plan.md`. Review applicable sections of:

- `docs/quality-project.md` for selected criteria and concrete applicability.
- `docs/catalog/data-protection.md` and the global privacy decisions for omitted behavior or unsupported exclusions.
- `docs/catalog/verification.md` for observable results, errors, limits, and preservation conditions.

Use the spec's IDs, scope, and references to focus the review. Consult app flows and design for affected views, states, journeys, or visual references. Consult architecture, prior specs, and existing contracts when dependencies, shared constraints, or compatibility need confirmation.

If a reference is missing or inaccessible, record what part of the review is limited and request only the necessary information. Do not invent its content.

Keep decisions, requirements, and scope intact unless the user changes them. Do not write code, a technical plan, tasks, a permanent review file, a per-spec verification file, or a separate constitution.

## First phase: detect only

The first review response must contain only numbered findings. Do not propose solutions, select values, modify the spec, or conduct a complete interview before the user responds.

### 1. Check coherence and meaning

Find:

- Ambiguities that permit materially different implementations.
- Contradictions among requirements, rules, examples, and acceptance.
- Undefined terms, actors, permissions, or states.
- Decisions presented as confirmed without support.
- Dependencies assumed available without relevant evidence.
- Conflicts with the selected slice or shared decisions.

For an ambiguity, show the competing interpretations admitted by the text without choosing one. If an EARS requirement has an imprecise condition or response, identify the meaning problem; the presence of `WHEN` or `SHALL` does not make a requirement verifiable.

### 2. Find relevant omissions

Trace the main scenario and relevant alternatives. Depending on the behavior, inspect:

- Invalid, empty, duplicate, and boundary inputs.
- Repetition, cancellation, retry, and interruption.
- Existing data and effect preservation.
- Denied access and resource ownership.
- Persistence or external-dependency failures.
- Dates, ordering, equality, or concurrency.
- UI states needed to understand and complete the journey.

For each omission, explain what result is currently undetermined and how it relates to the increment. Do not invent hypothetical cases without impact on the selected scope.

### 3. Review acceptance and applicability

Check that requirements identify inputs or preconditions, action, expected result, and relevant effects. Find vague criteria, insufficient examples for important rules, thresholds without context, and compliance claims based only on intent.

Review exclusions and deferrals. Distinguish:

- Behavior outside the product or slice.
- Existing controls that must remain.
- Obligations required when the feature activates.
- Conditions required only for publication or real data.
- Applicability questions still open.

Flag deferrals that leave included behavior unprotected or lack a concrete resolution event. Missing test tools or schema details are not automatically functional ambiguity; first determine whether the behavior can be defined without that technical choice.

### 4. Contrast flow, design, and scope

Check that views, states, journeys, and results agree with the accepted references. Verify that external references identify a stable version or date; flag changing links that make acceptance uncertain.

Look for independent objectives grouped together, excessive variants, or dependencies that prevent reviewing the increment as one unit. In the first review, describe the scope problem and affected capabilities; defer a concrete split proposal until the resolution phase.

### 5. Present findings

Number findings with stable review IDs such as `CL-01`. Each finding must include:

- Category.
- Affected requirement, section, or reference.
- Brief evidence and concrete explanation.
- Consequence for behavior, acceptance, or scope.
- Required resolution timing.

Classify timing with a short rationale:

- **Resolve before planning** when it changes what will be built or how the result is judged.
- **Resolve during technical planning** when behavior is defined and only the mechanism is missing.
- **Resolve before a future condition activates** when the deferral is legitimate and explicit.
- **Editorial improvement** when meaning does not change.

Use the classification to guide work, not to make every observation a blocker. Group duplicate findings and preserve IDs while the review remains active. Prioritize consequences for scope, data, permissions, and acceptance.

If there are no material findings, say so and identify review limitations, if any. Stop after the findings and wait for the user's direction.

## Second phase: resolve with the user

When the user answers findings or requests resolution, start with findings affecting scope or conditioning other decisions. Ask concrete questions one at a time unless the user prefers grouping. Include the finding ID and explain what changes for each answer.

Use prior answers and avoid re-asking settled matters. If the user delegates a decision, resolve it within the stated constraints and record the choice. Silence is not acceptance. Move purely technical decisions to the technical plan while identifying the requirement they must satisfy; if a technical uncertainty affects viability, retain it as an explicit dependency.

When a response changes related requirements, stories, examples, limits, references, or acceptance, review those consequences. If it expands or splits the slice, explain the effect and agree on the boundary before presenting the new scope as confirmed. If it conflicts with a global decision, identify the document decision that must change. For material legal uncertainty, verify the official source or preserve the uncertainty and its effect.

## Third phase: update and re-review

Incorporate agreed answers into the affected requirements, rules, scenarios, examples, and acceptance criteria. Preserve existing IDs; use unused IDs for additions and retain traceability for removals.

Remove `[NEEDS CLARIFICATION]` only when the normative content resolves the decision. A conversation summary at the end cannot substitute for updating the requirement. Keep a short decision summary only when it clarifies a meaningful scope or behavior change.

For remaining questions, record the question, affected requirement, impact, and resolution timing. Keep legitimate deferrals and their activation conditions explicit. Update other documents only when authorized; if global plan, flow, or design synchronization is needed but not authorized, record the discrepancy.

Re-review affected parts to ensure that changes resolve the original finding, agree with other requirements and examples, support observable acceptance, preserve shared quality/privacy constraints, keep the slice manageable, and introduce no hidden decisions. A response may resolve several findings or create a new one; keep statuses visible without creating another review document.

## Readiness and status

The spec may be ready for technical planning when:

- Outcome, scope, and actors are sufficiently defined.
- Material behavior conflicts are resolved.
- Requirements have verifiable results.
- Relevant errors and boundaries have defined responses.
- Exclusions and deferrals have a basis and resolution condition.
- Applicable quality and privacy criteria are reflected in behavior.
- Required references are identifiable and material discrepancies are resolved.
- Remaining decisions can be resolved at a compatible later stage.

Technical choices may remain open for the technical plan. Distinguish them from questions that still change required behavior.

Use the project's status convention, such as `Ready for planning` when appropriate or `Clarification pending` when blockers remain. If user approval is part of the agreed workflow, record the user's actual decision; do not infer approval from silence.

Clarification evaluates the definition of the increment. Acceptance of an implementation requires later evidence.

## Responses

During the first review, output only numbered findings.

After incorporating answers, provide a link to the updated spec and a concise summary of:

- Resolved findings and incorporated decisions.
- Remaining questions and their impact.
- Decisions legitimately deferred to technical planning.
- Readiness for the next stage.

If the user requested detection only, keep the response at that review. If the user authorized resolution and updates, make the supported changes and stop when clarification is complete.
