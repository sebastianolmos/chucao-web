# VS-05 Notes and History — Technical Plan

## 1. Status and sources

**Status:** VS-05 is closed for validated local scope; implementation, validation, and closure evidence are recorded in [`tasks.md`](tasks.md). MV-02 browser runtime privacy inspection remains unverified by the user's explicit decision and is not represented as passed. This does not claim publication readiness. R-01 and R-02 were accepted by the user and incorporated into FR-07/AC-05.

**Spec:** `005`, VS-05 Notes and history (state at plan authoring: Ready for technical planning). Initial source `spec.md` SHA-256: `CACD63E86498B3867198AC6A5710829158C016D643A375E57F1C42E987E79AFC`, inspected 2026-11-18. This plan preserves FR-01–FR-09, NFR-01–NFR-05, and AC-01–AC-10.

Sources consulted: repository `AGENTS.md`; `docs/global-plan.md` sections 5, 7, 8; `docs/architecture.md` ownership, persistence, concurrency and retention decisions; `docs/app-flow.md` VIEW-07–VIEW-09, FLOW-05–FLOW-07 and shared interaction rules; `docs/design.md` sections 2–7; `docs/quality-project.md` Q01–Q06, SEC01–SEC04, SEC08, WEB03; verification catalog V01–V10 and privacy catalog DP02/03/10/12–16/18/19. Shared visual references are the repository documents dated 2026-11-18 and existing application surfaces, not a new mockup.

Only this plan is produced here. No tasks, application changes, migrations, dependencies, or deployment are introduced.

## 2. Existing implementation and reuse

| Existing path | Evidence and planned reuse |
|---|---|
| `src/App.tsx` | Owns navigation, `PracticeSession`, `startPractice`, return destinations, preference snapshots and session cleanup. Current practice context contains title/description but no stable concept/list/round identity. Extend that context and the existing navigation rather than introduce a router. |
| `src/features/practice/PracticeView.tsx` | Owns transient timer state, completion effects, description reveal and restart confirmation. Add an explicit closure entry and completed-session payload; retain the timer/scene and sound lifecycle. |
| `src/features/practice/timerModel.ts`, `ForestTimerScene.tsx`, `practice.module.css` | Reuse timing logic, scene and style. No timer recovery store, new animation, or rewrite. |
| `src/features/rounds/roundService.ts`, `DrawResultModal.tsx`, `RoundProgressPanel.tsx` | Reuse trusted draw/new-round operations and confirmed/rejected/unresolved result pattern. Its sessionStorage recovery envelope is for round operations; do not copy it for private closure drafts. |
| `src/features/concepts/conceptService.ts`, `ConceptDetailView.tsx`, `src/features/lists/ListDetailView.tsx` | Reuse authenticated reads, optimistic conflict handling, associated-note entry context and existing layout. |
| `src/lib/database.types.ts`, `supabase.ts`, `queryClient.ts`; `src/features/shared/supabaseErrors.ts` | Extend typed schema/contracts, Supabase client, query invalidation and localized domain errors. |
| `src/i18n/resources.ts`, `src/index.css`, `src/app/app.module.css` | Extend Spanish/English text and reuse shared theme, semantic colors, typography and authenticated shell. |
| `supabase/migrations/20261118180000_vs03_round_schema.sql` | Rounds and appearances already exist. Detached anonymous rounds have no owner/list link and are not visible through owner RLS. |
| `supabase/migrations/20261119100000_vs03_round_operations.sql` | `delete_concept` clears appearance titles and concept content; the appearance constraint requires a deleted appearance to have a null title. Both require a new forward migration for the changed product rule. |

Existing Vitest/RTL tests include `PracticeView.test.tsx`, `timerModel.test.ts`, `roundService.test.ts`, `ConceptManagementView.test.tsx`, and `MyListsView.test.tsx`. Extend these only where a connection changes. `package.json` provides `npm test`, `npm run build`, `npm run lint`, `npm run dev`. Local Supabase requires Docker and `npx supabase start` per AGENTS.md. No database verification command is defined in package scripts; preparation of its reproducible local runner is explicitly part of CHECK-03. No CI workflow was found in the inspected `.github` inventory; do not add CI for this slice.

## 3. Proposed changes across layers

All new paths below are proposed, not existing files.

| Change | Responsibility and connections | Spec |
|---|---|---|
| Extend App and PracticeView | Carry a fresh session UUID, owned list/concept IDs, entry round/appearance IDs where applicable, and return context. On completion capture final selected duration and completion instant; an explicit action opens closure. Opening or typing never writes. Restart creates a new save identity when beginning a new practice. | FR-01/02/04 |
| `src/features/practice/PracticeClosureView.tsx` | RHF/Mantine form for label, note and optional 0–5 rating. Save invokes service once per intent, retains values on failure, locks the submitted payload while outcome is uncertain, then shows saved state without navigation. | FR-01–04/09 |
| `src/features/practice/practiceService.ts`, `practiceValidation.ts` | Typed create/reconcile/read and note update/delete contracts. Validate responses, map safe error codes and invalidate owner-specific queries. Validation computes trimmed length while persisting original non-empty text. | FR-02–06/08 |
| `src/features/history/HistoryView.tsx`, `historyService.ts`, `history.module.css` | Owner-scoped Practices/Rounds views, filters/reset and paginated reads; preserve filter state when opening/closing detail. Do not load every record into the browser to filter. | FR-06/07/09 |
| `src/features/practice/PracticeDetailView.tsx`, `PracticeNoteEditor.tsx` | Independent practice detail opened from History; reuse the same note editor from associated concept/list context. Record metadata and rating are read-only. Explicit Save Changes, Cancel and separately confirmed Delete. | FR-05/08/09 |
| New versioned migration(s) under `supabase/migrations/` | Practice/note resources, private reads and trusted writes, idempotency, bounded history queries, deletion compatibility. Preserve the parent-list locking order already used by round operations. | FR-02–08 |

VIEW-08 and independent detail use existing cream surfaces, coffee-brown text/borders, Comfortaa, semantic save/delete/back colors and offset shadows. Retain the navbar/footer, visible Back action, labeled fields, inline errors and established confirmation dialogs. On mobile use stacked controls and readable wrapped text; desktop can align metadata in columns. Do not introduce a new design system, artwork, font, routing library, or test framework.

After Save, associated practice offers Return (existing List Detail destination), Repeat, and Draw Another or Start New Round based on fresh round state. Repeat creates a fresh prepared timer for the same active context; it does not draw again or change the saved record. Draw/new-round actions reuse existing RPCs, including confirmation and retry behavior. Re-fetch availability before acting; an exhausted/stale result updates the actions without changing the saved practice. Independent Return goes to My Lists and Repeat opens a fresh independent timer. If the concept has since been deleted, disable repeat and offer return; do not reactivate it.

## 4. Proposed storage and contracts

### 4.1 Data model

Use PostgreSQL as source of truth. Add the following internal resources; names are proposed and must be reflected in generated/maintained database types during implementation.

- **`practices`:** UUID ID (the in-memory session/save identity), owner UUID derived from `auth.uid()`, kind (`associated`/`independent`), concept/list/round/appearance references as applicable, historical title snapshot for associated records, original independent label, selected duration in whole minutes 1–59, `completed_at timestamptz`, server `saved_at timestamptz`, nullable integer rating 0–5, and request fingerprint for replay comparison. Only completed records exist; return a constant completed state rather than allow arbitrary status transitions.
- **`practice_notes`:** practice ID unique/primary key, original nonblank text, revision counter, server update timestamp. One optional note per practice. Ownership follows the practice. Delete cascades from practice. Retain a note-operation receipt separately so note deletion retries cannot recreate content.
- **`practice_note_operations`:** owner/practice/operation IDs, operation kind, expected revision and resulting revision/outcome. No note payload or historical copies. Delete with the practice. Serialize note operations through the parent practice row; replay returns current state plus original outcome, never deleted note content.

Associated records require an owned list and matching concept; round/appearance links must belong to that same context. Independent records have null associated references and a label of trimmed length 1–50. Rating null means Unrated and is distinct from zero. Empty/whitespace-only note on initial creation means no note row. An empty edit is rejected and does not become a delete operation. Notes have trimmed length 1–2,000. Use a shared, explicitly enumerated whitespace rule in client and SQL and Unicode code-point counts for parity; test accented text, emoji and line breaks. Preserve the original accepted text, including outer whitespace.

Owner/list indexes plus descending `(completed_at, id)` support history. Add concept/date index for concept-context reads and retain existing round/list history indexes. Do not add indexes for every optional filter before inspecting the representative workload. Notes are fetched in detail; list queries return `has_note` rather than full note text.

RLS denies anonymous access and restricts authenticated reads by owner (including linked notes). Revoke direct mutation grants; expose only trusted functions with fixed search paths, explicit owner checks and authenticated execute grants. Browser-supplied owner values are never authoritative. SECURITY DEFINER functions must perform checks even where RLS would otherwise protect ordinary reads. No service key ships to the client.

### 4.2 Internal service/RPC contract

| Proposed operation | Inputs | Result/effects |
|---|---|---|
| `save_completed_practice` | Session/practice UUID; mode and context IDs; duration/completion instant; original label/note; nullable rating | Atomic practice + optional note creation. Return saved ID and metadata. Same UUID/payload returns existing result; different payload on an existing UUID is a conflict. No partial practice if note validation fails. |
| `get_saved_practice` | Practice UUID | Owner-only current record/note for detail or reconciliation after lost response; inaccessible IDs return a generic unavailable result. |
| `update_practice_note` | Practice ID, operation UUID, expected revision, original note | Owner-only compare-and-swap update; returns new revision. Missing/deleted note or revision mismatch cannot silently recreate/overwrite it. |
| `delete_practice_note` | Practice ID, operation UUID, expected revision | Confirmed UI intent; atomically removes note and records text-free receipt. Repeat of same operation does not remove a newer note or practice. |
| `list_practice_history` | Validated filters, date instants, cursor, page size | Owner-only metadata and next cursor; parameterized values, allowed sort directions, no mutation. |
| `list_round_history` / appearance detail read | Owned list filter/cursor or round ID | Paginated owned rounds and ordered appearances, with preserved title and deleted status. History reads never call `get_or_create_current_round`. |

Service results use `confirmed`, `rejected`, `unresolved`; errors distinguish validation, unauthenticated, unavailable context, stale version and transport uncertainty without content-bearing messages. Do not infer that matching text means matching identity. A failed response after commit is reconciled by the same UUID; it does not trigger a new insert UUID. Changed form values require resolution of the previous uncertain submission first.

### 4.3 Compatibility and deletion

Add forward migrations; do not edit executed VS-03 migrations. Change the appearance constraint to permit a preserved title when `concept_deleted=true`, and change `delete_concept` to flag appearances/practices without wiping their historical snapshots. Keep active concept text erasure/tombstone behavior and exclude deleted concepts from draw/repeat. Retain saved practices and notes after concept deletion as confirmed by the user. Review round-operation replay code, which currently replaces deleted titles with null, so presentation changes are deliberate and existing selection semantics remain intact.

Permanent list deletion must remove practices, notes and operation receipts together with linked authored data, and retain only anonymous round totals. The existing schema has no list-delete RPC or round-anonymization trigger: its round FK alone cannot satisfy the round lifecycle constraint. T02 therefore adds and verifies a database `BEFORE DELETE` trigger that snapshots each round's appearance count, detaches/closes the round, and erases its appearance and operation details before list cascades remove authored resources. This adds no list-delete UI or client API to VS-05. Account deletion cascades its profile and lists through the same trigger, so it also retains only detached anonymous round totals, without list/account linkage or appearance details; the user confirmed this consequence on 2026-11-18. Do not create practice records from old timer sessions: VS-04 retained none.

Existing deleted appearance titles were erased and cannot be reconstructed by a migration. For those legacy rows only, show "Concepto eliminado — título no disponible" / "Deleted concept — title unavailable". Preserve available titles and future snapshots. This compatibility exception is confirmed in FR-07/AC-05; never fabricate a title or claim a backfill from missing data. Retained anonymous round totals stay outside private History, without owner linkage or public read access.

Deploy/apply schema before new client reads/writes. Check existing synthetic lists, concepts, rounds and preferences survive the migration. Code rollback can stop using the new tables but does not reverse writes, erasures or migrate retained titles back safely. Use forward corrective migrations; do not promise data recovery from code rollback. Local migration/recovery tests use disposable synthetic data, not production resets.

## 5. Internal behavior and failure handling

**Transient state:** Keep timer, closure drafts and save intent in React memory. Extend App's private-state cleanup to history/practice/note query keys on logout/account change; late responses are discarded if the current Auth UUID changed. Do not persist text or timer state to sessionStorage/localStorage/URLs. Existing round-operation storage remains separate.

**Context:** Retain stable identity when leaving Draw Result; extend callbacks through ListDetailView/App rather than infer a concept from its title. Capture the entry round; starting another round elsewhere does not relabel this practice into a new round. Validate all retained references at save. If deletion has made the context unavailable before save, return unavailable and keep current in-memory input for recovery, with no partial write.

**Time:** `completed_at` is the timer's completion instant, captured once and submitted as a UTC instant; `saved_at` is server time. Pauses do not add to the selected practice duration. Date filters convert local start-of-day to an inclusive lower instant and the day after the local end date to an exclusive upper instant. Do not add a fixed 24 hours across daylight-saving changes. Missing bounds are unbounded on that side; inverted bounds show validation without a query. Locale changes format text only. Different device time zones can legitimately select different records around midnight.

**History pagination:** Plan default 50 records per page, maximum 100 per request, ordered by completion instant plus UUID; support newest/oldest directions from the global ordering decision. Use cursor pagination and discard pages when filters change. Round pages use opened time/ID and appearances use order/ID. Filter categories combine with AND; parameterize values. Use exact concept/list identifiers and literal independent-label matching rather than evaluating label input as an expression. No additional fuzzy search or concept pending/seen filters are introduced.

**Concurrency:** Associated writes acquire the parent-list lock before the practice lock, consistent with existing operations. Independent note writes lock only their practice. Transactions cover practice/note creation and note receipt creation. CAS rejects stale note edits and preserves the UI draft; recovery displays the current note and lets the user explicitly reapply edits against its revision. Cancel discards only the draft. Delete has a separate confirmation and never changes rating or practice metadata.

**Trust limit:** A transient browser timer does not provide server-verifiable proof of oral practice or elapsed time. The server validates types, allowed completed-record structure, ownership and duration, but cannot attest that the user really waited or practiced. Adding persisted timer starts or an anti-cheating service would contradict this scope. The UI enforces completion eligibility; direct requests must still obey every enforceable data rule.

## 6. Decisions and proportionality

- Reuse installed React, Mantine, RHF, TanStack Query, i18next, Supabase and Vitest/RTL. No new dependency or provider is needed; no compatibility/pricing assumption about a new service is required.
- Separate notes from immutable practice metadata so note edits/deletion cannot change a rating. Reuse a single note editor across contexts to avoid divergent behavior.
- Stable client-generated save UUID and transactional uniqueness solve duplicate submission without storing active sessions. Unlike text-based reconciliation, this handles identical but separate valid practices.
- Owner-specific paginated reads resolve spec Q-01's query strategy; compare-and-swap resolves its conflict mechanism. Retention follows the accepted deletion events, not an invented automatic expiry.
- No extra suite per requirement. Add tests only for new domain rules, service uncertainty, trusted database invariants and changed UI transitions. Visual fidelity and actual database authorization require their respective real environments.

## 7. Dependencies, risks and conditional decisions

| ID | Finding and response | Effect/timing |
|---|---|---|
| R-01 | Confirmed by the user: show the localized title-unavailable fallback only for legacy deleted appearances whose snapshots were erased; preserve all available titles and future snapshots. | Resolved in FR-07/AC-05; verify under CHECK-04. No destructive reset or invented backfill. |
| R-02 | Confirmed by the user: anonymous detached round totals remain in storage and outside private History, with no owner linkage or public read access. Deleted-list practices and notes disappear from History. | Resolved in FR-07/AC-05; verify retained totals and access rejection under CHECK-04. |
| R-03 | Trimmed-length limits plus verbatim storage permit very large outer whitespace. No raw-size ceiling is approved. Use existing transport limits, parameterized processing, paged reads and avoid copying notes into list payloads. | If measured input/resource concerns require a new raw text ceiling, clarify the spec before adding it; do not silently truncate. |
| R-04 | Note access after concept deletion still needs an owned list context. Preserve a link from that list's practice records to the note context without reactivating the concept. | Include in note/deletion integration review; independent detail remains separate. |
| R-05 | New code depends on schema and browser keys/local Docker. Credentials and fixtures are external setup, not planning evidence. | Local boundary checks need running Supabase and two synthetic accounts. |

R-01 and R-02 are resolved product/compatibility decisions. The plan can be decomposed into tasks. Implementation must preserve their title-retention and private-access boundaries; R-03 remains a conditional risk if evidence justifies proposing a new raw-input limit.

## 8. Verification and review strategy

All checks below are planned, not executed. Use the existing test environment and synthetic fixtures. Retain execution command, working revision/state, selected tests, expected/observed outcomes and any simulated boundaries in the later task evidence. Do not add a separate verification document.

| Check | Method, setup and expected result | Execution/evidence |
|---|---|---|
| CHECK-01 Rules and dates | Small reusable tests for trimmed label lengths 0/1/50/51, notes absent/1/2000/2001, verbatim storage, empty edit rejection, ratings null/0/5/invalid, local inclusive range conversion including daylight-saving and language independence. Use fixed times and Unicode/whitespace fixtures. | Alongside rule helpers; retain Vitest output. One table-driven case group can cover multiple boundaries. |
| CHECK-02 Closure/service transitions | Extend PracticeView tests and add focused closure/service tests: completion does not save, explicit save creates once, lost response retries same identity, failure preserves input, saved closure does not auto-navigate, Repeat starts a new timer, draw/new-round uses existing operation paths. Mock network/time deliberately; no mocked test claims real persistence. | Alongside closure wiring; verify incomplete/reload abandonment and preferences/scene behavior using existing regressions. Retain discovered test names/results. |
| CHECK-03 Actual persistence and isolation | Local Supabase with two synthetic authenticated users plus anonymous client. Apply new migration over VS-03/04 fixtures. Save/reload associated and independent practices; reject invalid references/fields/ratings and direct unauthorized writes; retry same UUID and overlap requests; verify atomic note creation, CAS conflict and deletion replay. Compare actual rows and HTTP/RPC results. | Alongside storage/services. Prepare a proposed reusable local runner under `supabase/tests/` or a documented Node test invocation; exact runner command is implementation preparation, not an existing npm script. Keep privileged setup separate from authenticated assertions and clean synthetic fixtures only. Retain migration and request outputs. |
| CHECK-04 History/deletion integration | Use real Supabase fixtures with tied timestamps, boundary dates, both types and rated/unrated records. Compare AND-filtered pages with predetermined expected IDs; verify next page has no duplicate stable records. Delete a concept: title snapshot/practice/note survive, deleted status appears, active use fails. Delete its synthetic list: practice/note/receipts disappear and only anonymous round totals survive. Cover legacy null rows under resolved R-01 and RLS under R-02. | Alongside history/deletion work. Reuse CHECK-03 setup. Record before/after counts and owner/cross-user results. Human review of destructive migration and grants is required. |
| CHECK-05 Note UI and safe rendering | Focused RTL tests of shared editor and independent detail: Save Changes, Cancel, empty edit, separate delete confirmation, retained draft after conflict, unchanged rating/description, and returned History note indicator. Render HTML-like note/label text as inert text. | Alongside note UI; mock service failures, reuse real database evidence from CHECK-03. Retain test output. |
| CHECK-06 Integrated visual journey | Real Vite + local Supabase, two synthetic accounts, desktop and narrow Android-sized viewport, Spanish and English. Complete/save/reload one associated practice with rating 0 and note, edit/delete note, review round/history; complete labeled independent practice and manage its note from detail. Check context return, keyboard focus, touch access, long text, field labels, contrast, zoom, loading/empty/error states and matching existing Chucao screens. Inspect logout/account change for leaked cache/text and URLs/storage/diagnostics for private drafts. | After integrated feature exists. Human visual/interaction review and concise screenshots/observations; record actual browser/device. jsdom does not prove layout or database privacy. Broad release matrix remains VS-07. |
| CHECK-07 Static and regression | From repo root after dependencies installed: `npm run build`, `npm run lint`, and focused `npm test -- <affected test paths>`. Reuse existing timer, round service, concepts and My Lists tests where touched. Run the full existing `npm test` once at integration if shared App/session changes warrant it; repeat only after relevant changes/failures. | Retain command output, nonzero discovered-test counts and failures. Inspect expected results independently of implementation, avoid snapshot-only UI tests and assertions on private component internals. |

### Final manual validation procedures (CHECK-06; MV-01 completed, MV-02 deferred)

These checks use the current uncommitted VS-05 implementation with local Vite and local Supabase only. Do not include screenshots or logs containing tokens or note text. The user confirmed completion of MV-01 on 2026-11-19 and reported no failing flow; browser/version and per-case observations were not supplied. By the user's explicit scope decision, MV-02 is not required to complete this local spec validation and remains unverified as a separate privacy/release follow-up.

**MV-01 — Integrated journey and visual/interaction review (FR-01–FR-07/FR-09, AC-01–AC-05/AC-07–AC-10, NFR-01/02, CHECK-06):**

- **Preconditions:** Start Vite with `npm run dev -- --host 127.0.0.1`; start local Supabase and apply pending migrations with `npx supabase migration up --local`. Use two dedicated synthetic accounts authenticated through the established local app flow, never production or personal content. Do not inject privileged keys or borrow real-user content; if synthetic browser sessions cannot be established with current local configuration, record this procedure blocked. Record browser/version and desktop size, then use a narrow Android-sized viewport (emulation is not a physical-device claim).
- **Synthetic data:** In account A, use a list named `VS05 review A`, a concept named `Concept A`, associated notes `VS05-note-A-20261119` and `VS05-note-delete-A-20261119`, draft `VS05-draft-A-20261119`, independent label `Independent A`, and note `VS05-independent-A-20261119`. Account B has its own list/concept and note `VS05-note-B-20261119`. Prepare one legacy null-title round appearance through the existing synthetic fixture setup.
- **Steps and expected results:** (1) In Spanish on desktop, complete a minimum-duration associated timer, set rating `0`, enter `VS05-note-A-20261119`, and explicitly save; VIEW-08 stays with success until an action is chosen. Reload; History has exactly one matching practice with `0` and note presence. (2) From Concept A, cancel an edit and verify the saved note is unchanged; then save a new note and verify the updated value. Delete only the separate `VS05-note-delete-A-20261119` note through the separate confirmation; verify its practice/rating/description remain and its History note presence refreshes. Delete Concept A using the synthetic fixture and confirm the first note's historical title/status and retained note are available from that list's discarded-concept context, with no practice action for the deleted concept. (3) Save an independent completed practice without note/rating and with `Independent A`; History says `Unrated`. Save a separate independent practice with a note, open its distinct detail from History, edit/delete the note, and return to the same filter context. (4) Review round order/origin, an appearance without a practice, deleted status, and the localized missing-title fallback; anonymous totals do not appear in History. (5) Switch to English and verify filter results do not change. Repeat the relevant views at narrow size with keyboard and touch; inspect focus/order, labels/errors, long-text wrapping, contrast and non-color states at 200% zoom. Preferences must scroll far enough to expose Sign out. (6) Sign out and sign in as B; no A note/draft is visible, and B sees only B data.
- **Evidence and cleanup:** Record results without authored text, exact record IDs, or credentials. Clean only the synthetic fixture run using its verified cleanup/readback; if cleanup is interrupted, inspect `app_metadata.fixture_run` and do not reset a shared database.
  - **Execution:** Completed by the user; user confirmed all MV-01 checks and reported no failing flow on 2026-11-19. Browser/version and per-case observations were not supplied, so this is recorded as user attestation rather than independently reproduced evidence.

**MV-02 — Runtime privacy inspection (FR-08, AC-06, NFR-03/05, DP10/13, CHECK-06):**

- **Preconditions/data:** Use the same local build and synthetic A/B sessions. Open a note containing a unique synthetic marker and type `VS05-draft-A-20261119` in the editor without saving.
- **Steps and expected results:** (1) In DevTools Application/Storage, inspect Local Storage, Session Storage, IndexedDB and Cache Storage for the note/draft markers; none should be persisted there. Supabase auth-session entries may exist; do not reveal or copy their values. (2) Inspect the address bar and browser history while opening History, detail, editor, and returning; note/draft text must not appear in path, query or fragment. (3) Inspect Console/diagnostic output after opening, editing, saving and deleting; note/draft markers, credentials and other-account content must not be logged. A note in the explicitly requested detail response or save request is expected and is not itself a leak. (4) Sign out and switch A→B; the UI must stop showing A's note/draft, and B must not retrieve A's content. Anonymous History remains inaccessible. Do not clear storage or copy token/session values as part of inspection.
- **Evidence and cleanup:** Record only browser/version, locale/viewport, inspected storage categories and pass/fail; never retain token values, request bodies, screenshots with authored text, or other personal data. Clean synthetic fixtures and verify absence using the existing cleanup procedure.
  - **Execution:** Not run. The user explicitly excluded MV-02 from the checks required to complete this local spec validation. Runtime storage/URL/cache/diagnostic behavior remains unverified and must not be represented as passed; broad privacy and publication review remains separate.

Proposed test paths: `src/features/practice/practiceValidation.test.ts`, `practiceService.test.ts`, `PracticeClosureView.test.tsx`, `PracticeNoteEditor.test.tsx`, and `src/features/history/historyService.test.ts` as needed. Combine cases or omit a file where existing tests already establish that boundary; this list is not a quota. No new E2E framework, mutation suite, CI, animation suite or duplicate authentication suite is required.

Use a synthetic personal-scale dataset of 1,000 saved practices across 10 lists plus independent sessions to inspect query plans/page bounds in CHECK-04. This is a review fixture, not a product record cap or promised latency SLA. Confirm the client does not fetch/render all notes for a history page; refine indexes only with evidence.

Before public release (VS-07): validate supported browsers, production transport/configuration, account/rights processes, provider backup retention and deletion/restoration handling. Local checks cannot certify those conditions. New note data must already be private from its first local activation; isolation is not deferred to release.

## 9. Traceability and general sequence

| Requirements / acceptance | Planned changes | Evidence |
|---|---|---|
| FR-01; AC-07 | Completed-session payload, explicit closure, memory-only drafts | CHECK-02/06 |
| FR-02/03; AC-01/02/09 | Validation, typed context, atomic practice/note creation, null rating | CHECK-01/02/03 |
| FR-04; AC-03/10 | Save identity/reconciliation, success state and context actions | CHECK-02/03/06 |
| FR-05; AC-04 | Shared note editor, detail entry, CAS and delete receipts | CHECK-03/05/06 |
| FR-06; AC-05 | Bounded filtered owner queries, dates, cursor pages | CHECK-01/04/06 |
| FR-07; AC-05 | Round history and forward deletion changes | CHECK-04; R-01/R-02 decisions |
| FR-08; AC-06 | RLS, trusted grants/validation, safe rendering/cache cleanup | CHECK-03/04/05/06 |
| FR-09; AC-08 | Localized states and established UI patterns | CHECK-02/05/06 |
| NFR-01/02; Q03/WEB03 | Existing theme/layout/focus/labels and responsive contexts | CHECK-06/07 |
| NFR-03/05; DP02/03/10/12–16/18/19 | Minimal fields, synthetic evidence, deletion cascade, redacted errors | CHECK-03/04/06; release conditions |
| NFR-04; Q04/SEC08 | Text rules, metadata-only paged reads and workload review | CHECK-01/04; R-03 |

General order: introduce trusted save/read contract and necessary migration changes including the confirmed legacy compatibility; integrate the associated closure through a real save/reload; add independent closure and post-save actions; expose history with bounded filters/rounds; integrate shared note maintenance; then gather the combined journey/design/regression evidence. Verification accompanies each behavior. This is dependency order, not a task checklist.

## 10. Shared documentation updates

During implementation, record actual practice schema/service boundaries in architecture and carry the confirmed R-01/R-02 compatibility rules into affected shared documentation. Flow/design already describe intended VS-05 behavior; update implementation status only after evidence. Preserve the existing visual system and concept-state filters deferred to VS-06. Update README only for actual local runner/setup changes; do not invent new commands in AGENTS.md. Keep global-plan capability status selected/planned until validation/closure supports delivery.

The next documentation stage is task decomposition from this plan. R-01/R-02 no longer block it. No task file or code has been created by this planning stage.
