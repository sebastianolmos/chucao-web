# VS-01 — Account and First Private List

## Status and references

- **Status:** Draft — ready for task breakdown
- **Spec:** `specs/001-account-and-first-private-list/spec.md`
- **Slice:** VS-01, first selected vertical slice
- **Planning basis:** Current working tree and the clarified spec dated 2026-11-16
- **Product and scope:** `docs/global-plan.md`, sections 4, 5, 7, and 8
- **Architecture:** `docs/architecture.md`, sections 2–7 and ARCH-01–ARCH-07
- **Quality:** `docs/quality-project.md`, Q01–Q06, SEC01, SEC04–SEC08, SEC10, and WEB03
- **Privacy:** `docs/catalog/data-protection.md`, DP01–DP03, DP08–DP13, and DP19
- **Verification:** `docs/catalog/verification.md`, V01–V09, V11–V13
- **Flow and design:** `docs/app-flow.md`, `VIEW-01`–`VIEW-03`, `FLOW-01`–`FLOW-02`; `docs/design.md`, sections 2, 4, 5, and 6

This plan describes implementation and evidence only. It does not authorize
implementation, dependency installation, migrations, deployment, or changes to
the product requirements.

## Existing implementation and reuse

The current application is a Vite React client with a Mantine provider and
Comfortaa font setup in `src/main.tsx`. `src/App.tsx` contains the existing
Google sign-in, session subscription, OAuth error parsing, and local-scope
logout proof. `src/lib/supabase.ts` creates a PKCE Supabase client with URL
session detection, persisted sessions, and token refresh.

There are no domain tables, migrations, RLS policies, list views, locale
resources, query hooks, form modules, or test scripts in the repository. The
`supabase/` directory currently contains local configuration only. The plan
therefore reuses the current auth client and provider setup but treats all list,
profile, preference, and authorization behavior as new work.

Existing manifest capabilities to reuse:

- React, TypeScript, Vite, Mantine, and Fontsource Comfortaa.
- `@supabase/supabase-js` for Auth and data access.
- TanStack Query for remote state and invalidation.
- React Hook Form for the list form.
- `i18next` and `react-i18next` for Spanish/English resources.
- Oxlint through `npm run lint`.

No new dependency is required by this plan. A routing library, test runner, or
component library extension would require a separate rationale and approval.

## Proposed changes by component

The paths below are proposed implementation locations; they do not currently
exist unless stated otherwise.

### Browser application and session boundary

**Existing entry points:** `src/App.tsx`, `src/lib/supabase.ts`,
`src/main.tsx`.

**Proposed responsibility and change:**

- Refactor `App` into a session-aware shell that explicitly distinguishes
  session checking, session-check failure, Access, authenticated loading, and
  authenticated content.
- Initialize the session with an explicit `getSession` read and retain the
  existing `onAuthStateChange` subscription. Clean up the subscription on
  unmount.
- Track the authenticated UUID, not the email, as the cache and ownership
  identity.
- Clear list queries, private view state, and drafts when the authenticated
  UUID changes. Preserve a list-form draft only while reauthenticating the same
  account in the same page session.
- Keep OAuth redirect handling and local-scope sign-out from the existing proof.
- Map Supabase/Auth failures to non-sensitive translated messages; do not expose
  provider tokens, query details, or another user's data.

**Requirements:** FR-01–FR-07, FR-18, NFR-05–NFR-08, AC-01–AC-04.

### Locale and shared shell

**Proposed paths:** `src/i18n/`, `src/app/LocaleProvider.tsx`,
`src/app/messages/`, or the nearest existing structure selected during task
breakdown.

**Responsibility and change:**

- Define Spanish and English resources for Access, My Lists, minimal List
  Detail, privacy notice, validation, loading, success, failure, retry,
  session expiry, duplicate, and list-limit messages.
- Detect the browser language only when no account preference and no local
  Access selection exist; use Spanish as fallback.
- Keep unauthenticated language selection local to the current visit.
- After authentication, read the account preference. An existing account
  preference wins over the Access selection; otherwise persist the Access
  selection as the account preference.
- Apply locale changes immediately without resetting the list form or private
  content.
- Represent preference-read and preference-write failure separately from the
  local locale currently displayed, with retry available.
- Update the document language and page identity for the active locale.

**Requirements:** FR-08–FR-09, FR-19–FR-20, NFR-02, NFR-09, AC-07,
AC-09, AC-11.

### Privacy notice

**Proposed path:** `src/content/privacy-notice/` or the locale resource
structure selected for the shell.

**Responsibility and change:**

- Provide a session-independent Access entry to a readable privacy notice.
- Render the notice in both supported locales and keep its version/date visible.
- Describe only the data and purposes activated by this slice: Google/Auth
  identity and session data, account preference, list names, service delivery,
  providers, retention/deletion boundaries, rights/contact, and security at an
  appropriate level.
- Keep the notice content separate from authentication and list persistence so
  it remains available when the session or API is unavailable.
- Mark final legal/provider publication review as a release dependency; a local
  synthetic demonstration is not evidence of legal compliance.

**Requirements:** FR-02, NFR-09–NFR-10, AC-11.

### Lists and minimal views

**Proposed paths:** `src/features/lists/`, with focused components such as
`MyListsView`, `ListDetailView`, `ListForm`, and list query/mutation helpers.

**Responsibility and change:**

- Render My Lists with authenticated context, loading, empty, success, failure,
  retry, list-count information when the limit is reached, and the create-list
  form.
- Use React Hook Form for the name field, retaining the raw input while
  validating the trimmed value and displaying translated correction messages.
- Render the minimal List Detail after confirmed creation with the list name,
  an explanation that concepts are unavailable in this slice, and a return
  action. Do not expose concept, round, practice, rename, delete, archive,
  search, ordering, or multi-selection behavior.
- Keep the list display text escaped as ordinary text. No rich HTML is required
  for list names or errors.
- Use TanStack Query keys scoped by authenticated UUID. Invalidate the list
  query only after a confirmed mutation or a reconciliation read.
- Keep the view state in the existing client without adding a router unless a
  later requirement introduces direct route/deep-link behavior.

**Requirements:** FR-10–FR-18, FR-21–FR-22, NFR-01–NFR-05,
AC-01–AC-06, AC-10, AC-12.

### Data access and error mapping

**Proposed paths:** `src/features/lists/listService.ts`,
`src/features/preferences/preferencesService.ts`, and focused query hooks.

**Responsibility and change:**

- Keep all remote reads and writes behind small typed functions.
- Treat the browser as untrusted for owner identity, normalized names, list
  count, and locale validity.
- Convert known database/Auth error conditions to typed domain outcomes:
  invalid name, duplicate name, list limit, unauthorized/session expired,
  unavailable service, and unresolved mutation result.
- Preserve the original user-entered name in memory after a recoverable failure.
- Reconcile an uncertain create operation by reading the current user's lists
  for the normalized name before offering another submit. If exactly one
  matching list exists, treat it as the created result; otherwise show the
  unresolved retry state without a blind duplicate request.

**Requirements:** FR-11–FR-20, FR-22, NFR-01, NFR-05, NFR-08,
AC-05–AC-10, AC-12.

## Data model, contracts, and compatibility

### Proposed persistent entities

The physical names are proposed for task breakdown and may be refined without
changing the spec's observable behavior.

#### `profiles` or equivalent account-preference record

- `id`: UUID equal to the Supabase Auth user UUID; primary ownership key.
- `locale`: constrained value `es` or `en`; default Spanish when no preference
  exists.
- `created_at`, `updated_at`: provider/database timestamps as appropriate.

The record must not duplicate Google credentials. Email is display data from
Auth, not an ownership key. Its read, insert, and update policies must require
the authenticated UUID to equal `id`.

#### `lists`

- `id`: UUID generated at the trusted boundary.
- `owner_id`: UUID referencing the authenticated owner.
- `name`: trimmed user-visible name, 1–80 characters.
- `name_normalized`: server-derived value used for per-owner duplicate checks.
- `created_at`, `updated_at`: timestamps used for later ordering and display.

The first slice has no archive behavior; all created rows are active for the
100-list limit. If a future-compatible archive marker is introduced during
implementation, it must not expose archive behavior here and the limit must
continue to count only active rows once archiving exists.

Required invariants:

- `owner_id` is never accepted from an untrusted client value.
- A unique trusted-boundary constraint covers `(owner_id, name_normalized)`.
- The server validates trimmed character length and derives normalization.
- A trusted operation rejects creation when the owner already has 100 active
  lists.
- Reads return only rows owned by the authenticated UUID.

### Normalization and validation contract

The client may provide early feedback, but the trusted boundary is authoritative.
The shared contract is:

1. Trim the submitted name.
2. Reject an empty result or a result longer than 80 characters.
3. Derive one server-side case-folded normalized value from the trimmed name.
4. Reject a duplicate normalized name for the same owner.
5. Preserve the trimmed original as the display value.

The normalization implementation must be identical for duplicate checks and
reconciliation. It must preserve valid punctuation such as apostrophes as data
and must not use a suspicious-character blacklist.

### Trusted list-creation operation

Use a PostgreSQL function or equivalent trusted transaction for creation. The
operation receives only the candidate name and derives identity from
`auth.uid()`. Its observable outcomes are:

- success: the created list identity and display fields;
- invalid name;
- duplicate name;
- owner at the 100-active-list limit;
- unauthenticated/unauthorized;
- recoverable service failure.

The operation must serialize the owner-specific count/check and insert so two
concurrent requests cannot both pass the 100-list limit. The unique constraint
protects the duplicate invariant. A security-definer function, if used, must
set a restricted `search_path`, qualify objects, and grant execution only to
the intended authenticated role.

The client must read the owner list after an uncertain network result before
submitting again. A matching list is not a new duplicate; it is reconciliation
of the same observable operation.

### Preference contract

Preference reads and writes are scoped to the current Auth UUID. Locale writes
accept only `es` or `en`. A failed read or write must not block the private
shell, silently replace an existing account preference, or mutate list data.
The local locale state and synchronized account preference state must remain
distinguishable to the UI.

### Compatibility and existing data

There are no existing domain rows or migrations in the repository. The first
domain migration can establish the profile/preferences and list invariants
without a data transformation. Existing Auth users must be able to obtain
their profile/preference record idempotently after sign-in; failure to do so
blocks protected list operations but must not claim list success.

Rollback of frontend code does not roll back an applied database migration.
Migration recovery and local reset instructions must be documented with the
implementation evidence; no production migration or destructive reset is
authorized by this plan.

## Algorithms and failure handling

### Session and identity sequence

```text
start application
  -> show session-checking state
  -> read current Supabase session
  -> if read fails: show non-sensitive retry state
  -> if no session: show Access and local locale
  -> if session: establish/read account preference and query owned lists
  -> show authenticated shell only after protected state is scoped to the UUID
```

Auth state changes must clear the previous user's private cache before showing
the next user's data. A different account must never inherit the previous
account's list query results or form draft.

### Create and reconcile sequence

```text
submit raw name
  -> client feedback for trim/length
  -> trusted create operation
  -> on success: invalidate lists and remain in My Lists
  -> on selecting a persisted list: open minimal List Detail
  -> on known validation/duplicate/limit: preserve form and show correction
  -> on uncertain failure: query current owner's normalized name
       -> one match: show it as the confirmed result
       -> no match or ambiguous failure: unresolved retry state, no blind submit
```

The UI must disable duplicate submission while an operation is pending, but
the database invariants remain authoritative for direct or concurrent requests.

### Session expiry during creation

On an auth/session error, retain the active trimmed/raw form value in memory,
show reauthentication guidance, and allow retry after the same Auth UUID is
restored. If a different UUID signs in, discard the draft and reset the private
query scope to that account.

### Locale failure

Apply a user-selected locale immediately in the current UI. If the account
preference cannot be read, use the Access selection or browser/fallback locale,
show a retryable synchronization state, and do not overwrite the account
preference merely because the read failed. If the account has no preference,
persist the authenticated user's Access selection.

## Technical decisions and rationale

### TD-01 — Supabase remains the only product data boundary

- **Decision:** Use the existing Supabase client, PostgreSQL, RLS, and a
  trusted SQL operation; do not add an application server.
- **Rationale:** This is the confirmed ARCH-01 boundary and keeps ownership
  enforcement close to the data.
- **Consequence:** SQL policies/functions, grants, and direct-request checks are
  part of the slice and cannot be replaced by UI checks.

### TD-02 — Query-based reconciliation plus database invariants

- **Decision:** Use the unique owner/name invariant and an authoritative
  reconciliation read after uncertain creation rather than adding a separate
  idempotency service or request-log table.
- **Rationale:** The spec requires at most one list and safe retry, while the
  slice has one simple create operation and no external side effect.
- **Consequence:** The reconciliation query must be scoped to the Auth UUID and
  use exactly the server normalization contract.

### TD-03 — No new client router for this slice

- **Decision:** Use an in-memory authenticated view state for My Lists and the
  minimal List Detail transition.
- **Rationale:** The slice requires navigation between two private views but
  does not commit direct deep-link behavior; WEB02 is scheduled for VS-07.
- **Consequence:** Reload returns to the authenticated list entry point and
  re-reads persisted data; direct List Detail URLs are not part of this slice.

### TD-04 — No new test framework in this plan

- **Decision:** Use the repository's existing build/lint checks plus controlled
  local Supabase, direct boundary checks, and reproducible browser workflows.
- **Rationale:** `package.json` has no test script or test runner, and adding
  infrastructure would expand this documentation stage.
- **Consequence:** Manual/integration evidence must be retained clearly; a
  future test framework remains a separate project decision.

### TD-05 — One atomic VS-01 domain migration and explicit trusted contract

- **Decision:** Add one timestamped migration named
  `<timestamp>_vs01_account_and_first_private_list.sql`, creating
  `public.profiles`, `public.lists`, their constraints/indexes/RLS policies,
  and the trusted `public.create_private_list(p_name text)` operation.
- **Rationale:** These schema objects and the creation boundary form one
  security and consistency unit. `profiles` provides a stable home for the
  account-level locale preference, while `lists` represents the first
  user-owned resource.
- **Consequence:** The migration timestamp is generated when implementation
  begins. The client never supplies `owner_id`; the operation derives it from
  `auth.uid()`, and direct table access remains governed by explicit RLS.

### TD-06 — Narrow idempotent profile initialization

- **Decision:** Initialize the authenticated profile through a parameterless
  `public.ensure_profile()` operation. It derives `auth.uid()`, inserts only
  when absent, preserves an existing locale preference, and returns the
  current profile.
- **Rationale:** A narrow trusted operation avoids exposing a generic client
  upsert and makes first-account initialization idempotent without allowing a
  failed read or retry to overwrite account preferences.
- **Consequence:** Profile initialization is a protected prerequisite for
  list operations. Its failure must be surfaced as a recoverable protected
  state rather than being treated as successful authentication or list
  creation.

### TD-07 — Feature-oriented UI with existing styling mechanisms

- **Decision:** Keep `src/App.tsx` as the session/view orchestrator and add
  focused Access, privacy, My Lists, list-form, and minimal List Detail
  components under `src/features/`, with only genuinely shared components
  under `src/components/`.
- **Rationale:** This separates the vertical slice's user journeys without
  introducing a router, design-system abstraction, or unnecessary component
  layer.
- **Consequence:** Mantine remains responsible for standard controls,
  responsive layout, and accessible behavior; CSS Modules handle
  feature-specific presentation; `src/index.css` remains the location for
  global tokens and base styles.

### TD-08 — Reproducible local/manual evidence without a new test runner

- **Decision:** Retain VS-01 evidence under `temp/evidence/vs-01/`, centered
  on an `evidence.md` index with one record per `CHECK-ID`, supported by
  screenshots and sanitized SQL/API/browser outputs. Record commands,
  environment, synthetic data, expected and observed results, pass/fail, and
  required human review.
- **Rationale:** The repository has no test runner, while the highest-risk
  behaviors require real Supabase/RLS, concurrency, account isolation, and
  browser interaction. Structured manual evidence is more informative than
  introducing unvalidated mocks or a new framework for this slice.
- **Consequence:** Evidence is produced during implementation and review,
  referenced from the authorized task or PR, and must never contain secrets or
  real personal data.

## Dependencies, risks, and open decisions

### Dependencies

- Docker and Supabase CLI for local Auth/PostgreSQL/API services.
- A configured synthetic Google development project and local OAuth callback.
- Local Vite environment variables for the public Supabase URL and publishable
  key; secrets remain in ignored local configuration.
- Owner-approved privacy-notice content and provider details before real-user or
  public processing.
- Final Chucao artwork is not required for private-list behavior, but the
  current Vite favicon/placeholder must not be presented as approved identity.

### Risks and mitigations

| Risk | Mitigation or evidence |
| --- | --- |
| Client-only ownership or list-count checks are bypassed | Direct Supabase requests, RLS, trusted creation operation, and boundary tests. |
| Concurrent creates exceed 100 lists | Lock owner-specific count/insertion transaction and test concurrent requests locally. |
| Lost create response causes duplicate | Unique owner/name invariant plus reconciliation before retry. |
| User data leaks across account changes | UUID-scoped query keys, cache clearing, RLS, and two-account direct tests. |
| Locale read failure overwrites a preference | Separate local/synchronized state and explicit read-failure handling. |
| Privacy notice diverges from actual processing | Review actual payloads/configuration against the notice before release. |
| OAuth or provider setup differs between environments | Keep local and production credentials/configuration separate and record provider review. |

### Pending technical decisions

- None. All technical decisions identified during planning are resolved;
  task breakdown may select exact implementation paths while preserving these
  decisions and the clarified specification.

These decisions do not change the spec's behavior. Implementation tasks must
preserve them and their stated consequences.

## Verification and review strategy

Preparation uses synthetic accounts and lists only. The local Supabase project
must be isolated from production, and destructive reset commands must target
only local data. Commands are run from the repository root.

| Check | Requirement / acceptance | Method, environment, and expected result | Evidence and timing |
| --- | --- | --- | --- |
| `CHECK-01` | NFR-04, Q05, Q06 | Run `npm run lint` and `npm run build` after implementation. Both complete without new errors; build produces the Vite artifact. | Command output and commit/worktree state; before task completion. |
| `CHECK-02` | FR-01–FR-07, AC-01, AC-04 | With local Supabase, synthetic Google test identity, and Vite, exercise session checking, OAuth success/cancel/failure, local logout, initial session-read failure, and same-account reauth. Private content remains unavailable until authenticated; no wrong-account draft or success appears. | Reproducible browser workflow and failure notes; integration review. |
| `CHECK-03` | FR-16, FR-18, NFR-05, AC-03 | Use two synthetic Auth identities against local Supabase. Verify list reads/writes for owner A, unauthenticated access, and direct requests by owner B with a known identifier. RLS/trusted operations deny B without exposing A's data. | SQL/API request results and review of policies/functions; before accepting persistence. |
| `CHECK-04` | FR-11–FR-13, FR-22, AC-05, AC-12 | Exercise empty, 80/81-character, trimmed, punctuation, case-folded duplicate, and 100/101-list cases through UI and direct service requests. Rejected cases create no row and preserve existing data. | Boundary matrix with synthetic data; integration and contract review. |
| `CHECK-05` | FR-15, AC-06, AC-10 | Simulate a lost/failed response and repeat/concurrent create attempts. Reconciliation finds one matching row or shows unresolved retry state; no blind duplicate or second row occurs. | Failure-injection/manual network evidence plus database result; before task completion. |
| `CHECK-06` | FR-14, FR-17, FR-21, AC-01–AC-02 | Complete create, open minimal detail, return to My Lists, reload, and open with the same account in another supported browser/device. The same persisted list is displayed and no concept behavior appears. | End-to-end workflow recording/notes and database state. |
| `CHECK-07` | FR-08–FR-10, FR-19–FR-20, NFR-02, AC-07, AC-09 | Check Access-local locale, account preference precedence, cross-device locale, read/write preference failure, translated states, document language, headings, focus, labels, and preserved form values. | Spanish/English UI review across committed browser baseline; accessibility notes. |
| `CHECK-08` | FR-02, NFR-09, AC-11 | Open the privacy notice without a session in both locales. Compare displayed categories, purposes, providers, retention/deletion, rights/contact, and version/date with the approved content and actual slice payloads. | Human privacy/content review; before real-user/public activation. |
| `CHECK-09` | NFR-02, Q03, WEB03, AC-07 | Review keyboard operation, visible focus, touch targets, responsive layout, zoom/text expansion, meaningful title/heading/language, and non-color status cues on the PC and Android browser baseline. | Manual accessibility/compatibility checklist; before slice acceptance. |
| `CHECK-10` | NFR-08, NFR-10, SEC10, DP13, DP19 | Inspect browser bundles, environment handling, logs/errors, repository changes, and fixtures for privileged secrets or real personal data. Confirm only publishable Supabase configuration reaches the client. | Security/configuration review; before deployment or real data. |

The current repository has no automated test command. Mocks may help show
specific UI failures, but they do not replace `CHECK-03`, `CHECK-05`, or
`CHECK-06` against local Supabase. Existing OAuth proof must be regression
checked rather than replaced by a mock-only result.

Human review is required for RLS/function authorization, migration safety,
privacy-notice accuracy, browser data isolation, accessibility, and any change
to the verification evidence itself.

## Traceability and implementation sequence

| Requirement / acceptance | Planned change | Verification |
| --- | --- | --- |
| FR-01–FR-07, AC-01, AC-04 | Session shell, OAuth reuse, auth error mapping, account transition handling | CHECK-02 |
| FR-08–FR-10, FR-19–FR-20, AC-07, AC-09 | Locale provider/resources, account preference read/write, translated shell states | CHECK-07 |
| FR-02, NFR-09, AC-11 | Session-independent localized privacy notice | CHECK-08 |
| FR-11–FR-14, FR-16–FR-18, FR-21, AC-01–AC-03, AC-06 | List schema, RLS, typed reads, create mutation, My Lists, minimal detail | CHECK-03, CHECK-04, CHECK-06 |
| FR-15, AC-05, AC-10 | Server normalization, unique invariant, reconciliation path, retry state | CHECK-04, CHECK-05 |
| FR-22, NFR-03, AC-12 | Trusted 100-active-list limit and UI limit state | CHECK-04 |
| NFR-01–NFR-08, NFR-10 | Shared operation states, trusted validation, secret/data handling, build/lint, synthetic fixtures | CHECK-01, CHECK-03–CHECK-07, CHECK-10 |
| NFR-09, AC-08 | Notice content and release-only privacy/provider review | CHECK-08, CHECK-10 |

General technical order:

1. Establish the local migration, profile/preference/list constraints, grants,
   RLS policies, and trusted create operation.
2. Add typed data services and query/mutation state scoped to Auth UUID.
3. Wire locale initialization and account preference synchronization.
4. Refactor the auth shell and implement Access, privacy notice, My Lists, and
   minimal List Detail states.
5. Exercise boundary/failure/security checks and update the evidence.

This is an implementation dependency order, not a task breakdown. No later
concept, round, practice, archive, or account-deletion behavior is included.

## Shared documentation updates

No shared document is modified by this plan. During implementation or closure,
the following synchronization should be proposed and reviewed:

- Update `docs/app-flow.md` so `VIEW-03` explicitly includes the VS-01 minimal
  empty state while retaining later concept/round behavior as future scope.
- Update `docs/design.md` if the implemented empty List Detail presentation or
  privacy-notice entry differs from its current visual reference.
- Update `docs/architecture.md` only if the chosen profile initialization or
  trusted creation mechanism changes a shared boundary decision.
- Update `docs/global-plan.md` only if implementation changes the selected slice,
  100-list product rule, or shared capability interpretation.

The plan is ready for task decomposition. Planned checks are not evidence that
the slice is implemented, compliant, or ready for publication.
