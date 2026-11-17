# Chucao Web — Global Plan

## 1. Document status and sources

**Status:** Complete planning draft, awaiting product review  
**Date:** 2026-11-16  
**Decision state:** Confirmed decisions, proposals, and open questions are distinguished below.  
**Delivery state:** Planned unless explicitly marked otherwise; this document does not claim implementation or compliance.

**Principal sources**

- `temp/plan.md`, especially the product purpose, functional scope, constraints, data conditions, proposed increments, and pending decisions.
- `README.md`, which confirms the project is in early planning/development and summarizes the intended stack and features.
- `docs/catalog/quality.md`, consulted 2026-11-16; local SHA-256 `A69114F60892C856BBC8EDF4E78B3858385C024547C5B34E90F800A254B4634C`.
- `docs/catalog/data-protection.md`, consulted 2026-11-16; local SHA-256 `7CFD0B22B5C142A2DDD5BDBC56E3E9E199FC6FAB0510759B2389A0C6E369219B`.

The privacy catalog cites Chilean Law 19.628 and amendments in Law 21.719, with legal references checked on 2026-11-13. Applicability and the law in force must be reconfirmed before processing real users or publishing.

## 2. Problem, users, and context

Chucao Web helps a person organize concepts into lists and practice explaining them orally through random, non-repeating selection within a round. It records actions and time; it does not determine whether an explanation was correct or whether the person learned the material.

The primary user is an authenticated individual who owns private lists, concepts, rounds, practices, and practice notes. The product is not currently scoped for shared lists, organizations, public content, teachers, administrators, or social features.

The product evolves from Chucao Desktop, a Windows/WPF application using local CSV files. The web version adds remote persistence, accounts, authorization, responsive browser access, editable descriptions, practice notes, and history. It is also a learning and portfolio project whose outcomes include maintainable code, tests, reproducible delivery, and documented decisions.

Public registration is intended for the portfolio release, but the product is general-purpose and is not directed at minors. No age verification is planned. This decision must be revisited if the audience, messaging, or observed use changes.

## 3. Goals and observable outcomes

- A person can create private lists, add concepts, and practice from a PC or Android browser.
- Random selection uses only pending concepts, gives each eligible concept the same chance, and persists the result and order of appearance.
- A new round makes existing concepts available again without erasing prior round history.
- Practice can be timed, paused, resumed, and restarted within the current page session, with the animation and completion sound synchronized to the logical timer state. Reloading or leaving the page abandons the active timer without recovery.
- Descriptions can remain hidden until voluntarily revealed, and practice notes and history remain distinct from concept descriptions.
- The interface works responsively in Spanish and English, preserves in-progress work when the language changes, and provides understandable loading, empty, success, and failure states.
- Repeated, concurrent, interrupted, or failed operations do not silently duplicate practices, consume another concept, overwrite changes, or expose another user's data.
- The project can be rebuilt and its schema reconstructed from versioned changes, with relevant checks reproducible before publication.

No numeric adoption, latency, retention, or learning targets are invented at this stage.

## 4. Capabilities and scope

| ID | Capability | Scope | Delivery state |
|---|---|---|---|
| CAP-01 | Google account authentication, logout, and session handling through Supabase Auth | MVP | Planned |
| CAP-02 | Private user-owned lists with create, view, rename, and delete | MVP | Planned |
| CAP-03 | Concepts with stable identity, title validation, optional description, individual entry, pasted batch entry, edit, and delete | MVP | Planned |
| CAP-04 | Independent list rounds, pending/seen state, uniform random selection, manual marking, appearance order, and new-round history | MVP | Planned |
| CAP-05 | Timed practice from a selected concept or independently, with a configurable duration from 1 to 59 minutes, pause, resume, restart, and reduced-motion behavior | MVP | Planned |
| CAP-06 | Chucao forest animation and optional completion sound synchronized with the timer | MVP | Planned |
| CAP-07 | Completed practice records, notes, prior rounds, and practice history, including a 0–5 satisfaction rating distinct from Unrated; independent practices are saved only when given a free-text label | MVP | Planned |
| CAP-08 | Spanish/English interface, translated validation and accessibility text, and locale-aware dates/plurals | MVP | Planned |
| CAP-09 | Responsive, keyboard-usable, accessible interface for PC and mobile browsers | MVP | Planned |
| CAP-10 | Cross-device access to the same signed-in user's saved data through the responsive web application | MVP baseline from the first release, not a later feature | Planned |
| CAP-11 | List duplication, archiving workflow, return-to-pending, search/filtering, ordering, and defined multi-selection actions | Later increment, except any subset explicitly pulled into MVP | Planned |
| CAP-12 | Account-synchronized preferences for language, default timer duration, sound, volume, and reduced motion | MVP baseline from the first release | Planned |
| CAP-13 | Public sharing, shared lists, organizations, analytics/marketing, social features, and learning assessment | Out of scope | Excluded |
| CAP-14 | Synchronization or continuation of an active timer/session across devices or browser instances | Out of scope | Excluded |

The existing plan treats list search/order, duplication, archive/restore, return-to-pending, and multi-selection as contemplated functionality. They remain in CAP-11 so the first observable study loop is not blocked by advanced organization; this is a planning proposal, not a silent removal. Cross-device access and account-level preferences are not deferred: they are baseline consequences of the responsive authenticated product.

## 5. Constraints and confirmed decisions

### Confirmed or source-backed constraints

- Frontend: React, TypeScript, Vite, Mantine, CSS Modules, CSS variables, React Hook Form, TanStack Query, `i18next`, `react-i18next`, and Fontsource Comfortaa.
- Data and identity: Supabase PostgreSQL, Supabase Auth, `supabase-js`, Supabase API, RLS, SQL functions when needed, and versioned SQL migrations.
- Delivery: Supabase CLI and Docker for local development; Cloudflare Pages for the frontend; Git and GitHub for versioning.
- Authentication: Google is the only sign-in provider for the first version, through Supabase Auth. There are no application-managed email/password registration or password-recovery forms.
- Public registration is planned for the portfolio release with Google account creation enabled. The product is not directed at minors and will not collect age evidence or implement age verification in the initial scope.
- Delivery automation: GitHub Actions will run installation, linting, type-checking, tests, and build checks. Cloudflare Pages will provide preview and production environments with separated variables; production deployments and versioned Supabase migrations are controlled.
- The interface is responsive, warm, illustrated, and based on the existing Chucao identity. Mobile prioritizes vertical layouts and touch targets; desktop may use multiple columns.
- The same account data and preferences are available from supported devices; the interface adapts to the viewport rather than maintaining separate PC and mobile product behavior.
- The timer uses elapsed time and recorded pauses rather than visual frame updates as its source of truth. Its duration is between 1 and 59 minutes. Users may edit the duration before starting, but cannot add time after starting.
- Active timer/session state is not persisted, synchronized, or resumed across devices or browser instances. Leaving the practice abandons the active timer and does not create a resumable timer state.
- The animation uses React, SVG, transparent images, CSS Modules, and `requestAnimationFrame`; reduced-motion behavior is required.
- Concept titles are 1–50 characters after trimming. Duplicate detection initially preserves the desktop rule: exact, case-sensitive match within the same list, including seen concepts and duplicates within a pasted block.
- Maximum lengths are 80 characters for list names, 50 characters for concept titles, 2,000 characters for descriptions, and 2,000 characters for practice notes. Limits apply after trimming and are enforced in the backend as well as the interface.
- List names are unique per user after trimming and case folding.
- MVP ordering is predefined and does not provide manual ordering: lists by name A–Z/Z–A, recently/oldest created, or recently modified; concepts by title A–Z/Z–A, pending/seen first, or incorporation order; history newest/oldest first. Ordering is local and does not change persisted concept order.
- Multi-selection applies to concepts and supports delete, mark as seen, and return to pending. Only delete requires confirmation; bulk results report successes and failures.
- Privileged credentials stay out of the frontend. Authorization is enforced at the backend/database boundary, not only by hidden controls.
- Random selection and manual marking must be atomic, and retries must not consume another concept or duplicate a practice.

### Initial product choices

- A selected concept remains seen when its result is closed without practice.
- A new round closes the previous round, preserves its history, and makes existing concepts available again; deleted concepts are not restored.
- Concept identity is stable across title and description edits, so editing does not reset round state. Historical appearances keep a snapshot of the title used at that time.
- Deleting a concept removes it from the active list and shows it as “Deleted concept” in history, without allowing new practices. Deleting a list should generally be preceded by archiving; permanent deletion removes active content and preserves only anonymized historical records.
- Notes can be edited or deleted without deleting their associated practice.
- Deleting an account removes or anonymizes all associated personal and content data, subject to the documented retention and backup process.
- Abandoning a timer creates no practice record. Practice history contains only practices explicitly completed and saved according to the later practice specification.
- A completed practice may have a satisfaction rating from 0 to 5; `Unrated` is distinct from a rating of 0. An independent practice is persisted only when the user provides a free-text label, which does not create or modify a list concept.
- The description is proposed to start hidden during practice and can be revealed voluntarily.
- Browser locale detection may provide the first language, but the selected language and other preferences are account-level values shared across supported devices, with Spanish as fallback.

### Confirmed development authentication approach

Local development will continue using Vite and Supabase CLI with Docker. Google authentication occurs over the internet, while the local Supabase Auth instance creates the development user and session.

- Use a separate Google development project in Testing mode with a Web application OAuth client.
- For the usual local ports, register `http://localhost:5173` as the web origin and `http://127.0.0.1:54321/auth/v1/callback` as the Supabase Auth callback.
- Enable `[auth.external.google]` in `supabase/config.toml`. Keep the client secret in an ignored local `.env`, outside `VITE_*` variables.
- Configure the local `site_url` and allowed return URL, then restart Supabase after configuration changes.
- The React sign-in action uses `supabase.auth.signInWithOAuth({ provider: 'google' })`. Two Google accounts should be used to verify user isolation.
- Production uses a separate Google project and OAuth credentials with the callback of the remote Supabase project. Google is enabled in Supabase, email/password authentication is disabled, and user creation remains enabled for public registration.

This is a confirmed product and development constraint, not evidence that the authentication flow is already implemented or verified.

## 6. Working principles

1. **Bounded increments produce observable results.** Each increment must leave a usable cross-layer journey, not only a technical layer.
2. **Implementation matches agreed requirements.** Changes to behavior, scope, or compatibility are explicit rather than inferred from the implementation.
3. **Affected ambiguity is resolved before implementation.** A decision is required before building behavior whose alternatives change data, privacy, or user expectations.
4. **Checks are proportional to change and risk.** Core rules, persistence, authorization, destructive actions, and integrations receive stronger evidence than cosmetic changes.
5. **Evidence is retained.** Reproducible checks, review results, migrations, and unresolved limitations remain linked to the delivered behavior.
6. **Human review focuses on critical changes.** Permissions, personal data, migrations, destructive operations, core randomization, dependencies, and release configuration receive focused review.
7. **Documentation follows product change.** Affected global planning, specifications, decisions, and quality/privacy records are updated when behavior changes.

Changing these principles requires an explicit rationale in the plan.

## 7. Data protection decisions

The following is a conceptual inventory, not a physical schema. It includes data generated by the product and auxiliary processing that must be checked before release.

| Decision | Catalog source | Product impact and current decision | Status / resolution point |
|---|---|---|---|
| Identify controller, processors, responsibility, and applicable law | DP01 | The project owner is the provisional controller for the product. Google, Supabase, and Cloudflare Pages are providers whose processing roles, terms, subprocessors, and transfer conditions must be documented. The initial legal review is under Chilean law; this is a planning decision, not a declaration of compliance or a conclusion that other jurisdictions cannot apply. | Decision confirmed; verify roles and applicable obligations before public registration |
| Inventory account, content, practice, device, logs, backups, and vendor flows | DP02 | Expected data includes account identifiers, email, lists, concepts, descriptions, rounds, appearances, practices, notes, session/device/network logs, and backups. Minimize and document each flow. | Pending; resolve during design and before public release |
| Define purpose, necessity, and lawful basis | DP03 | Service delivery, Google authentication, account security, diagnostics, and any optional analytics must be separated. No analytics or marketing is currently in scope. Only data necessary for those purposes will be collected. | Decision confirmed; verify actual flows before public registration |
| Keep private-by-default isolation | DP10 | Lists, concepts, rounds, practices, and notes are private to the owning account, enforced by RLS/backend checks, including direct requests and history. | Pending; verify with cross-user checks before release |
| Define identity and account lifecycle | DP11 | Google owns credential recovery; the application owns Google sign-in initiation, logout/session handling, account deletion, and linkage of private content to the authenticated identity. | Pending; verify in the account slice and before public registration |
| Use maintained security and encrypted transport controls | DP12 | Keep secrets server-side, use provider-managed authentication, HTTPS, protected sessions, least privilege, and recovery procedures. | Pending; verify before deployment |
| Prevent auxiliary disclosure | DP13 | Errors, logs, URLs, caches, browser storage, backups, and support artifacts must not expose credentials or other users' content. | Pending; verify before publication and after observability changes |
| Define retention, erasure, account deletion, and backups | DP14, DP18 | Supabase-managed backups will be used initially; no separate backup system is planned. Active account and content data are retained while the account is active or until deletion is requested. Logs and sessions are retained only for the minimum period necessary for security, diagnostics, and operation, with exact operational periods documented before release. Account deletion removes or anonymizes associated active data; permanently deleted lists retain only anonymized historical records. Backup copies may persist temporarily according to Supabase retention and will be disclosed in the notice. | Decision confirmed; implement deletion and document provider retention before public registration |
| Provide accessible privacy information and collection notice | DP08, DP09 | A public privacy notice and point-of-collection explanation will describe the data categories, purposes, providers, transfers, retention, deletion, rights, security at an appropriate level, contact channel, policy version, and update date. It must be available before or during Google registration. | Decision confirmed; publish and review before public registration |
| Provide rights handling and correction processes | DP15, DP16, DP17 | A manual process will initially handle access, export where applicable, correction, deletion, objection, and restriction requests. The process will use proportionate ownership verification, track requests, provide secure responses, and distinguish account closure from deletion and restriction. | Decision confirmed; publish contact and procedure before public registration |
| Review providers and international transfers | DP05 | Google, Supabase, and Cloudflare require a provider review covering role, location, subprocessors, retention, deletion, security terms, and international transfers. Future providers require the same review before use with real data. | Decision confirmed; document provider evidence before public registration |
| Handle incidents | DP21 | The project owner is responsible for first response, containment, investigation, evidence preservation, recovery, provider escalation, and notification decisions. Supabase, Google, and Cloudflare escalation contacts will be documented. | Decision confirmed; document the procedure and contacts before public registration |
| Sensitive data, minors, consent, telemetry, and high-risk automation | DP04, DP06, DP07, DP20 | The intended product does not request sensitive study data, age evidence, analytics, or consequential automated decisions, and is not directed at minors. Reconsider if scope adds them or the audience changes. | Conditional; review before activating any such processing |
| Development and testing data | DP19 | Use synthetic fixtures and avoid sending real personal data to repositories, screenshots, logs, agents, or external tools. | Pending; verify in development/release practice |

The catalog is an engineering and legal-planning aid, not a declaration of compliance. The applicable legal text, authority guidance, contracts, and responsibilities require review for the actual processing context.

## 8. Provisional vertical-slice sequence

The sequence preserves the proposed increment order while making each increment an observable result. It may change when an open decision materially changes dependencies or risk.

| Slice | Observable result | Capabilities | Boundary and dependencies | Activated quality/privacy conditions |
|---|---|---|---|---|
| **VS-01 Account and first private list** | **Closed for validated local scope; publication conditions remain pending.** A person can sign in with Google and create and view a private empty list in Spanish or English from supported responsive devices. | CAP-01, CAP-02 (partial: create/view), CAP-08, CAP-09, CAP-10, CAP-12 (partial: language/account shell) | Supabase Auth, Google OAuth, database, RLS, frontend shell, and the minimum account linkage needed for private lists. Rename/delete lists, full settings, concepts, and later study behavior remain outside this slice. Requires account lifecycle and privacy notice decisions before real users. | Q01–Q06, SEC01, SEC04–SEC08, SEC10, WEB02–WEB04; DP01–DP03, DP08–DP13 |
| VS-02 Concept management | A person can add, paste, validate, edit, and delete concepts with descriptions while seeing clear accepted/rejected results. | CAP-03, CAP-09 | Depends on private lists and trusted validation; requires description length and deletion/history policy decisions. | Q01–Q04, SEC01–SEC03, SEC08; DP02, DP03, DP10, DP13, DP14 |
| VS-03 Persistent round and selection | A person can mark or randomly select a pending concept, see the result and appearance order, and start a new round without losing prior history. | CAP-04, CAP-10 | Depends on concepts and atomic persistence; requires concurrency, retry/idempotency, return-to-pending, and the defined concept/list history rules. | Q01–Q04, SEC01–SEC04, SEC08; DP02, DP10, DP12–DP14, DP16 |
| VS-04 Timed practice journey | A person can practice from a selected concept or independently for 1–59 minutes, pause/resume/restart, and see the animation reach the end with optional sound. Leaving the view does not preserve an active timer. | CAP-05, CAP-06, CAP-09, CAP-12 | Depends on selected concept context and timer limits; requires platform limitation review for background/locked-device sound. | Q01–Q06, SEC03, SEC08, SEC10, WEB03–WEB04; DP02, DP07 if telemetry/storage is added, DP13 |
| VS-05 Notes and history | A person can complete a practice, save notes, and review prior practices and rounds without confusing notes with descriptions. Abandoning a timer creates no practice record. | CAP-07, CAP-10 | Depends on practice lifecycle and deletion/retention rules; note length/edit/delete and deleted-reference behavior are defined. | Q01–Q04, SEC01–SEC04; DP02, DP03, DP10, DP13–DP16, DP18 |
| VS-06 Advanced organization | A person can search/order, duplicate/archive/restore lists, return concepts to pending, and use the defined multi-selection actions. | CAP-02, CAP-03, CAP-04, CAP-11 | Depends on stable identities and history semantics; list limits, sorting, multi-selection actions, and confirmation rules are defined. Permanent list deletion must preserve the documented anonymization and retention behavior. | Q01–Q04, SEC01–SEC04, SEC08; DP10, DP13–DP16 |
| VS-07 Publication readiness | The integrated study journey is validated on modern browsers on PC and Android, with accessibility, migration reproducibility, deployment, and documented privacy handling. | CAP-01–CAP-10, CAP-12 | Depends on all release-blocking decisions, provider review, production configuration, migration/recovery evidence, and representative PC/Android checks. | All selected release criteria; unresolved DP items block real-user publication unless explicitly resolved with rationale. |

Cross-cutting conditions apply to every slice: errors must expose the real state or uncertainty, retries must be safe, authorization must hold at the trusted boundary, and affected documentation must be updated.

### Selected slice — VS-01 Account and first private list

**Selection rationale:** VS-01 was selected as the first implementation slice
and now delivers the smallest useful private product foundation: a person can
enter Chucao, establish an account through the confirmed Google flow, create a
private list, and see that same list again. It activates the trust and privacy
boundaries needed by every later slice without bundling concepts, rounds, or
practice behavior. Its local implementation and validation are closed; release
conditions remain separate.

**User outcome:** An individual opens Chucao, signs in with Google, creates a named private list, and sees the list in the responsive application. After reloading or using another supported browser/device with the same account, the list remains available. A different authenticated account cannot read or modify it.

**Capabilities covered:**

- **CAP-01:** Full first-slice scope for Google sign-in, session recognition, and local sign-out.
- **CAP-02:** Partial scope for creating and viewing a private empty list; rename and delete are deferred.
- **CAP-08:** Partial scope for the access and list shell in Spanish and English, including translated loading, success, and failure states.
- **CAP-09:** First responsive and keyboard-usable shell for supported PC and Android browsers.
- **CAP-10:** Cross-device access to the persisted account-owned list, without active-timer behavior.
- **CAP-12:** Partial scope for account-level language preference and the shared shell; timer, sound, volume, and reduced-motion preference controls are deferred.

**Included scope:**

- Check the current Supabase session and distinguish loading, unauthenticated, authenticated, and authentication-error states.
- Continue with Google using the confirmed Supabase Auth/PKCE flow, with duplicate-start prevention and retryable failure.
- Establish or recognize the authenticated Chucao user by the stable Supabase Auth UUID.
- Render the first authenticated shell with Spanish/English labels and the account-level language choice needed by this slice.
- Create a list with the confirmed trimmed name validation, 80-character maximum, and per-user uniqueness rule.
- Display the authenticated user's private lists, including the empty state and the first created list.
- Reload the page and read the persisted list again.
- Enforce ownership at the trusted Supabase/database boundary through the planned RLS and backend validation path.
- Provide understandable loading, empty, validation, success, unauthorized, session-expired, and recoverable network/error states.
- Keep the responsive presentation usable on the committed PC and Android browser targets.

**Deferred scope:**

- Concept creation, pasted batches, descriptions, rounds, selection, progress, practice, notes, history, ratings, and timer behavior.
- List rename, deletion, archive/restore, duplication, search, ordering, and multi-selection.
- Full Settings and Account views beyond the minimum language/session shell needed here.
- Chucao timer scenery, flying animation, completion sound, and final identity assets. The owner-created chucao resources remain a visual dependency for the corresponding views, but their absence does not change this functional boundary.
- Public release, production privacy publication, provider/legal review completion, and production deployment evidence.

**Data and effects:** This slice creates or reads the authenticated user linkage, account-level language preference as needed, and user-owned list records. It must not expose another account's records, infer ownership from email, or create concepts, rounds, or practice data.

**Dependencies and readiness:**

- Existing evidence: Google OAuth configuration, PKCE client, session observation, local sign-in/sign-out proof, Supabase local configuration, React/Vite/Mantine/Comfortaa setup.
- Implemented work: domain migration for the minimum user/list data, ownership
  path, RLS policies, trusted validation, frontend shell/list interaction, and
  Spanish/English resources.
- The architecture already establishes Supabase PostgreSQL as the source of truth, Auth UUID ownership, deny-by-default authorization intent, versioned migrations, and local Docker development.
- The repository now contains the VS-01 list schema, domain migration, RLS
  policy, and list UI; the completed local evidence is the dependency for later
  slices, not a claim that the broader product is complete.
- Local development can use synthetic accounts/data. Public registration remains blocked until the privacy notice, provider review, deletion/retention procedure, and release evidence required by the global plan are complete.
- The requested owner-created chucao assets are not required to specify the private-list behavior, but final identity presentation must wait for the corresponding resources.

**Affected layers and components:** The slice crosses the browser shell and responsive layout, Google/Supabase Auth, session and locale state, list form/display interaction, Supabase API/PostgreSQL persistence, migrations, RLS, and error handling. It reuses the existing `src/lib/supabase.ts`, `src/App.tsx` authentication proof, Mantine provider, Comfortaa setup, and local Supabase configuration. It does not introduce a separate application server or a second client.

**Activated shared criteria and controls:**

- **Q01/Q02:** Loading, empty, success, failure, retry, reload, duplicate-submit, validation, and persistence states must be truthful and must not duplicate lists.
- **Q03:** Keyboard operation, visible focus, labels, contrast, zoom, touch targets, responsive layouts, and language changes apply to the access and list shell.
- **Q04:** List reads and writes must remain usable for representative personal-scale data without unbounded client work.
- **Q05/Q06:** Local setup, migrations, build/lint checks, actionable errors, and documentation alignment are required for slice completion.
- **SEC01/SEC04:** Client input and direct Supabase requests cannot bypass list limits, ownership, or allowed operations; unauthenticated and cross-user access must be rejected.
- **SEC05–SEC07:** Google-only registration/session behavior, provider configuration, public-registration exposure, and abuse assumptions must be deliberate before public use.
- **SEC08/SEC10:** List input/service limits and absence of privileged secrets in the browser must be checked.
- **WEB02–WEB04:** Direct/deep route behavior, meaningful page language/title/heading metadata, favicon handling, and accessible image identity must be considered; the final chucao asset remains pending.
- **DP01–DP03 and DP08–DP13:** Account, provider, purpose, notice, privacy, ownership, retention, and deletion boundaries must be represented before real user data or public registration. Local testing uses synthetic data.

**Demonstration scenario:**

1. Start local Vite and Supabase services with a development Google OAuth account configured for the documented callback.
2. Open Chucao without a session and verify the loading-to-access transition, language selection, privacy link, and retryable Google error state.
3. Sign in as user A, create a list named `Anatomía`, and verify a confirmed success state followed by the list in the authenticated list view.
4. Reload the page and verify that user A still sees `Anatomía`; open the app from a second supported browser/device with the same account and verify the same result.
5. Sign in as user B and verify that user A's list is neither returned nor accessible through a direct request or guessed identifier.
6. Attempt an empty, over-limit, duplicate, unauthenticated, and repeated submission case and verify understandable rejection without a duplicate or unauthorized record.

The scenario demonstrates persistence and ownership, not only visual rendering. Production provider/legal and full browser-matrix evidence remain publication checks rather than local-slice evidence.

**Closure state and follow-ups:** VS-01 is closed for its validated local
scope. The complete requirements, task states, validation matrix, and closure
evidence are recorded in
`specs/001-account-and-first-private-list/spec.md`,
`specs/001-account-and-first-private-list/tasks.md`, and
`temp/evidence/vs-01/evidence.md`. Production configuration, provider/legal
publication, and real-user activation remain release work and are not implied
by this closure.

## 9. Proposals and open questions

| Decision needed | Consequence | Owner / stage |
|---|---|---|

The following remain proposals rather than approvals: hidden-by-default descriptions, list duplication with new progress, and archive preserving history.

## 10. Significant changes

| Date | Change | Rationale |
|---|---|---|
| 2026-11-16 | Created the global plan from `temp/plan.md`, preserving the proposed scope and increment order. | Establishes a reviewed planning baseline without claiming implementation. |
| 2026-11-16 | Separated the first private study loop from advanced organization and account-synchronized timer behavior. | Keeps the MVP observable and reduces early uncertainty without silently deleting contemplated capabilities. |
| 2026-11-16 | Added product-level privacy decisions and release-blocking questions. | Accounts, private remote data, logs, providers, and public registration create obligations beyond UI functionality. |
| 2026-11-16 | Confirmed Google-only authentication, public registration without age verification, account-level preferences, responsive cross-device access from the first release, and no active-timer synchronization. | Reduces provider complexity while preserving the same product behavior across supported devices. |
| 2026-11-16 | Confirmed field limits, ordering, multi-selection actions, timer boundaries, and concept/note history rules. | Converts the corresponding planning proposals into product constraints for later specifications. |
| 2026-11-16 | Confirmed anonymized list history after permanent deletion, no record when abandoning a timer, and modern PC/Android browser support. | Closes the remaining behavior and compatibility questions from the prior planning draft. |
| 2026-11-16 | Closed the controller, jurisdiction, privacy notice, rights, retention, backup, provider, and incident-responsibility planning item. | Establishes an initial Chilean-law review scope and a proportionate privacy operation for public registration; implementation and legal verification remain release prerequisites. |
| 2026-11-16 | Selected VS-01, Account and first private list, as the first implementation slice. | Delivers the smallest demonstrable private product foundation while activating identity, ownership, persistence, responsive access, and required controls for later slices. |

