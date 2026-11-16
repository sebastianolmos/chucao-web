# Chucao Web — Project Quality Criteria

## 1. Scope and source

**Product scope:** Authenticated, private, responsive web application for organizing concept lists and practicing oral explanations with persistent rounds, timed practice, notes, and history. Public sharing, organizations, analytics, and marketing are out of scope.

**Date:** 2026-11-16  
**Status:** Selected baseline for planning; all criteria are pending unless evidence is listed. Selection does not mean satisfaction.

**Quality catalog:** `docs/catalog/quality.md`, consulted 2026-11-16, local SHA-256 `A69114F60892C856BBC8EDF4E78B3858385C024547C5B34E90F800A254B4634C`.

Privacy-related criteria are coordinated with `docs/catalog/data-protection.md`, consulted the same date, local SHA-256 `7CFD0B22B5C142A2DDD5BDBC56E3E9E199FC6FAB0510759B2389A0C6E369219B`.

## 2. Selected criteria

| Source ID | Product-specific interpretation and scope | Required by | Expected evidence | Status |
|---|---|---|---|---|
| Q01 | Registration through private list creation, concept entry, selection, practice, notes, history, locale change, and release journey show truthful loading, empty, success, failure, and retry states. | Each slice; complete before publication | Reproducible integrated workflow with real persistence and relevant failure paths. | Pending |
| Q02 | Validation, duplicate paste, destructive actions, retries, reloads, concurrent selection, migrations, and deletion do not corrupt or duplicate data. | VS-02 onward; before each affected release | Boundary, repeat-action, interruption, migration, and concurrency evidence. | Pending |
| Q03 | Keyboard operation, visible focus, labels, accessible names, errors, contrast, zoom, reduced motion, touch targets, and supported PC/mobile viewports are usable. | UI slice; complete before publication | Accessibility review and representative keyboard/mobile/manual workflow evidence. | Pending |
| Q04 | List and concept operations, pasted input, history, and timer/animation remain usable for realistic personal data volumes without unbounded client work. | VS-02, VS-04, VS-06; before publication | Defined representative workload and targeted performance/resource review where justified. | Pending |
| Q05 | The project can be installed, configured without secrets, started, migrated, built, and deployed using documented dependencies and supported browsers. | VS-01 for setup; VS-07 for release | Clean setup/build/deployment result, migration/recovery instructions, and compatibility evidence. | Pending |
| Q06 | Changes follow the chosen React/Supabase patterns, expose actionable failures without sensitive data, remove debug artifacts, and keep affected documentation aligned. | Every slice; release review | Human review, diagnostics review, dependency/configuration review, and documentation diff. | Pending |
| SEC01 | Client, pasted text, stored values, and direct service requests cannot bypass title lengths, allowed fields, ownership, state transitions, or list/concept rules. | VS-01–VS-06; before each related release | Server/database bypass tests for types, lengths, fields, identity, and state. | Pending |
| SEC02 | SQL functions, filters, ordering, and any dynamic values use bound parameters or allowlisted mappings; hostile punctuation remains plain data. | Before first persistence implementation and after query changes | Code review plus representative hostile-input tests. | Pending |
| SEC03 | User-authored names, descriptions, notes, and error content render as text and cannot execute markup or scripts. | VS-02 onward; before publication | Stored/reflected content checks, including HTML-like and apostrophe-containing values. | Pending |
| SEC04 | Every read/write/delete/history operation is restricted to the owning authenticated user; RLS and backend checks cover direct requests and background paths. | VS-01 for lists; each new resource; before publication | Unauthenticated and cross-user read/update/delete tests against actual service boundaries. | Pending |
| SEC05 | Supabase Auth handles registration, confirmation, login, logout, recovery, expiry, and revocation without custom credential storage or recovery bypass. | VS-01; before public registration | Provider configuration review and account/session lifecycle tests. | Pending |
| SEC06 | Review credentialed cross-origin behavior and state-changing requests; avoid state changes on GET and verify applicable CSRF protections for the chosen auth model. | Before deployed state-changing endpoints | Configuration review and rejection/allowed-origin evidence appropriate to Supabase/browser auth. | Pending |
| SEC07 | Registration, login, recovery, and verification exposure is deliberate and provider/application limits are understood; no CAPTCHA is added without a concrete abuse need. | Before public registration | Access decision, provider settings, abuse-risk review, and targeted rate-limit evidence if needed. | Pending |
| SEC08 | Pasted batches, record creation, timer actions, and other exposed operations have justified input, processing, and service limits. | VS-02, VS-04, VS-06; before publication | Boundary/rejection evidence and service-quota/spending review. | Pending |
| SEC10 | No privileged Supabase keys, secrets, or debug resources ship to the client; relevant dependencies, HTTPS, headers, and production configuration are reviewed. | Before any deployed environment and again at release | Bundle/configuration inspection, dependency review, and deployment review. | Pending |
| WEB02 | Unknown routes, refreshes, and deep links provide a useful not-found/continuation experience compatible with the hosting and routing model. | VS-07 | Direct and navigated unknown-URL checks with appropriate deployment behavior. | Pending |
| WEB03 | Pages have meaningful titles, headings, language metadata, semantics, favicon, and correct language changes for Spanish/English. | VS-01 for shell; VS-07 for all routes | Browser/document review in both locales. | Pending |
| WEB04 | Chucao art and controls have appropriate alternatives; decorative images are not redundantly announced and broken/loading states are understandable. | VS-04 and VS-07 | Screen-reader/accessibility review of the animation and image controls. | Pending |
| WEB08 | Published artifacts contain only intentionally public source maps, configuration, test assets, and debug resources. | VS-07 | Production artifact inspection. | Pending |

## 3. Conditional criteria and open applicability questions

| Source ID | Activation condition | Review stage |
|---|---|---|
| SEC09 | Select only if uploads, file import/export, path handling, or user-supplied remote fetches are added. Current pasted concept text is not a file feature. | Before that capability is specified |
| WEB01 | Select if public indexing, previews, or initial HTML requirements become a product goal. Private application screens do not require SSR by default. | Before public marketing/indexing scope |
| WEB05 | Select if public pages must be indexed or shared with accurate previews. | Before public pages or sharing |
| WEB06 | Select if public discoverable pages, sitemap, or robots policy are introduced; robots must not be used as access control. | Before public discovery scope |
| WEB07 | Select only if truthful structured data has a concrete product use. | Before adding Schema.org/JSON-LD |
| SEC07 | The criterion is selected for deliberate registration/abuse decisions; stronger controls are conditional on observed risk. | Before public registration and after abuse signals |
| DP04, DP06, DP07, DP20 | Reconsider if the product processes sensitive data, minors, consent-dependent tracking, telemetry/SDKs, profiling, or consequential automated decisions. | Before activating the relevant processing |
| Q04 | Apply more deeply if shared/public datasets, unusually large imports, or cross-device synchronization are introduced. | Before expanding beyond personal-scale use |

Open applicability questions: supported browsers and minimum mobile OS/browser versions; expected realistic personal data volume; whether public registration is enabled; whether any analytics/crash SDK is used; and whether public pages need indexing or sharing metadata.

## 4. Relevant exclusions

| Source ID | Current reason | Reconsider when |
|---|---|---|
| WEB01 | No confirmed public indexing or sharing requirement; this is primarily a private authenticated application. | Public landing/content pages or crawler-dependent sharing are added. |
| WEB05 | No public SEO or social-preview requirement is confirmed. | Public pages or shareable resources are introduced. |
| WEB06 | No public sitemap/discovery surface is currently planned. | Public pages are published and discoverability is a product goal. |
| WEB07 | No relevant structured-data use case is confirmed; inventing markup would be misleading. | A truthful, useful public content type is added. |
| SEC09 | No uploads, archive extraction, filesystem paths, or user-supplied URL fetches are in scope. | Any such capability is specified. |
| SEC06 (partial) | No separate cookie-authenticated custom API is currently planned; the chosen Supabase/browser auth flow still requires a cross-origin/state-change review. | Custom cookie/session endpoints or credentialed origins are added. |
| DP06, DP07 (current processing) | No consent-based analytics, marketing, tracking, or non-essential SDK is confirmed. | Such processing or third-party telemetry is added. |
| DP04, DP20 (current processing) | The intended domain does not require sensitive data, age evidence, profiling, or consequential automated decisions. | Scope or audience changes create those conditions. |

These are scope exclusions, not evidence that the criteria have been satisfied.

## 5. Significant changes

| Date | Change | Rationale |
|---|---|---|
| 2026-11-16 | Created the project quality selection from the local quality and privacy catalogs. | Establishes an evidence-oriented baseline for the planned vertical slices. |
| 2026-11-16 | Selected general, security, and relevant web criteria; left SEO/discovery and file criteria conditional or excluded. | The product is private-first and has no confirmed public indexing or file-fetch capability. |
| 2026-11-16 | Marked all criteria pending. | The project is in planning/early development; dependencies, settings, plans, and intentions are not verification evidence. |
