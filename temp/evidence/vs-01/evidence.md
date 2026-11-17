# VS-01 Evidence Index

## T01 — Local verification preparation

- **Recorded:** 2026-11-16
- **Repository:** `C:\Users\sebam\projects\chucao-web`
- **Base revision observed:** `6292392`
- **Data policy:** Synthetic accounts and list names only. No real personal
  data, credentials, access tokens, or service keys are recorded here.
- **Environment:** Windows; Node/npm available; Docker Desktop available;
  dependencies installed; `.env.local` and `.env` are present. Only variable
  names were inspected.
- **Supabase CLI:** `3.1.0`
- **Local Supabase:** Running and isolated from production.
  - API: `http://127.0.0.1:54321`
  - Studio: `http://127.0.0.1:54323`
  - Mailpit: `http://127.0.0.1:54324`
- **Health checks:** API, Studio, and Mailpit returned HTTP 200.
- **Configured environment keys:** `.env.local` contains the public Supabase
  URL and publishable-key variables; `.env` contains Google OAuth variable
  names. Values are intentionally not recorded.
- **Google OAuth development setup:** User-confirmed working with two dedicated
  development accounts; both accounts completed the local sign-in flow. No
  account identifiers or OAuth credentials are recorded.

## Synthetic data procedure

The following identities and values are reserved for local verification after
the domain migration exists:

| Identifier | Purpose | Example data |
| --- | --- | --- |
| `local-user-a` | Owner account | `Anatomía`, `Lista privada A` |
| `local-user-b` | Cross-account isolation | No access to user A's lists |
| `local-user-limit` | Boundary account | 100 active synthetic lists |

These are test identities/data definitions, not production users. T02 will
provide the schema and trusted operations required to create local rows. The
Google browser journey was separately verified with two dedicated development
accounts, without recording their identifiers or credentials.

## Commands and results

| Command/check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | No lint output after the `StrictMode` correction. |
| `npm run build` | Passed | TypeScript and Vite production build completed successfully. |
| `npx supabase --version` | Passed | Version `3.1.0`. |
| `npx supabase status` | Passed | Local setup running; no production project linked. Sensitive key output was not retained. |
| Local API/Studio/Mailpit HTTP checks | Passed | All three endpoints returned HTTP 200. |

## Limitations and pending prerequisites

- At the time of T01, no local Auth identities or list rows were created
  because the VS-01 domain schema did not yet exist; T02 created synthetic
  local identities and rows for database verification.
- OAuth callback and sign-in verification were performed by the user with two
  dedicated development accounts; credentials remain outside this evidence.
- No production service, deployment, personal Google account, or real personal
  data was accessed.

## T02 — Trusted VS-01 domain migration

- **Migration:** `supabase/migrations/20261116210000_vs01_account_and_first_private_list.sql`
- **Local reset:** `npx supabase db reset --local --yes` passed and applied the
  migration to the isolated local database. The CLI reported that no seed file
  matched the configured optional `supabase/seed.sql` path; no seed data was
  required for this task.
- **Database lint:** `npx supabase db lint --local` passed with no schema errors.
- **Positive/negative SQL verification:** Passed with synthetic local Auth
  identities:
  - `ensure_profile()` created an account row idempotently and preserved an
    existing `en` locale across repeated calls.
  - A trimmed `Anatomía` list was stored as `Anatomía` with normalized value
    `anatomía`.
  - Apostrophes were preserved; exactly 80 characters were accepted; empty
    and 81-character names were rejected.
  - Case-folded duplicate creation returned `list_name_duplicate` and created
    no second row.
  - A second synthetic user saw zero rows and could not insert or update lists.
  - An anonymous role could neither read lists nor execute list creation.
  - The limit identity created exactly 100 lists; the 101st returned
    `list_limit_reached` and left the count at 100.
- **Test harness correction:** An initial verification block used a list-shaped
  variable for the profile return value and failed before testing the intended
  assertions. The block was corrected and all affected checks were rerun
  successfully. This was a verification-script issue, not a migration error.

## T03 — Typed Supabase data contracts and reconciliation

- **Implementation:**
  - `src/lib/database.types.ts` defines typed profile/list rows and RPC
    contracts for `ensure_profile()` and `create_private_list()`.
  - `src/lib/supabase.ts` now creates a typed Supabase client.
  - `src/features/shared/supabaseErrors.ts` maps trusted boundary outcomes to
    non-sensitive domain error codes.
  - `src/features/lists/listService.ts` provides UUID-scoped query keys,
    validation, owned-list reads, trusted creation, and reconciliation.
  - `src/features/preferences/preferencesService.ts` provides profile
    initialization, scoped reads, locale reads, and locale updates.
- **Checks:** `npm run lint` passed; `npm run build` passed with TypeScript and
  Vite output.
- **Contract review:** No create service accepts `owner_id`; list/profile reads
  assert the current authenticated UUID before querying; reconciliation uses
  the same trimmed/lowercase contract as the database operation.
- **Limitations:** The repository has no test runner and these services have no
  UI caller until T04/T07. Live browser invocation is therefore deferred to
  those integration tasks; the underlying local Supabase contracts were
  exercised in T02 with synthetic identities.

## T04 — Authentication and session ownership boundary

- **Implementation:**
  - `src/App.tsx` now exposes explicit session-checking, session-error,
    Access, profile-initialization, profile-error, and authenticated states.
  - Initial `getSession()` verification and the `onAuthStateChange`
    subscription are both retained, with subscription cleanup on unmount.
  - Auth UUID changes clear private list/profile query caches; same-account
    synchronization does not clear them.
  - `ensureProfile()` must succeed before authenticated content is exposed.
  - Local logout clears private caches and returns to Access. Sign-in/sign-out
    duplicate actions are guarded while busy, and OAuth errors remain
    retryable with non-sensitive messages.
  - `src/main.tsx` provides the shared TanStack Query client required for
    private cache ownership.
- **Checks:**
  - `npm run lint` passed with no warnings after deferring the initial session
    refresh to a microtask.
  - `npm run build` passed with TypeScript and Vite production output.
  - Code review confirmed that list/profile cache keys remain UUID-scoped and
    that no authenticated state is rendered before profile initialization
    succeeds.
- **Pending verification:** Manual browser evidence is still required for
  session-check failure/retry, OAuth cancellation/failure, expiry during a
  protected operation, local logout visibility, same-account reauthentication,
  and different-account switching. Draft preservation/discard cannot yet be
  exercised because the list form is a later task. T04 remains pending until
  those checks are covered by the planned integration work.

## T04 — Manual browser verification

- **Recorded:** 2026-11-16
- **Environment:** Local Vite frontend with isolated local Supabase services;
  two configured Google development identities; no production data or
  credentials recorded.
- **Scenarios executed:**

  | Scenario | Expected result | Observed result | Status |
  | --- | --- | --- | --- |
  | Visitor without a session | Session checking completes, then Access is shown without private content. | Access was shown with `Chucao Web` and the Google sign-in button; no private content was visible. | Passed |
  | Successful sign-in | Google sign-in returns to profile initialization, then authenticated content is shown. | The application showed the initialization state and then `Mis listas` with the signed-in state. | Passed |
  | Local logout | Logout returns to Access and private content remains unavailable after reload. | Logout returned to Access; reloading did not restore private content. | Passed |
  | Different-account switch | A second account cannot inherit the first account's private state. | The second development account opened its own authenticated entry point without the first account's private state. | Passed |
  | Same-account reauthentication | Reauthentication restores the same account's authenticated entry point without cross-account state. | The same development account returned to its authenticated entry point without mixed account state. | Passed |
  | OAuth cancellation | Cancellation returns to retryable Access with the sign-in action available. | Returning from Google showed Access, but the button remained disabled with `Cargando…`. Reloading restored the enabled sign-in button. | Partial; retry required reload |
  | Profile initialization failure | Private content remains unavailable, a non-sensitive error is shown, and retry/logout remain available. | Stopping local Supabase produced the profile-preparation error without exposing private content; after restarting Supabase, retry recovered the authenticated state. | Passed |
  | Initial session-check failure | Private content remains unavailable and retry recovers after connectivity returns. | Blocking the Auth request produced the session-check error and retry control; restoring connectivity and retrying recovered the expected state. | Passed |

- **OAuth cancellation follow-up:** The observed disabled `Cargando…`
  state indicates that the local `busy` flag is not reset when the provider
  returns from a cancelled OAuth attempt without an Auth session event. This
  is a T04 recovery defect to correct before marking the task complete.
- **Draft limitation:** Same-account draft preservation and different-account
  draft discard were not applicable because the list form is implemented in a
  later task. No draft behavior is claimed by this evidence.

## T05 — Bilingual locale and account-preference behavior

- **Implementation:**
  - `src/i18n/resources.ts` defines Spanish and English resources for the
    Access/auth shell and the planned list, detail, validation, preference,
    and privacy states.
  - `src/i18n/i18n.ts` initializes the existing `i18next` integration with
    Spanish fallback.
  - `src/app/LocaleProvider.tsx` applies browser-language detection,
    current-visit local selection, account-preference precedence, profile
    preference reads/writes, retryable read/write states, and document
    language/title updates.
  - `src/App.tsx` now renders translated Access/authenticated shell text,
    accessible language controls, and explicit preference synchronization
    errors without blocking private access.
  - `src/main.tsx` mounts the locale provider around the application shell.
- **Checks:**
  - `npm run lint` passed with no lint diagnostics.
  - `npm run build` passed with TypeScript and Vite production output.
    Vite reported only the existing class of chunk-size warning; the build
    completed successfully.
  - No automated locale tests were added because `package.json` has no test
    runner and T05's account-preference behavior requires a live browser and
    local Supabase session.
- **Pending manual verification:** Access Spanish/English selection must be
  checked without authentication and confirmed not to write account data.
  An existing `es`/`en` account preference must be checked for precedence
  over the Access selection, including reload and another browser/device.
  The no-preference path must confirm that the selected/detected locale is
  persisted. Preference read and write failures must be induced locally and
  confirmed to preserve the displayed locale, keep private access available,
  and expose a retry action. Document language and translated accessible names
  remain pending recheck after the latest correction. Active form-value
  preservation remains assigned to T07 because the relevant UI form does not
  exist yet.

## T05 — Manual verification update

- **Recorded:** 2026-11-17
- **User-reported checks before the follow-up correction:**
  - Existing account preference precedence over the Access selection passed.
  - Preference read/write failure behavior passed.
  - `document.documentElement.lang` changed correctly between `es` and `en`.
  - Unauthenticated language selection behaved correctly except that the
    selection was lost after reload/OAuth navigation.
  - The no-preference account path incorrectly returned to Spanish after
    signing in with English selected.
  - `document.title` remained `Chucao Web` for both locales.
- **Correction applied:** The current-visit locale is now restored from
  `sessionStorage` so the unauthenticated selection survives OAuth
  navigation without being written to account data before authentication.
  Locale-specific document titles now distinguish Spanish and English.
- **Required follow-up:** Repeat the unauthenticated reload/OAuth selection,
  no-preference account persistence, document title, document language, and
  accessible-name checks after this correction. The active list-form value
  check remains assigned to T07.

- **Additional user report:** Access showed the authenticated list title in
  the browser tab; this was corrected so Access now uses `Chucao`, while the
  authenticated shell uses the locale-specific list title. The
  unauthenticated English selection still reverted to Spanish after a page
  refresh in the user's environment despite the current-visit
  `sessionStorage` correction. This remains a non-blocking pending
  verification item rather than being changed to longer-lived local
  persistence.

## T06 — Pre-authentication privacy notice

- **Implementation:**
  - Added Spanish and English privacy content to
    `src/i18n/resources.ts`, versioned as local VS-01 content dated
    17 November 2026.
  - Added a session-independent Access link that opens the notice without
    calling Supabase or requiring authentication.
  - Added the same privacy entry to the authenticated shell. Its current
    local return action goes back to the authenticated list entry point;
    moving the entry into a future Settings/Preferences view remains outside
    this slice.
  - The notice covers the actual slice data, purposes, Google/Supabase
    providers, retention/deletion limitations, rights/contact status,
    security controls, and pending legal/provider publication review.
  - The notice uses semantic headings, an article label, ordinary text
    rendering, translated content, and a return action.
- **Checks:**
  - `npm run lint` passed with no lint diagnostics.
  - `npm run build` passed with TypeScript and Vite production output.
    Vite reported only the existing class of chunk-size warning; the build
    completed successfully.
  - `git diff --check` passed.
- **Manual verification scope:** Open Access without a session in Spanish
  and English, follow the privacy entry, check version/date, headings,
  language metadata, return navigation, and readability. Compare every claim
  with the implemented Auth/profile/list payloads and confirm that no
  unnecessary personal data is disclosed. Final controller, contact,
  provider, transfer, retention, rights, and publication review remains a
  release dependency and is not closed by this local implementation.

- **Manual review result:** Passed. The notice was opened from Access and from
  the authenticated shell in both supported locales. The version/date,
  headings, language, return navigation, and content were reviewed against
  the implemented slice. No unnecessary personal data was observed.
  Final legal/provider publication remains pending by design.

## T07 — My Lists and safe list creation

- **Implementation:**
  - `src/features/lists/MyListsView.tsx` reads owned lists through the
    UUID-scoped TanStack Query key and renders loading, empty, list, query
    failure/retry, success, duplicate, session, unresolved, and limit states.
  - `src/features/lists/ListNameForm.tsx` preserves raw input, validates the
    trimmed 1–80-character value before submission, renders punctuation as
    ordinary text, and disables duplicate submission while pending.
  - Confirmed creation or reconciliation invalidates only the current
    owner's list query. Rejected and unresolved outcomes retain the active
    input and do not claim success.
  - `src/features/lists/lists.module.css` provides the feature layout and
    responsive list grid without adding later list-management controls.
  - `src/App.tsx` now renders the authenticated My Lists view while retaining
    the existing session, locale, privacy, and logout shell.
- **Checks:**
  - `npm run lint` passed with no lint diagnostics.
  - `npm run build` passed with TypeScript and Vite production output.
    Vite reported only the existing class of chunk-size warning; the build
    completed successfully.
  - `git diff --check` passed.
- **Manual review result:** Passed. With synthetic local identities, the UI
  was checked for empty state, valid creation, reload persistence, exact
  80/81 boundaries, whitespace, punctuation, duplicate and repeated
  submission, 100/101 limit behavior, query/create failure and retry,
  account isolation, and preservation of the raw value after recoverable
  failures. Minimal List Detail is intentionally deferred to T08.

## T05/T07 — User decisions recorded

- **Recorded:** 2026-11-17
- Same-account logout/login intentionally discards the unsaved list-form
  value; this is accepted product behavior for the current slice.
- Changing locale while editing a list preserves the active form value and
  passed manual verification.
- Account preference precedence and preference read/write failure recovery
  passed manual verification.
- An unauthenticated Access locale may reset to the Spanish fallback after a
  page refresh. This is accepted as the current-visit behavior and does not
  write account data.
- T05 and T07 are marked complete in `tasks.md`. T08 remains the next task
  for the minimal List Detail transition.

## T08 — Minimal List Detail transition

- **Implementation:**
  - `src/features/lists/ListDetailView.tsx` renders the persisted list name,
    the empty-state explanation for unavailable concepts, and a return action.
  - `src/App.tsx` owns the selected-list state, opens detail only after a
    confirmed create/reconciliation result or an existing list selection, and
    clears it during account changes or logout.
  - `src/features/lists/MyListsView.tsx` makes each list card keyboard
    operable as a button and delegates selection to the App shell.
  - No router, deep-link behavior, concept actions, or later list-management
    controls were added.
- **Automated checks:** `npm run lint`, `npm run build`, and `git diff
  --check` passed. The build retained only the existing Vite chunk-size
  warning.
- **Manual review result:** Passed. Creating a list kept the user in My Lists
  with success feedback and the persisted list visible. Selecting an existing
  list opened detail with the correct name and empty explanation; returning
  revealed the same list, and reload returned to My Lists with persisted data.
  Spanish and English detail text and titles were checked, and no concept or
  management actions were exposed.
- **Product adjustment:** The detail view is entered only by selecting an
  existing persisted list. The document title is `Lista`/`List` while in
  detail and remains `Chucao Web — Mis listas`/`Chucao Web — My Lists` in the
  list view.

## T10 — Responsive accessibility and supported browser behavior

- **Implementation review:** List cards remain keyboard-operable buttons and
  now use valid inline text content rather than nested paragraph elements.
  Existing labels, headings, `aria-describedby` validation errors,
  `role="alert"`/`role="status"` states, document language, translated
  titles, and non-color feedback were reviewed in code.
- **Automated checks:** `npm run lint`, `npm run build`, and `git diff
  --check` passed. The build retained only the existing Vite chunk-size
  warning.
- **Manual verification scope:** The representative keyboard, focus,
  zoom/text expansion, responsive, touch, and browser compatibility review
  was completed.
- **Manual review result:** Passed. Access, privacy, My Lists, form errors,
  retry states, detail, Spanish/English labels and titles, responsive
  layouts, zoom, touch use, and the committed browser scenarios were
  reviewed successfully. The only observed exception is that keyboard Tab
  navigation does not enter list-card selection; this is explicitly accepted
  as product behavior for the current slice and does not block T10.

## T04 — OAuth cancellation follow-up

- **Previous behavior:** Returning from Google after cancelling could leave
  Access showing the sign-in button disabled as `Cargando…` until the page was
  reloaded.
- **How to reproduce:** From Access, start Google sign-in, cancel or go back
  on the provider screen, return to the app without manually reloading, and
  inspect the Access button.
- **Implemented fix:** `src/App.tsx` now listens for `pageshow` and for the
  document becoming visible again. While an OAuth attempt is busy, it calls
  `getSession()` once per return event. A recovered session continues through
  the existing session/profile boundary; no session clears the busy state,
  returns to Access, and shows the retryable OAuth error.
- **Automated checks:** `npm run lint`, `npm run build`, and `git diff
  --check` passed. The build retained only the existing Vite chunk-size
  warning.
- **Manual review result:** Passed. Cancelling or returning from Google
  without reloading returned Access to an enabled sign-in state, displayed the
  retryable message, and allowed a second Google sign-in attempt. A
  successful sign-in still reached the authenticated state.
- **Alternative:** Handle the provider callback through a dedicated
  callback-state component that always resolves the pending sign-in attempt
  before rendering Access. A timer-only reset is not recommended because it
  can re-enable duplicate sign-in while Google navigation is still active.

## T09 — Failure, expiry, retry, and account-switch integration

- **Implementation:**
  - `src/App.tsx` keeps private content behind explicit session/profile
    states, clears private queries and selected detail on account changes or
    logout, and reconciles OAuth return/cancellation.
  - `src/features/lists/MyListsView.tsx` preserves the existing retry action
    and now maps list-query `unauthenticated` and `unauthorized` failures to
    their specific translated messages instead of presenting a generic
    unavailable state.
  - List creation already retains the active form value for rejected,
    unresolved, and recoverable mutation outcomes; successful creation resets
    it only after confirmation.
- **Automated checks:** `npm run lint`, `npm run build`, and `git diff
  --check` passed. The build retained only the existing Vite chunk-size
  warning.
- **Evidence basis:** T09 reuses the previously recorded browser and
  local-service scenarios rather than duplicating them in a new checklist.

- **Manual review result:** Passed based on the previously recorded
  integration checks. T04 covers initial session failure, OAuth cancellation,
  profile failure, logout, reauthentication, and account switching; T05
  covers locale synchronization failures and retry; T07 covers list query and
  creation failures, retry, unresolved reconciliation, duplicate safety,
  persistence, and account isolation. The accepted product decision is that
  local logout/login discards an unsaved draft. These results cover T09
  without adding a separate test runner or duplicating the earlier evidence.

## T11 — Persistence, isolation, boundaries, and security evidence

- **Local database and migration evidence:** The migration was previously
  applied with `npx supabase db reset --local --yes`; `npx supabase db lint
  --local` was rerun and passed with no schema errors. The local stack remains
  isolated and unlinked to a production project.
- **Trust-boundary evidence:** Existing T02 SQL checks cover two synthetic
  authenticated identities, unauthenticated access, known-ID cross-user
  reads, blocked inserts/updates, owner-derived creation, trimmed and
  case-folded names, apostrophes, 80/81-character boundaries, duplicate
  rejection, and the 100/101-list limit. Existing T07 evidence covers UI
  persistence, retries, uncertain-result reconciliation, repeated submits,
  and account isolation.
- **Persistence evidence:** The owner reload/cross-session journey and
  minimal detail persistence were manually passed in T07/T08 evidence.
  No production data was used.
- **Client/configuration review:** `npm run build` passed and
  `git diff --check` passed. No privileged key values or private credentials
  are present in reviewed source/configuration paths, and no client debug
  logging patterns were found. The only `sb_secret_` bundle match is the
  Supabase library's public prefix-detection code, not a secret value.
  Local `supabase status` output was inspected without recording its local
  secret/storage values.
- **Limitations:** Production HTTPS, deployment headers, real-user data,
  and release configuration remain outside local VS-01 evidence and are not
  claimed by this task.

## T12 — Delivery checks and implementation evidence closure

- **Final automated checks:** `npm run lint` passed; `npm run build` passed
  with TypeScript and Vite production output; `git diff --check` passed.
  Vite retained only the known non-blocking chunk-size warning.
- **Integrated evidence review:** T01–T11 evidence covers the synthetic
  vertical journey from Access and privacy notice through OAuth/profile
  initialization, locale selection, My Lists, creation, minimal detail,
  return, reload, logout, recovery, account isolation, responsive behavior,
  and trusted-boundary/security checks.
- **Documentation review:** `tasks.md`, the current spec/plan behavior, flow
  documentation, migration, permissions, and evidence references are aligned
  with the implemented behavior, including the accepted decision that
  creation remains in My Lists and detail opens by selecting a persisted list.
- **Skipped or conditional:** No test runner exists in `package.json`.
  Production deployment, HTTPS/headers, real-user data, final legal/provider
  publication, and final Chucao artwork remain release conditions outside
  local VS-01 closure.
- **Manual review result:** No additional manual scenarios are required for
  T12; the necessary journey and recovery scenarios were already executed and
  recorded in T04–T11.

## Final validation after visual correction

- **Recorded:** 2026-11-17
- **Code state:** Uncommitted working tree at HEAD `6292392`, with the latest
  visual changes in `src/App.tsx`, `src/app/app.module.css`, and
  `src/index.css`.
- **Automated checks:** `npm run lint`, `npm run build`,
  `npx supabase db lint --local`, and `git diff --check` passed. The build
  retained only the known non-blocking Vite chunk-size warning.
- **Scope of changed behavior:** The shared shell now uses the cream
  background at full desktop width, and Access reuses the authenticated
  `languageGroup` presentation for Spanish/English controls.
- **Manual validation status:** Passed. The user checked the current worktree
  on desktop and mobile: lateral strips are gone, Access and authenticated
  language controls match visually, and the responsive behavior remains
  correct.
- **Release limitations:** Production HTTPS/headers, provider/legal
  publication, final identity/art review, and real-user data remain outside
  local VS-01 validation.
