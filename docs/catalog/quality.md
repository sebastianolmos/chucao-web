# Minimum Quality Catalog

## Scope and proportionality

Quality and completion criteria for software products, with concrete checks. Apply general criteria to the relevant behavior; apply interface, security, and web criteria only where those capabilities exist.

**Do not turn this catalog into a feature backlog.** It does not require accounts, a backend, public registration, analytics, SEO, CAPTCHA, microservices, or new testing infrastructure. Use the simplest sufficient solution and reuse established controls.

For selected criteria, record **Met / Pending / Not applicable**, with a short rationale and evidence. Distinguish inapplicability from a requirement due before release. A small audience does not justify broken authorization or data loss. Recheck affected criteria when behavior changes; do not repeat a full audit for every change.

## General product quality

### Q01. Complete and truthful behavior

**Criterion:** The promised workflow works with real inputs and dependencies, and the interface accurately reflects its result.

**Check:** Complete the main workflow in the intended environment. Check relevant empty, loading, success, failure, and retry states. Do not display success before the operation succeeds or ship active controls backed only by placeholders. Clearly identify demonstrations and synthetic data.

### Q02. Data integrity and predictable failure

**Criterion:** Invalid inputs, interruptions, and repeated actions do not silently corrupt data or produce unintended effects.

**Check:** Verify applicable boundaries, duplicate submissions, persistence failures, and restarts. Confirm what is saved after failure and whether retries are safe. Preserve existing data through format changes or migrations. Provide confirmation or recovery appropriate to destructive actions; do not require both for every action.

### Q03. Usable and accessible interfaces

**Criterion:** People can understand and operate supported interactions, including relevant assistive technologies.

**Check:** For graphical interfaces, check keyboard operation, visible focus, accessible names, form labels, understandable errors, contrast, zoom, and supported viewport sizes. Do not communicate essential meaning through color alone. For CLI or library interfaces, check understandable usage, errors, outputs, and documented behavior. Test the actual interface type rather than imposing web conventions universally.

### Q04. Performance and resource use

**Criterion:** Core operations remain usable under realistic data volumes and the intended environment.

**Check:** Check response time, memory, startup, and expensive operations where relevant. Bound processing of large inputs. For web clients, inspect initial JavaScript and defer heavy optional features when justified. Define practical expectations from product needs; avoid arbitrary optimization targets or speculative scaling architecture.

### Q05. Reproducible delivery and compatibility

**Criterion:** The software can be built, installed, started, or consumed using documented requirements on supported platforms.

**Check:** Verify setup with a clean environment when delivery changes. Document required configuration without secrets. Check dependency versions, relevant platform compatibility, and production artifacts. Include migration and recovery instructions when needed; do not rely on undocumented local state.

### Q06. Maintainable changes and operational clarity

**Criterion:** Changes have a clear purpose, use established project patterns, and expose useful failures without leaking sensitive details.

**Check:** Remove accidental debug code, dead controls, and unused dependencies. Avoid duplicate business rules and abstractions without a current need. Investigate application errors and failed resources on main workflows; distinguish browser-extension noise. Keep diagnostics actionable and relevant documentation consistent with implemented behavior.

## Security and abuse resistance

### SEC01. Trusted-boundary validation and allowed fields

**Criterion:** Untrusted inputs are validated where rules are enforced, including inputs from clients, files, integrations, and stored external content.

**Check:** Verify types, lengths, ranges, required fields, nested values, and permitted state changes. Bypass client-side checks in tests. Attempt extra fields such as owner or role; ensure they cannot change protected attributes. Derive identity from trusted authentication context. Preserve valid text such as apostrophes rather than relying on suspicious-character blacklists.

### SEC02. Injection prevention

**Criterion:** Data cannot become database queries, executable commands, or other interpreter instructions.

**Check:** Review raw SQL and ORM escape hatches for bound parameters; map dynamic identifiers and sort options to allowed values. Avoid shell interpolation of untrusted input; constrain executable arguments even without a shell. Exercise representative hostile inputs and valid punctuation. A passing input test alone does not establish safe query or command construction.

### SEC03. Safe rendering and XSS prevention

**Criterion:** Untrusted content is displayed without executing unintended code.

**Check:** Keep framework escaping enabled and use context-appropriate output handling. Inspect raw HTML and unsafe rendering APIs. If rich HTML is required, use a maintained sanitizer. Check stored and reflected content, including links. Verify a value such as `O'Higgins <borrador>` is preserved and displayed as text where plain text is intended.

### SEC04. Authorization and tenant isolation

**Criterion:** Every protected operation checks permission on the actual resource, not just whether a user is authenticated.

**Check:** Test unauthenticated access and cross-user reads, updates, deletion, downloads, lists, and exports. Add cross-organization tests only for multitenant products. Include background operations and administrative paths. If clients access a database directly, verify exposed-table policies such as RLS and ensure privileged keys never reach clients. UUIDs and hidden buttons are not authorization.

### SEC05. Authentication, recovery, and sessions

**Criterion:** Authentication uses maintained mechanisms, and recovery or session handling does not bypass intended access controls.

**Check:** Verify login, expiry, logout, recovery, and relevant revocation behavior. Use single-use, expiring recovery tokens and responses that avoid unnecessary account enumeration. Protect session cookies with appropriate attributes and protect credentials in transit and storage. Enforce MFA for administrative service accounts where supported; assess other roles according to risk. Do not implement custom cryptography or password storage schemes.

### SEC06. CSRF and cross-origin behavior

**Criterion:** Ambient credentials cannot be abused to perform unauthorized state changes from another origin.

**Check:** For cookie-authenticated state changes, verify framework CSRF protections or an appropriate equivalent, including rejection tests. Keep GET requests free of application state-changing actions. Review credentialed cross-origin access and allowed origins. CORS is not authentication, and cookie attributes alone are not a universal replacement for CSRF protection.

### SEC07. Registration and automated abuse

**Criterion:** Publicly reachable, abuse-prone operations have deliberate access and rate controls.

**Check:** Decide whether registration is public, invited, or disabled; enforce that choice at the server or identity provider. Test limits on login, recovery, verification, and magic-link emails. Use account and source signals where appropriate, without enabling easy permanent lockout of victims. Provider authentication limits do not automatically cover application endpoints. Add CAPTCHA only for a concrete abuse need.

### SEC08. Quotas and costly operations

**Criterion:** A user or automated client cannot consume unbounded resources through an exposed feature.

**Check:** Set justified limits for request size, processing time, uploads, record creation, email, or paid API calls where applicable. Verify enforcement at the trusted boundary and understandable rejection. Review service quotas and spending exposure. Rate limits address repetition; they do not fix a vulnerability exploitable with one request.

### SEC09. Files, paths, and remote fetches

**Criterion:** File handling and external-resource features cannot escape their intended boundaries.

**Check:** Validate upload size and content rather than trusting names or MIME headers alone. Prevent path traversal and unsafe archive extraction; control storage and serving permissions. When fetching user-supplied URLs, restrict destinations, protocols, and redirects to prevent access to internal or privileged services. Test these controls only if such capabilities exist.

### SEC10. Secrets, dependencies, and production configuration

**Criterion:** Delivery does not expose privileged credentials or leave known, relevant security failures unresolved.

**Check:** Inspect source, client bundles, logs, and configuration for secrets; rotate exposed credentials rather than merely deleting them. Review dependency and security findings for actual applicability. Disable production debug endpoints and unnecessary privileges. Check encrypted network connections and relevant security headers. Scanners and framework defaults need review; neither proves security by itself.

## Web-specific presentation and discoverability

### WEB01. Initial HTML and rendering

**Criterion:** Rendering meets the page's actual indexing, sharing, and loading requirements.

**Check:** Inspect the initial HTML and the behavior of relevant crawlers or preview clients. Client-rendered content is not automatically defective. Require server rendering or prerendering only when needed to meet concrete requirements.

### WEB02. Missing pages and navigation

**Criterion:** Unknown URLs produce a useful not-found experience and appropriate HTTP behavior.

**Check:** Open an invented URL directly and through navigation. Provide a way to continue. For public pages, verify the server response avoids accidental soft 404s returning 200. Check deep links and refresh behavior against the hosting and routing model.

### WEB03. Page identity and semantics

**Criterion:** Pages are distinguishable and their structure is understandable.

**Check:** Verify meaningful page titles, suitable main headings, logical heading levels, and the correct document language, including language changes. Remove leftover template titles and branding. Ensure the favicon loads and identifies the product. Do not select heading levels solely for visual size.

### WEB04. Images and image controls

**Criterion:** Images provide the appropriate accessible meaning.

**Check:** Give informative images useful text alternatives, mark decorative images with empty alternatives, and give image-based controls accessible names. Check broken images and loading behavior. Avoid redundant descriptions that repeat adjacent information.

### WEB05. Public search and sharing metadata

**Criterion:** Public pages have accurate metadata where indexing or sharing is a product requirement.

**Check:** Review relevant metadescriptions and Open Graph titles, descriptions, and images. Confirm preview resources are accessible and URLs use the public deployment. If canonical links are used, verify each target; do not point every page to the homepage. Private application screens do not automatically need SEO metadata.

### WEB06. Crawling and discovery

**Criterion:** Crawling settings match intended public visibility without being mistaken for access controls.

**Check:** Inspect robots rules for accidental production blocks or unintended allowance. If a sitemap is warranted, include current public URLs and exclude private, missing, test, and unnecessary redirected URLs. Keep private resources protected independently of robots rules. Absence of `llms.txt` is not a defect; if adopted for a concrete purpose, keep its links and content current.

### WEB07. Structured data

**Criterion:** Structured markup is included only when useful and truthful.

**Check:** If Schema.org or JSON-LD is used, validate it against the actual visible content. Do not invent reviews, ratings, entities, or supported features to satisfy a checklist. Omission is acceptable when there is no relevant use case.

### WEB08. Public build artifacts

**Criterion:** Published assets contain only intentionally public material.

**Check:** Review source maps, bundled configuration, test assets, and debug resources. Public source maps are a deliberate tradeoff, not automatically a vulnerability; if private, exclude them from public artifacts rather than only removing JavaScript references. Never rely on source-map removal to conceal secrets already shipped to clients.

## Completion evidence

For applicable criteria, retain reproducible results or concise review evidence. Confirm the delivered behavior, relevant error cases, and preservation of existing behavior. Identify untested conditions and unresolved defects.

Do not mark a criterion met because a dependency is installed, a setting exists, or a test is planned. Resolve blocking issues before the affected capability is released. Any scope change or accepted exception must be explicit, with its rationale and remaining risk.

## Technical references

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/): supporting guidance for authentication, authorization, XSS, CSRF, uploads, SSRF, and resource abuse.

This is a selected engineering baseline, not a claim of complete security or conformance to a certification standard.
