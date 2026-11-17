# VS-01 — Account and First Private List

## Status and references

- **Status:** Implementation and local validation complete; publication conditions remain pending
- **Spec:** `specs/001-account-and-first-private-list/spec.md`
- **Plan:** `specs/001-account-and-first-private-list/plan.md`
- **Slice:** VS-01 — Account and First Private List
- **Task state:** All tasks start pending. Planning is not implementation evidence.
- **External prerequisites:** Docker, Supabase CLI, local Supabase configuration,
  Vite environment variables, and a synthetic Google development identity.
- **Release blockers:** Privacy/provider/legal publication review, production
  configuration, and real-user activation remain outside local implementation.
- **Tooling constraint:** `package.json` currently provides `npm run lint`,
  `npm run build`, `npm run dev`, and `npm run preview`; it has no test runner
  or formatter script.

## Tasks

- [x] T01 — Prepare isolated local verification and evidence
  - **Objective:** Establish the local Supabase/Vite setup and the evidence
    convention needed to verify VS-01 with synthetic data.
  - **Depends on:** None.
  - **References:** NFR-04, NFR-10, AC-08; TD-04, TD-08; CHECK-01,
    CHECK-02, CHECK-03, CHECK-04, CHECK-05, CHECK-06, CHECK-07, CHECK-08,
    CHECK-09, CHECK-10.
  - **Work:**
    - Confirm the repository-root commands and local environment prerequisites.
    - Start isolated local Supabase services only when database/Auth checks
      require them; do not use production services or real personal data.
    - Prepare synthetic account/list data and a sanitized evidence index under
      `temp/evidence/vs-01/`; do not add a per-spec test suite.
    - Record the working-tree/commit state and any unavailable prerequisite.
  - **Verification:** Confirm local services/configuration can be reached and
    that evidence records can capture commands, environment, expected result,
    observed result, and sanitized artifacts.
  - **Done when:** The isolated local environment and synthetic-data procedure
    are reproducible, no secrets or real personal data are present, and any
    missing Google/Docker prerequisite is explicitly recorded as blocked.

- [x] T02 — Create the trusted VS-01 domain migration
  - **Objective:** Establish profile preferences, private lists, ownership
    constraints, and trusted database operations.
  - **Depends on:** T01.
  - **References:** FR-04, FR-11–FR-13, FR-16, FR-18–FR-20, FR-22;
    NFR-03, NFR-05, NFR-08; AC-03, AC-05, AC-07, AC-09, AC-12;
    TD-01, TD-05, TD-06; CHECK-03, CHECK-04, CHECK-07, CHECK-10.
  - **Work:**
    - Add the timestamped
      `supabase/migrations/<timestamp>_vs01_account_and_first_private_list.sql`
      migration.
    - Create `public.profiles` keyed by the Auth UUID with constrained locale
      values and timestamps.
    - Create `public.lists` with generated UUID, owner UUID, trimmed display
      name, server-derived normalized name, timestamps, and the per-owner
      uniqueness constraint.
    - Implement `public.ensure_profile()` as the parameterless idempotent
      initialization operation; preserve an existing locale.
    - Implement `public.create_private_list(p_name text)` with trusted
      identity, server validation/normalization, duplicate handling, and an
      atomic owner-specific 100-active-list limit.
    - Add explicit RLS policies, grants, restricted security-definer
      `search_path` where applicable, and no client-supplied ownership field.
  - **Verification:** Apply/reset the migration only in local Supabase and
    exercise valid/invalid direct requests, owner isolation, profile
    initialization retries, duplicate names, punctuation, and the 100/101
    boundary.
  - **Done when:** Local migration application succeeds; trusted operations
    enforce all stated invariants; unauthenticated and cross-user requests
    cannot read or modify another user's list; rejected requests create no
    unintended row; and sanitized database evidence is retained.

- [x] T03 — Implement typed Supabase data contracts and reconciliation
  - **Objective:** Provide the browser-side typed boundary for profiles,
    preferences, list reads, creation, and uncertain-result reconciliation.
  - **Depends on:** T02.
  - **References:** FR-11–FR-20, FR-22; NFR-01, NFR-05, NFR-08;
    AC-05, AC-06, AC-09, AC-10, AC-12; TD-02; CHECK-03, CHECK-04, CHECK-05,
    CHECK-07.
  - **Work:**
    - Add the proposed typed services/query helpers under
      `src/features/lists/` and `src/features/preferences/`.
    - Scope TanStack Query keys and reads by the authenticated UUID.
    - Map known database/Auth outcomes to typed domain results for validation,
      duplicate, limit, unauthorized/session expiry, service failure, and
      unresolved mutation.
    - Preserve raw and trimmed form values as required by the recovery rules.
    - Reconcile an uncertain create result by querying the current owner's
      normalized name before allowing another submission; accept exactly one
      match and otherwise expose unresolved retry state.
    - Keep locale reads/writes distinguishable from the locally displayed
      locale and accept only `es`/`en`.
  - **Verification:** Call the services directly against local Supabase with
    synthetic users and boundary inputs; simulate an uncertain response and
    verify that reconciliation prevents a blind duplicate.
  - **Done when:** Typed service outcomes represent every planned trusted
      result, all reads are UUID-scoped, reconciliation uses the same server
      normalization contract, and no service path accepts client ownership.

- [x] T04 — Refactor authentication and session ownership boundary
  - **Objective:** Preserve the existing Google/PKCE proof while implementing
    truthful session states, profile initialization, account switching, and
    local logout.
  - **Depends on:** T02, T03.
  - **References:** FR-01–FR-07, FR-18; NFR-05–NFR-08; AC-01, AC-03,
    AC-04; CHECK-02, CHECK-03, CHECK-05.
  - **Work:**
    - Refactor `src/App.tsx` around explicit session-checking, session-check
      failure, Access, authenticated loading, and authenticated content states.
    - Perform the planned initial session read and retain/clean up the
      `onAuthStateChange` subscription.
    - Initialize the profile through `ensure_profile()` before enabling
      protected list operations.
    - Track the Auth UUID rather than email as ownership/cache identity.
    - Clear private queries, view state, and drafts when the UUID changes or
      local logout occurs; unsaved drafts are intentionally discarded.
    - Preserve local-scope sign-out, OAuth redirect handling, duplicate sign-in
      prevention, and non-sensitive translated errors.
  - **Verification:** Execute session success, cancellation/failure, initial
      session-read failure, local logout, expiry during creation, same-account
      reauthentication, and different-account switch with synthetic identities.
  - **Done when:** Private content is unavailable before a valid session and
      profile boundary, OAuth failures remain retryable in Access, local
      logout clears private visibility and unsaved drafts, a different
      account cannot inherit data/drafts, and no success is claimed after
      auth/profile failure. **Current state:** session/profile boundary,
      account switching, local logout, and provider-return OAuth recovery
      were manually verified. The accepted product behavior is to discard an
      unsaved list-form value on logout/login.

- [x] T05 — Add bilingual locale and account-preference behavior
  - **Objective:** Implement Spanish/English resources and the local/account
    preference precedence and failure behavior for the slice shell.
  - **Depends on:** T03, T04.
  - **References:** FR-08–FR-10, FR-19–FR-20; NFR-02; AC-07, AC-09;
    TD-06, TD-07; CHECK-07, CHECK-09.
  - **Work:**
    - Add the proposed i18n resources/provider using existing `i18next` and
      `react-i18next` dependencies.
    - Cover Access, privacy, My Lists, minimal List Detail, validation,
      loading, success, failure, retry, duplicate, session, and limit states.
    - Apply unauthenticated selection locally for the current visit.
    - After authentication, prefer the existing account locale; otherwise
      persist the Access selection through the profile boundary.
    - Detect browser language only when no selection/preference exists and use
      Spanish as fallback.
    - Keep local locale and synchronized preference state separate; support
      retry after read/write failure without blocking private access or
      overwriting an existing preference.
    - Update document language and page identity for the active locale.
  - **Verification:** Review both locales through Access and authenticated
      states, including preference precedence, reload/cross-device behavior,
      failed read/write, preserved form value, translated accessible names,
      document language, and headings.
  - **Done when:** All included visible and accessible text is available in
      Spanish and English, locale changes preserve active data/form state,
      account preference precedence is correct, synchronization failures are
      explicit and retryable, and unauthenticated selection does not write
      account data. **Current state:** bilingual resources, locale provider,
      account preference synchronization, retry states, document language,
      localized titles, and authenticated form-value preservation were
      manually verified. An anonymous Access selection may reset to the
      Spanish fallback after a page refresh by product decision; it remains
      local and does not write account data.

- [x] T06 — Publish the pre-authentication privacy notice
  - **Objective:** Make the privacy information reachable before Google sign-in
    and consistent with the actual VS-01 processing.
  - **Depends on:** T05.
  - **References:** FR-02; NFR-09–NFR-10; AC-08, AC-11; DP01–DP03,
    DP08–DP09, DP12–DP13, DP19; CHECK-08, CHECK-10.
  - **Work:**
    - Add locale-aware privacy content under the planned content/resource
      structure, independent of session/API availability.
    - Describe only the actual slice data, purposes, providers, retention and
      deletion boundaries, rights/contact, security level, and version/date.
    - Provide an accessible Access entry/link before sign-in and preserve
      readable headings and navigation in both locales.
    - Mark provider/controller/legal publication review as a release
      dependency; do not claim legal compliance from local content alone.
  - **Verification:** Open the notice without a session in both locales and
    compare it with actual browser/database payloads and approved content.
    Review links, headings, language, and absence of unnecessary personal data.
  - **Done when:** An unauthenticated visitor can open and understand the
      versioned notice before Google sign-in in both locales, its claims match
      implemented processing, and unresolved legal/provider publication work
      remains explicitly pending. **Current state:** bilingual,
      session-independent privacy content and entries in both Access and the
      authenticated shell are implemented. Manual review passed for both
      locales, links, headings, language, and content consistency. The
      authenticated entry is a temporary shell link; a future
      Settings/Preferences surface remains outside this slice. Legal/provider
      publication is not claimed.

- [x] T07 — Implement My Lists and safe list creation
  - **Objective:** Deliver the authenticated empty/list state and create flow
    for private empty lists.
  - **Depends on:** T03, T04, T05.
  - **References:** FR-10–FR-18, FR-22; NFR-01, NFR-03, NFR-05,
    NFR-08; AC-01, AC-03, AC-05, AC-06, AC-10, AC-12; TD-02, TD-07;
    CHECK-03, CHECK-04, CHECK-05, CHECK-06.
  - **Work:**
    - Add the proposed `MyListsView` and `ListNameForm` under
      `src/features/lists/`, using Mantine controls and feature CSS Modules.
    - Render authenticated context, loading, empty, list, success, failure,
      retry, duplicate, and 100-list-limit states.
    - Keep raw input visible while validating the trimmed 1–80-character
      value; preserve punctuation as text and disable duplicate submission
      while pending.
    - Call the trusted create service only after client feedback; invalidate
      the UUID-scoped list query only after confirmed success or reconciliation.
    - Preserve the name during recoverable failures and show unresolved state
      rather than blindly retrying.
    - Keep all list names/errors escaped as ordinary text and exclude all
      later concept/list-management controls.
  - **Verification:** Exercise empty, 80/81-character, whitespace, punctuation,
      duplicate, repeated, limit, persistence, network-failure, and uncertain
      response cases through the UI and direct service boundary.
  - **Done when:** An authenticated owner can create exactly one valid private
      empty list and see truthful loading/success/error/retry states; invalid,
      duplicate, repeated, uncertain, unauthorized, and over-limit attempts
      do not create unintended rows or lose the active value. **Current
      state:** My Lists, UUID-scoped retrieval, client validation, trusted
      creation, retry/error states, duplicate protection, reconciliation
      feedback, and the 100-list boundary presentation are implemented.
      Manual verification of the full UI, failure scenarios, boundaries,
      persistence, duplicate safety, and account isolation passed. Minimal
      List Detail remains assigned to T08.

- [x] T08 — Add the minimal List Detail transition
  - **Objective:** Complete the post-creation journey without expanding into
    concepts or later list management.
  - **Depends on:** T07.
  - **References:** FR-14, FR-21; NFR-01–NFR-03; AC-01, AC-02;
    TD-03, TD-07; CHECK-06, CHECK-09.
  - **Work:**
    - Add `ListDetailView` with the confirmed list name, empty explanation,
      and return action to My Lists.
    - Open it when the person selects a persisted list from My Lists; a
      successful creation remains in My Lists and shows its success state.
    - Keep internal view state in `App` without adding a router or deep-link
      contract.
    - Ensure reload returns to the authenticated list entry point and
      re-reads persisted data.
    - Exclude concepts, rounds, practice, rename, delete, archive, search,
      ordering, and multi-selection actions.
  - **Verification:** Create a list and remain in My Lists with success
      feedback, select the persisted list, return to My Lists, reload, and
      confirm that detail is not shown automatically after creation.
  - **Done when:** A persisted list selected from My Lists opens in the
      minimal detail state, creation remains in My Lists, return navigation
      reveals the same private list, reload rehydrates from persistence, and
      no excluded capability is exposed.
      **Current state:** `ListDetailView` and the App-owned in-memory
      transition are implemented. Manual verification passed for creation
      staying in My Lists, explicit opening of an existing list, return
      navigation, reload persistence, localized detail text, document titles,
      and absence of excluded capabilities.

- [x] T09 — Complete failure, expiry, retry, and account-switch integration
  - **Objective:** Verify the cross-component recovery paths that cannot be
    closed by isolated services or views.
  - **Depends on:** T04, T05, T07, T08.
  - **References:** FR-01, FR-03, FR-05, FR-07, FR-15, FR-20;
    NFR-01, NFR-05, NFR-08; AC-04, AC-06, AC-09, AC-10; CHECK-02,
    CHECK-05, CHECK-07.
  - **Work:**
    - Exercise initial session-check failure and retry without exposing
      protected content.
    - Exercise OAuth cancellation/failure, service failure, expired session
      during create, same-account reauth, and different-account sign-in.
    - Verify draft preservation/discard rules, no false success, no blind
      duplicate, locale synchronization state, and private cache clearing.
    - Record simulated versus real failure boundaries in evidence.
  - **Verification:** Use local Supabase and controlled browser/network
    conditions; repeat the affected flows after any code change.
  - **Done when:** Each committed recovery outcome is observable and
      retryable, preserves only the allowed state, never leaks or duplicates
      private data, and the evidence distinguishes simulated failures from
    real integration results. **Current state:** session, OAuth,
    profile, list-mutation, query-retry, locale, cache-clearing, and
    account-switch paths are implemented. The list query now maps
    unauthenticated and unauthorized failures to explicit messages instead
    of a generic error. Previously recorded manual checks cover the
    required recovery, retry, reconciliation, locale-failure, and
    account-isolation scenarios; T09 is complete.

- [x] T10 — Review responsive accessibility and supported browser behavior
  - **Objective:** Confirm the included shell and interactions are usable on
    the committed PC and Android browser baseline.
  - **Depends on:** T05, T06, T07, T08.
  - **References:** NFR-02, AC-07, AC-09, AC-11; Q03, WEB03, DP08;
    CHECK-07, CHECK-08, CHECK-09.
  - **Work:**
    - Review keyboard order, visible focus, labels, accessible names,
      associated errors, headings, document language, touch targets, zoom/text
      expansion, and non-color status cues.
    - Exercise Access, privacy, My Lists, form, failure, and minimal detail
      states in the two latest stable versions of Chrome, Edge, and Firefox on
      PC and Chrome on Android.
    - Confirm the placeholder/template identity is not presented as approved
      final Chucao artwork.
  - **Verification:** Retain the manual compatibility/accessibility checklist
      and screenshots/notes for representative states; log unavailable
      browser/version checks rather than treating them as passed.
  - **Done when:** Included interactions remain understandable and operable
      across the committed baseline, focus/labels/language/errors are
      observable, responsive layouts do not hide essential meaning, and any
      unavailable platform remains explicitly pending. **Current state:**
      semantic card content was corrected to avoid invalid nested paragraph
      content inside list buttons; lint/build checks pass. Manual review
      passed across the committed browser and responsive scenarios. Keyboard
      focus does not enter list-card selection, and this is an explicitly
      accepted product exception for the current slice.

- [x] T11 — Execute persistence, isolation, boundary, and security evidence
  - **Objective:** Produce real local integration evidence for the highest-risk
    data and trust-boundary behaviors.
  - **Depends on:** T01, T02, T03, T07, T09.
  - **References:** FR-11–FR-18, FR-22; NFR-03, NFR-05, NFR-08,
    NFR-10; AC-02, AC-03, AC-05, AC-06, AC-10, AC-12; SEC01, SEC02,
    SEC03, SEC04, SEC08, SEC10, DP10, DP12, DP13, DP19; CHECK-03,
    CHECK-04, CHECK-05, CHECK-06, CHECK-10.
  - **Work:**
    - Run two synthetic authenticated identities and unauthenticated direct
      requests against actual local Supabase boundaries.
    - Verify known-ID cross-user reads/updates, owner-field injection attempts,
      hostile-but-valid punctuation, length/count limits, repeated/concurrent
      creates, uncertain-result reconciliation, and reload/cross-browser
      persistence.
    - Inspect client bundles, environment handling, logs/errors, repository
      fixtures, and evidence for secrets, private data, or debug leakage.
    - Record migration application/reset and recovery instructions without
      touching production.
  - **Verification:** Capture sanitized SQL/API results, database row counts,
      browser state, bundle/configuration review, and code/migration review in
      `temp/evidence/vs-01/evidence.md`.
  - **Done when:** Owner persistence works across sessions, unauthorized and
      cross-user operations are denied without disclosure, boundary/concurrency
      invariants hold, no privileged secret or real personal data is exposed,
      and all mandatory local evidence is reproducible. **Current state:**
      local migration/RLS and trusted-operation evidence, synthetic boundary
      results, persistence/reconciliation evidence, and bundle/configuration
      review are recorded in `temp/evidence/vs-01/evidence.md`. T11 is
      complete; production deployment and real-data review remain outside
      this local task.

- [x] T12 — Run delivery checks and close the implementation evidence
  - **Objective:** Confirm the integrated vertical journey builds cleanly and
    that documentation/release conditions are accurately recorded.
  - **Depends on:** T06, T08, T09, T10, T11.
  - **References:** NFR-04, NFR-09–NFR-10; AC-01–AC-12; Q01, Q05,
    Q06, DP01–DP03, DP08–DP09, DP19; CHECK-01, CHECK-06, CHECK-08,
    CHECK-09, CHECK-10; V01, V02, V06, V09, V11, V12, V13.
  - **Work:**
    - Run the existing `npm run lint` and `npm run build` from the repository
      root; do not invent a test command.
    - Review the complete synthetic-data journey: Access, privacy notice,
      Google session, profile initialization, empty My Lists, create,
      minimal detail, return, reload, locale, logout, and recovery.
    - Review changed code, migration, permissions, dependencies, diagnostics,
      documentation references, and evidence for accidental scope expansion.
    - Update only affected shared documents if implementation changes an
      agreed architecture, flow, design, or quality decision; otherwise leave
      them unchanged.
    - Mark task states and evidence only from actual command/review results.
  - **Verification:** Retain lint/build output, integrated workflow notes, code
      and migration review, and a list of skipped/unavailable checks. Keep
      publication-only legal/provider and production checks pending.
  - **Done when:** The build and lint checks pass without new errors, the
      complete synthetic vertical journey and required recovery/security
      evidence are recorded, documentation matches implemented behavior, and
      no task is marked complete without its stated evidence. **Current state:**
      final lint/build checks passed, T01–T11 evidence is complete, and the
      integrated journey is covered by the recorded Access, privacy,
      authentication, locale, lists, detail, recovery, isolation, and
      responsive reviews. T12 is complete; production/legal publication
      conditions remain outside this slice.

## Coverage notes

- T02 and T11 provide the trusted-boundary, ownership, validation, quota,
  injection, and data-protection coverage; UI hiding alone is not accepted.
- T04, T07, and T09 jointly cover authentication/session recovery and truthful
  operation states; isolated component success is not sufficient for AC-04,
  AC-06, or AC-10.
- T05, T06, and T10 cover locale, privacy information, semantics, keyboard,
  touch, and browser-baseline obligations.
- No task introduces concepts, rounds, practice, full account settings,
  deletion automation, public release, analytics, a router, a test runner, or
  production deployment.
- Q04 is not activated for a separate performance task in this slice because
  the committed behavior is limited to at most 100 personal lists; T11 still
  verifies bounded list retrieval and the trusted 100-list rule.

## Final validation and conditional checks

- The integrated local journey is performed in T12 only after T02–T11 are
  complete enough to provide real dependencies.
- Privacy/provider/controller publication review remains a release condition
  and is not closed by local synthetic evidence.
- Production HTTPS, deployment configuration, provider settings, and any
  public-registration abuse controls remain pending until the relevant
  deployment/release event.
- The committed desktop and mobile browser scenarios were reviewed manually
  and passed, including the latest visual shell correction.

## Final validation status

**Validation verdict:** Spec met for local VS-01 scope.

The functional, persistence, authorization, privacy-notice, recovery,
responsive, and delivery evidence recorded before the latest visual changes
remains applicable to those unchanged behaviors. The targeted visual review
was then repeated against the current worktree and passed.

| Requirement or criterion | Related tasks | Test or check | Status and result | Evidence or pending reason |
| --- | --- | --- | --- | --- |
| FR-01–FR-07, AC-01, AC-04 | T04, T09 | Browser authentication and recovery review | Pass on recorded evidence | `temp/evidence/vs-01/evidence.md`; unaffected by the latest CSS/layout change |
| FR-08–FR-10, FR-19–FR-20, AC-07, AC-09 | T05, T10 | Locale, preference, translated shell, and accessibility review | Pass | Manual review after the latest visual changes passed |
| FR-02, AC-11 | T06 | Privacy notice in both locales before sign-in | Pass on recorded evidence | `temp/evidence/vs-01/evidence.md` |
| FR-11–FR-18, FR-21–FR-22, AC-02–AC-06, AC-10, AC-12 | T02, T03, T07–T09, T11 | Local Supabase boundary, persistence, failure, retry, and isolation checks | Pass on recorded evidence | Migration lint and synthetic boundary evidence remain applicable |
| NFR-04, Q05, Q06 | T01, T11, T12 | `npm run lint`, `npm run build`, `npx supabase db lint --local`, `git diff --check` | Pass | Current worktree; build has only the known non-blocking chunk-size warning |
| NFR-02, Q03, WEB03–WEB04 | T10 | Desktop/mobile visual, keyboard, focus, title, favicon, and responsive review | Pass | Desktop lateral strips are gone; Access and authenticated language selectors match; mobile review passed |
| NFR-05–NFR-10, SEC01, SEC04–SEC10, DP01–DP03, DP08–DP13, DP19 | T02, T06, T11, T12 | Trusted-boundary, bundle/configuration, synthetic-data, and privacy evidence review | Pass locally; release review pending | Production HTTPS/headers, provider/legal publication, and real-user review remain outside VS-01 |

### Current validation state

- **Code state:** uncommitted working tree; current HEAD `6292392`.
- **Environment:** Windows, local Supabase stack, Node/npm dependencies installed.
- **Executed checks:** `npm run lint`, `npm run build`, `npx supabase db lint --local`, and `git diff --check` passed.
- **Manual review completed:** Access and authenticated shell were checked in desktop and mobile layouts after the latest visual correction; all targeted scenarios passed.
- **Release-only pending work:** production deployment configuration, HTTPS/headers,
  provider/legal publication review, and real-user data review.

The local VS-01 specification is validated. Publication-only conditions remain
outside this verdict.

## Closure

- **State:** Closed for the validated local VS-01 scope.
- **Effective date:** 2026-11-17.
- **Validated code state:** Uncommitted working tree at HEAD `6292392`, with
  the final local implementation changes present.
- **Validation evidence:** `temp/evidence/vs-01/evidence.md`, including the
  final desktop/mobile visual review and the automated delivery/database
  checks.
- **Documents synchronized:** This task document records the closure and
  evidence; `spec.md` records the validated state; `docs/global-plan.md`
  records VS-01 as locally validated and links the scope; no architecture,
  flow, design, or quality decision changed beyond the already implemented
  visual correction.
- **Remaining follow-ups:** Production deployment configuration, HTTPS and
  headers, provider/legal publication review, final identity/art review, and
  real-user data review remain release conditions outside this slice.
