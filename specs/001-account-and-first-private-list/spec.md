# VS-01 — Account and First Private List

## Status and references

- **Spec ID:** VS-01
- **Title:** Account and First Private List
- **Status:** Validated locally; publication conditions remain pending
- **Slice:** VS-01, selected first vertical slice
- **Global source:** `docs/global-plan.md`, sections 4, 5, 7, and 8
- **Flow source:** `docs/app-flow.md`, `VIEW-01`, `VIEW-02`, `FLOW-01`, and `FLOW-02`
- **Design source:** `docs/design.md`, sections 2, 4.1, 4.2, 5, and 6
- **Architecture source:** `docs/architecture.md`, sections 2, 4, 6, and 7
- **Project quality source:** `docs/quality-project.md`, selected criteria Q01–Q06, SEC01, SEC04–SEC08, SEC10, and WEB03
- **Quality source:** `docs/catalog/quality.md`, Q01–Q06, SEC01, SEC04–SEC08, SEC10, WEB02–WEB04
- **Privacy source:** `docs/catalog/data-protection.md`, DP01–DP03 and DP08–DP13
- **Verification source:** `docs/catalog/verification.md`, V01–V09, V11, and V12

This document defines observable behavior only. Technical implementation details, physical schema, migration ordering, test tooling, and CI changes remain for the technical plan.

## Context and objective

Chucao Web needs a private, persistent account boundary before concepts, rounds, practices, and history can be added. This slice turns the existing Google session proof into the first usable product journey: a person enters through Google, creates a named empty list, and can see that list again from the same account on a supported browser or device.

The result must establish private ownership without exposing another account's data. It also establishes the Spanish/English access and list shell, truthful operation states, and a responsive foundation for later slices.

## Actors and preconditions

### Actors

- **Unauthenticated visitor:** Can access the entry view, choose a language, start Google sign-in, and read the privacy information.
- **Authenticated person:** Owns and manages their private lists in this slice.
- **Second authenticated person:** Must not see or modify the first person's lists.
- **Google and Supabase Auth:** External identity and session providers; Google remains responsible for Google credentials and recovery.

### Preconditions

- The application can reach the configured Supabase Auth service and database service.
- The person has a Google account permitted by the current environment.
- A valid Chucao session is required for private list reads and writes.
- Development and acceptance data use synthetic accounts and content; this slice does not authorize public production use.

## Scope and exclusions

### Included

- Session checking with distinct loading, unauthenticated, authenticated, and recoverable authentication-error states.
- Google sign-in through the confirmed Supabase Auth/PKCE flow, local Chucao sign-out, and session recognition after return.
- First-account recognition and linkage to the stable authenticated identity.
- Spanish and English labels, validation, status messages, accessible text, and language selection for the included views.
- An accessible privacy notice available from Access before Google sign-in, covering the applicable data, purposes, providers, retention/deletion, rights/contact, and notice version/date.
- A responsive, keyboard-usable Access view and My Lists view for supported modern PC and Android browsers.
- Compatibility with the two latest stable versions of Chrome, Edge, and Firefox on PC, and the two latest stable versions of Chrome on Android.
- Creating a private empty list with a required trimmed name.
- List-name validation: 1–80 characters after trimming, and uniqueness per user after trimming and case folding.
- Limiting each account to at most 100 active lists; creation beyond that limit is rejected without modifying existing data.
- Displaying the authenticated person's active private lists, including loading and empty states.
- Opening a minimal empty List Detail view showing the list name, an explanation that concepts are not available in this slice, and a return action to My Lists.
- Reading the persisted list after reload and from another supported browser/device using the same account.
- Trusted-boundary ownership enforcement for list reads and writes.
- Understandable validation, unauthorized, expired-session, network, persistence, retry, and duplicate-submission states.

### Excluded

- Concepts, descriptions, pasted batches, rounds, random selection, practice, notes, ratings, history, and timers.
- List rename, deletion, archiving, restoration, duplication, search, ordering controls, and multi-selection.
- Full Settings and Account views beyond the language/session shell and local sign-out needed here.
- Account deletion, rights automation, public registration release, production deployment, and provider/legal review completion.
- Active timer state, Chucao timer scenery, completion sound, and final identity assets.
- Shared lists, organizations, public content, analytics, marketing, and learning assessment.

Existing authentication proof and its intended local logout behavior must remain functional while this slice expands the authenticated experience.

## Scenarios and user stories

### US-01 — Enter privately

As an unauthenticated visitor, I want to understand the product and continue with Google so that I can enter my private workspace without creating an application password.

### US-02 — Create the first list

As an authenticated person, I want to name and create an empty list so that I have a private place for later concepts.

### US-03 — Return to saved data

As the owner of a list, I want to reload the application or open it on another supported device and see the same list so that my account data is persistent and cross-device.

### US-04 — Preserve isolation

As a person using another account, I want private lists to remain inaccessible so that knowing a resource identifier or using a direct request does not bypass ownership.

## Functional requirements

### Authentication and session

**FR-01.** When the application starts, it shall show a session-checking state until the current Chucao session is known, without presenting private list content as available. If checking the session fails, it shall show a non-sensitive error and a retry action while keeping private content unavailable.

**FR-02.** When no valid session exists, the application shall show Access with a Google sign-in action, language selection, and a reachable privacy notice before Google sign-in. The notice shall identify the applicable data, purposes, providers, retention/deletion, rights/contact, and its version or date in understandable language.

**FR-03.** When the person starts Google sign-in, the application shall show a processing state and prevent duplicate starts until the attempt resolves or fails.

**FR-04.** When Google/Supabase authentication succeeds, the application shall recognize or create the Chucao identity associated with the stable authenticated identity and route to the private list view.

**FR-05.** If authentication is cancelled or fails, the application shall remain in Access, show an understandable retryable error, and shall not create a list or claim a signed-in state.

**FR-06.** When the person signs out locally, the application shall end the Chucao session, clear private list visibility, and return to Access without claiming that the Google account itself was deleted or signed out.

**FR-07.** If the session expires during a protected operation, the application shall not report success or write under an unauthenticated or different identity. It shall explain that reauthentication is required, preserve the active list name in memory, and allow the person to retry after reauthentication with the same account. If a different account signs in, it shall discard that draft and show only the new account's private entry point.

### Language and private shell

**FR-08.** The Access, My Lists, and minimal List Detail views shall provide Spanish and English text for visible labels, validation, errors, confirmations, loading, empty, success, and accessible names.

**FR-09.** When the person changes language within this slice, the application shall update the included interface immediately without losing the active list-form value or changing list ownership or content. Before authentication, the selection applies locally to the current visit and does not write account data.

**FR-10.** After authentication, the application shall display My Lists with a clear authenticated context, list loading state, empty state, create-list action, and a visible result after a successful creation.

### List creation and retrieval

**FR-11.** When an authenticated person submits a list name, the application shall trim it before validation and persistence.

**FR-12.** If the trimmed name is empty or exceeds 80 characters, the application shall show a correction message, shall not create a record, and shall preserve the entered value for correction.

**FR-13.** If a list with the same trimmed name under case folding already belongs to the authenticated person, the application shall reject the creation, explain the duplicate, and shall not create another list.

**FR-14.** When a valid list creation is confirmed by the trusted data boundary, the application shall show success and the new empty list in the authenticated person's My Lists view. It shall not show success before confirmation.

**FR-15.** Repeated submissions of the same create action shall not create more than one list. If the result of a submission is uncertain, the application shall reconcile the authenticated person's lists before offering another attempt; it shall show the matching persisted list as the result when exactly one matching normalized name is found, or show a retryable unresolved state without blindly submitting again. A failed operation shall not silently discard the active name.

**FR-16.** When an authenticated person opens My Lists, the application shall return only lists owned by that authenticated identity and shall show an appropriate empty state when none exist.

**FR-17.** After reload or access from another supported browser/device with the same account, the application shall retrieve and display the previously persisted list.

**FR-18.** An unauthenticated request, a request with another authenticated identity, or a request that attempts to provide or alter ownership shall be rejected at the trusted boundary. The UI shall not disclose the protected list or internal authorization details.

**FR-19.** When an authenticated person changes language, the application shall persist the selected language as an account-level preference and apply it when the same account opens the application on another supported browser or device. After authentication, an existing account preference takes precedence over the unauthenticated Access selection; if no preference exists, the Access selection becomes the account preference.

**FR-20.** If reading or saving the language preference fails, the application shall not block access or silently overwrite the account preference. It shall distinguish the locally applied language from the unsynchronized account preference, preserve the current interface selection, and provide a retryable failure state. If no account-level preference or Access selection exists, the application shall use browser-language detection where available and Spanish as fallback.

**FR-21.** When an authenticated person opens a persisted list from My Lists, the application shall show a minimal List Detail view with the list name, explain that concepts are not available in this slice, and provide a return action to My Lists. It shall not create or manage concepts, rounds, selection, or practice from this view.

**FR-22.** If the authenticated person already owns 100 active lists, the application shall reject another list creation with an understandable limit message and shall not modify existing lists.

### Examples

| Input | Expected result |
|---|---|
| `  Anatomía  ` | Accepted and displayed as `Anatomía`; surrounding whitespace is not part of the stored name. |
| 80 characters after trimming | Eligible for creation if otherwise unique. |
| 81 characters after trimming | Rejected with no created list. |
| `Anatomía` followed by ` anatomía ` for the same owner | The second submission is rejected as a duplicate. |
| An apostrophe or ordinary punctuation in a valid name | Preserved as user-authored text and displayed as text, not treated as an injection or invalid solely due to punctuation. |

## Applicable non-functional requirements

### Quality and delivery

**NFR-01 (Q01, Q02).** The slice shall expose truthful loading, empty, processing, success, validation, failure, retry, reload, and duplicate-submission states; rejected or failed operations shall not create unintended lists or lose the active value without explanation.

**NFR-02 (Q03, WEB03, WEB04).** The included views and interactions shall be operable by keyboard and touch across the two latest stable versions of Chrome, Edge, and Firefox on PC and the two latest stable versions of Chrome on Android. They shall expose visible focus, associated labels and errors, meaningful headings and document language, and appropriate alternatives for any included identity imagery. Essential meaning shall not depend on color, hover, or illustration.

**NFR-03 (Q04, SEC08).** List retrieval and rendering shall remain usable for up to 100 active lists per account without unbounded client-side processing, and the trusted boundary shall reject creation beyond that limit.

**NFR-04 (Q05, Q06, V12).** Local setup, the domain data change, and the affected application behavior shall remain reproducible through the repository's documented delivery process, with actionable failures and no accidental debug output.

### Security and privacy

**NFR-05 (SEC01, SEC04, DP10).** List names, protected fields, and ownership shall be validated and enforced at the trusted data boundary. Direct requests shall have the same isolation as normal UI requests; authentication alone and hidden controls shall not establish authorization.

**NFR-06 (SEC05, DP11).** The slice shall use the confirmed Google/Supabase session flow, keep Google credentials outside Chucao, associate ownership with the stable authenticated identity rather than email, and define observable local logout and session-expiry behavior.

**NFR-07 (SEC06, SEC07).** The slice shall preserve the confirmed Google-only registration approach and shall not introduce application-managed password recovery, unreviewed cross-origin state changes, or unbounded public list-creation behavior. Public registration remains a release dependency rather than an acceptance claim for this slice.

**NFR-08 (SEC08, SEC10, DP12, DP13).** The slice shall enforce the 80-character list-name boundary at the trusted boundary, keep privileged credentials out of the browser and repository, use protected transport in deployed environments, and avoid exposing private content or credentials through errors, URLs, logs, caches, or diagnostic output.

**NFR-09 (DP01–DP03, DP08–DP09).** The slice shall provide accessible privacy information at or before Google registration, consistent with the data and purposes actually used by the slice. Before real-user or public processing, the project shall complete the controller/provider, purpose/necessity, retention, rights, and publication review required by the applicable regime. This slice may be demonstrated with synthetic data while release review remains pending.

**NFR-10 (DP19).** Development and acceptance evidence shall use synthetic accounts and lists and shall not place real personal data in fixtures, screenshots, logs, repositories, or external tools.

## Errors and boundary cases

- **Empty name:** Keep the form active, identify the required value, and prevent any write.
- **Maximum boundary:** Accept exactly 80 trimmed characters and reject 81 or more, with no partial record.
- **List-count boundary:** Accept creation while the account has fewer than 100 active lists; reject the 101st with no new record and preserve existing lists unchanged.
- **Duplicate by owner:** Reject the second case-folded duplicate, including a retry after an apparent timeout, without creating two lists.
- **Concurrent/repeated creation:** The observable result must be at most one list for one intended submission. If the final state is uncertain, reconcile the authenticated person's lists first; do not claim success unless the matching persisted list is found, and do not blindly submit again.
- **Unauthenticated or expired session:** Prevent the write, protect existing private content, explain reauthentication, and preserve only explicitly allowed in-memory form values.
- **Initial session-check failure:** Keep private content unavailable, show a non-sensitive error, and provide retry without treating the person as authenticated.
- **Different account:** Do not display, update, or infer the existence of another account's list, including through a guessed identifier or direct request.
- **Network or persistence failure:** Show a recoverable error, retain the name while the page remains active where possible, and allow retry without silently duplicating the list.
- **Reload or browser/device change:** Re-read persisted lists for the same account; do not restore another account's cached content or unsaved form data.
- **Language change during entry:** Translate the shell while preserving the current form value and its ownership context.
- **Language preference failure:** Keep the selected language visible locally, identify that synchronization failed, and allow retry without changing list data or ownership.
- **Language preference read failure:** Keep private access available using the Access selection or browser/fallback language, identify that the account preference could not be loaded, and allow retry before replacing it.
- **Unauthenticated language selection:** Apply the selected language locally without writing account data; after authentication, use the account preference when present or save the Access selection when absent.
- **Unexpected service error:** Expose a useful non-sensitive explanation and retry path; do not show internal credentials, query details, or another user's data.

## Flows and design references

- `VIEW-01 Access`: Google continuation, language selection, privacy link, loading, retryable authentication failure, and document identity.
- `VIEW-02 My Lists`: authenticated shell, active list collection, empty state, create-list interaction, and confirmed result.
- `FLOW-01 Access with Google`: session checking, duplicate-start prevention, cancellation/failure recovery, local logout, and expiry behavior.
- `FLOW-02 Create and organize a list`: this slice includes create/view and the minimal post-creation List Detail state; rename, delete, archive, restore, duplicate, search, ordering, and concept actions are deferred.
- `VIEW-03 List Detail`: only the empty-state presentation, list name, explanatory message, and return navigation are included; concept and round behavior belongs to later slices.
- `docs/design.md`, `VIEW-01`, `VIEW-02`, and the empty-state portion of `VIEW-03` visual references: warm responsive shell, prominent Google action, list cards, empty state, persistent labels, and clear operation states.
- The final owner-created Chucao identity artwork is not available in the repository. Its absence is a visual dependency for final identity presentation, not a reason to expand the functional slice.

## Acceptance criteria

### AC-01 — First private journey

Given a synthetic/configured Google test identity, a browser with no Chucao session, and configured local services, when the person opens Chucao, starts Google sign-in, returns with a valid session, creates or is linked to the Chucao identity, and creates `Anatomía`, then the app shows the authenticated shell, confirms the successful creation, and displays exactly one private list named `Anatomía` in My Lists. Opening that list shows the minimal List Detail view and allows returning to My Lists.

### AC-02 — Persistence and same-account access

Given the list from AC-01, when the same account reloads the application or opens it in another supported PC browser or Chrome Android browser within the committed two-version baseline, then the list is retrieved and displayed without recreating it.

### AC-03 — Cross-account isolation

Given user A owns a list and user B has a valid separate session, when user B opens My Lists or attempts a direct read or modification using the known list identifier, then user B receives no list data and cannot change user A's list.

### AC-04 — Authentication recovery

Given no session, when Google sign-in is cancelled or fails, then the app remains in Access, shows a retryable error, and creates no account-owned list. Given the initial session check fails, the app keeps private content unavailable and offers retry. Given a session expires during creation, the app does not show success or write under the wrong identity, preserves the active name for the same account after reauthentication, and discards it if a different account signs in.

### AC-05 — Validation and duplicate safety

Given an authenticated person, when they submit an empty name, an 81-character name, a duplicate case-folded name, or the same valid submission repeatedly, then invalid submissions create nothing and repeated valid submission creates at most one list with an understandable result.

### AC-06 — Failure and retry

Given a valid name and a simulated or observed persistence failure, when the person submits and retries, then the first attempt does not claim success, the entered name remains available where possible, and a later successful retry creates one list only.

### AC-10 — Uncertain creation result

Given a valid submission whose response is lost or times out, when the application reconciles the authenticated person's lists, then exactly one matching persisted list is shown as the successful result; if no matching result can be confirmed, the application shows an unresolved retryable state and does not issue a blind duplicate submission.

### AC-12 — Maximum active lists

Given an authenticated person who already owns 100 active lists, when they submit another valid list name, then the application rejects the operation with an understandable limit message, creates no list, and leaves all existing lists unchanged.

### AC-07 — Language and interaction

Given the Access, My Lists, or minimal List Detail view, when the person switches between Spanish and English or operates the included controls with keyboard and touch, then labels, errors, status messages, focus, and headings remain understandable, the active list-form value is preserved, and the authenticated account's language preference is saved or the unauthenticated selection remains local until authentication.

### AC-09 — Language synchronization failure

Given an authenticated person whose language preference read or save fails, when they open the private shell or change language, then the interface remains available locally, clearly indicates that the account preference is not synchronized, preserves the current form value, and allows a retry without changing list data or silently replacing the account preference.

### AC-08 — Delivery and privacy evidence

The slice is not accepted for real-user release until applicable quality, security, and privacy obligations are evidenced, including trusted-boundary isolation, absence of privileged browser secrets, synthetic-data development evidence, and the reviewed privacy notice before registration. The specific checks and commands belong to the technical plan.

### AC-11 — Privacy notice before sign-in

Given an unauthenticated visitor, when they open Access before Google sign-in, then they can open and understand the privacy notice, including the slice's data, purposes, providers, retention/deletion, rights/contact, and version/date, without needing a Chucao session.

## Dependencies and shared constraints

- Supabase Auth with Google OAuth/PKCE and the existing local configuration are required.
- Supabase PostgreSQL, the authenticated UUID ownership boundary, and private-by-default authorization are required.
- A versioned domain data change and reproducible local environment are required; exact physical schema and migration design are deferred.
- React/Vite/Mantine/Comfortaa and the existing Supabase client/session proof are reusable repository context.
- Spanish/English resources and account-level language behavior are limited to this slice's shell; timer and full preference controls are deferred.
- Public registration, provider review, final privacy notice publication/review, retention/deletion procedures, and production configuration remain release dependencies even though the slice includes the notice entry and content needed for its local behavior.
- Project-specific quality criteria remain pending evidence; `docs/quality-project.md` defines their applicability and expected evidence but does not claim satisfaction. The committed browser baseline is the two latest stable versions of Chrome, Edge, and Firefox on PC and Chrome on Android.

## Completion criteria

The specification is ready for technical planning when:

- The main private journey, exclusions, ownership rules, boundaries, and recovery outcomes are agreed.
- Each committed functional and non-functional requirement has linked acceptance evidence.
- The slice can be demonstrated end to end with synthetic data on the intended local environment.
- Existing Google session proof and local sign-out behavior remain preserved.
- No blocking authorization, persistence, accessibility, privacy, or delivery defect remains for the committed behavior.
- Applicable quality and privacy conditions are evidenced, with publication-only obligations clearly distinguished from slice evidence.

Authoring this document does not claim approval, implementation, validation, legal compliance, or production readiness.

## Open questions

No material behavioral questions remain for clarification. Physical schema, migration ordering, test tooling, CI changes, and the concrete Q04 measurement method remain technical-planning decisions.

