# VS-03 Persistent round and selection

## 1. Status and references

| Field | Value |
|---|---|
| Spec ID | `003` |
| Slice | `VS-03 Persistent round and selection` |
| State | T01–T07 complete; local VS-03 spec validation passed against the user-accepted browser review scope |
| Capabilities | CAP-04; CAP-10 (round and appearance persistence) |
| Language | Product interface remains available in Spanish and English; user-authored concept text is not translated |

Acceptance-defining references:

- `docs/global-plan.md`, sections 3, 4, 5, 7, and 8 / Selected slice: outcome, confirmed product rules, privacy and retention boundaries, and this slice's scope and demonstration.
- `docs/app-flow.md`, FLOW-04 — Draw, mark, and start a round; confirmed user journey and recovery behavior.
- `docs/architecture.md`, sections 2, 4, 6, and 7 — trusted ownership boundary, atomic state changes, conceptual round/appearance model, and shared constraints.
- `docs/quality-project.md`, Q01–Q04, SEC01–SEC04, SEC08; `docs/catalog/data-protection.md`, DP02, DP10, DP12–DP14, DP16; `docs/catalog/verification.md`, V01, V03–V09.
- `docs/app-flow.md`, VIEW-03 and VIEW-06; `docs/design.md`, sections 3, 4.1–4.2, 5, and 6 — acceptance-defining visual and interaction constraints.
- Existing behavior and migration boundary: `specs/002-concept-management/spec.md` (closed VS-02), `supabase/migrations/20261117134700_vs02_concept_management.sql`, and `src/features/concepts/conceptService.ts`.

## 2. Context and objective

Concepts can already be managed in a private list, but their planned `pending` / `seen` state is not yet a study round: there is no persistent round lifecycle, appearance history, or random draw. This slice lets an authenticated owner work through a list round, preserve how concepts appeared, and begin again without erasing the prior round.

The product records selection actions and their order. It does not judge an oral explanation, infer learning, or create a practice record in this slice.

## 3. Actors and preconditions

- **Primary actor:** an authenticated Chucao user operating on a list they own.
- The list and its active concepts exist and are readable under the current authenticated account.
- If the list has no current round yet, the application must establish a usable first current round from its active concepts before offering round actions.
- Network and persistence may fail or return an uncertain outcome. The interface must distinguish confirmed state from an unresolved operation.
- Supported contexts are the existing responsive PC and Android browser application in Spanish or English. Round progress is persistent account data; an in-flight UI action is not a synchronized cross-device session.

## 4. Scope and exclusions

### Included

- Initialize or load the current round for an owned list and show its empty, available, seen, exhausted, loading, and failure states.
- Mark a pending concept as seen manually, or draw one pending concept uniformly at random.
- Record the appearance's order and whether it came from a draw or manual marking.
- Show a successful draw result, keep its description hidden, and allow return to the list. Returning without practice leaves the concept seen.
- Return a seen concept to pending without deleting its earlier appearance record.
- Keep both pending and practiced (seen) active concepts visible in List Detail, with a clear state label and the action appropriate to that state. Practiced concepts are unavailable to draws until returned to pending or a new round begins.
- Show practiced/active-concept progress on My Lists cards and refresh it after confirmed round changes.
- Start a new round with explicit confirmation; cancellation leaves current state untouched, while confirmation makes active concepts pending and preserves prior round appearances.
- Persist and retrieve round state for the authenticated owner after reload; enforce ownership at the trusted database boundary.
- Localized, accessible, responsive presentation consistent with the shared design system.

### Excluded

Timed or independent practice, forest animation and sound, practice records/notes/ratings, practice and round history screens, status filters for all/pending/practiced concepts (planned for VS-06 Advanced organization), bulk marking, list rename/delete and advanced organization, active-operation synchronization between browser sessions/devices, public sharing, publication, and release-wide browser conformance. This slice may show the newly drawn concept and its current-round appearance order, but does not add a general history view. Creating a round action must not create a practice.

Existing VS-01/VS-02 authentication, list/concept management, locale switching, and shell behavior remain preserved.

## 5. User scenarios

### US-01 — Work through a round

As an authenticated list owner, I want to draw a pending concept or mark one seen so that I can practice explaining the concepts in my list in a non-repeating order.

### US-02 — Correct progress and restart

As an authenticated list owner, I want to return a seen concept to pending or start a new round so that I can change current availability without losing the recorded appearances from prior rounds.

## 6. Functional requirements

### FR-01 — Current-round availability

When an owner opens an owned list, the system shall load its current round, or establish an initial round when none exists. Each active concept is pending or seen in that round. A concept added while a round is open shall join that round as pending. Deleted/tombstoned concepts are not active candidates and are never restored by a new round.

All state-changing round actions for one list shall be processed in a single order against the current state when each action is processed. Each distinct explicit action is evaluated in that order; same-intent retries return the original outcome without another state change or appearance.

For a list with no active concepts, the system shall show the empty-list state and the existing Add Concepts action; it shall not offer a draw or create an appearance.

### FR-02 — Round progress

While a current round is open, the interface shall communicate the number of active concepts seen/practiced and the number still pending. My Lists cards shall show practiced active concepts over total active concepts and reflect confirmed mark, return, and new-round operations without requiring a reload. A progress bar, if shown, shall have an equivalent numeric text label and shall not use color alone to convey state.

### FR-03 — Manual mark as seen

When the owner marks a pending concept as seen, the system shall persist its seen state and one manual appearance in the current round, with a unique position following prior appearances. It shall confirm the action only after persistence is confirmed.

A seen concept cannot be marked seen again through this action. If another action has already changed the target out of pending, the mark shall be rejected without adding an appearance or changing progress.

### FR-04 — Draw a pending concept

When the owner requests a draw, the system shall select uniformly from concepts pending in that list's current round when the request is processed, atomically mark the selected concept seen, and record one draw appearance with its position. No seen or deleted concept is eligible.

While a draw is processing, the initiating flow shall prevent duplicate submission. Repeating the same request shall return its original outcome and shall not record another appearance. On confirmed success, Draw Result shall show the selected concept's title and current-round appearance position, keep its description hidden, and offer Return to List. Returning leaves it seen. Practice is deferred to VS-04; no active or placeholder Practice action is required by this slice.

If no concept is pending, the draw action shall be unavailable and the exhausted-round state shall offer Start New Round.

### FR-05 — Return a seen concept to pending

When the owner returns a seen concept to pending, the current-round availability shall change to pending while prior appearances remain unchanged. A later mark or draw may record another appearance at a later position. The system shall confirm only a persisted change; repeated return-to-pending shall not create an appearance.

### FR-06 — Start a new round

When the owner chooses Start New Round, the system shall explain that the current round will close, its appearance history will remain, and active concepts will become pending in the new round. The owner may cancel or confirm.

- On cancellation, current-round identity, progress, and appearances remain unchanged.
- On confirmed success, the former round is closed, a new current round is established, all currently active concepts are pending, and prior round appearances remain available as history data.
- Deleted/tombstoned concepts are not reactivated.
- The UI shall show success only after the change is confirmed. A repeated confirmation shall not create multiple unintended current rounds.

### FR-07 — Persistence and retrieval

The system shall preserve current round identity, active availability, and recorded appearances across reloads for the same owner. Reopening the list shall show the persisted state and shall not create a duplicate appearance or round.

### FR-08 — Ownership and permitted state changes

Round and appearance reads and writes shall be limited to the authenticated owner of the parent list, including direct requests using known or guessed identifiers. The trusted boundary shall validate allowed transitions and derive ownership from the authenticated identity; client-supplied ownership or state assertions shall not grant access or bypass rules.

Unauthenticated or cross-user attempts shall not disclose another user's list, concepts, round, or appearance content and shall not change persisted state.

### FR-09 — Localized and safe presentation

Round actions, progress, confirmations, loading, success, empty, exhausted, failure, retry, and unresolved-result states shall be available in Spanish and English. User-authored concept titles shall remain unchanged and render as text. Errors and notifications shall not expose another user's data or sensitive diagnostic values.

## 7. Applicable non-functional requirements

- **NFR-01 (Q01, Q02):** Loading, processing, confirmed success, failure, retry, cancellation, repeated action, and uncertain outcome must reflect the persisted result truthfully. A failure shall not consume an extra concept, create duplicate appearances, or silently replace confirmed data.
- **NFR-02 (Q03):** Keyboard and touch users shall be able to operate the included views. Provide visible focus, accessible names, clear disabled/processing states, understandable errors, and non-color status cues. Preserve responsive behavior and long-title wrapping on supported PC and Android browser targets.
- **NFR-03 (Q04, SEC08):** Round reads and state changes shall remain bounded for realistic personal lists. No arbitrary list maximum or response-time target is introduced here; if implementation needs a specific bound, justify and resolve it before implementation.
- **NFR-04 (SEC01, SEC04, DP10):** Enforce ownership and legal transitions at the trusted boundary; UI hiding alone is insufficient. Direct unauthenticated and cross-user operations must be rejected.
- **NFR-05 (SEC02, SEC03):** Concept titles and historical title snapshots shall be handled as parameterized plain data and rendered without executing markup or changing query meaning.
- **NFR-06 (DP02, DP03, DP12–DP14, DP16):** Round and appearance data shall be limited to the selection/progress/history purpose, kept private, protected from auxiliary disclosure, and handled according to the global retention rules. A title edit shall not silently alter the title snapshot of an earlier appearance. On concept deletion, replace the historical displayable title with a deletion marker; history consumers shall display the localized equivalent of “Deleted concept” and shall not reveal the deleted title. Preserve appearance order/origin and only the minimum reference needed to retain that history. Deleted concepts shall not re-enter active rounds. Real-user deployment transport and provider operations remain publication evidence, not local-slice claims.
- **NFR-07 (Q06):** Reuse established React, Supabase, localization, and migration patterns. Do not add a new provider, privileged browser key, analytics, or unrelated infrastructure for this slice.

### Verification scope note

The technical plan should choose only focused automated tests that meaningfully protect new VS-03 business rules and changed persistence/ownership boundaries (for example: availability transitions, one appearance per confirmed action, new-round preservation, safe retry, and cross-owner rejection). It should not add tests for unchanged VS-01/VS-02 behavior or test static visual styling as code behavior. Review the visual design and accessibility in the running interface; select broader regression checks only when the changed dependency or risk justifies them. Exact test files, fixtures, tools, and commands belong in the technical plan.

## 8. Errors, boundaries, and preservation

| Condition | Required observable result and permitted effects |
|---|---|
| Empty list | Explain that no active concepts are available and offer Add Concepts. No draw, round appearance, or false success. |
| Exhausted round | Disable drawing and offer Start New Round. Current history remains unchanged until confirmation. |
| Repeated mark, return, or confirmation | Keep the resulting state truthful; do not append an appearance or create an extra round for a duplicate submission. |
| Draw failure before confirmation | Show no result as if committed; do not consume another concept. Keep a safe retry path. |
| Timeout or ambiguous response | Reconcile against persisted state before retrying where possible; otherwise state that outcome is unresolved and avoid blindly issuing an action that could consume another concept. |
| Concurrent draw/mark operations | Process actions for one list in a single order against current state. Same-intent retries cannot consume multiple concepts; distinct draws use the next eligible pending concept, while a mark targeting a concept that is no longer pending is rejected without a second appearance. |
| New-round cancellation/failure | Cancellation is a no-op. Failure does not claim reset; reload/retry must not lose the last confirmed round/history. |
| Expired session | Protect all persisted state, explain the need to reauthenticate, and do not present an unconfirmed action as saved. |
| Cross-user or unauthenticated request | Reject at the trusted boundary without content disclosure or state change. |
| Deleted concept | Exclude it from draw, progress availability, and new-round reset. Replace its historical displayable title with a deletion marker; history consumers show the localized equivalent of “Deleted concept” while preserving appearance order/origin and only the minimum reference needed. |
| Edited concept title | Keep concept identity and current availability; prior appearance title snapshot remains the title used at that appearance. |
| Language change | Translate interface and feedback while preserving concept text, current persisted progress, and the current navigation context. |

## 9. Flow and visual design references

### Acceptance-defining behavior

- `docs/app-flow.md`, **FLOW-04 — Draw, mark, and start a round**: entry from non-empty List Detail, draw, manual mark, return-to-pending, new-round confirmation, empty/exhausted behavior, and recovery.
- `docs/app-flow.md`, **VIEW-03 — List Detail**: existing back control, centered list title, concept collection, and add action remain the entry context.
- `docs/app-flow.md`, **VIEW-06 — Draw Result**: result dialog visual reference. Practice is added when VS-04 is delivered; until then this slice exposes Return to List only.

### Visual constraints

- `docs/design.md`, **sections 3, 4.1, 4.2, 5, and 6**: warm cream and coffee-brown visual language, existing semantic action colors, responsive cards/panels, numeric text alongside round progress bars, clear pending/seen status beyond color alone, dialog focus entry/return, distinct loading/error states, and reduced-motion-safe non-timer progress presentation.
- Keep the established List Detail composition from VIEW-03. Add round progress and actions in the existing content hierarchy so the list remains easy to scan on mobile and desktop. Use the warm cream Draw Result dialog with a darkened warm backdrop and centered concept title; keep the concept description hidden on first display as required by FLOW-04. At VS-03, the result offers Return to List; add Practice only with VS-04.
- These references define behavior and visual constraints; they do not claim that implementation or accessibility review has occurred. No separate mockup is an acceptance source for this slice.

## 10. Acceptance criteria

### AC-01 — First round and empty state (FR-01, FR-02)

Given an owned list with three active concepts and no existing round, when the owner opens List Detail, then one current round is available with all three concepts pending and progress reflects three pending and zero seen. After reload, the same round and availability are shown. For an empty list, draw is absent/disabled and Add Concepts is offered without creating an appearance.

If an active concept is added while a round is open, it joins that current round as pending and is included in the available/pending count.

### AC-02 — Manual appearance (FR-03)

Given an owned current round with a pending concept, when the owner marks it seen, then its availability changes, one manual appearance is recorded at the next position, and progress updates after persistence confirmation. Repeating the action does not create another appearance.

### AC-03 — Uniform draw, result, and exhaustion (FR-04)

Given a round with pending concepts, when the owner draws, then exactly one pending concept is selected by the trusted operation and recorded once as a draw appearance. The result shows its title and appearance position with its description hidden; returning to the list leaves it seen. Drawing until no pending concepts remain results in an exhausted state with no further draw and an available new-round action.

The product rule is equal selection probability among eligible pending concepts; a demonstration of one draw is not by itself statistical proof of uniformity. The implementation evidence must verify the selection rule at the appropriate level.

### AC-04 — Return to pending (FR-05)

Given a seen concept with at least one appearance, when the owner returns it to pending, then it becomes eligible for a later draw, while the prior appearance remains unchanged. A later selection creates a later appearance rather than rewriting the earlier one.

### AC-05 — Cancel and confirm new round (FR-06)

Given a round with both pending and seen concepts and recorded appearances, when the owner opens Start New Round and cancels, then the round and all progress/history remain unchanged. When the owner confirms instead, then the old round is closed, a new current round exists, active concepts are pending, and all old appearances remain associated with the closed round. Tombstoned concepts remain inactive.

### AC-06 — Persistence and repeat recovery (FR-03–FR-07)

Given a confirmed mark, draw, return, or new-round operation, when the owner reloads or reopens the list, then the last confirmed round state and appearances remain. Repeating a request after an ambiguous response does not create an unintended second appearance or round; if the result cannot be resolved, the UI communicates uncertainty and offers a safe recovery path.

### AC-07 — Ownership and privacy (FR-08, NFR-04–NFR-06)

Given synthetic user A owns a list with a round and appearances, when unauthenticated user or synthetic user B attempts direct reads or writes using A's identifiers, then the trusted boundary rejects the request, no state changes, and no concept/round/appearance content is disclosed. A remains able to read and change their own round.

### AC-08 — Accessible localized responsive controls (FR-02, FR-04, FR-06, FR-09, NFR-02)

Given Spanish and English locales in Chrome and Brave on PC and in mobile mode, when a person uses keyboard or touch to view progress, draw, mark, return-to-pending, cancel, or confirm a new round, then labels, focus, status, feedback, and confirmation consequences are understandable in the selected locale, status is not conveyed by color alone, and the layout remains usable without horizontal overflow. User-authored titles remain unchanged. The owner accepted this focused browser-review scope for VS-03; broader release compatibility remains part of VS-07.

### AC-09 — Failure and concurrency integrity (NFR-01, NFR-03)

Given two distinct draw requests for the same list while at least two concepts are pending, when the requests are processed concurrently, then they are applied in a single order and each selects one concept that is pending when its action is processed. If two concurrent manual mark actions target the same concept, only the first changes it and records an appearance; the later action is rejected without a second appearance. Given a persistence failure, timeout, or repeated submission, no unconfirmed result is presented as success, no same-intent duplicate consumes another concept, appearance order remains valid, and retry or unresolved-result guidance reflects the actual persisted state.

### AC-10 — Deleted concept history (FR-07, NFR-06)

Given a concept with one or more appearances is deleted, when a history consumer reads those appearance records, then the deleted title is not present in displayable historical content, the localized equivalent of “Deleted concept” is shown, and each appearance's order and origin remain intact. The deleted concept is absent from current-round availability.

## 11. Dependencies and shared constraints

- VS-01 and closed local VS-02 provide the authenticated session, private lists, concept identities and pending/seen field, tombstone behavior, localization, shell, and versioned migration conventions.
- Round/appearance persistence and trusted state operations do not exist yet; they are required for this slice and must preserve the established Auth UUID ownership chain and RLS policy.
- FLOW-04 and architecture require atomic selection/marking and safe retries. Exact tables, function contracts, algorithm implementation, and test tools are technical-plan decisions.
- Global deletion rules apply: concept deletion replaces the displayable historical title with a deletion marker while preserving minimum appearance metadata; list deletion removes active content while preserving only anonymized historical records. Physical anonymization and retention mechanics belong in the technical plan.
- Local acceptance uses synthetic accounts/data and local Supabase/Docker. Public registration, production transport/provider review, legal notice, backup operations, and release-wide browser validation remain later publication requirements.

## 12. Completion criteria

The slice is acceptable when:

- Every included requirement has evidence through its linked acceptance criteria.
- The complete local journey (open list, mark/draw, recover progress after reload, return an item to pending, cancel/confirm a new round) works with persisted synthetic data.
- Trusted ownership rejects direct access from another account, and failures/retries preserve integrity.
- Existing VS-01/VS-02 list, concept, locale, and shell behavior remains intact.
- The responsive presentation follows the cited Chucao visual system and receives a focused accessibility review; visual appearance alone does not establish persistence or authorization.
- Applicable Q01–Q04, SEC01–SEC04, SEC08, DP02, DP10, DP12–DP14, and DP16 conditions are reviewed with evidence and limitations recorded. No publication readiness is claimed.
- The technical plan identifies only necessary focused automated tests for new or changed VS-03 behavior and persistence boundaries, plus proportionate manual visual/accessibility and integrated-flow checks.

## 13. Open questions

No unresolved behavior questions remain. The former technical questions Q-03 and Q-04 are resolved in `plan.md` and recorded below.

### Clarification decisions incorporated

- **CL-01:** Concurrent list actions are processed in a single order against the state current when each is processed. Repeated same-intent requests return the original outcome; a mark that is no longer valid is rejected without an appearance.
- **CL-02:** Concepts added during an open round join it immediately as pending.
- **CL-03:** VS-03 Draw Result offers Return to List. Practice is introduced with VS-04; FLOW-04 and VIEW-06 now state this staged behavior.
- **CL-04:** Concept deletion replaces the displayable historical title with a deletion marker; history shows the localized “Deleted concept” label and preserves only appearance order/origin and the minimum reference needed. Global and architecture wording is aligned.
- **CL-05:** The initially accepted review target was the current and previous Chrome, Edge, and Firefox versions on PC, and Chrome on Android. For VS-03 local validation this target is superseded by CL-06; broader release compatibility remains deferred to VS-07.
- **CL-06:** The owner accepts review in Chrome and Brave on PC and mobile mode as sufficient to close VS-03. The owner confirmed all included flows work in those contexts. This is a slice-level validation scope decision; it does not claim support/version conformance for other browsers or replace the broader VS-07 release review.
- **Q-03 (accepted technical decision):** Use a minimal PostgreSQL round-operation ledger keyed by list and client operation UUID; retries reuse the same UUID and return the original recorded outcome. Store no authored text; retain records with round history and clear/anonymize them with that history. Detailed contract is in `plan.md`.
- **Q-04 (accepted technical decision):** On future permanent list deletion, remove event-level round/appearance details and retain only anonymous round totals, with owner/list/concept identifiers, user content, operation UUIDs, exact event timestamps, per-concept order, and origin removed. List deletion itself remains outside VS-03. Detailed schema direction and DP14 review condition are in `plan.md`.

