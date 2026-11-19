# VS-05 Notes and History

## 1. Status and references

| Field | Value |
|---|---|
| Spec ID | `005` |
| Slice | `VS-05 Notes and history` |
| State | Closed for validated local scope (2026-11-19); publication readiness remains separate |
| Capabilities | CAP-07; CAP-10 for saved-data access |
| Language | Product interface remains available in Spanish and English; user-authored notes and labels are preserved verbatim. |

Acceptance-defining references:

- [`docs/global-plan.md`](../../docs/global-plan.md), sections 3–8 and **Closed slice: VS-05 Notes and history** — scope, dependencies, controls, and demonstration.
- [`docs/app-flow.md`](../../docs/app-flow.md), `VIEW-07`–`VIEW-09`, `FLOW-05`–`FLOW-07`, and section 6 — completion, independent practice, note handling, history, and abandonment rules.
- [`docs/design.md`](../../docs/design.md), sections 2–5 and 7; `VIEW-02`–`VIEW-09` — implemented visual language and local VS-05 closure/history presentations; release-wide visual/accessibility review remains separate.
- [`docs/architecture.md`](../../docs/architecture.md), sections 2, 4, 6–8 and `ARCH-06` — Auth UUID ownership, private persistence, history relationships, and transient timer boundary.
- [`docs/quality-project.md`](../../docs/quality-project.md), Q01–Q04, Q06, SEC01–SEC04, SEC08, WEB03; [`docs/catalog/data-protection.md`](../../docs/catalog/data-protection.md), DP02, DP03, DP10, DP12–DP16, DP18–DP19; [`docs/catalog/verification.md`](../../docs/catalog/verification.md), V01, V03–V10.
- Existing behavior to preserve: [`specs/003-persistent-round-and-selection/spec.md`](../003-persistent-round-and-selection/spec.md) and [`specs/004-timed-practice-journey/spec.md`](../004-timed-practice-journey/spec.md), including their recorded local closure evidence.

The app-flow and design documents define acceptance behavior and presentation. `VIEW-08` and `VIEW-09` are design references, not evidence of implemented screens. The existing authenticated shell, concept/list views, Draw Result, and timer provide the style and behavior to extend.

## 2. Context and objective

VS-01–VS-04 provide authenticated private lists/concepts, persistent rounds and selection, and a transient associated or independent timer. This slice lets a person explicitly save a completed practice with an optional note and rating, then review saved practices and rounds. Notes are distinct from concept descriptions. An abandoned or incomplete timer remains transient and never creates a practice record.

The slice completes the CAP-07 outcome through the same authenticated, responsive product. It does not add shared content, active timer recovery, or advanced list organization.

## 3. Actors and preconditions

- **Primary actor:** an authenticated Chucao user.
- Associated practice begins from an owned active concept's practice journey and retains its applicable concept, list, and round context.
- Independent practice begins without list or concept context. It is saved only if the user supplies a free-text label.
- A practice can be saved only after the VS-04 timer reaches completion. The user's session and the service boundary must still authorize the write.
- Local acceptance uses synthetic accounts and data with local Vite and Supabase. Supported product contexts remain Spanish/English PC and Android browsers; broad release compatibility remains VS-07.

## 4. Scope and exclusions

### Included

- Present a practice closure after timer completion, retaining associated context or providing an independent label field.
- Collect an optional note and optional satisfaction rating before explicit save. Rating values are integers 0–5; `Unrated` is distinct from 0.
- Save a completed associated practice, or a completed independent practice with a non-empty label, only after explicit submission.
- Edit or delete an associated practice note from its relevant concept/list context. For an independent practice, open its record from History to reach a separate practice-detail state where its note can be edited/deleted; the History list itself remains read-only. Deleting a note does not delete its practice or change its rating.
- Browse Practices and Rounds in History. Practice history supports filters by date, list, concept or independent label, practice type, and rated/unrated state. Entries expose the applicable date, duration, completion state, concept or label, rating/Unrated, and note presence. Round history exposes list, open/closed state, appearance order, and draw/manual origin.
- Preserve the originating context and filters on return where possible; provide localized loading, empty, validation, save, failure, and retry states.
- Enforce private access for every practice, note, and history read/write/delete using the authenticated owner identity at the trusted boundary.

### Excluded

- Saving a timer at start, saving an abandoned/incomplete timer, restoring an active timer, or syncing active sessions across browsers/devices.
- Draft/autosave while composing closure data; history editing of ratings or practice records; public/shared history; exports or analytics.
- Advanced list organization and concept-state filters in VS-06; release-wide browser/accessibility review and deployment in VS-07.
- Changing the existing round selection, timer controls, authentication, or concept-description behavior except where required to enter closure and preserve context.

## 5. User scenarios

### US-01 — Save an associated practice

As a user who completed a timer for a selected concept, I want to add an optional note and rating and explicitly save the practice, so that I can later review what I practiced without replacing the concept description.

### US-02 — Save an independent practice

As a user who completed an independent timer, I want to give the practice a label and optionally add a note/rating before saving, so that it can be identified in my private history.

### US-03 — Review practice and round history

As an authenticated user, I want to browse and filter my practices and inspect round appearances, so that I can review prior activity and distinguish unrated practices from a rating of zero.

### US-04 — Maintain a note

As a user, I want to edit or delete an associated practice note from its concept/list context, or an independent practice note from that practice's detail state, so that I can correct or remove my authored note without deleting its practice record.

## 6. Functional requirements

### FR-01 — Closure follows successful timer completion

When the timer reaches its completed state, the system shall make the closure/save journey available with the completed timer's duration and associated context, if any. The closure shall not be entered as a saveable completed practice if the timer was abandoned, interrupted, or incomplete. Returning or navigating away before explicit save shall not create a record or persist a closure draft. (CAP-05, CAP-07; Q01; DP02)

### FR-02 — Associated and independent practice identity

When saving an associated practice, the system shall retain its concept identity and applicable list/round context. When saving an independent practice, the system shall require a user-authored label of 1–50 characters after trimming leading/trailing whitespace; that label shall not create or modify a concept. A missing or whitespace-only label shall prevent save and explain the correction required. Validate using the trimmed value but preserve the user's original label verbatim when saving. (CAP-07; SEC01, DP02)

### FR-03 — Explicit save and optional rating/note

The system shall permit a completed eligible practice to be saved with no note and no rating. If a rating is provided, it shall be one integer from 0 through 5; absence is represented as `Unrated`, not `0`. A note is optional; if its value is non-empty after trimming, it shall contain no more than 2,000 characters after trimming. A whitespace-only note is treated as absent. Validate the trimmed note but preserve the user's original note verbatim when saving. A note and rating shall be collected before explicit submission. No persisted practice or note shall be created merely by opening closure or typing. (CAP-07; Q01/Q02; SEC01)

### FR-04 — Save outcome and recovery

The system shall report save success only after persistence is confirmed. If save fails, it shall retain the unsaved closure values in the current view, clearly report failure, and allow retry without creating duplicate practices or losing the entered values. A repeated submission of the same closure shall not create multiple practice records. After successful save, the system shall remain in VIEW-08, show confirmation, and wait for the user's chosen next action; saving alone shall not redirect. For an associated practice, offer return to its originating context, a fresh timer for the same concept, and Draw Another when pending concepts remain (otherwise Start New Round). For an independent practice, offer return to My Lists or a fresh independent timer. A fresh timer is a new unsaved session; it does not duplicate or alter the just-saved practice. (CAP-07; Q01/Q02; SEC01; DP13)

### FR-05 — Note edit and deletion

The owner shall be able to edit or delete an associated practice note from its relevant concept/list context. For an independent practice, opening its History entry shall lead to a distinct practice-detail state where the owner can edit or delete its note; the History list and practice rating remain read-only. Editing a note changes only an explicit saved update; cancelling edit discards the unsaved changes and preserves the last saved note. Saving a whitespace-only edit is rejected; the owner must use the separate delete action. If an update fails or conflicts with a newer saved version, retain the user's draft, show the failure/conflict without overwriting the saved note, and provide a recovery action. A note update shall not replace a concept description. A deleted note shall no longer be readable or shown as present in History, while its practice and rating remain. Deletion shall use the established destructive-action confirmation pattern; cancelling confirmation leaves the note unchanged. (CAP-07; Q02; SEC01–SEC04; DP10, DP14, DP16)

### FR-06 — Practice history and filters

History shall distinguish Practices from Rounds and show only records available to the signed-in owner. Practice entries shall identify the associated concept or independent label and show date, duration, completed state, rating or `Unrated`, and whether a note exists. The user shall be able to filter practices by date, list, concept/independent label, practice type, and rated/unrated state, and reset filters. Active filters across different criteria shall combine with AND; the date criterion shall use an inclusive start/end range in the current device's local time zone. Changing interface language shall not change matching results. Filter values shall be treated as data and shall not alter query structure. History entries and ratings are read-only. (CAP-07/CAP-10; Q01; SEC02, SEC04, SEC08; DP10)

### FR-07 — Round history and prior semantics

Round history shall show the list, open/closed state, and each appearance in its persisted order with whether it came from drawing or manual marking. When a concept is deleted, history shall preserve the historical title and clearly identify the concept as deleted using a localized status label or equivalent text treatment; deletion shall not make the concept active or available for practice. Permanently deleted lists shall expose only the already-agreed anonymized round totals; their practices and notes are deleted. A concept may have a round appearance without any practice. (CAP-04/CAP-07; SEC03/SEC04; DP10, DP13, DP14)

For legacy deleted appearances whose titles were already erased before VS-05, show the localized fallback "Concepto eliminado — título no disponible" / "Deleted concept — title unavailable". This exception applies only to those missing legacy snapshots; preserve available titles and all future deletion snapshots. Do not invent or reconstruct erased titles.

Anonymous round totals retained after permanent list deletion remain in database storage without an owner link and are excluded from private History. The deleted list's practices and notes disappear from that history. Do not restore account linkage or expose anonymous totals through public reads.

### FR-08 — Private data and safe presentation

Every practice, note, and history operation shall be limited to the authenticated owner's data at the trusted service/database boundary. Unauthenticated and cross-user requests shall be rejected without disclosing content or causing partial changes. Notes and labels shall render as user-authored text; errors, URLs, caches, and diagnostics shall not expose their content unnecessarily. (SEC01–SEC04; DP10, DP12, DP13)

### FR-09 — Localization and operation states

Closure, note maintenance, filters, and history shall provide Spanish and English interface labels, validation/errors, dates, and pluralized counts as applicable. They shall expose truthful loading, empty, success, failure, and retry states and shall remain understandable without color, hover, or sound. (CAP-08/CAP-09; Q01, Q03, Q06; WEB03)

## 7. Applicable non-functional requirements

- **NFR-01 — Visual and interaction continuity (Q03/Q06):** Build VIEW-08 and VIEW-09 using the existing authenticated shell, Chucao semantic palette, Comfortaa typography, coffee-brown structure, rounded controls, and solid offset-shadow/action conventions documented in `docs/design.md`. Reuse existing button, text-input, textarea, dialog, card/row, filter, toast, focus, and error treatments. Keep the closure's concept/context and next action visually clear. Do not introduce a visually separate design language or redesign implemented screens. The new views must adapt to one-column mobile layouts and wider desktop layouts, keep essential actions visible without hover, wrap long notes/labels, and remain usable with zoom and virtual keyboards.
- **NFR-02 — Accessible states (Q03, WEB03):** Inputs have persistent labels and associated validation; keyboard focus and action order are visible; status is conveyed with text/shape as well as color; the two rating states `0` and `Unrated` are visually and textually distinguishable. Required at slice acceptance; release-wide conformance remains VS-07.
- **NFR-03 — Personal-data minimization (DP02/DP03/DP13/DP14/DP18):** Persist only fields needed to identify and review the saved practice and its optional note. Keep the purpose limited to practice history and user review. Define lifecycle, deletion propagation, backup/retention consequences, and historical references before real-user release. Use synthetic data for development evidence (DP19).
- **NFR-04 — Query/resource bounds (Q04/SEC08):** History reads and note/label inputs shall have justified bounds suitable for personal-scale use. FR-02/FR-03 define the text bounds; the technical plan shall establish a representative personal-data workload and proportionate query/resource bounds without inventing latency targets.
- **NFR-05 — Honest error handling (Q01/Q06/DP13):** Errors shall identify the failed action and recovery option without including note, label, or other private content in user-visible diagnostics or logs.

## 8. Errors, boundaries, and preservation

| Case | Required observable result and permitted effects | Requirements |
|---|---|---|
| Timer abandoned, reloaded, or still incomplete | No closure save and no practice/note/history record; existing transient VS-04 behavior remains unchanged. | FR-01 |
| Independent label absent or whitespace-only | Save is rejected with a localized field error; no practice or note is persisted. | FR-02 |
| Independent label exceeds 50 trimmed characters | Save is rejected with a localized length error; other closure values remain available and no record is persisted. | FR-02 |
| Note is whitespace-only | Treat the optional note as absent; save the eligible practice as `Unrated` if no rating was given. | FR-03 |
| Note exceeds 2,000 characters after trimming | Reject the note with a localized length error; preserve the label/rating and create no record until corrected. | FR-03 |
| Rating outside integer 0–5 or malformed input | Reject the value, preserve other form values, and create no record until corrected. `0` remains a valid rating. | FR-03 |
| Optional note/rating omitted | Save succeeds when the practice otherwise qualifies; history shows no note and `Unrated`. | FR-03, FR-06 |
| Persistence failure/retry/repeated submit | Keep entered values visible and do not report success until confirmed; retry/replay yields at most one practice record. | FR-04 |
| Note edit/delete failure | Keep the last confirmed note state visible, report failure, and offer retry; do not imply deletion or modification succeeded. | FR-05 |
| Empty edit or cancellation | Reject a whitespace-only edit and leave the saved note untouched; cancel discards only the draft. Deletion remains a separate confirmed action. | FR-05 |
| Stale concurrent note edit | Do not silently overwrite the newer saved note; preserve the user's draft and provide a way to review current state before retrying. | FR-05 |
| Unauthorized or cross-user direct request | Reject access and mutation at trusted boundary; no partial write and no private content in response. | FR-08 |
| Deleted concept referenced by history | Preserve the historical concept title and show a clear localized deleted status; do not restore the concept to active use. | FR-07 |
| Permanently deleted list referenced by history | Delete its practices and notes; retain only anonymous round totals as already agreed. | FR-07 |
| Empty history/filter results | Show a localized empty state and a visible way to reset filters/return to the unfiltered view. | FR-06, FR-09 |

## 9. Flows and design references

- **Flow source:** `docs/app-flow.md`, `FLOW-05` (completed associated timer), `FLOW-06` (independent timer), `FLOW-07` (history), shared interaction rules in section 6. In particular, save is explicit, incomplete timers never save, a save failure retains closure values, and notes are managed outside History.
- **View references:** `VIEW-07` (existing transient timer), `VIEW-08` (implemented local closure), `VIEW-09` (implemented local history with an independent-practice detail state), and relevant `VIEW-02`/`VIEW-03` concept/list contexts for associated-note maintenance. Implementation and local validation evidence are recorded in [`tasks.md`](tasks.md); the user excluded the unverified MV-02 browser runtime privacy inspection from local spec completion. Publication readiness remains separate.
- **Acceptance-defining visual reference:** `docs/design.md`, section 2 (visual direction), section 3 (palette/type/spacing), section 4.1 (authenticated responsive shell), section 4.2 (`VIEW-08`/`VIEW-09` compositions), section 5 (form, filter, dialog, card, toast states), and section 7 (accessibility/interaction constraints).
- **Implemented style reference:** existing VS-01–VS-04 authenticated shell and views. Reuse those interaction patterns and visual tokens; new closure/history screens do not authorize redesign of the shell, timer, lists, concepts, or Draw Result.

Design source for this specification is the repository's current `docs/design.md` (2026-11-18). No external mockup or frame identifier is available; the documented view compositions are the acceptance reference.

## 10. Acceptance criteria

### AC-01 — Associated completed practice persists

Given an authenticated owner has completed a timer for a selected concept, when they enter an optional note and rating `0` and explicitly save, then one practice appears after reload with its concept/list/round context, duration, completed state, note presence, and rating `0`.

### AC-02 — Independent practice requires a label

Given an authenticated owner completed an independent timer, when they try to save without a label, then the localized label error appears and no record is created. When they provide a label and save with no note/rating, then exactly one independent completed practice appears as `Unrated` with no note.

### AC-09 — Text limits and whitespace

Given a completed practice closure, a trimmed independent label of 1 or 50 characters is accepted while a whitespace-only or 51-character label is rejected. A trimmed note of 1 or 2,000 characters is accepted, a whitespace-only note is treated as absent, and a 2,001-character note is rejected. For accepted non-empty text, leading/trailing and internal whitespace in the saved value remains as entered; validation does not silently rewrite authored content.

### AC-10 — Save confirmation and next action

Given a valid associated or independent closure, when the owner activates Save and persistence succeeds, then VIEW-08 remains visible with a success confirmation and no automatic navigation. When the owner chooses a next action, Return goes to the originating context (associated) or My Lists (independent); Repeat opens a fresh prepared timer for the same mode/context; and the associated Draw Another action is available only when concepts are pending, otherwise Start New Round is offered. The saved practice remains unchanged and a new timer creates no record until separately completed and saved.

### AC-03 — Failed and repeated save

Given valid closure values, when persistence fails, then the closure remains populated, no success is reported, and retry is available. When retry succeeds or the same submission is repeated, the owner can observe only one saved practice.

### AC-04 — Note edit/delete preserves practice

Given a saved associated practice with a note, when the owner edits then explicitly saves the edit from its permitted concept/list context, then the new note appears while the description and practice/rating remain unchanged. Cancelling an edit discards the draft; a whitespace-only edit is rejected without changing the saved note. Deleting uses a separate confirmation and removes only the note. Given a saved independent practice with a note, opening its History entry reaches a distinct detail state where the same note actions are available while its rating remains read-only. A failed or stale update preserves the user's draft, reports the current saved state, and offers recovery without overwriting it.

### AC-05 — Filtered practice and round history

Given the owner has saved associated and independent practices plus round appearances, when they browse History and apply/reset filters, all active criteria match together with AND and date boundaries include the selected local start/end dates. Changing language does not change the matching records. Matching practices show the confirmed fields, rounds retain appearance order and origin, and `0` is distinct from `Unrated`. A deleted concept retains its historical title and is clearly marked as deleted. Empty and loading states are understandable.

Given a legacy deleted appearance with an already-null title, History shows the localized title-unavailable fallback; available historical titles remain visible with deleted status. Given permanent deletion of a synthetic list, its practices and notes no longer appear in private History; only anonymous round totals remain in storage, inaccessible through owner or anonymous history queries.

### AC-06 — Privacy and rejection

Given synthetic users A and B, when B attempts direct reads or writes using A's practice/note/history identifiers, then the trusted boundary rejects the operation and A's content remains unchanged and undisclosed. Unauthenticated access is also rejected.

### AC-07 — Abandonment creates no practice

Given an associated or independent timer is incomplete, when the user navigates away or reloads before completion, then VS-04 abandonment behavior is preserved and no practice, note, or history record is created.

### AC-08 — Visual and localized continuity

Given representative long Spanish and English labels/notes and mobile/desktop viewports, when the user completes closure, manages a note, and reviews History by keyboard and touch, then the existing Chucao style is consistent, text wraps without clipping, controls remain reachable, focus and errors are perceivable, and no required state depends only on color or hover.

### Minimum verification intent

Verification should protect changed behavior without duplicating checks at every layer: focused business-rule coverage for eligibility, label/rating validation, and `0` versus `Unrated`; persistence/ownership coverage for save, note mutation, history reads, retries, and rejection; and one complete representative UI journey covering closure through saved history. Review the new screens' responsive/accessibility presentation manually where the automated component environment cannot establish it. The technical plan will select the smallest concrete set of tests and tools that provides this evidence; no one-test-per-requirement or broad duplicate suite is required.

## 11. Dependencies and shared constraints

- Reuse VS-01–VS-04 authenticated identity, owner-scoped lists/concepts/rounds, timer completion state, i18n, query/cache patterns, shared shell, and design tokens. Local closure evidence is recorded in VS-03 and VS-04 task documents; it does not establish deployed compatibility.
- Practice/note persistence is new and requires versioned schema and trusted authorization/integrity controls before the user-facing save path is enabled. Existing list/concept/round migrations do not provide practice/note storage.
- History preserves a deleted concept's historical title with a clear deleted status, in line with the updated deletion decisions in `docs/global-plan.md` and `docs/architecture.md`. Permanent list deletion deletes its practices and notes and must not regain identifiers or authored content through history.
- The selected independent-practice detail state, explicit save, post-save actions, history filter semantics, and deleted-concept display are aligned with the updated `docs/app-flow.md`, `docs/design.md`, `docs/global-plan.md`, and `docs/architecture.md` references.
- User-facing practice/note saving requires Spanish/English strings and localized date/plural presentation. Notes and labels are not translated.
- Publication still requires provider/backup retention review, applicable privacy information, release configuration, and supported-browser/accessibility review under VS-07. This spec does not claim legal compliance or release readiness.

## 12. Completion criteria

- FR-01–FR-09 and AC-01–AC-10 are satisfied, subject to remaining technical decisions below.
- The associated and labeled-independent save journeys and practice/round history are demonstrable with local Supabase and synthetic users.
- Abandonment, failed/repeated save, note lifecycle, deleted references, empty states, and cross-user rejection preserve their stated effects.
- New views preserve existing product behavior and use the documented Chucao design and interaction language in Spanish and English.
- Only focused verification needed to protect the changed behavior is added; existing relevant checks are reused. Required local database, privacy, and focused UI evidence is recorded before slice closure.
- Remaining publication-only limits and browser/accessibility checks are recorded for VS-07.

## 13. Open questions

| ID | Status | Decision needed | Affected requirements / consequence | Resolution stage |
|---|---|---|---|---|
| Q-01 | Deferred technical decision | What query pagination/retention strategy and conflict behavior will support personal-scale history and note edits across devices? | FR-05/06, NFR-04; no new technology or contract is chosen here. | Technical plan, informed by agreed product limits. |

There are no unresolved product-behavior questions from the reviewed findings. Pagination/retention mechanics remain for technical planning. Text limits, history filter/date behavior, deleted-concept title, permanent-list deletion, independent-note maintenance, and post-save actions are resolved and synchronized with the shared references. The central slice outcome and scope remain selected and ready for technical planning.
