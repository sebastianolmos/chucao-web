# VS-06 Advanced Organization

## 1. Status and references

| Field | Value |
|---|---|
| Spec ID | `006` |
| Slice | `VS-06 Advanced organization` |
| State | Closed for validated local scope (2026-11-19); T01–T10, automated/local checks, and user-confirmed manual interface/functionality review are complete. Publication readiness remains outside VS-06. |
| Capabilities | CAP-02, CAP-03, CAP-04, selected CAP-11 organization subset |
| Language | Product interface remains available in Spanish and English; user-authored list and concept text is preserved. |

Acceptance-defining sources:

- [`docs/global-plan.md`](../../docs/global-plan.md), sections 3–8 and **Closed slice: VS-06 Advanced organization**: outcome, scope, confirmed product constraints, privacy boundary, and demonstration.
- [`docs/app-flow.md`](../../docs/app-flow.md), **FLOW-02 Create and organize a list**, **FLOW-03 Add and manage concepts**, **FLOW-04 Draw, mark, and start a round**, and section 6: current list/concept journeys, actions, states, and existing round behavior.
- [`docs/design.md`](../../docs/design.md), sections 2–5 and `VIEW-02` My Lists, `VIEW-03` List Detail: implemented visual baseline and interaction/accessibility constraints.
- [`docs/architecture.md`](../../docs/architecture.md), sections 4, 6–7: authenticated ownership, private persistence, list/concept/round relationships, and history preservation.
- [`docs/quality-project.md`](../../docs/quality-project.md), Q01–Q04, Q06, SEC01–SEC04, SEC08, WEB03; [`docs/catalog/data-protection.md`](../../docs/catalog/data-protection.md), DP02, DP03, DP10, DP13–DP16, DP18; [`docs/catalog/verification.md`](../../docs/catalog/verification.md), V03–V09.
- Existing behavior to preserve: [`specs/002-concept-management/spec.md`](../002-concept-management/spec.md), [`specs/003-persistent-round-and-selection/spec.md`](../003-persistent-round-and-selection/spec.md), and [`specs/005-notes-and-history/spec.md`](../005-notes-and-history/spec.md), especially stable concept identity, round history, practice/note retention, and permanent-list deletion effects.

The flow and design documents are acceptance and presentation references. Implementation evidence is in `src/features/lists/`, `src/features/concepts/`, `src/features/rounds/`, and `src/features/history/`; validation results and any remaining evidence gaps are recorded in [`tasks.md`](./tasks.md). Local implementation does not imply release readiness.

## 2. Context and objective

VS-01–VS-05 provide authenticated private lists and concepts, persistent study rounds, saved practices, notes, and history. VS-06 lets an authenticated person find and organize lists and concepts without changing the study or history model. The objective is a complete private workflow for list search/order and management, study-state filtering, and the already-defined concept bulk actions.

The slice follows the existing warm Chucao interface, shared authenticated navigation, list cards, bordered panels, dialogs, action hierarchy, responsive layouts, localized feedback, and focus behavior. It extends the implemented My Lists and List Detail experiences; it does not introduce a new visual system.

## 3. Actors and preconditions

- **Primary actor:** an authenticated Chucao user.
- The user's lists, concepts, rounds, practices, and notes are private and are accessed using the authenticated Supabase Auth identity.
- Search/order begins in My Lists. Concept-state filtering and multi-selection begin in List Detail.
- Existing data may include archived lists and concept/practice/round history. All state-changing actions require a live authorized session.

## 4. Scope and exclusions

### Included

- Search the user's active and archived list collections and order lists using the defined options.
- Rename and permanently delete a list using existing list-name rules and an explicit destructive confirmation.
- Duplicate a list with a chosen name.
- Archive and restore a list.
- Filter List Detail to All, Pending, or Practiced concepts.
- Select multiple concepts and apply Delete, Mark as seen, or Return to pending. Delete requires confirmation; results distinguish successful and failed items.
- Localized loading, empty/no-match, validation, processing, success, failure/retry, and destructive-confirmation states, in Spanish and English.

### Exclusions

- Public/shared lists, organizations, export/import, manual ordering, new study states, changes to round selection/history, and any bulk action beyond the three named above.
- History editing or changes to VS-05 practice/note retention rules.
- Release-wide browser/accessibility, deployment, migration/recovery, and publication readiness (VS-07).

## 5. User stories

- **US-01:** As a user with several lists, I can find a list and order the collection so I can open the one I need.
- **US-02:** As a list owner, I can rename, duplicate, archive, restore, or permanently delete my list with effects that are clear before a destructive action.
- **US-03:** As a user studying a list, I can focus on all, pending, or practiced concepts and make a supported change to several concepts together.
- **US-04:** As a user, I can trust that organization actions preserve unrelated content and remain private to my account.

## 6. Functional requirements

### List collection and list actions

- **FR-01 — Search and order:** My Lists shall provide list search and the predefined list orderings: name A–Z/Z–A, recently/oldest created, and recently modified. Ordering is a presentation choice and shall not rewrite persisted list or concept order. For created/modified ordering, equal timestamps shall be ordered by list name A–Z, then by stable list identity. If names compare equal in an alphabetical ordering, stable list identity shall break the tie. The selected order applies to both Active and Archived collections and remains selected when switching between them. On a fresh visit or reload, the default is name A–Z; sort choice is not persisted as an account preference. Search shall match a partial list name, ignoring case and diacritics, within the currently viewed collection (Active or Archived). Trimming the query and removing it shall respectively search without surrounding whitespace and restore all lists in that collection under the selected order.
- **FR-02 — Rename:** When a user renames an owned list, the system shall preserve its identity and contents and enforce the existing list-name rules: required name, maximum 80 characters after trimming, and per-user uniqueness after trimming and case folding. Invalid or duplicate names shall remain correctable and shall not alter the saved list.
- **FR-03 — Duplicate:** When a user duplicates an owned list, the system shall create a distinct list with a fresh identity and the user-chosen valid name, copying its concepts and descriptions but starting with fresh progress and no copied rounds, practices, notes, or history. The source list remains unchanged.
- **FR-04 — Archive and restore:** When a user archives an owned list, the system shall remove it from the active collection while preserving its list, concepts, round state, rounds, practices, notes, and history. The user shall be able to find and open it from Archived lists in read-only mode, with its archived status clearly identified and a Restore action available. Editing list/concept data, adding concepts, changing round state, or starting study/practice from an archived list shall require restoring it first. Restore returns it to the active collection with its content and history intact when the owner has fewer than 100 active lists. At 100 active lists, restore shall be rejected, the list shall remain archived with all data unchanged, and the interface shall explain that an active-list slot must be freed first. Archived lists remain private.
- **FR-05 — Permanent deletion:** Permanent list deletion shall require explicit confirmation describing its effect and offering **Archive instead** as a secondary action. Choosing Archive applies FR-04 and performs no permanent deletion. Choosing permanent deletion requires explicit confirmation; on confirmation, active list content and associated practices/notes shall be removed and only round totals without owner/list/concept identifiers, authored content, operation identifiers, precise event timestamps, or per-concept appearance details may remain. Cancel leaves all data unchanged. VS-06 acceptance shall verify locally that retained totals exclude those fields; this does not establish that the data is anonymous or eliminate re-identification risk.
- **FR-06 — List collection states:** Active and archived collections shall have distinct localized headings or state indicators and useful empty states. Loading, action processing, success, and recoverable error shall be distinguishable; retry shall not create a duplicate list or repeat a completed state change.

### Concept collection and bulk actions

- **FR-07 — Study-state filters:** List Detail shall offer All, Pending, and Practiced filters. All existing active concepts remain visible under All. Pending contains concepts eligible for the current round; Practiced contains concepts marked/selected in that round. Filtering shall not change round state, appearance order, or persisted concept order. Empty filtered results shall be distinguishable from an empty list and an exhausted round. Multi-selection shall include only concepts visible under the current filter; changing the filter clears the selection and announces that it was cleared. Leaving List Detail also clears the selection.
- **FR-08 — Multi-selection:** The user shall be able to select multiple active concepts visible under the current filter and apply Delete, Mark as seen, or Return to pending. Only Delete requires confirmation. Concepts already in the requested state shall not acquire duplicate appearances or other duplicate effects. The result shall report each concept's outcome. Completed items shall remain completed; only failed items remain selected for retry. Before retrying, the system shall reconcile current state and ownership so a completed effect is not repeated and the result reflects any intervening change.
- **FR-09 — Bulk delete preservation:** Deleting selected concepts shall apply existing single-concept deletion history rules: preserve historical title snapshots and appearance order/origin, visibly mark deleted concepts in applicable history, and prevent deleted concepts from returning to active practice. Rejected or failed deletions shall not damage retained concepts or their history.
- **FR-10 — Ownership and input safety:** Every list, concept, archive, duplicate, bulk, and delete operation shall act only on resources owned by the authenticated user. Direct requests using another user's identifiers shall be rejected without changing data. User-authored names shall render as text.
- **FR-11 — Localization and interaction:** New labels, filters, errors, confirmations, summaries, and accessibility names shall be available in Spanish and English. Changing locale shall preserve the current collection, search query, selected order, concept filter, and selection; user-authored content shall not be translated.

## 7. Applicable non-functional requirements

- **NFR-01 — Visual and flow continuity (Q01, Q03, Q06):** New controls shall follow `VIEW-02` and `VIEW-03` composition and shared design tokens, typography, borders, shadows, action hierarchy, dialogs, card/row treatments, and responsive behavior. Preserve the shared authenticated navbar and existing list/concept entry points. Do not rely on color alone for active/archive, selection, pending/practiced, error, or destructive status. Provide visible keyboard focus, persistent labels/accessibility names, managed dialog focus, and usable touch targets. The spec adds no per-slice redesign.
- **NFR-02 — Trusted constraints and isolation (SEC01–SEC04; DP10):** Validation, allowed actions, ownership, and state transitions shall be enforced at the trusted persistence boundary as well as reflected in the interface. Queries and sort choices shall not allow hostile text to alter query behavior. Applies when each operation is enabled.
- **NFR-03 — Data lifecycle and disclosure (DP02, DP03, DP10, DP13–DP16, DP18):** Use list/concept data only to provide private organization and study. Do not place authored text or private identifiers in URLs, diagnostics, or user-visible errors. Preserve the VS-05 deletion/retention behavior. VS-06 local acceptance verifies field-level removal from retained totals, not anonymity; assess re-identification risk, provider retention, and backup handling before processing real-user data or publication, and do not claim anonymity is validated before that review. Access/correction/deletion handling shall reflect accepted mutations.
- **NFR-04 — Bounded work (Q04, SEC08):** List searches, ordering, selected-concept operations, and result feedback shall operate on justified personal-data volumes without unbounded client work. The technical plan defines bounded server-side queries and focused representative-workload review; concrete limits must be justified by that review rather than invented as product behavior.
- **NFR-05 — Selective verification (Q01–Q04, Q06; V03–V09):** Verification shall cover only material new behavior and affected regressions. Required coverage is: list search/order and concept-filter rule boundaries; persistence and ownership for changed list operations; bulk success/failure and preservation/idempotent effects; and a representative localized responsive journey with loading/error/confirmation states. Reuse existing tests for unchanged behavior. Do not require one automated test per requirement or a new end-to-end suite if focused service/component tests plus the product demonstration give sufficient evidence. Test tool, fixtures, commands, and exact test selection belong in the technical plan.

## 8. Errors, boundaries, and preservation

- A blank or invalid rename/duplicate name, duplicate name under case folding, or overlong name shall show a localized correction and leave the original list unchanged.
- A failed search/read shall not be presented as an empty collection. A retry shall preserve the user's query and selected ordering.
- A failed archive, restore, duplicate, or rename shall not show success before persistence confirms it; retrying shall not produce duplicate effects.
- A bulk operation may partially succeed. The result shall distinguish each outcome, retain selection only for failed items, and permit retry only after rechecking their current state and ownership. Reconciliation shall prevent repeating completed effects and expose an intervening state change in the per-item result.
- Cancelling list/concept deletion leaves all selected data unchanged. If ownership/session validation fails, no mutation occurs and the interface reports an actionable localized error without private content.
- Existing list, concept, round, practice, and note identities and their documented history behavior remain intact under the confirmed duplication and archive rules.

## 9. Flows and design references

- **List entry and organization:** `docs/app-flow.md`, FLOW-02, section 6; `docs/design.md`, VIEW-02 and sections 2–5. Extend the existing My Lists panel/cards and dialogs. Keep list opening as the primary card action, with less frequent actions in the established menu/action pattern.
- **List Detail filters and bulk actions:** `docs/app-flow.md`, FLOW-03, FLOW-04, VIEW-03 and section 6; `docs/design.md`, VIEW-03, component rows for Tabs and filters, Menu, Dialog, List/concept card or row, and Notice/toast. Preserve visible concept state labels and current round progress while adding filters and selection.
- **Visual baseline:** `docs/design.md`, sections 2–5, dated 2026-11-19; implementation references `src/features/lists/lists.module.css`, `src/features/concepts/concepts.module.css`, and `src/app/app.module.css`. These existing application assets are the acceptance reference; no external mockup or new visual direction is introduced.

## 10. Acceptance criteria

- **AC-01 (FR-01, FR-06):** Given active and archived owned lists, search matches partial names without case/diacritic distinction only within the currently viewed Active or Archived collection; clearing search restores that collection. Each ordering option applies in both collections and remains selected when switching between them. Equal timestamps resolve by name A–Z then stable identity; alphabetical ties resolve by stable identity. A fresh visit/reload starts with name A–Z. Search and each ordering option show the expected collection and stable sort outcome. A no-match result is distinct from loading/failure.
- **AC-02 (FR-02):** Given a list with concepts and history, a valid rename changes only its displayed name and remains after reload. Invalid/duplicate/case-fold-equivalent/overlong names do not change saved data.
- **AC-03 (FR-03):** Given a source list with concepts, descriptions, round progress, and history, duplication creates a distinct owned list with the chosen valid name, copied concepts/descriptions, fresh progress, and no copied rounds/practices/notes/history. The source remains unchanged, and retry does not create a second copy.
- **AC-04 (FR-04):** Archive removes a list from the active collection while retaining its content and history. The user can open it from Archived and inspect it read-only; edit/add/state-changing study actions are unavailable until restore. Below the active-list limit, restore returns it to Active and, after reload, prior concepts, progress, rounds, practices, notes, and history remain intact. At 100 active lists, restoration is rejected with a localized explanation and the archived list and all its data remain unchanged.
- **AC-05 (FR-05, FR-10):** The confirmation explains deletion effects and offers Archive instead; choosing it archives the list and leaves its data intact. Cancel deletion and verify no effects. Confirm permanent deletion and verify active content and practices/notes are removed and retained round totals contain none of the prohibited identifiers, authored content, operation identifiers, precise timestamps, or per-concept appearance details. Verify another authenticated user cannot read or mutate the deleted/retained resources. Record that this local field-level check does not validate anonymity; re-identification/provider/backup review remains required before real-user data or publication.
- **AC-06 (FR-07):** With concepts in pending and practiced states, All/Pending/Practiced display the correct sets and empty filtered results do not reset, consume, or reorder round state. Changing filters clears and announces the cleared selection; leaving List Detail discards it. State persists correctly after reload.
- **AC-07 (FR-08, FR-09):** Select visible concepts across relevant states; mark seen, return to pending, and delete. Verify only-delete confirmation, accurate per-item success/failure feedback, successful items are not selected or repeated, failed items alone can be retried after current state/ownership is checked, no duplicate appearance on repeats, preserved historical title/order/origin, and no mutation to unrelated concepts.
- **AC-08 (FR-10, NFR-02):** Attempt direct cross-user reads and writes with known identifiers; the trusted boundary rejects them and no data changes. Inputs resembling markup or query punctuation remain inert user text.
- **AC-09 (FR-11, NFR-01):** Complete representative search, list action, filter, and bulk flows in Spanish and English using keyboard and mobile-width layout. Switching locale preserves collection, query, order, concept filter, and selection. Focus, names, selected state, processing, and errors remain understandable without color alone and use the established design treatment.
- **AC-10 (NFR-04, NFR-05):** The agreed representative personal-data workload and bulk-selection boundary are documented in the plan and exercised with bounded queries/processing. Focused automated checks cover the changed rules and persistence/ownership boundaries; one integrated local demonstration exercises the complete journey and a failure/recovery path.

## 11. Dependencies and shared constraints

VS-01–VS-05 are closed for their documented local scopes. Existing Auth UUID ownership, RLS, migrations, typed services, query/cache, i18n, list/concept CRUD, round state, history, and authenticated shell are available locally. The technical plan identifies the necessary migration and trusted operations while preserving compatibility with current records and deletion rules.

Local demonstration requires Vite, local Supabase/Docker, and synthetic accounts. VS-05 browser runtime privacy inspection remains unverified by the user's earlier decision and is not asserted as passed here; verify before publication under VS-07. Provider backup/retention and re-identification review also remain publication/privacy concerns.

## 12. Completion criteria

- All clarified FRs and ACs have evidence, including the integrated organization journey across list collection and List Detail.
- Permanent-list deletion evidence confirms only the specified aggregate fields remain locally; re-identification, provider, and backup review is completed before any real-user data or publication, and no earlier anonymity claim is made.
- Existing concept, round, history, and note behavior remains preserved except for explicitly accepted operations.
- Required focused automated checks and the representative manual/product review are complete; failures, partial operations, and ownership rejection are evidenced.
- New UI is localized, responsive, keyboard-operable, and consistent with the implemented design and app flow.
- This spec records the clarified behavior; `docs/global-plan.md`, `docs/app-flow.md`, `docs/design.md`, and `docs/architecture.md` reflect the locally implemented state and link to its evidence. Physical schema and implementation are present locally and checked through T01–T10; production deployment, privacy/re-identification review, and publication-only limitations remain visible and are not represented as satisfied.

## 13. Clarification decisions and review conditions

- **OQ-01 — Resolved:** List search uses partial-name matching, ignores case and diacritics, and is scoped to the currently viewed Active or Archived collection.
- **OQ-02 — Resolved:** Duplicate copies concepts and descriptions into a new list with the user-chosen name, fresh progress, and no copied rounds, practices, notes, or history. The source is unchanged.
- **OQ-03 — Resolved:** Archived lists preserve all content and history, can be opened read-only, and can be restored. Editing, adding concepts, changing round state, or starting study/practice requires restoration first.
- **OQ-04 — Resolved:** Equal created/modified timestamps sort by list name A–Z, then stable list identity. Equal names under alphabetical ordering sort by stable list identity.
- **OQ-05 — Resolved:** Bulk actions can target only concepts visible under the active filter. Changing filters clears and announces the cleared selection; leaving List Detail clears selection.
- **OQ-06 — Resolved:** The selected list ordering applies in Active and Archived and remains selected when switching collections; fresh visits/reloads default to name A–Z, with no account-preference persistence.
- **OQ-07 — Resolved:** Permanent-deletion confirmation offers Archive instead. Permanent deletion remains available only after its explicit confirmation.
- **OQ-08 — Resolved:** Restore is allowed only while the owner has fewer than 100 active lists; at the limit it is rejected without changing the archived list or its data, and the user is told to free a slot first.
- **Clarification status:** No product questions remain. Re-identification, provider-retention, and backup review remains a pre-real-user/pre-publication condition under DP14/DP18 and is not claimed as complete here.
- **Technical planning:** Query/pagination strategy, migration/RPC shape, test fixtures/commands, and representative-data review are recorded in [`plan.md`](./plan.md); no task breakdown or implementation is included in this spec.
