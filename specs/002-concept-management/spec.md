# VS-02 — Concept Management

## Status and references

- **Spec ID:** VS-02
- **Title:** Concept Management
- **Status:** Base scope closed; extraordinary authenticated-shell extension T10 in progress
- **Slice:** VS-02, selected after the locally validated VS-01 foundation
- **Global source:** `docs/global-plan.md`, sections 4, 5, 7, and 8; selected-slice record for VS-02
- **Flow source:** `docs/app-flow.md`, `VIEW-03`, `VIEW-04`, `VIEW-05`, and `FLOW-03`
- **Design source:** `docs/design.md`, sections 3, 4.1, 4.2, 5, 6, and 7
- **Architecture source:** `docs/architecture.md`, sections 4, 6, 7, 8, and 9
- **Project quality source:** `docs/quality-project.md`, selected criteria Q01–Q04, SEC01–SEC03, SEC08, and SEC10
- **Privacy source:** `docs/catalog/data-protection.md`, DP02, DP03, DP10, DP13, DP14, and DP19
- **Verification source:** `docs/catalog/verification.md`, V01–V09, V11, V12, and V13

This document defines observable behavior only. Physical schema, migration
ordering, SQL/function contracts, module structure, test tooling, and CI
changes remain for the technical plan.

## Context and objective

VS-01 establishes authenticated private lists and the trusted ownership
boundary. The next useful product result is to let an authenticated person
populate one of those lists with concepts that can later participate in rounds
and practice.

This slice shall provide a complete persisted concept-management journey:
individual entry, pasted batch review, validation, persistence, retrieval,
editing, and deletion. It shall preserve private ownership and truthful
operation states while leaving selection, rounds, practice, notes, and history
to later slices.

## Actors and preconditions

### Actors

- **Authenticated person:** Owns and manages concepts inside their private
  lists.
- **Second authenticated person:** Must not read, edit, create within, or
  delete another person's concepts.
- **Unauthenticated or expired-session visitor:** Must not access protected
  concept data or perform protected operations.
- **Supabase/Auth and database boundary:** Provides the authenticated identity
  and enforces protected resource access; it is not controlled by client
  visibility alone.

### Preconditions

- The person has a valid Chucao session established through the VS-01
  Google/Supabase Auth flow.
- The target list exists and is owned by the authenticated identity.
- The application can reach the configured Supabase service and database.
- Local development and acceptance use synthetic accounts and authored test
  content; this local slice does not authorize public production use.

## Scope and exclusions

### Included

- An authenticated navbar on My Lists, List Detail, and authenticated Privacy, with Chucao identity linking to My Lists, one locale-toggle action, and Preferences entry.
- A Preferences dialog showing the signed-in email, local sign-out, and access to the Privacy view; remove those account/privacy controls from the authenticated page body.
- Preserve Access as a separate unauthenticated screen without the navbar and retain its existing language and privacy entry points.
- Opening an owned List Detail view and showing its concept collection.
- Showing `0/<active concept count>` as a static practiced-count indicator on
  non-empty My Lists cards; the empty-list state remains distinct.
- An empty-list state with a concrete add-concepts action.
- Individual concept entry with a required title and optional description.
- Pasted batch entry with accepted/omitted review before confirmation.
- Validation of title, description, syntax, and exact case-sensitive duplicates.
- Persistence in input order with each new concept initially pending.
- Retrieval after confirmation, reload, and access from another supported
  browser/device using the same account.
- Opening a concept and editing its title or description without changing its
  identity or current round state.
- Explicit deletion of an active concept after explaining its effects.
- Spanish and English labels, validation, status messages, accessible names,
  and user-authored text preservation.
- Truthful loading, empty, processing, success, failure, retry, cancellation,
  discard-unsaved-work, and expired-session states.
- Trusted-boundary validation and ownership enforcement for every concept
  read/write/delete operation.

### Excluded

- Random or manual selection, appearances, rounds, and progress tracking, and
  pending/seen transitions beyond the initial pending state.
- Practice, notes, ratings, history views, and deleted-concept historical
  presentation.
- Return-to-pending, bulk mark-as-seen, or other multi-selection actions.
- List rename, deletion, archive/restore, duplication, search, and ordering.
- File import/export, remote fetches, HTML/Markdown rendering, sharing,
  public content, analytics, marketing, and new external services.
- Account deletion, public-registration release, production deployment,
  provider/legal review, and full publication compatibility evidence.

Existing authentication, private-list ownership, locale behavior, and the
VS-01 shell must remain functional while this slice adds concept behavior.

## Scenarios and user stories

### US-01 — Add one concept

As an authenticated list owner, I want to enter a title and optional
description so that a concept is saved in my private list for later study.

### US-02 — Review a pasted batch

As an authenticated list owner, I want to paste several concept lines and see
which entries will be accepted or omitted before saving so that invalid or
duplicate content does not silently enter my list.

### US-03 — Maintain saved content

As an authenticated list owner, I want to view and edit a saved concept
without changing its identity, and delete it with an explicit confirmation, so
that my list remains accurate.

### US-04 — Preserve private persistence

As the owner, I want concepts to remain available after reload or on another
supported browser/device, while another account remains unable to access them.

### SC-01 — Individual creation and reload

Given an authenticated owner with an empty private list, when they add
`Anatomía` with description `órganos y sistemas`, then the application confirms
the persisted save, displays the concept as pending, and displays the same
title and description after reload.

### SC-02 — Batch review and confirmation

Given an authenticated owner with `Anatomía` already stored, when they paste a
batch containing valid lines, an empty line, a malformed line, an overlong
title, an exact duplicate of `Anatomía`, and duplicate lines within the batch,
then the review identifies accepted entries and each omitted line with a
reason; confirmation stores only the accepted entries in input order.

### SC-03 — Edit without identity change

Given a persisted concept, when the owner edits its title or description and
the save succeeds, then the updated content is shown without creating a second
concept or changing its current round state.

### SC-04 — Delete with cancellation and confirmation

Given a persisted active concept, when the owner opens deletion, then the
application explains the effect and offers cancellation; cancelling leaves the
concept unchanged, while confirming removes it from the active collection and
reports the confirmed result.

### SC-05 — Ownership rejection

Given a concept owned by user A, when user B attempts to read, edit, or delete
it through the UI or a direct service request, then the operation is rejected
without disclosing the concept or changing either user's data.

## Functional requirements

### Concept entry and validation

**FR-01.** When an authenticated person opens an owned list, the application
shall show a loading state while the concept collection is being retrieved,
then show either the persisted concepts or an empty state with an add action.
It shall not show a success state before the read is confirmed.

**FR-02.** When the person chooses individual entry, the application shall
show a labelled required title field and an optional description field, with
the current values preserved while validation or persistence is pending.

**FR-03.** The system shall trim the concept title and description for
validation and persistence. A title shall contain 1–50 characters after
trimming; a description shall contain no more than 2,000 characters after
trimming. The exact accepted boundary shall remain accepted, and a value
outside it shall be rejected without a record or unintended modification.

**FR-04.** When the person submits a valid individual concept, the system shall
persist it under the authenticated owner's list, assign its stable identity,
initialize it as pending, and show success only after the trusted boundary
confirms the write.

**FR-05.** When the person chooses batch entry, the application shall accept
the supported line syntax in which each candidate begins with `-`. A line may
use `- Title : Description`; the title and optional description shall be
extracted according to the agreed delimiter rule. The review shall preserve
the original input order for accepted candidates.

**FR-06.** Before batch confirmation, the application shall show accepted
candidate concepts and omitted lines with an understandable reason for each
omission. It shall not persist accepted candidates merely because the paste
was parsed.

**FR-07.** The system shall omit empty, malformed, over-limit, and exact
case-sensitive duplicate titles. Duplicate detection shall include concepts
already stored in the same list and repeated titles within the current batch,
including concepts in any existing pending or seen state when those states are
later available.

**FR-08.** The batch operation shall enforce a finite processing boundary for
input size and work. A pasted batch shall contain at most 100 lines and 20,000
characters, counting line breaks. If the pasted input exceeds either boundary,
the application shall explain the applicable limit, preserve the entered
content where possible, and shall not partially confirm an unreviewed batch.

**FR-09.** When the person confirms a reviewed batch, the system shall persist
only the accepted candidates in input order, initialize each as pending, and
return a result summary. If persistence fails or the result is uncertain, it
shall not report success, shall preserve enough input/review state for retry,
and shall not create unintended duplicates.

### Retrieval and editing

**FR-10.** After a confirmed individual or batch save, the application shall
show the persisted concepts in the list and distinguish their pending initial
state with text or another non-color cue. The list shall distinguish an empty
collection from a collection whose concepts are merely not yet selected in a
later round.

**FR-11.** When the person opens a persisted concept, the application shall
show its title and description as user-authored text and shall provide the
concept's current state without exposing unrelated users' data.

**FR-12.** When the owner submits a title or description edit, the system shall
validate the same limits and duplicate rule as creation, preserve the
concept's stable identity, and preserve its current round state. A rejected
edit shall leave the last confirmed content unchanged and keep the editable
values available for correction.

**FR-13.** If an edit is based on stale content, the system shall not silently
overwrite the newer confirmed value. It shall identify the conflict and offer
a visible `Reload current version` action before the owner edits again. The
rejected stale edit shall not modify the newer value.

### Deletion

**FR-14.** When the owner requests deletion of an active concept, the
application shall explain the effect on active data and future history, require
an explicit confirmation, and provide a cancellation path.

**FR-15.** If deletion is cancelled, the concept and its confirmed content
shall remain active and unchanged. If deletion is confirmed by the trusted
boundary, the concept shall no longer appear in the active collection and the
application shall show the confirmed result.

**FR-16.** A failed or uncertain deletion shall not report success or remove
the concept only from the interface. The application shall show a recoverable
error, preserve the confirmed active state when known, and allow a safe retry.
Deletion shall remain compatible with the product rule that a deleted concept
cannot be practiced and is represented as `Deleted concept` in future
historical views. The deleted concept shall be represented at the trusted data
boundary by a logical deletion/tombstone that hides its title and description
from active views while retaining only the minimum reference needed for future
history behavior. Final erasure remains governed by the product retention and
account-deletion rules.

### Identity, ownership, and session

**FR-17.** Every concept read, create, edit, and delete operation shall derive
ownership from the authenticated Supabase Auth identity and shall reject
client-supplied ownership or list relationships that do not resolve to that
identity.

**FR-18.** If the session is unauthenticated or expires during a protected
operation, the system shall not read or modify protected concepts and shall
not report success. It shall explain that reauthentication is required and
preserve only explicitly allowed in-memory form/review values.

**FR-19.** When a different account becomes active, the application shall
discard or replace private concept visibility and shall not display the
previous account's concepts, cached records, pending result, or draft as if
they belonged to the new account.

**FR-20.** When a concept operation fails because of an unavailable service,
the application shall expose a non-sensitive retryable error, shall not
silently convert the operation into success, and shall preserve the last
confirmed persisted state.

### Localization and user-authored content

**FR-21.** The included concept views shall provide Spanish and English
translations for labels, validation, omission reasons, loading, empty,
processing, success, failure, retry, confirmation, cancellation, and
accessible names. Changing language shall not alter stored titles or
descriptions.

**FR-22.** User-authored titles and descriptions, including apostrophes,
punctuation, HTML-like text, and non-English characters, shall be stored and
rendered as plain text. They shall not be translated, interpreted as markup,
inserted into SQL, or exposed through diagnostics beyond what is necessary for
the operation.

**FR-23.** My Lists shall show `Conceptos practicados 0/<active concept
count>` and its English equivalent for each non-empty list. The denominator
shall be the current number of active concepts; empty lists shall retain the
empty-list state. The numerator remains zero until a later slice implements
practice tracking. This indicator does not imply selection or progress.

**FR-24.** Every authenticated content view in the VS-02 shell, including My
Lists, List Detail, and authenticated Privacy, shall show a shared navbar.
The navbar shall use `#fdeab7`, show the Chucao bird and app title at left as
an accessible action returning to My Lists, and show a single locale toggle
and Preferences action at right. Access and pre-authentication privacy shall
remain outside this authenticated navbar.

**FR-25.** The locale toggle shall show the destination locale (`En` when the
active locale is Spanish and `Es` when it is English), switch immediately,
and preserve the current view and form state. The former two-button language
group shall not appear in authenticated views; Access keeps its existing
language selection.

**FR-26.** Preferences shall open a dismissible, accessible dialog over the
current authenticated view. It shall show the current Auth email, offer
Chucao local sign-out, and open authenticated Privacy. The email, sign-out,
and authenticated Privacy entry shall no longer appear in the authenticated
page body. Sign-out shall keep the existing local-scope Auth behavior and
return to Access only after success.

**FR-27.** Access language controls and its Privacy link shall be centered.
The navbar and its controls shall remain usable at narrow mobile widths.
Authenticated concept list/detail layouts shall wrap long unspaced titles and
descriptions within their cards and panels without horizontal page overflow.
Preferences shall use a centered, prominent title, centered sign-out action,
and a close control that is visually distinct from the dialog background.

## Applicable non-functional requirements

### Quality, accessibility, and delivery

**NFR-01 (Q01, Q02).** The slice shall expose truthful loading, empty,
validation, accepted/omitted, processing, success, failure, retry, reload,
duplicate-submit, duplicate-paste, interruption, edit-conflict, and
delete-confirmation states. Rejected, failed, cancelled, or repeated
operations shall not create unintended concepts, duplicate accepted entries,
or lose confirmed data without an explanation.

**NFR-02 (Q03).** The included views and interactions shall be operable by
keyboard and touch on the committed PC and Android browser targets. They shall
provide visible focus, persistent labels, associated errors, meaningful
headings, accessible names, usable touch targets, and status cues that do not
depend only on color, hover, illustration, or animation.

**NFR-03 (Q04, SEC08).** Concept retrieval, rendering, individual creation,
and batch parsing shall remain bounded for a representative personal-scale
workload. The workload and batch boundary shall be explicit before
implementation; no unbounded client-side processing is acceptable.

**NFR-04 (Q05, Q06).** The affected migration/configuration, application
behavior, and documentation shall remain reproducible through the repository's
documented setup and delivery process. Failures shall be actionable, and
debug artifacts or sensitive values shall not be exposed.

### Security and privacy

**NFR-05 (SEC01, SEC04, DP10).** Title, description, list relationship,
initial state, and ownership rules shall be enforced at the trusted data
boundary. Unauthenticated and cross-user direct requests shall be rejected
for reads, creates, edits, and deletes; UI hiding shall not be treated as
authorization.

**NFR-06 (SEC02, SEC03).** Database operations shall use bound values or
allowlisted mappings, and user-authored content shall remain text through
storage, error handling, and rendering. Hostile punctuation and HTML-like
values shall not execute or change query meaning.

**NFR-07 (DP02, DP03, DP13).** The implementation shall collect and retain
only the concept fields necessary for private list management, document their
purpose and lifecycle, and avoid exposing titles/descriptions through URLs,
logs, caches, errors, or diagnostics. Development evidence shall use
synthetic content.

**NFR-08 (DP14).** Concept deletion shall define what happens to active data,
future historical references, indexes/caches, and retry after partial failure.
The accepted slice must not claim erasure or anonymization beyond the
confirmed behavior and evidence.

**NFR-09 (SEC10, DP19).** Privileged Supabase keys, service credentials, and
real user content shall remain outside browser code, committed files, local
fixtures, screenshots, logs, and external tools. The public client may use
only the already approved publishable configuration.

## Errors and boundary cases

- **Empty title:** Keep the entry available for correction, identify the
  required value, and perform no write.
- **Title boundaries:** Accept exactly 1 and 50 trimmed characters; reject
  empty or 51+ character titles with no record or unintended modification.
- **Description boundaries:** Accept an empty description and exactly 2,000
  trimmed characters; reject longer descriptions with no modification.
- **Malformed batch line:** Omit it during review with a specific reason; do
  not silently reinterpret it as a valid title.
- **Empty batch:** Show that no valid candidates are available and do not
  persist a successful empty operation.
- **Existing duplicate:** Omit or reject an exact case-sensitive title already
  in the same list, preserving the existing concept.
- **Within-batch duplicate:** Keep only the first accepted occurrence in input
  order and identify later occurrences as duplicates.
- **Batch boundary:** Reject input over 100 lines or 20,000 characters
  including line breaks before confirmation; preserve the entered content for
  correction or retry and do not partially confirm it.
- **Repeated confirmation:** The resulting active collection shall contain at
  most one concept per accepted intended entry; an uncertain result shall be
  reconciled or reported as unresolved rather than blindly resubmitted.
- **Edit duplicate or invalid value:** Keep the last confirmed persisted
  concept unchanged and preserve the editable value with correction feedback.
- **Concurrent edit:** Reject the stale update, preserve the newer confirmed
  value, identify the conflict, and offer `Reload current version` before
  editing again.
- **Delete cancellation:** Leave active data and the current view unchanged.
- **Delete failure or timeout:** Do not show deletion success; retain or
  re-read the active concept and provide safe retry.
- **Expired session:** Protect data, explain reauthentication, and preserve
  only allowed in-memory values.
- **Different account:** Do not display, infer, update, or delete another
  user's concept through UI, URL, cache, or direct request.
- **Service failure:** Keep the last confirmed state, expose a non-sensitive
  retry path, and avoid duplicate writes on retry.
- **Language change:** Translate the interface while preserving user-authored
  content, current draft/review where allowed, and ownership context.

## Flows and design references

- `VIEW-03 List Detail`: concept collection, empty state, list identity, and
  entry points for adding or opening concepts. The My Lists card count is a
  static `0/active total`; practice progress, draw, and round controls remain
  excluded.
- `VIEW-04 Add Concepts`: Individual and By Batch modes, persistent labels,
  character guidance, accepted/omitted review, and confirm/cancel hierarchy.
- `VIEW-05 Concept Detail`: title, description, current state, edit action,
  and future practice context; only title/description/state management is
  included here.
- `FLOW-03 Add and manage concepts`: the authoritative interaction sequence
  and alternatives for this slice, including exact duplicate behavior and
  preservation on failure.
- `docs/design.md`, sections 3, 4.1, 4.2, 5, 6, and 7: pastel semantic
  action roles, responsive single-column mobile adaptation, persistent
  labels, focus/error states, touch targets, long-content wrapping, and
  non-color status cues. These are presentation constraints, not evidence of
  implementation.
- Existing VS-01 shell and `VIEW-03` empty presentation remain compatible
  references. The concept-management views may extend them but shall not
  imply round or practice behavior before those slices.

## Acceptance criteria

### AC-01 — Individual concept persistence

Given a synthetic authenticated owner with an empty private list, when the
owner enters `Anatomía` and `órganos y sistemas` and confirms, then exactly
one concept is persisted for that list, the UI shows confirmed success, the
concept is displayed as pending, and reload shows the same content.

### AC-02 — Individual validation

Given an authenticated owner, when the owner submits an empty title, a title
longer than 50 trimmed characters, or a description longer than 2,000 trimmed
characters, then the UI identifies the invalid field, preserves the entered
value for correction, and no concept is created or modified.

### AC-03 — Batch review

Given a list containing `Anatomía`, when the owner pastes valid lines, an empty
line, a malformed line, an overlong title, an exact `Anatomía` duplicate, and
repeated lines within the batch, then the review displays accepted entries and
an omission reason for every rejected line without persisting the review.

### AC-04 — Batch confirmation and retry

Given a reviewed batch with at least two accepted entries, when the owner
confirms and the persistence operation succeeds, then the accepted concepts
appear once, in input order, with pending initial state and a result summary.
If the operation fails or is interrupted, then no false success is shown, the
review/input remains available where possible, and retry does not duplicate
confirmed entries.

### AC-05 — Retrieval and edit

Given a persisted concept, when the owner opens and edits its title or
description with valid non-duplicate content, then the changed content is
shown after confirmation, the concept identity remains stable, and the
current state remains unchanged. Invalid or stale edits leave the last
confirmed content intact; a stale edit identifies the conflict and offers
`Reload current version`.

### AC-06 — Delete confirmation

Given an active persisted concept, when the owner requests deletion, then the
application explains the consequence and offers cancel/confirm. Cancel leaves
the concept active; confirmed successful deletion removes it from the active
collection, creates the logical deleted/tombstone state at the trusted
boundary, and retains only the minimum reference required for future history
behavior.

### AC-07 — Private ownership

Given user A owns a concept, when user B or an unauthenticated client requests
the concept by list or concept identifier, then the trusted boundary rejects
the operation and neither the UI nor the error response discloses the
concept's content or ownership details.

### AC-08 — Session and recovery states

Given an expired session, a service failure, or a language change during entry,
when the affected operation occurs, then the application protects persisted
data, exposes the corresponding retry/re-authentication or local-language
state, and preserves only the values permitted by the relevant requirement.

### AC-09 — Accessible responsive journey

Given the supported PC and Android browser targets, when a person completes
the empty-list, individual-entry, batch-review, edit, and delete-confirmation
journeys using keyboard and touch, then labels, focus, errors, status, content
wrapping, and action hierarchy remain understandable without relying only on
color, hover, or animation.

### AC-10 — Bounded input

Given a pasted batch, when it exceeds 100 lines or 20,000 characters including
line breaks, then the application rejects it before confirmation, explains the
limit, performs no partial unreviewed write, and preserves the entered content
where possible.

### AC-11 — Static practiced-count card indicator

Given a non-empty list, when My Lists is shown, then its card displays the
localized `0/<active concept count>` practiced-count indicator. Confirmed
concept addition or deletion updates the denominator; an empty list retains
the empty-list state. The numerator stays zero because practice is not
recorded in this slice.

### AC-12 — Authenticated navbar and preferences

Given an authenticated person in My Lists, List Detail, or Privacy, when the
view is displayed, then the shared `#fdeab7` navbar is visible with the bird
and Chucao action at left and one destination-language toggle plus Preferences
at right. Selecting the brand returns to My Lists; the locale button shows
`En` in Spanish and `Es` in English and changes locale without resetting the
view. Opening Preferences shows the signed-in email, sign-out, and Privacy
entry; these account controls do not remain in the page body. Privacy opens
within the authenticated shell and returns to Preferences. Access and its
privacy view remain unchanged and have no navbar.

### AC-13 — Narrow layout and preferences styling

Given Access or an authenticated concept view at a narrow mobile viewport,
when the user opens the screen with a long title containing no spaces, then
the navbar remains within the viewport and the title wraps inside its card or
detail panel without forcing horizontal page overflow. Access language and
Privacy controls are centered. The Preferences title is centered and bold,
sign-out is centered, and the close button contrasts with the dialog surface.

## Dependencies and shared constraints

- VS-01 is the required product dependency: authenticated session, private
  lists, ownership identity, locale shell, Supabase configuration, and local
  migration workflow.
- The implementation must follow the confirmed React/TypeScript/Vite,
  Mantine, CSS Modules, React Hook Form, TanStack Query, i18next, Supabase,
  RLS, and versioned-migration decisions. The exact technical decomposition
  belongs to the technical plan.
- Concept persistence must follow the Auth UUID ownership chain and deny-by-
  default authorization intent in `docs/architecture.md`, ARCH-03 and
  ARCH-04.
- Trusted validation and safe retry must preserve the Q02 and SEC01
  requirements; client validation is not sufficient.
- The supported compatibility target is the current and previous versions of
  Chrome, Edge, and Firefox on PC, and Chrome on Android, as recorded in
  `docs/architecture.md`. Release-wide compatibility evidence remains a later
  publication concern.
- No new provider, analytics SDK, file capability, or privileged client
  configuration is needed or authorized by this slice.

## Completion record

VS-02 is closed for the validated local scope as of 2026-11-17. The closure
criteria were:

- Every included behavior has a stable requirement and linked acceptance
  criterion or an explicit clarification marker.
- The individual and batch concept journeys are demonstrable with real
  persistence in the required local environment.
- Existing VS-01 authentication, list ownership, locale, and shell behavior
  remain preserved.
- Validation, duplicate handling, retry, edit conflict, deletion, and
  cross-user rejection outcomes are defined and reviewable.
- Applicable Q01–Q04, SEC01–SEC03, SEC08, SEC10, and DP02/DP03/DP10/DP13/
  DP14/DP19 obligations are represented without claiming evidence.
- The spec, once clarified, can support a technical plan without inventing
  physical schema, tooling, or deployment behavior. T01–T09 and local
  validation are recorded in `tasks.md`. CHECK-08 browser rendering and the
  requirement to choose a workload before implementation are accepted closure
  exceptions per CL-05; no browser or production performance result is claimed.

## Resolved clarification decisions

| ID | Decision | Consequence |
|---|---|---|
| CL-01 | A batch is limited to 100 lines and 20,000 characters including line breaks. Excess input is rejected before confirmation and remains available for correction. | Establishes a bounded processing workload and a predictable user correction path. |
| CL-02 | A stale edit is rejected rather than merged or overwritten. The UI identifies the conflict and offers `Reload current version` before another edit. | Prevents silent data loss and avoids ambiguous automatic merges. |
| CL-03 | Concept deletion is logical/tombstone-based at the trusted boundary. The active collection hides the deleted concept and its title/description, while minimum reference data remains for future historical representation. | Preserves future history semantics and safe retry; final erasure follows retention/account-deletion rules. |
| CL-04 | List cards show a static practiced count of `0/<active concept count>` for non-empty lists, localized in Spanish and English. | Reflects the user's explicit product decision; practice tracking remains outside VS-02. |
| CL-05 | For local VS-02 closure, the user accepts the 500-concept database retrieval measurement as available workload evidence and waives browser rendering measurement. The workload was chosen during validation, after implementation. | Records an explicit closure exception to NFR-03's before-implementation timing and CHECK-08 browser-rendering component. No browser performance pass or production performance claim is made. |

## Open questions

No blocking behavioral questions remain for the technical planning stage.

