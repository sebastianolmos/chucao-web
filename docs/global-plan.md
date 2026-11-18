# Chucao Web â€” Global Plan

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
| CAP-01 | Google account authentication, logout, and session handling through Supabase Auth | MVP | Delivered locally in VS-01/T10; publication/account lifecycle remain release work |
| CAP-02 | Private user-owned lists with create, view, rename, and delete | MVP | Partially delivered locally: create/view; rename/delete remain pending |
| CAP-03 | Concepts with stable identity, title validation, optional description, individual entry, pasted batch entry, edit, and delete | MVP | Delivered locally in VS-02; selection, rounds, and practice remain separate capabilities |
| CAP-04 | Independent list rounds, pending/seen state, uniform random selection, manual marking, appearance order, and new-round history | MVP | Planned |
| CAP-05 | Timed practice from a selected concept or independently, with a configurable duration from 1 to 59 minutes, pause, resume, restart, and reduced-motion behavior | MVP | Delivered locally in VS-04; active sessions remain transient and are not saved as practices |
| CAP-06 | Chucao forest animation and optional completion sound synchronized with the timer | MVP | Delivered locally in VS-04; browser background/audio restrictions remain for release validation |
| CAP-07 | Completed practice records, notes, prior rounds, and practice history, including a 0â€“5 satisfaction rating distinct from Unrated; independent practices are saved only when given a free-text label | MVP | Planned |
| CAP-08 | Spanish/English interface, translated validation and accessibility text, and locale-aware dates/plurals | MVP | Partially delivered locally in VS-01/VS-02; remaining views and locale-aware study content remain pending |
| CAP-09 | Responsive, keyboard-usable, accessible interface for PC and mobile browsers | MVP | Partially delivered and user-reviewed locally for VS-01/VS-02; later views and release-wide validation remain pending |
| CAP-10 | Cross-device access to the same signed-in user's saved data through the responsive web application | MVP baseline from the first release, not a later feature | Partially delivered locally for private lists/concepts; supported-device release validation remains pending |
| CAP-11 | List duplication, archiving workflow, return-to-pending, search/filtering, ordering, and defined multi-selection actions | Later increment, except any subset explicitly pulled into MVP | Planned |
| CAP-12 | Account-synchronized preferences for language, default timer duration, sound, volume, and reduced motion | MVP baseline from the first release | Delivered locally in VS-04 for locale and timer preferences; broader release validation remains pending |
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
- Concept titles are 1â€“50 characters after trimming. Duplicate detection initially preserves the desktop rule: exact, case-sensitive match within the same list, including seen concepts and duplicates within a pasted block.
- Maximum lengths are 80 characters for list names, 50 characters for concept titles, 2,000 characters for descriptions, and 2,000 characters for practice notes. Limits apply after trimming and are enforced in the backend as well as the interface.
- List names are unique per user after trimming and case folding.
- MVP ordering is predefined and does not provide manual ordering: lists by name Aâ€“Z/Zâ€“A, recently/oldest created, or recently modified; concepts by title Aâ€“Z/Zâ€“A, pending/seen first, or incorporation order; history newest/oldest first. Ordering is local and does not change persisted concept order.
- Multi-selection applies to concepts and supports delete, mark as seen, and return to pending. Only delete requires confirmation; bulk results report successes and failures.
- Privileged credentials stay out of the frontend. Authorization is enforced at the backend/database boundary, not only by hidden controls.
- Random selection and manual marking must be atomic, and retries must not consume another concept or duplicate a practice.

### Initial product choices

- A selected concept remains seen when its result is closed without practice.
- A new round closes the previous round, preserves its history, and makes existing concepts available again; deleted concepts are not restored.
- A concept added while a list round is open joins that round as pending. Concurrent state-changing actions for one list are processed in order against current state; repeating the same intent does not produce another effect.
- Concept identity is stable across title and description edits, so editing does not reset round state. Historical appearances keep a snapshot of the title used at that time while the concept remains active.
- On concept deletion, replace its displayable historical title with a deletion marker. History shows the localized equivalent of “Deleted concept”, preserving appearance order and origin while not disclosing the deleted title; retain only the minimum reference needed for that history.
- Deleting a concept removes it from the active list and shows it as â€œDeleted conceptâ€ in history, without allowing new practices. Deleting a list should generally be preceded by archiving; permanent deletion removes active content and preserves only anonymized historical records.
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
| **VS-01 Account and first private list** | **Closed for validated local scope; publication conditions remain pending.** A person can sign in with Google and create and view a private empty list in Spanish or English from supported responsive devices. | CAP-01, CAP-02 (partial: create/view), CAP-08, CAP-09, CAP-10, CAP-12 (partial: language/account shell) | Supabase Auth, Google OAuth, database, RLS, frontend shell, and the minimum account linkage needed for private lists. Rename/delete lists, full settings, concepts, and later study behavior remain outside this slice. Requires account lifecycle and privacy notice decisions before real users. | Q01â€“Q06, SEC01, SEC04â€“SEC08, SEC10, WEB02â€“WEB04; DP01â€“DP03, DP08â€“DP13 |
| **VS-02 Concept management** | **Closed for validated local scope (2026-11-18, including T10).** A person can manage concepts in private lists, use the shared authenticated navigation/preferences, and receive localized action feedback. | CAP-01 (partial), CAP-02 (partial), CAP-03, CAP-08 (partial), CAP-09 (partial), CAP-10 (partial), CAP-12 (partial) | Depends on private lists and trusted validation. The delivered local scope excludes rounds, selection, practice, account deletion, list rename/delete, release-wide browser validation, and publication. | Q01â€“Q04, SEC01â€“SEC03, SEC08; DP02, DP03, DP10, DP13, DP14 |
| VS-03 Persistent round and selection | **Closed for validated local scope (2026-11-18).** A person can mark or randomly select a pending concept, see the result and appearance order, and start a new round without losing prior history. | CAP-04, CAP-10 (partial) | Depends on concepts and atomic persistence; requires concurrency, retry/idempotency, return-to-pending, and the defined concept/list history rules. Broader release compatibility and publication remain VS-07. | Q01â€“Q04, SEC01â€“SEC04, SEC08; DP02, DP10, DP12â€“DP14, DP16 |
| **VS-04 Timed practice journey** | **Closed for validated local scope (2026-11-18).** An authenticated person can run and control an associated or independent timer, see the timer-synchronized Chucao scene, and configure account-level timer preferences. Active sessions are transient; completion and abandonment do not save practice history. | CAP-05, CAP-06, CAP-09 (local/user-reviewed scope), CAP-12 (timer preferences) | Reuses VS-01â€“VS-03 auth, concepts, Draw Result and shell. Adds constrained account preference fields, a minimal Credits and Licenses section in existing Preferences, and no practice persistence. T07/T08 manual review was user-confirmed; broad release compatibility, accessibility and publication checks remain VS-07. | Q01â€“Q06, SEC01, SEC03, SEC04, SEC08, SEC10, WEB03â€“WEB04; DP02, DP10, DP12â€“DP14. DP07 only if telemetry/storage is added. See [`spec.md`](../specs/004-timed-practice-journey/spec.md), [`tasks.md`](../specs/004-timed-practice-journey/tasks.md), and local closure evidence. |
| VS-05 Notes and history | A person can complete a practice, save notes, and review prior practices and rounds without confusing notes with descriptions. Abandoning a timer creates no practice record. | CAP-07, CAP-10 | Depends on practice lifecycle and deletion/retention rules; note length/edit/delete and deleted-reference behavior are defined. | Q01â€“Q04, SEC01â€“SEC04; DP02, DP03, DP10, DP13â€“DP16, DP18 |
| VS-06 Advanced organization | A person can search/order, duplicate/archive/restore lists, filter List Detail to all, pending, or practiced concepts, and use the defined multi-selection actions. | CAP-02, CAP-03, CAP-04, CAP-11 | Depends on stable identities and history semantics; list filters, limits, sorting, multi-selection actions, and confirmation rules are defined. Permanent list deletion must preserve the documented anonymization and retention behavior. | Q01â€“Q04, SEC01â€“SEC04, SEC08; DP10, DP13â€“DP16 |
| VS-07 Publication readiness | The integrated study journey is validated on modern browsers on PC and Android, with accessibility, migration reproducibility, deployment, and documented privacy handling. | CAP-01, CAP-10, CAP-12 | Depends on all release-blocking decisions, provider review, production configuration, migration/recovery evidence, and representative PC/Android checks. | All selected release criteria; unresolved DP items block real-user publication unless explicitly resolved with rationale. |

Cross-cutting conditions apply to every slice: errors must expose the real state or uncertainty, retries must be safe, authorization must hold at the trusted boundary, and affected documentation must be updated.

### Closed slice: VS-03 Persistent round and selection

**Slice status:** Closed for local implementation and validation (2026-11-18)
after the validated local VS-02 scope. T01–T07 are complete within the
owner-accepted Chrome/Brave PC and mobile review scope (CL-06). This does not
claim broader release compatibility or publication readiness; those remain
VS-07 checks. It activates the first complete study loop without pulling
timed practice or notes/history views forward.

**Specification, plan, validation, and closure:** [`specs/003-persistent-round-and-selection/spec.md`](../specs/003-persistent-round-and-selection/spec.md), [`plan.md`](../specs/003-persistent-round-and-selection/plan.md), and [`tasks.md`](../specs/003-persistent-round-and-selection/tasks.md). The validation matrix and closure record are in `tasks.md`. T01–T07 and AC-08 are complete within CL-06; release-wide browser/version review remains for VS-07. No later slice is selected here.

**User outcome:** An authenticated person can progress through a private
list's current round by marking a pending concept seen or drawing one uniformly
at random, see the selected concept and its order, return it to pending when
needed, and begin a fresh round while retaining the prior round's appearances.

**Capabilities covered:**

- **CAP-04:** Current-round pending/seen state, manual appearance, random
  selection, appearance order/origin, return-to-pending, and a new round with
  history retained.
- **CAP-10:** Extend account-owned persistence to rounds and appearances so
  current progress is available after reload and across the same user's
  supported devices; active timer/session synchronization remains excluded.

**Included scope:** Enter List Detail for an owned list; show empty, pending,
seen, exhausted, and current-round progress states. Keep all active concepts
visible in the collection with a clear pending/practiced (seen) label; show
practiced/active-concept counts on My Lists cards. Manually mark pending
concepts seen; draw only from pending concepts with equal eligibility; show a
confirmed draw result with description hidden; return a seen concept to pending
without erasing prior appearances; confirm or cancel a new round; reset active
concept progress while preserving closed-round appearance history. Failed,
repeated, and concurrent operations must not falsely show a result, consume an
extra concept, or corrupt order/history. Persist only the minimum round and
appearance data required by these behaviors, privately under the authenticated
owner. Existing concept management and shared authenticated shell remain
available.

**Deferred scope:** Timed or independent practice, animation/sound, practice
notes and history/rating views, list rename/delete and advanced organization,
bulk mark-as-seen, cross-device active operation/session synchronization,
status filters for all/pending/practiced concepts (planned for VS-06 Advanced
organization), publication, and release-wide browser validation. Practice entry may remain a
future action; this slice does not create a practice record or timer state.

**Dependencies and readiness:** VS-02 is closed for its validated local scope.
Its concepts have stable UUIDs, list association, active/deleted tombstone
state, and initial `pending` state in the local migration and trusted RPCs
(`supabase/migrations/20261117134700_vs02_concept_management.sql`,
`src/features/concepts/conceptService.ts`). VS-01 provides authenticated
ownership, RLS conventions, localization, and the responsive shell. No round,
appearance, draw, or progress persistence is currently present; the slice must
add the trusted transactional persistence needed for state changes, with safe
retry/idempotency and ownership checks. Local demonstration can use synthetic
accounts with Vite and Supabase/Docker. Real-user publication, production
provider configuration, and legal/privacy release review remain outside this
selection. Existing VS-02 tombstones preserve a minimum future-history
reference; exact appearance snapshots and list-deletion/anonymization effects
must be reconciled with the existing global retention rules in the spec.

**Affected layers:** List Detail and a focused draw/result/confirmation UI;
localized accessible loading, empty, progress, success, failure, retry, and
confirmation states; typed round/appearance service operations; PostgreSQL
migrations, constraints, RLS, and trusted atomic operations. Reuse the VS-01/
VS-02 authenticated shell, list/concept identities, localization, query/cache
patterns, and migration conventions. No additional provider or application
server is anticipated.

**Activated shared criteria and controls:**

- **Q01/Q03:** Every round state and action must be understandable, keyboard
  operable, responsive, and localized; success is shown only after persistence
  is confirmed.
- **Q02/Q04, SEC08:** Concurrent draws, repeated submissions, retries,
  interruptions, and large personal lists must preserve a valid unique order
  and bounded operation; define realistic list limits or query/resource bounds
  in the spec if needed.
- **SEC01/SEC04, DP10:** State transitions and all round/appearance reads and
  writes are validated at the trusted boundary and isolated by Auth UUID; a
  second synthetic account must be unable to access or mutate the data.
- **SEC02/SEC03:** Titles and historical snapshots remain parameterized data
  and safely rendered as text.
- **DP02/DP12â€“DP14/DP16:** Inventory generated round/appearance data and its
  purpose; keep it private, minimize auxiliary disclosure, define retention
  when concepts/lists are deleted, and ensure displayed progress/history agrees
  with persisted events. Verify confidentiality/integrity through the local
  boundary; deployed transport and operational controls remain publication
  evidence.

**Demonstration scenario:** Start local Vite and Supabase, then sign in as
synthetic user A with a list containing three named concepts. Draw until the
round is exhausted; verify each appears once in persisted appearance order,
only after a confirmed operation, and reload to confirm seen/pending state and
history remain. Return one seen concept to pending and verify a subsequent draw
can select it without deleting the earlier appearance. Cancel a new-round
confirmation and verify nothing changes; confirm it and verify the old round's
appearances remain while active concepts become pending in the new round. Retry
or overlap a draw and verify it cannot consume a second concept; sign in as
synthetic user B and verify direct reads/writes for A's list/round are rejected.
The local scenario demonstrates persistence and trusted ownership, not
production transport or the full supported-browser matrix; those remain
publication checks.

**Decisions and task readiness:** Product clarifications and technical
decisions Q-03/Q-04 are accepted and recorded in the spec and plan: same-list
changes are ordered, same-intent retries use a command ledger, concepts added
during an open round join as pending, Practice is introduced with VS-04,
deleted concept titles are replaced by a localized history marker, and future
permanent list deletion retains only anonymous round totals. The seven-task
breakdown is ready for execution; all tasks remain pending and implementation
has not started.

### Selected slice: VS-04 Timed practice journey

**Status and rationale:** Closed for validated local scope on 2026-11-18 after
T01–T08. It delivers the core timed practice behavior before VS-05 adds saved
practices, notes, ratings, and history. Automated, database, privacy, and
user-confirmed manual review evidence is recorded in the VS-04 task breakdown;
this is not a deployment or release-wide validation claim.

**User outcome:** An authenticated person starts a 1–59 minute timer either
from a selected concept's Draw Result or as an independent timer, can reveal
the associated concept description, pause/resume/restart, and reaches a clear
completion state with the Chucao scene and optional completion sound.

**Capabilities covered:** CAP-05 (associated and independent timer, duration,
controls, transient lifecycle); CAP-06 (timer-synchronized scene and optional
sound); CAP-09 (responsive, localized, keyboard-accessible practice surface,
including reduced-motion presentation); CAP-12 (account-level default
duration, sound, volume, and reduced-motion preferences), now implemented for
timer settings in VS-04. Wider release validation remains in VS-07.

**Included scope:** Entry from Draw Result and the planned Independent Timer
entry; duration selection before start, constrained to 1–59 minutes; hidden
description with voluntary reveal for associated practice; start, pause,
resume, confirmed restart, elapsed-time-based completion; synchronized
animation, optional sound triggered once, and an understandable completed
state. Add and synchronize timer preferences per account. Add a concise,
localized Credits and Licenses section to the existing Preferences dialog
with the required project, font, and timer-media attribution. Show loading,
unavailable-context, error/retry, and completion states truthfully in Spanish
and English. Active timer state stays in the current browser session;
leaving, reloading, session loss, or changing browser/device abandons it without
recovery or a practice record. Existing authentication, list/concept context,
round selection, and navigation remain in place.

**Deferred scope:** Saving completed practices, independent-practice labels,
notes, ratings, closure save/repeat/draw-another actions, and practice/history
views remain VS-05. Cross-device timer synchronization/recovery remains
excluded (CAP-14); post-start time extension, list organization, publication,
and release-wide browser validation are also out of scope. Completion here is
a transient result, not a saved practice.

**Implementation and boundaries:** VS-01–VS-03 provide the authenticated shell,
private ownership, concept detail, and Draw Result. VS-04 extends the owner
profile with constrained timer preference fields and a narrow trusted update
grant; the timer remains client-only, so no practice/timer persistence layer is
needed. The user confirmed `src/assets/fly1.png`, `fly2.png`, and `tronco.png`
are owner-created and approved for reuse, and confirmed `src/assets/chucao.wav`
as the completion sound and its CC BY-NC-SA 4.0 attribution terms. The root
README now records the creator, font, audio source, modifications, and license
exclusion; VS-04 adds a concise in-app Credits and Licenses section. Browser
restrictions can delay or suppress sound while backgrounded or locked;
the UI must not misrepresent the timer's logical completion, and publication
testing must record the limitation. Local demonstration requires Vite,
Supabase/Docker, synthetic accounts, and browser sound enabled by the user.

**Affected layers:** Draw Result and Independent Timer entry in the React
authenticated shell; localized practice surface and account Preferences UI;
client-side elapsed-time state and animation/audio lifecycle; typed profile
preference service and profile migration/RLS/trusted update operation; tests
and focused browser review. Reuse VS-01–VS-03 identity, query/cache, i18n,
responsive components, and migration conventions. Do not add an application
server or persist active timer state.

**Applicable shared criteria and consequences:**

- **Q01/Q02:** Start, pause, restart, completion, errors, retry, and abandonment
  must follow logical timer state without duplicate completion effects;
  preference writes report success only after persistence and recover from
  failure.
- **Q03, WEB03–WEB04:** Controls and completion remain localized and operable
  by keyboard/touch; reduced motion preserves time and completion information;
  timer artwork has appropriate alternatives and animation/audio is not
  required to understand state. Required for this UI slice.
- **Q04, SEC08:** Bound timer update work and audio/animation resources; reject
  durations outside 1–59 minutes at the relevant boundary. Required during
  implementation and before publication.
- **Q05/Q06, SEC10:** Keep setup/build reproducible, errors actionable without
  sensitive data, and privileged keys absent from client artifacts. Q06 applies
  throughout; release configuration checks remain VS-07.
- **SEC01/SEC04; DP10:** Validate permitted preference fields and enforce
  account ownership at Supabase/RLS/trusted boundaries. Required with the
  preference persistence change.
- **SEC03; DP02/DP13:** Render concept text safely and avoid exposing concept
  content or session details through errors, URLs, caches, or diagnostics.
- **DP12/DP14:** Keep account preference access private and reconcile its
  retention with existing account deletion/backup rules. No timer or practice
  content is retained by this slice.
- **DP07** is conditional only if telemetry, tracking, or additional device
  storage is introduced; none is selected here.

**Demonstration scenario:** Run local Vite and Supabase with a synthetic signed-
in user and a list with at least one concept containing a description. Open its
Draw Result, start a short valid timer, reveal the description, pause and resume,
then restart and let it reach zero; verify one completion state and one optional
sound event. Change duration/sound/volume/reduced-motion preferences, reload,
and verify those preferences persist while the in-progress timer does not.
Start the independent timer and verify the same controls and completion path
without a concept. Try an out-of-range duration and verify rejection; abandon a
running timer by navigating/reloading and verify there is no recovery or
practice/history record. Verify another synthetic account cannot read or
change the first user's preferences. This demonstrates local persistence and
ownership, not background/locked-device sound guarantees or publication
compatibility; those require supported-browser review in VS-07.

**Decisions and readiness for technical planning:** Clarification is complete.
The user approved the timer defaults, sound-volume mapping and preview, reduced-
motion precedence, background timing, session preference behavior, navigation
confirmation, completion destinations, timer assets, audio attribution, and the
minimal Credits and Licenses section in Preferences. The specification is
ready for technical planning; browser background/locked-device sound limits
remain implementation and release constraints.

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
| 2026-11-17 | Selected VS-02 Concept management as the next implementation slice. | Extends the validated private-list foundation to a complete persisted concept-management journey while keeping rounds, selection, practice, and history separate. |
| 2026-11-17 | Closed VS-02 for its validated local scope and aligned the spec, flow, design, and validation evidence with the static `0/active concept count` card indicator. | Records completed local concept management and the user-accepted CHECK-08 browser-measurement exception without claiming publication readiness. |
| 2026-11-18 | Closed the T10 authenticated-shell extension for local scope after user-confirmed manual review; recorded the shared navigation/preferences, toast, responsive list/concept presentation, and list-create dialog. | Completes the authenticated local UI extension without implying deployment, publication, account deletion, later study views, or release-wide browser conformance. |
| 2026-11-18 | Selected VS-03 Persistent round and selection as the next implementation slice after VS-02 closure. | Delivers the first persisted study-round journey while keeping timed practice and practice history as separate increments. |
| 2026-11-18 | Clarified VS-03 behavior and marked its spec ready for technical planning. | Resolves list-action concurrency, concepts added during an open round, staged Practice entry, deleted-concept history representation, and supported browser targets. |
| 2026-11-18 | Recorded user acceptance of the VS-03 idempotency ledger and anonymized round-summary recommendations; marked plan ready for task breakdown. | Resolves remaining technical questions while honoring the user's instruction not to start task breakdown yet. |
| 2026-11-18 | Prepared the VS-03 task breakdown; all tasks remain pending. | Makes the accepted technical plan executable without starting implementation. |
| 2026-11-18 | Closed VS-03 for validated local scope after T01–T07 and the accepted CL-06 browser review; aligned the slice status with validation evidence. | Records the delivered round journey without claiming production deployment or release-wide compatibility. |
| 2026-11-18 | Selected and bounded VS-04 Timed practice journey after VS-03 closure. | Activates the associated and independent transient timer plus account-synced timer preferences; keeps saved practice/notes/history in VS-05 and records unconfirmed timer asset provenance as an implementation constraint. |
| 2026-11-18 | Clarified VS-04 behavior and approved timer-media reuse and attribution. | Adds the account-preference timing rules, timer background behavior, controlled abandonment and completion navigation, owner-created scene assets, licensed sound attribution, and a minimal Credits and Licenses section in existing Preferences; the spec is ready for technical planning. |
| 2026-11-18 | Closed VS-04 for validated local scope after T01â€“T08; recorded automated/database evidence and user-confirmed T07/T08 review. | Marks the associated and independent timer journey locally complete while keeping broad browser compatibility, accessibility, and publication readiness in VS-07. |

