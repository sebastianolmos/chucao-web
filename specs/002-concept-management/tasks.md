# VS-02 — Concept Management Tasks

## Status and references

- **Status:** T01–T09 base scope complete; extraordinary extension T10 in progress
- **Spec:** `specs/002-concept-management/spec.md`
- **Plan:** `specs/002-concept-management/plan.md`
- **Slice:** VS-02 — Concept Management
- **Task state convention:** `[ ]` is pending; `[x]` requires completed work
  and retained evidence. Planning is not implementation evidence.
- **External prerequisites:** Docker, local Supabase CLI/configuration, Vite
  environment variables, and synthetic authenticated accounts.
- **Release conditions:** Production privacy/provider/legal review, deployment,
  real-user activation, and publication browser-matrix evidence remain outside
  this slice.
- **Tooling:** `package.json` provides `npm test` (Vitest), `npm run lint`,
  `npm run build`, `npm run dev`, and `npm run preview`; no formatter script
  is configured.

## Tasks

- [x] T01 — Prepare isolated VS-02 verification
  - **Objective:** Establish the local database/browser environment, synthetic
    data, and sanitized evidence procedure needed for concept persistence and
    ownership checks.
  - **Depends on:** None; VS-01 local foundation is an existing prerequisite.
  - **References:** Preconditions; NFR-04, NFR-09; AC-01, AC-07, AC-08;
    CHECK-01, CHECK-03, CHECK-06, CHECK-07, CHECK-08, CHECK-09, CHECK-10.
  - **Work:**
    - Confirm repository-root commands and required local environment values
      without exposing secrets.
    - Start local Supabase services only when database/Auth checks require
      them; use synthetic accounts and content only.
    - Prepare user A, user B, an owned list, boundary strings, mixed batch
      lines, HTML-like text, punctuation, and long Spanish/English content.
    - Define where sanitized command output, database observations, and
      manual UI results will be retained; do not create a per-spec
      verification file.
    - Record the working-tree/commit state and any unavailable prerequisite.
  - **Verification:** Confirm local services/configuration can be reached or
    record the exact missing prerequisite; confirm test data contains no real
    personal information and evidence can capture expected versus observed
    results.
  - **Done when:** The isolated synthetic-data procedure and evidence path are
    reproducible, secrets are excluded, and any Docker/Auth limitation is
    explicitly recorded without claiming a passing feature check.
  - **Evidence:** Repository state `89d979d` with pre-existing local changes
    preserved. `node_modules` is present; `.env`/`.env.local` contain the
    required variable names `VITE_SUPABASE_URL` and
    `VITE_SUPABASE_PUBLISHABLE_KEY` (values were not printed or retained).
    `npx supabase status` confirmed the local stack is running; sanitized
    endpoint checks returned HTTP 200 for the local REST endpoint and Studio.
    `npm run dev -- --host 127.0.0.1` started Vite successfully and a request
    to `http://127.0.0.1:5173/` returned HTTP 200; the temporary server was
    stopped after the check. `npx supabase migration list` confirmed only the
    VS-01 migration is currently applied, so no VS-02 feature behavior was
    claimed. Synthetic fixtures for later checks are defined as user A, user
    B, one owned list, boundary-length values, mixed batch lines,
    HTML-like text, punctuation, and long Spanish/English content; they must
    be created only in the local stack during T02/T05/T09 execution. Evidence
    is retained in this task file as sanitized command results and expected/
    observed notes; no separate verification file or real-user data was used.

- [x] T02 — Add the trusted concepts migration
  - **Objective:** Establish the concepts table, active/tombstone lifecycle,
    ordering, constraints, RLS, grants, and trusted operations.
  - **Depends on:** T01.
  - **References:** FR-03, FR-04, FR-07–FR-09, FR-12–FR-18; NFR-05–NFR-08;
    AC-01–AC-07; ARCH-03–ARCH-05; CHECK-03, CHECK-04, CHECK-05, CHECK-06,
    CHECK-07, CHECK-11.
  - **Work:**
    - Add a timestamped
      `supabase/migrations/<timestamp>_vs02_concept_management.sql`
      migration after the VS-01 migration.
    - Create `public.concepts` with stable identity, list relationship,
      nullable-on-tombstone title/description, pending/seen state, monotonic
      position, timestamps, and `deleted_at`.
    - Add active-row trim/length checks, exact case-sensitive active-title
      uniqueness, active-read ordering indexes, and ownership-resolution
      support.
    - Add deny-by-default RLS and minimum grants; ensure anonymous and
      cross-user direct access is rejected.
    - Implement trusted single-create, atomic batch-create, compare-and-swap
      update, and compare-and-swap logical-delete operations with Auth UUID
      ownership, fixed SQL, explicit `search_path`, and domain-safe errors.
    - Ensure deletion clears title/description, retains only the minimum
      tombstone reference, and excludes deleted rows from active reads.
    - Lock the list scope while allocating contiguous positions for batch
      inserts.
  - **Verification:** Apply/reset the migration in local Supabase using the
    configured CLI workflow (the exact reset command is an execution detail),
    then exercise valid/invalid direct requests, duplicate titles, batch
    atomicity, stale timestamps, tombstones, and owner isolation.
  - **Done when:** The additive migration applies after VS-01; every trusted
    operation enforces its limits and ownership; batch failure creates no
    partial accepted rows; stale updates do not overwrite newer data; delete
    clears active content; and direct unauthenticated/cross-user access is
    rejected with sanitized evidence.
  - **Evidence:** Added
    `supabase/migrations/20261117134700_vs02_concept_management.sql` without
    modifying the VS-01 migration. `npx supabase db reset --local` applied
    both migrations in order, and `npx supabase db lint --local` reported
    `No schema errors found`. A reversible `psql` check inside the local
    database used only synthetic users A/B and synthetic lists to verify
    single creation, ordered atomic batch insertion, exact duplicate
    rejection, no partial rows after a failed batch, stale
    `updated_at` rejection, tombstone clearing, owner isolation, rejected
    cross-user trusted creation, rejected direct writes, and rejected
    anonymous reads. The check ended with `ROLLBACK` and reported
    `T02 migration checks passed`; no synthetic rows were retained. The
    initial SQL CLI check was discarded because its prepared-statement mode
    rejected multiple statements; the equivalent container `psql` check
    completed successfully. No UI, browser, or client-contract behavior was
    claimed.

- [x] T03 — Define typed contracts and domain errors
  - **Objective:** Make the database/resource contract and failure vocabulary
    explicit for the browser implementation.
  - **Depends on:** T02.
  - **References:** FR-03, FR-04, FR-09, FR-12–FR-20, NFR-01, NFR-05–NFR-09;
    AC-01, AC-04–AC-08; CHECK-03, CHECK-04, CHECK-05, CHECK-06, CHECK-07.
  - **Work:**
    - Extend `src/lib/database.types.ts` with `ConceptRow`, nullable
      tombstone fields, table types, and the trusted function signatures.
    - Extend `src/features/shared/supabaseErrors.ts` with concept validation,
      duplicate, batch-limit, conflict, not-found, unresolved, and
      authentication/authorization mappings.
    - Keep raw provider/SQL messages out of UI-facing errors and preserve
      non-sensitive causes only where the existing error pattern allows it.
    - Ensure returned active concept types are safe for UI rendering and
      tombstone values cannot be treated as active content.
  - **Verification:** Compile the new types against the migration contract
    and map representative trusted error codes/messages to stable domain
    outcomes without exposing SQL text or user-authored content.
  - **Done when:** The browser contract represents every planned operation and
    error outcome, no client type accepts a caller-selected owner, and the
    build/type check finds no unused or incompatible contract code.
  - **Evidence:** Extended `src/lib/database.types.ts` with
    `ConceptState`, nullable `ConceptRow`, non-null active
    `ActiveConceptRow`, batch RPC input, the `concepts` table contract, and
    signatures for all four trusted migration functions. No concept contract
    accepts an owner identity. Extended
    `src/features/shared/supabaseErrors.ts` with stable concept validation,
    duplicate, batch, conflict, not-found, unresolved, authentication, and
    authorization mappings; UI-facing messages remain domain codes rather than
    raw provider/SQL text. `npm run build` passed (TypeScript and Vite);
    `npm run lint` passed; `git diff --check` passed. No test runner exists in
    the repository, so no separate automated mapping test was added. Parser,
    service, and UI usage remain pending in T04–T08.

- [x] T04 — Implement parser and deterministic validation
  - **Objective:** Parse individual/batch input without side effects and
    produce the accepted/omitted review required before persistence.
  - **Depends on:** T01.
  - **References:** FR-03, FR-05–FR-08, FR-21–FR-22; NFR-01, NFR-03, NFR-06;
    AC-02, AC-03, AC-10; CHECK-02, CHECK-08.
  - **Work:**
    - Add the proposed `src/features/concepts/conceptParser.ts`.
    - Enforce the 100-line/20,000-character boundary including line breaks.
    - Preserve source indexes/raw lines and parse lines whose trimmed content
      begins with `-`.
    - Split the first `:` into title/description while preserving later
      colons in the description.
    - Trim values, enforce 1–50 title and 0–2,000 description boundaries,
      reject malformed/empty entries, and omit exact case-sensitive duplicates.
    - Preserve the first valid duplicate occurrence and input order.
    - Return localized reason codes, not translated text or persistence calls.
  - **Verification:** Run focused rule checks through the repository's
    approved mechanism if one becomes available; otherwise execute the
    documented manual parser/UI cases for 0/1/50/51 title lengths,
    0/2,000/2,001 description lengths, 100/101 lines, 20,000/20,001
    characters, malformed lines, first-colon parsing, and duplicates.
  - **Done when:** All accepted/rejected boundary examples produce the
    planned stable results, review creation performs no persistence, and
    user-authored punctuation/HTML-like text remains plain data.
  - **Evidence:** Added the side-effect-free
    `src/features/concepts/conceptParser.ts` with shared title/description
    validation, 100-line/20,000-character guards, source indexes and raw
    lines, first-colon parsing, stable omission reason codes, exact
    case-sensitive duplicate handling, and preserved input order. A temporary
    TypeScript harness compiled with the repository's `tsc` and executed the
    real parser module using synthetic values; it passed title/description
    boundaries, exact 100/20,000 limits, 101/20,001 rejection, malformed and
    empty lines, first-colon descriptions, repeated/existing duplicates,
    source indexes, and HTML-like text preservation. The harness and output
    were removed after execution. `npm run build`, `npm run lint`, and
    `git diff --check` passed. No persistence client or test framework was
    introduced; review creation has no network or storage dependency.

- [x] T05 — Implement concept service and safe mutations
  - **Objective:** Connect the typed browser boundary to Supabase with
    owner-scoped reads, atomic batch writes, reconciliation, conflict
    handling, and tombstone deletion.
  - **Depends on:** T02, T03, T04.
  - **References:** FR-04, FR-07–FR-20; NFR-01, NFR-05–NFR-09;
    AC-01, AC-04–AC-08; CHECK-03, CHECK-04, CHECK-05, CHECK-06, CHECK-07,
    CHECK-10.
  - **Work:**
    - Add the proposed `src/features/concepts/conceptService.ts`.
    - Implement a user/list-scoped query key and `getOwnedConcepts` using the
      existing current-user assertion and active ordered read pattern.
    - Implement individual create and batch create through trusted operations;
      send only reviewed accepted candidates and never one request per line.
    - Reconcile uncertain create results by re-reading active concepts and
      matching exact accepted title/description values before offering retry.
    - Implement update/delete with `updated_at` compare-and-swap and map
      stale values to `concept_conflict`.
    - Map unavailable, unresolved, session-expired, unauthorized, duplicate,
      and validation outcomes without fabricating success.
    - Ensure no concept draft is written to browser storage and account/list
      changes invalidate or isolate local query state.
  - **Verification:** Exercise service operations directly against local
    Supabase with synthetic users, invalid values, duplicate/repeated
    submissions, an uncertain response, stale timestamps, delete retry, and
    cross-user identifiers.
  - **Done when:** Owner reads and trusted mutations work through one typed
    service boundary; invalid/duplicate/stale/unauthorized operations have no
    unintended effects; uncertain results reconcile or remain unresolved; and
    service evidence covers CHECK-03–CHECK-07 and CHECK-10.
  - **Evidence:** Added
    `src/features/concepts/conceptService.ts` with owner-asserted ordered
    reads, typed individual and atomic batch mutations, structural RPC
    response validation, reconciliation for uncertain writes, duplicate and
    validation mapping, compare-and-swap conflict handling, and tombstone
    deletion. A temporary Vite SSR harness exercised the real service against
    local Supabase with synthetic users A/B: owner creation/read, reviewed
    batch creation, duplicate rejection, valid update, stale update rejection,
    logical deletion, cross-user read isolation, and cross-user mutation
    rejection all passed. Synthetic accounts were removed in cleanup; no
    service data was retained. `npm run build`, `npm run lint`, and
    `git diff --check` passed. UI integration, browser query invalidation, and
    uncertain-network fault injection remain for later tasks.

- [x] T06 — Build concept list, individual entry, and batch review
  - **Objective:** Deliver the first vertical UI path from List Detail through
    validation/review to confirmed persisted concepts.
  - **Depends on:** T04, T05.
  - **References:** FR-01–FR-10, FR-18, FR-21–FR-22; NFR-01–NFR-04;
    AC-01–AC-04, AC-08–AC-10; `VIEW-03`, `VIEW-04`, `FLOW-03`;
    CHECK-02, CHECK-03, CHECK-04, CHECK-08, CHECK-09, CHECK-10.
  - **Work:**
    - Add `src/features/concepts/ConceptManagementView.tsx`,
      `ConceptEntryForm.tsx`, `ConceptBatchReview.tsx`, and
      `concepts.module.css` following the plan's proposed paths.
    - Use React Query for loading/error/retry and confirmed-write invalidation.
    - Render empty, active, loading, processing, success, failure, and retry
      states with `aria-busy`, status/alert semantics, and no false success.
    - Implement Individual and By Batch modes with persistent labels, title/
      description guidance, counters, correction feedback, and disabled
      duplicate submission.
    - Preserve raw input/review on recoverable failure and require explicit
      confirmation before batch persistence.
    - Show accepted/omitted sections with source lines, localized reason
      codes, input order, and a result summary after confirmed persistence.
    - Add discard-unsaved-work confirmation and keep all user-authored values
      unmodified and rendered as text.
  - **Verification:** Complete the empty-list, individual-create, mixed-batch
    review/confirmation, over-limit, duplicate, failure/retry, reload, and
    language-switch cases using synthetic user A; confirm no write occurs
    before batch confirmation.
  - **Done when:** The owner can review and persist a valid individual or
    batch concept set exactly once, sees clear accepted/rejected results,
    invalid/over-limit input remains correctable, and loading/error/retry
    behavior passes the relevant UI checks without exposing later round or
    practice controls.
  - **Evidence (2026-11-17, local uncommitted state):** Added the list-scoped
    concept query/view, individual form, batch review/confirmation, Spanish
    and English labels/reasons/status messages, responsive CSS, and confirmed
    write invalidation using the existing service/parser. Batch failure keeps
    the reviewed input available; confirmed success disables repeat submission
    and exposes a result summary. `npm.cmd run build` passed (TypeScript and
    Vite; Vite emitted a >500 kB chunk advisory),
    `npm.cmd run lint` passed, and `git diff --check` passed. Added Vitest/jsdom
    and React Testing Library infrastructure plus three component tests
    covering individual creation, explicit batch confirmation with no early
    write, and over-limit rejection; `npm.cmd test -- --reporter=verbose`
    passed (3 tests). The authenticated browser scenarios were completed by
    the user after T08 wired the view into List Detail; results are recorded
    below and T06 is complete.
  - **Manual verification (user-confirmed, 2026-11-17):** Through the
    authenticated browser flow, the user verified empty-list and individual
    create/reload, mixed batch review with no write before confirmation,
    confirmed batch ordering/result, limits, duplicate handling, recoverable
    failure/retry, and language switching. The user reported all scenarios
    worked as expected.

- [x] T07 — Build concept detail, editing, and deletion
  - **Objective:** Complete the saved-concept maintenance path with stable
    identity, conflict recovery, and explicit logical deletion.
  - **Depends on:** T05, T06.
  - **References:** FR-10–FR-16, FR-18–FR-20, FR-22; NFR-01, NFR-02,
    NFR-05–NFR-08; AC-05, AC-06, AC-08, AC-09; `VIEW-05`, `FLOW-03`;
    CHECK-05, CHECK-06, CHECK-07, CHECK-09, CHECK-10.
  - **Work:**
    - Add `src/features/concepts/ConceptDetailView.tsx` and integrate it with
      the concept collection without adding a separate route.
    - Render title/description as plain text and expose the pending state
      without implying round selection.
    - Implement edit mode with stable concept ID, trimmed validation, duplicate
      handling, expected `updated_at`, and last-confirmed-value preservation.
    - Show stale conflict and `Reload current version`; do not auto-merge or
      silently overwrite.
    - Implement delete confirmation, cancellation, processing, success, and
      failure/retry. Confirmed deletion must remove the active concept and
      reflect the tombstone contract without displaying cleared content.
    - Keep actions keyboard/touch usable and visually separate destructive
      confirmation from ordinary save/cancel actions.
  - **Verification:** Use two sessions for stale edit, cancel and confirm
    deletion, force/reproduce delete uncertainty, reload after changes, and
    inspect active versus tombstone state with synthetic data.
  - **Done when:** Valid edits preserve identity/state, stale edits are
    rejected with reload recovery, cancellation makes no change, confirmed
    deletion removes only active visibility and clears tombstone content, and
    no failed operation reports success.
  - **Evidence (2026-11-17, local uncommitted state):** Added
    `ConceptDetailView.tsx` and integrated it into the concept collection.
    Detail content is rendered as text with explicit pending/seen state. Edit
    submissions use the stable concept ID and last confirmed `updated_at`;
    invalid/duplicate values remain correctable, stale conflicts disable
    further edits until `Reload current version` loads the current row, and
    confirmed updates invalidate the list query. Delete uses a separate
    destructive panel and confirmation dialog; cancellation makes no service
    call, success is shown only for `deleted`/`reconciled` results, and
    uncertain/failure outcomes retain the visible concept and a safe retry.
    Added tests for stable-ID/timestamp update, invalid and duplicate edits,
    conflict/reload, delete cancellation/confirmation, and uncertain-delete
    retry. `npm.cmd test` passed (9 tests total, including T06);
    `npm.cmd run build`, `npm.cmd run lint`, and `git diff --check` passed.
    Component tests mock service results and do not claim real database or
    two-session verification. Those checks were completed by the user against
    the authenticated List Detail path; results are recorded below and T07 is
    complete.
  - **Manual verification (user-confirmed, 2026-11-17):** The user verified
    stale-edit conflict and reload recovery with two independent sessions on
    the same account; the newer value remained and the stale value did not
    overwrite it. The user also verified delete cancellation, confirmed
    deletion, uncertain-result retry, reload, and active-versus-tombstone
    content inspection. All scenarios worked as expected.

- [x] T08 — Integrate List Detail, localization, and privacy copy
  - **Objective:** Connect the concept views to the authenticated VS-01 shell
    and provide complete Spanish/English presentation for this slice.
  - **Depends on:** T06, T07.
  - **References:** FR-01, FR-10–FR-11, FR-18–FR-22; NFR-02, NFR-04,
    NFR-07–NFR-09; AC-01, AC-05, AC-08, AC-09; `VIEW-03`–`VIEW-05`;
    CHECK-09, CHECK-10, CHECK-11.
  - **Work:**
    - Update `src/features/lists/ListDetailView.tsx` to retain the persisted
      list title/back action while rendering the concept-management surface.
    - Add all Spanish/English concept labels, accessible names, validation,
      omission reasons, status, conflict/reload, confirmation, deletion,
      retry, and session-expiry messages to `src/i18n/resources.ts`.
    - Update the local privacy copy to describe concept titles/descriptions,
      private-list purpose, and the local/release limitation without claiming
      final legal publication.
    - Reuse existing CSS variables and responsive patterns; verify long
      translated/user-authored content wraps without clipping.
    - Preserve App-owned account switch/logout cleanup and do not add
      excluded routes, round, practice, history, or advanced organization
      controls.
  - **Verification:** Review both locales through List Detail, entry/review,
    detail/edit, deletion, session-expiry, and account-switch states on
    representative PC/mobile viewports; inspect changed privacy claims and
    accessible headings/labels.
  - **Done when:** The authenticated owner reaches the complete VS-02 journey
    from an existing list in both locales, account changes cannot retain the
    previous concept/draft, all included states are translated and usable,
    and excluded later-slice behavior is not exposed.
  - **Evidence (2026-11-17, local uncommitted state):** Replaced the VS-01
    placeholder in `ListDetailView.tsx` with `ConceptManagementView`, passing
    the current Auth UUID from `App.tsx`. Account switch and logout cleanup now
    remove `concepts` query data; changing the selected account also unmounts
    the concept view and its in-memory draft. Updated Spanish and English
    local privacy copy to describe user-authored concept titles/descriptions,
    their private-list oral-practice purpose, and the local review/release
    limitation. Added tests for list-detail-to-concept wiring and owner/list
    query scope, back navigation, concept controls in English with the
    user-authored list name preserved, localized expired-session feedback, and
    privacy claims in both locales. `npm.cmd test` passed (13 tests),
    `npm.cmd run build`, `npm.cmd run lint`, and `git diff --check` passed;
    Vite reports a >500 kB output chunk advisory. Tests use mocked service data
    and do not verify real Supabase/account-switch behavior. Manual review was
    completed by the user in Spanish/English, including the integrated views
    and account switch/logout; the user confirmed the checks worked as
    expected.

- [x] T09 — Run security, quality, and integrated slice validation
  - **Objective:** Produce the evidence that the implemented increment satisfies
    its acceptance criteria and preserves the VS-01 boundary.
  - **Depends on:** T02, T05, T06, T07, T08.
  - **References:** All committed FR/NFR and AC-01–AC-10; Q01–Q04, Q05–Q06,
    SEC01–SEC04, SEC08, SEC10, DP02, DP03, DP10, DP13, DP14, DP19;
    CHECK-01, CHECK-03–CHECK-11.
  - **Work:**
    - Run the repository's existing `npm run build` and `npm run lint`
      commands from the repository root.
    - Execute direct local Supabase authorization checks for unauthenticated,
      user A, and user B reads/writes/deletes using known IDs.
    - Execute the integrated journey: open an empty owned list, create
      `Anatomía`, reload, paste the mixed batch, confirm, edit, reload,
      cancel deletion, confirm deletion, and inspect the resulting active/
      tombstone state.
    - Repeat failure, retry, uncertain-result, stale-edit, account-switch,
      language-switch, and over-limit scenarios.
    - Review migration grants/RLS, plain-text rendering, browser configuration,
      diagnostics, privacy copy, changed documentation, and excluded scope.
    - Record command output, environment, expected/observed results, and
      sanitized evidence in the repository's established temporary evidence
      location if one is used during execution.
  - **Verification:** Complete CHECK-01 and all applicable checks from the
    plan, distinguishing automated, direct-service, manual, simulated, and
    unavailable evidence. Do not mark a check passed from a plan or from a
    UI-only result where trusted-boundary evidence is required.
  - **Done when:** The complete List Detail → review → persistence →
    retrieval/edit/delete journey passes for synthetic user A; invalid,
    duplicate, over-limit, stale, failed, repeated, unauthenticated, and
    cross-user operations produce no prohibited effects; build/lint pass;
    accessibility/privacy/security review findings are resolved or recorded;
    and every remaining limitation is explicit.
  - **Evidence (2026-11-17, local uncommitted state):** `npm.cmd test` passed
    (2 files, 15 tests); `npm.cmd run build` passed (TypeScript and Vite,
    with the existing >500 kB chunk advisory); `npm.cmd run lint` and
    `git diff --check` passed. `npx.cmd supabase migration list --local`
    confirmed the VS-01 and VS-02 migrations are applied in the local stack.
    Direct local SQL checks using the existing synthetic accounts confirmed
    owner list/concept reads and trusted create/update/logical-delete; account
    B could not read account A's list/concept or call its create/update/delete
    operations. Direct table insert/update/delete were rejected for both
    authenticated and anonymous roles; anonymous reads and trusted writes
    were rejected. Authorized mutations ran inside rollback-only
    subtransactions; a follow-up query found zero temporary T09 rows.
    Read-only catalog review confirmed RLS and FORCE RLS on lists/concepts,
    no anon table access, authenticated select-only table grants, and
    authenticated-only SECURITY DEFINER functions with fixed search paths.
    Production bundle review found no source maps, privileged-key tokens,
    unsafe HTML rendering, or console debug calls. Previously user-confirmed
    T06–T08 manual scenarios cover the authenticated persistence/edit/delete
    journey, failure/retry, stale conflict, account switch, localization, and
    responsive views. The user completed CHECK-09 manual review on PC and
    Android Chrome in both locales, confirming keyboard/focus, zoom,
    error/dialog operation, wrapping, and touch target behavior. Final
    production privacy/provider/legal and deployment readiness remain outside
    VS-02.

## Coverage notes

- T02 and T05 cover the trusted data boundary; T06–T08 cover the browser
  journey; T09 is required to close the slice and is not implied by checking
  the implementation tasks.
- T04 is intentionally independent of the migration because the parser has no
  persistence side effects; T05 depends on both the migration contract and
  parser result shape.
- Vitest/jsdom and React Testing Library were added with user authorization
  and are used by the concept and list component tests. No CI workflow,
  provider, file capability, public route, or later round/practice behavior
  was added.
- External Docker/Supabase/Auth prerequisites can block execution of T01,
  T02, and T09. They do not change the selected scope and must be recorded
  explicitly rather than bypassed with production data.

## Final validation and conditional checks

- **Required before slice closure:** T09, including CHECK-01, direct
  ownership/security evidence, persistence evidence, boundary/retry evidence,
  and the integrated UI journey.
- **Completed for local VS-02:** User-confirmed PC and Android Chrome
  accessibility/responsive review in CHECK-09; see T09 evidence below.
- **Publication-only and not a VS-02 closure claim:** production HTTPS,
  provider/legal/privacy publication, backup/restore operations, public
  registration, deployment, and full browser-matrix evidence.
- **Not applicable to this slice:** uploads/file import/export and
  user-supplied remote fetches; SEC09 remains conditional.

## Execution evidence

T01–T09 execution evidence is recorded inline above. The validation matrix
below summarizes coverage and remaining issues. Evidence uses local services
and synthetic accounts; no production or real-user data was used. Never mark
`[x]` without recording the corresponding verification result.

## Specification validation

**Date and state:** 2026-11-17; local uncommitted working tree based on
`9eb66c5`; local Supabase VS-01 and VS-02 migrations applied; two synthetic
accounts and their local lists/concepts used for direct checks.

**Verdict:** Closed for the user-approved local VS-02 scope. All functional,
security, persistence, and user-confirmed UI criteria passed. The user accepted
two documented scope exceptions for closure: the 500-concept workload was
selected after implementation, and browser rendering measurement was waived.
The spec now includes the user's static `0/active concept count` card behavior.
No browser performance pass or production performance claim is made.

| Requirement or criterion | Related tasks | Test or check | Status and result | Evidence or pending reason |
| --- | --- | --- | --- | --- |
| FR-01–FR-22; AC-01–AC-08, AC-10 | T02–T08 | Parser harness, Vitest components, local Supabase service/RLS checks, user-confirmed T06–T08 browser scenarios | Pass | Task evidence above; real local persistence and synthetic-account isolation are separately evidenced from mocked component tests. |
| NFR-01, Q01–Q02; CHECK-03–CHECK-06, CHECK-10 | T02, T04–T09 | `npm.cmd test`; local SQL trusted-boundary checks; user-confirmed create/reload, batch/retry, conflict/reload, deletion/tombstone and session scenarios | Pass | 15 automated tests passed; local mutation checks rolled back; manual results recorded under T06–T09. |
| CHECK-01; NFR-04, Q05–Q06 | T09 | `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint`, `git diff --check` | Pass | Test suite: 2 files/15 tests. Build and lint passed. Vite retains a >500 kB chunk advisory. |
| CHECK-02; FR-03, FR-05–FR-08, AC-02, AC-03, AC-10 | T04, T06 | T04 parser boundary harness; component tests for batch confirmation and over-limit input | Pass | T04 evidence covers title/description boundaries, 100/101 lines, 20,000/20,001 characters, delimiter, malformed lines, duplicates and plain-text values. |
| CHECK-07; AC-07, SEC01–SEC04, SEC10, DP10, DP13, DP19 | T02, T05, T09 | Local Supabase SQL under synthetic owner A, account B and `anon`; grants/RLS/catalog and production bundle review | Pass | Owner reads and trusted mutations worked; cross-user reads/writes/deletes and anonymous access were rejected. RLS is enabled/forced, functions are authenticated-only with fixed search paths, and no privileged-key token/source map was found in the bundle. Temporary mutations left zero rows. |
| CHECK-08; NFR-03, Q04, SEC08 | T04, T06, T09 | Batch boundary tests; local Supabase synthetic 500-concept retrieval | Accepted closure exception | `EXPLAIN ANALYZE` fetched 500 synthetic rows in 1.181 ms on the local database (database query only). The temporary list was deleted and a fresh count returned to the pre-test baseline of 13 concepts. The user waived browser rendering measurement for local closure; it was not performed and no browser performance pass is claimed. |
| NFR-03 timing requirement: define representative workload before implementation | T01, T04, T09 | Review spec/plan history and validation evidence | Accepted closure exception | The 500-concept workload was selected during validation, after implementation. The user accepts this exception for closing the local slice; the temporal requirement was not met retroactively. |
| CHECK-09; NFR-02, AC-09, Q03, WEB03 | T08, T09 | User-confirmed keyboard/touch review on PC and Android Chrome in Spanish and English | Pass | User confirmed visible focus, zoom, errors/dialogs, wrapping and touch targets. Exact browser versions/viewports were not retained. |
| CHECK-11; DP02, DP03, DP14 | T08, T09 | Human review of migration/grants, errors, local privacy copy and documentation | Pass for local slice | Copy describes concept fields, purpose and tombstone retention and disclaims final legal publication. Lawful-basis, provider/legal publication and account/backup erasure policy remain publication work, not a local-slice claim. |
| FR-23, AC-11; static practiced-count indicator | T06, T09 | Review `MyListsView.tsx` against the updated spec and user direction | Pass | Non-empty cards show `0/active total`; the denominator is the actual active concept count. The numerator is static because practice is not implemented in VS-02. |
| SEC09 and file/remote-fetch exclusions | T02–T09 | Scope review | Not applicable | This slice adds no file import/export, path handling, or user-supplied remote fetch. |

No defect was demonstrated in the database retrieval. The browser-rendering
portion of CHECK-08 was explicitly waived by the user for this local closure;
the database query result must not be represented as a browser or production
performance result. No code was changed during validation.

## Closure

VS-02 is closed for its validated local scope on 2026-11-17 by the user's
decision to accept the documented CHECK-08/NFR-03 exception. T01–T09 are
complete. The spec, plan, validation matrix, global plan, application flow,
and design references were aligned with the delivered scope and the static
`0/active concept count` card indicator. Publication, deployment, legal review,
and release-wide browser compatibility remain outside this local slice; they
do not leave VS-02 pending.

## Extraordinary authenticated-shell extension

- [ ] T10 — Add the authenticated navbar and Preferences dialog
  - **Objective:** Extend the closed local VS-02 shell with the shared navbar,
    single locale toggle, brand return action, and Preferences dialog.
  - **Depends on:** T04, T05, and T08 (authenticated session, locale, and
    privacy behavior are already implemented).
  - **References:** FR-24–FR-28; AC-12–AC-14; `docs/app-flow.md` shared navigation;
    `docs/design.md` shared shell.
  - **Work:** Add the navbar to authenticated content views only; move the
    signed-in email, sign-out, and authenticated Privacy entry into the
    Preferences dialog; preserve Access and its language/privacy entry points;
    add bilingual accessible labels and responsive styling. Add a shared
    fixed stacked-toast surface and move successful list/concept confirmations
    into it while keeping validation/failure feedback in context.
    List rename/edit is not currently implemented in this repository; the
    shared `notify` API can be used when that action is added.
  - **Verification:** Run `npm run build` and `npm run lint`; review the
    authenticated and Access states in Spanish and English, including the
    brand return, modal dismissal/privacy navigation, local sign-out,
    preserved view on locale change, keyboard focus, and narrow layout.
    `npm.cmd run build` and `npm.cmd run lint` passed; the build retains the
    >500 kB chunk advisory; `git diff --check`
    passed. Interactive review with an authenticated browser session has not
    been performed because the browser access host was unavailable. Automated
    tests were not run for this task. The toast flows cover list creation,
    individual/batch concept creation, concept editing, and concept deletion.
  - **Done when:** AC-12–AC-14 are satisfied, the authenticated page body
    no longer duplicates identity/sign-out/privacy controls, Access remains unchanged,
    and the required build/lint checks pass. T10 remains pending until the
    authenticated visual/interaction review is recorded; it does not reopen
    or revalidate unrelated VS-02 database behavior.

