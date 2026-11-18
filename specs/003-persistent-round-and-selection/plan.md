# VS-03 Persistent round and selection — Technical Plan

## 1. Status and references

| Field | Value |
|---|---|
| Spec | [`spec.md`](./spec.md), VS-03, requirements FR-01–FR-09, NFR-01–NFR-07, acceptance AC-01–AC-10 |
| State | T01–T07 complete; local VS-03 spec validation is recorded in `tasks.md`. User accepted Q-03/Q-04 (2026-11-18) and the focused Chrome/Brave/mobile review scope (2026-11-18). |
| Source revision inspected | Repository `HEAD` `02c8379`; working-tree documentation includes the accepted clarification decisions |
| Implementation status | T01–T07 evidence and the validation verdict are tracked in `tasks.md`; this plan remains the technical reference for the implemented slice. |

Relevant sources: `docs/global-plan.md` sections 3–8; `docs/architecture.md` sections 2, 4, 6–7 and architectural decisions; `docs/app-flow.md` FLOW-04 and VIEW-03/VIEW-06; `docs/design.md` sections 2–6 and VIEW-03/VIEW-06; `docs/quality-project.md` Q01–Q04, SEC01–SEC04, SEC08; `docs/catalog/data-protection.md` DP02, DP10, DP12–DP14, DP16; `docs/catalog/verification.md` V01–V10.

## 2. Existing implementation and reuse

### Existing implementation

- `src/features/lists/ListDetailView.tsx` delegates the selected list to `ConceptManagementView`.
- `src/features/concepts/ConceptManagementView.tsx` owns the list-scoped concept query, empty/list states, concept add dialog, concept detail, and existing mutations. Its React Query key is `conceptQueryKey(userId, listId)` from `src/features/concepts/conceptService.ts`.
- `src/features/concepts/conceptService.ts` validates user identity before browser operations and calls typed Supabase RPCs. Existing result unions distinguish rejected from unresolved writes; new round operations need an equivalent explicit contract.
- `supabase/migrations/20261117134700_vs02_concept_management.sql` defines active/tombstoned concepts, current `pending | seen` state, RLS, and trusted create/edit/delete RPCs. `create_concept` and `create_concepts_batch` lock the parent list row before writing. The current edit/delete RPCs do not consistently use that same parent-list lock; VS-03 must align affected mutations before claiming list-wide ordering.
- `src/lib/database.types.ts` is the hand-maintained Supabase database contract. `src/i18n/resources.ts` contains Spanish/English labels. Mantine, CSS Modules, `useToast`, and TanStack Query are established UI patterns.
- Existing focused UI tests use Vitest, React Testing Library, and mocked feature services. Local migration and trusted-boundary checks have used synthetic accounts with `npx supabase db reset --local`, `npx supabase db lint --local`, and reversible SQL through the local database `psql` session (see `specs/002-concept-management/tasks.md`).

### Reuse and scope

Extend the current List Detail rather than adding a new route or application service. Keep concept add/view/edit/delete available. Add only round progress/actions, draw result, and new-round confirmation. No dependency or external provider is needed.

## 3. Component responsibilities and implementation status

This table tracks each component's intended responsibility and current implementation; remaining work stays scoped to its pending task.

| Component | Responsibility and proposed change | Requirements |
|---|---|---|
| `supabase/migrations/<timestamp>_vs03_persistent_round_and_selection.sql` | Add round, appearance, and accepted idempotency persistence; constraints, indexes only where query evidence needs them, RLS, grants, and fixed-search-path security-definer RPCs. Replace/extend affected concept mutation functions to follow the common list-lock order and redact deleted titles from appearances. | FR-01, FR-03–FR-08, NFR-01, NFR-04–NFR-06 |
| `src/lib/database.types.ts` | Add round/appearance/operation row types and generated-style RPC argument/result definitions consistent with the new migration. | FR-01–FR-08 |
| `src/features/rounds/roundService.ts` | Proposed feature service: load/ensure current round state; submit mark, draw, return-to-pending, and start-new-round commands; require an operation UUID per explicit command; map trusted errors and unresolved outcomes. Derive owner from Auth and never accept client-owned state as authority. | FR-01, FR-03–FR-08, NFR-01, NFR-04 |
| `src/features/concepts/ConceptManagementView.tsx` | Composes round progress/actions with the existing concept collection. Keeps both states visible; dispatches mark/return/draw/new-round commands and coordinates confirmed result/confirmation dialogs. The feature service refreshes round, concept, and My Lists card queries. | FR-01–FR-07, FR-09 |
| `src/features/rounds/RoundProgressPanel.tsx` | Renders numeric seen/pending progress, draw, manual mark, return-to-pending, and start-round actions, including empty, exhausted, disabled, busy, and recoverable error states. | FR-02–FR-06, FR-09, NFR-01–NFR-03 |
| `src/features/rounds/DrawResultModal.tsx` | Focused result dialog showing confirmed title and current-round appearance order, hiding description, and offering Return to List only. | FR-04, FR-09, NFR-02 |
| `src/features/rounds/rounds.module.css` | Uses existing theme variables, spacing, borders, solid offset shadows, pastel semantic actions, and responsive panel/dialog conventions. No new palette or visual dependency. | FR-02, FR-04, FR-06, NFR-02 |
| `src/i18n/resources.ts` | Spanish/English action labels, progress text, confirmation copy, empty/exhausted/loading/error/retry/unresolved states, and accessible status names. Preserves authored concept titles. | FR-02–FR-06, FR-09 |
| Focused VS-03 tests | Add only tests for new round UI state/command behavior; use local Supabase SQL checks for the database invariants and RLS boundary. Do not duplicate unchanged VS-01/VS-02 tests or test static CSS values. | AC-01–AC-10, NFR-01–NFR-06 |

### UI composition and visual direction

- Keep the existing `ConceptManagementView` header, back action, list title, scrollable concept rows, and Add Concepts action. Add round controls in the existing content hierarchy without displacing or hiding concept management.
- Show numeric progress text even if a bar is used. Pending/seen state must have text or shape cues in addition to color.
- Use the existing cream dialog surface, warm dimmed backdrop, coffee-brown text/borders, pastel semantic buttons, and solid shadows. Draw Result shows the centered title and position, no description, and the single Return to List action in VS-03.
- Use Mantine accessible modal behavior for focus entry/return and confirmation. Keep errors actionable and visible; toast only confirmed success. Respect keyboard focus, touch targets, long-title wrapping, and narrow layouts from `docs/design.md` sections 3–6.
- No forest art, timer animation, sound, or Practice action is part of this slice.

## 4. Data model, contracts, and compatibility

### Proposed persisted model

The exact physical schema will be detailed during task breakdown. The accepted Q-04 decision constrains the deletion lifecycle: list deletion must detach and anonymize retained round summaries rather than cascade-delete them or leave them user-linked. The minimum implementation needs:

1. **Rounds:** one row per list round, stable ID, list association while active, open/closed lifecycle, and timestamps. A partial unique constraint shall prevent more than one open round for a list. Historical rounds remain closed and readable only through the owning list's authorization chain.
2. **Appearances:** one immutable appearance event per manual mark or draw, linked to a round and concept identity (including a logical tombstone after deletion), with a positive unique per-round order, origin (`manual` or `draw`), and a plain-text title snapshot. Returning to pending changes current concept availability only; it does not rewrite or delete earlier appearances. A later mark/draw appends a new position.
3. **Current availability:** reuse `concepts.state` as the current-round pending/seen state rather than introducing duplicate round-concept state. A newly created concept's existing `pending` default makes it immediately eligible in the open round. Starting a new round resets only active concepts; tombstones remain deleted.
4. **Round command/idempotency record (accepted Q-03):** a minimal command ledger keyed by owner/list plus a client-generated operation UUID, action kind, and references to the resulting round/appearance/state outcome. It stores no concept title, description, or payload. Keep it for at least the lifetime of its associated round history so a retry of the same intent returns the original outcome.

Expected invariants: one open round per list; one globally ordered sequence of appearances within each round; one operation result per idempotency key; current concept availability is consistent with the open round; deleted concepts never qualify for selection; all active records resolve through their list to `auth.uid()`.

### Trusted RPC contract (proposed)

The browser calls narrow RPCs with the list/concept identifier, the operation UUID, and only the action-specific input. Candidate operations are `get_or_create_current_round`, `mark_concept_seen`, `draw_pending_concept`, `return_concept_to_pending`, and `start_new_round`. Names and exact JSON/row return shapes are technical details; the externally observable results follow FR-01–FR-08. Each write first authenticates and verifies ownership, then locks the owned parent list, then checks the operation ledger; it must never reveal a stored command result before the ownership check.

Each write response should identify the action outcome and authoritative current round/progress; a draw additionally returns its appearance ID/order and the selected active concept's title. Replayed operation UUIDs return the recorded result. Invalid/stale actions return a typed no-effect result. Do not return deleted title content. RLS remains enabled/forced; direct authenticated table writes remain revoked, and only authenticated callers receive execute permission on fixed-search-path functions.

### Compatibility and existing-data migration

- Existing lists/concepts have no round rows. Migration must not claim they already have a round. `get_or_create_current_round` creates the first open round safely on first List Detail load; existing active concepts retain their current state (currently default `pending`).
- Existing tombstones contain no title/description. They remain excluded. No backfill of historical appearances is possible or required; previous VS-02 state has no selection events.
- Use a forward-only versioned migration. Re-run local reset from VS-01/VS-02 to prove clean reconstruction. Rollback of code is separate from rollback of persisted rounds; do not promise destructive migration reversal or discard confirmed history.
- Exact indexes should follow the active-list/current-round/pending query and measured plan. Reuse the existing `concepts_list_active_position_idx` initially; add an index including `state` only if the local `EXPLAIN (ANALYZE, BUFFERS)` at the agreed representative workload shows it is needed.

## 5. Algorithms, serialization, and failure handling

### Per-list serialization

Every list-changing RPC in the VS-03 path shall lock the owning `lists` row first (`SELECT ... FOR UPDATE`) after deriving/validating `auth.uid()`. Existing concept create/batch already use this lock; edit and delete must be updated to use the same lock order before changing a concept. New-round, mark, draw, and return operations use the same parent lock. This serializes distinct commands and gives each command the current state required by CL-01. Keep transactions short and do not call external services while holding a lock.

### Draw selection

Proposed exact-uniform procedure within the locked list transaction:

1. Resolve the current round and count active pending concepts.
2. If the count is zero, return an exhausted/no-effect result.
3. Select an integer offset uniformly from `[0, pending_count - 1]`, over active pending concepts in stable `(position, id)` order.
4. Lock/update the chosen concept as seen, append one draw appearance at `max(round appearance order) + 1`, and record the operation outcome in the same transaction.
5. Return the selected title/order only after commit.

The random index is generated at the trusted database boundary. The pending set and order are stable during the operation because all writers take the same list lock. Code review shall verify the uniform offset range and that the candidate query excludes seen/tombstoned concepts; no flaky statistical-distribution test is proposed.

### Other state transitions

- **Ensure current round:** lock list, verify owner, return the existing open round or create exactly one. Unique constraint is the last-resort invariant if an unexpected writer bypasses the lock.
- **Manual mark:** require active/pending target, set seen, append a manual appearance, save command result.
- **Return:** require active/seen target, set pending, save command outcome but do not append an appearance.
- **New round:** lock list, close its current round, create a new open round, reset active concepts to pending, and save the outcome atomically. Tombstones remain untouched.
- **Concept deletion:** under the same list lock, tombstone the concept using the existing VS-02 semantics and replace any displayable appearance title snapshot for it with the deletion marker in that transaction. This prevents title disclosure if the response is interrupted or retried.

### Q-03 — Accepted request idempotency decision (2026-11-18)

**Decision:** use a small `round_operations` command ledger in PostgreSQL. The client creates one UUID per explicit action and keeps it unchanged for retries. Keep an unresolved operation UUID in per-tab `sessionStorage` (keyed by user/list) so a reload in the same tab can retry the same intent; store no title or other authored content and clear the token after a resolved result. Under the list lock, the RPC first looks up `(list_id, operation_id)`; if present, it returns the recorded result without applying the action again. Otherwise it validates the action, performs state/appearance changes, and records the result in the same transaction. Persist deterministic rejected outcomes such as already-seen/exhausted when a same-intent replay must preserve that result. Do not persist transient connection errors as successful commands. Keep command records with the related round history and remove/anonymize them with that history.

**Rationale:** a state reread alone cannot distinguish “my commit succeeded but the response was lost” from “another session independently made the same state change.” The existing concept service's content reconciliation is unsuitable for random draws and round starts. The ledger adds one internal table but no new service, API provider, or user-visible data.

**Consequence:** requires a client request UUID, trusted deduplication constraint, command response record, and direct retry checks. Implementation must meet the same-intent outcome in FR-01/FR-04/FR-06; it must not fall back to blind retries.

### Q-04 — Accepted permanent-list deletion decision (2026-11-18)

**Decision:** for a future permanent list deletion, remove the active list/concepts and replace detailed round/appearance history with anonymous round summaries only. Strip owner, list, concept identifiers, titles, descriptions, operation UUIDs, exact event timestamps, and per-concept order/origin; retain only non-identifying round totals needed to honor the global decision to preserve anonymized historical records. VS-03 does not implement the list-delete flow, but its relationships must allow a later deletion operation to detach/anonymize history rather than cascade-delete it or leave it user-linked.

**Rationale:** retaining event-level records after permanent deletion risks preserving a re-identifiable practice sequence. Round-level totals retain a minimal anonymized historical record while preventing deleted user-authored content from surviving. The technical plan must not claim the summaries are anonymous until the actual linkage and re-identification risk are reviewed under DP14.

**Consequence:** favors nullable/detachable list ownership on retained historical rounds and an explicit future anonymization RPC; it rules out a simple `ON DELETE CASCADE` from list to rounds if that would erase the globally promised anonymous records. This does not add list deletion to VS-03.

## 6. Technical decisions, dependencies, and risks

| Decision / risk | Recommendation and rationale | State / blocking point |
|---|---|---|
| Serialization | Parent list row lock is the single per-list lock, shared by concept writes and round operations; consistent lock order avoids deadlocks and reflects accepted sequential semantics. | Accepted technical direction; task breakdown must preserve it. |
| Idempotency (Q-03) | Command ledger keyed by list and client operation UUID; same request returns the committed result. | **Accepted by user (2026-11-18); task breakdown may proceed.** |
| List deletion retention (Q-04) | Replace event-level, content-bearing history with anonymous round totals on future permanent list deletion; keep this lifecycle out of VS-03 implementation. | **Accepted by user (2026-11-18); schema and future deletion contract must honor it.** |
| Random choice | Uniform integer offset over stable ordered pending rows inside the trusted transaction. | Proposed; verify query and explain plan before task closure. |
| Uniform state and event order | `concepts.state` is the sole current availability value; appearances are immutable except privacy redaction after concept deletion. | Proposed; no duplicate pending/seen table. |
| Error reconciliation | Reuse typed result/error mapping patterns, but use the accepted operation ledger rather than title/content matching for side-effecting round actions. | Accepted; contract details in task breakdown. |
| Performance | Personal-scale data only; use 500 synthetic concepts as the available local comparison point from VS-02, not as a product maximum or production claim. | Review local query plan; no new numeric threshold is introduced. |
| Deletion migration | Existing VS-02 `delete_concept` clears title/description; VS-03 must redact appearance snapshots in the same transaction and keep deleted concepts out of selection/reset. | Required for first VS-03 release. |
| Tests and dependencies | Use repository Vitest/RTL and local Supabase/psql patterns; add no test framework or runtime dependency. | Confirmed direction; exact focused files/commands in section 8. |

## 7. Dependencies, privacy, and documentation risks

- Requires local Supabase CLI and Docker for applying migrations and real RLS/RPC checks. Production Supabase, real users, and publication access are not required.
- `auth.uid()` is authoritative. Every RPC verifies ownership through the parent list; service-role keys are not used in the browser. RLS blocks cross-owner reads; direct table mutation remains revoked.
- Round/appearance data is private and limited to current progress and future round history. Keep title snapshots plain text, do not put titles in URLs/logs/errors, and redact deleted concept title snapshots on concept deletion.
- The proposed command ledger contains identifiers and operation/result references only; it must not duplicate authored content. Its retention follows round history; when list history is anonymized, remove operation identifiers and ownership links.
- Rounds are not practices: no timer, note, rating, or practice record is written.
- UI success is emitted only after the RPC confirms commit. On uncertain transport outcome, retry with the same UUID or show unresolved state; never mint a new intent UUID while the original outcome is uncertain.
- Main data-loss risk is order/state divergence if any concept-writing RPC skips the parent lock. Review all functions that can change active concept state, title, or deletion state and preserve a consistent lock order.
- Main privacy risk is a historical title surviving a tombstone or a list deletion. Verify redaction in local data and responses, not only in UI rendering.

## 8. Verification and review strategy

### Shared preparation

- Run from the repository root: `C:\Users\sebam\projects\chucao-web`.
- Use local Vite/Supabase with synthetic Auth users A and B, plus unauthenticated direct requests. No production or real-user data.
- Apply migrations from scratch with `npx supabase db reset --local`; run `npx supabase db lint --local` after migration changes. Use the established reversible local `psql` checks from VS-02 tasks; rollback test mutations and confirm synthetic rows are cleaned up.
- Seed one owned list with three distinctive synthetic titles (including an apostrophe and HTML-like text), plus a separate empty list and an account B list. For Q04 only, use synthetic data to inspect deletion/anonymization representation; do not retain fixtures.
- Existing check commands: `npm test`, `npm run build`, `npm run lint`, `npx supabase start`, `npx supabase db reset --local`, `npx supabase db lint --local`. VS-03 execution results and remaining validation gaps are recorded in [`tasks.md`](./tasks.md), including the reason local reset was skipped during T06 to preserve the non-empty baseline.

### Focused checks

| Check | Trace | Method, environment, and preconditions | Expected result / evidence | Timing |
|---|---|---|---|---|
| CHECK-01 — Focused round UI | FR-01–FR-06, FR-09; AC-01–AC-06, AC-08; Q01–Q03 | Add/extend only a VS-03 Vitest/RTL suite for List Detail states/actions. Mock the feature service to control success, rejection, unresolved response, and loading. Exercise empty, pending/seen progress, draw result without description, exhausted state, return-to-pending, cancel/confirm new round, retry-disabled/retry-enabled states, and locale copy. | UI shows only confirmed outcomes; actions become unavailable while processing; cancel has no service call; retry uses the same operation UUID; layout semantics/text are accessible in both locales. Retain focused test output and assertion review. | During implementation; run only affected test files. |
| CHECK-02 — Migration and trusted data contract | FR-01, FR-03–FR-08; AC-01–AC-06, AC-10; Q02–Q04 | Reset local Supabase from VS-01/02/03 migrations. Use synthetic data in local `psql`; verify first-round creation, one-open-round constraint, new concepts as pending, manual/draw/return/new-round effects, order/origin, tombstone exclusion, snapshot redaction, and rollback after forced transaction failure. Run `npx supabase db lint --local`. | First open creates one round; confirmed operation effects are atomic; cancellation writes nothing; old history stays closed/ordered; failed transaction leaves no partial state; deleted title is absent from historical display fields. Retain command output and reversible SQL results. | Before accepting persistence implementation. |
| CHECK-03 — Idempotency and concurrency | FR-01, FR-03–FR-06; AC-06, AC-09; Q-03 | With local Supabase, send two concurrent distinct draws for one list and a duplicate request UUID after simulating a lost response. Also issue two marks for the same pending concept. Use two authenticated sessions or two direct API/psql connections; seed at least two pending concepts. | Distinct requests serialize and each consumes one currently pending concept; repeated UUID returns the original result and adds no appearance; competing same-concept mark has one effect and one no-effect response; order remains unique. Retain request outcomes and row snapshots before/after. | Before accepting concurrency/idempotency behavior. |
| CHECK-04 — Ownership and RLS | FR-08, NFR-04–NFR-06; AC-07 | Against local Supabase, read and attempt each state-changing RPC as owner A, owner B using known IDs, and anon/unauthenticated. Inspect grants, RLS, function `search_path`, and changed rows. | A can operate own list. B/anon cannot read or change A's rounds, concepts, appearances, or command results; errors do not disclose titles or ownership. Retain direct request outcomes and policy/grant review. | Before accepting protected resource. |
| CHECK-05 — Core workflow and reload | FR-01–FR-07; AC-01–AC-06 | Local Vite + Supabase, synthetic owner A, three concepts. Draw to exhaustion; reload; return one item to pending and draw again; cancel then confirm a new round; reload again. | Progress and round identity restore from DB; each operation's order/origin is correct; cancelled round is unchanged; old appearances remain after restart; no practice/timer data is created. Record concise steps, screenshots only if useful, and DB state evidence. | Before slice closure. |
| CHECK-06 — Failures and uncertain response | FR-03–FR-07, NFR-01; AC-06, AC-09 | Local service test simulates a response timeout after server commit, then retries the exact command UUID. Separately force an RPC rejection before commit and retry after correction. | Post-commit timeout is reconciled to the original outcome with one appearance; pre-commit failure has no partial state; UI does not show false success and preserves current confirmed state. Retain test output and local row comparison. | Before slice closure. |
| CHECK-07 — Focused visual/accessibility/browser review | FR-02, FR-04, FR-06, FR-09, NFR-02; AC-08 | Manual review of List Detail and dialogs in Spanish/English, keyboard and touch, long concept titles, narrow viewport, focus entry/return, progress text, disabled/busy controls, and the Chucao color/shadow/dialog hierarchy. Per accepted CL-06, the owner reviewed Chrome and Brave on PC and mobile mode. Broader target coverage is deferred to VS-07. | No horizontal overflow; next action is clear; progress/status never depends on color alone; draw result hides description; focus and errors remain understandable; established visual system is preserved. Record unavailable targets without claiming VS-07 compatibility. | Before VS-03 closure; broader release review remains VS-07. |
| CHECK-08 — Targeted static/regression checks | Q06, NFR-07; relevant touched files | Run `npm run build`, `npm run lint`, and only focused affected suites: `npm test -- src/features/rounds` plus the changed `ConceptManagementView` test file. Run broader existing suite only if shared query/client or state architecture was changed. | TypeScript/build and lint pass; affected tests are discovered and pass; no unrelated tests are added or weakened. Retain command output and review changed diagnostics. | Before slice closure. |

### Tests intentionally not proposed

- No new tests for unchanged authentication, list creation, batch parsing, concept editing, timer, practice, or history UI.
- No snapshots/assertions for CSS colors, spacing, or static visual details; review these manually against `docs/design.md`.
- No statistical test over random draws (flaky and not evidence of the uniform algorithm); review the uniform-offset implementation and test candidate bounds/eligibility under deterministic database setup.
- No CI, browser automation framework, new test dependency, production test environment, or performance threshold is added by this plan.

### Verification limitations

- Mocked Vitest tests validate client state handling only; CHECK-02–CHECK-04 use local Supabase to establish transactions and authorization.
- Local SQL and manual browser checks do not prove production HTTPS, managed backup retention, legal compliance, or public browser readiness. Those remain release evidence.
- Browser targets outside the owner-accepted VS-03 scope in CL-06 remain a VS-07 release review condition; do not infer broader compatibility from this slice validation.

## 9. Traceability and implementation sequence

| Requirement / acceptance | Proposed changes | Verification |
|---|---|---|
| FR-01–FR-02; AC-01 | Current-round ensure/load RPC, one-open-round constraint, progress panel, pending inclusion for concepts added to an open round | CHECK-01, CHECK-02, CHECK-05 |
| FR-03; AC-02 | Ordered manual-mark RPC and row action | CHECK-01–CHECK-03 |
| FR-04; AC-03 | Uniform pending selection, atomic draw appearance, result dialog | CHECK-01–CHECK-03, CHECK-05 |
| FR-05; AC-04 | Return-to-pending RPC without appearance mutation | CHECK-01–CHECK-02, CHECK-05 |
| FR-06; AC-05 | Atomic close/create/reset operation and confirmation UI | CHECK-01–CHECK-03, CHECK-05 |
| FR-07; AC-06 | Persistent queries plus operation ledger and safe replay | CHECK-02, CHECK-03, CHECK-05, CHECK-06 |
| FR-08; AC-07 | Parent-list authorization, RLS, grants, fixed search path | CHECK-02, CHECK-04 |
| FR-09; AC-08 | i18n keys and visual/accessibility implementation | CHECK-01, CHECK-07 |
| NFR-01; AC-09 | Confirmed/unresolved states, same-intent replay, serialized mutations | CHECK-01–CHECK-03, CHECK-06 |
| NFR-02 | Semantic controls, focus, responsive Chucao presentation | CHECK-01, CHECK-07 |
| NFR-03 | Bounded list queries and representative local 500-concept plan inspection if relevant | CHECK-02, CHECK-08 |
| NFR-04–NFR-06; AC-10 | RLS/trusted RPCs, parameterized titles, deletion marker, minimum retained fields | CHECK-02, CHECK-04 |
| NFR-07 | Reuse existing stack and no new external dependency | CHECK-08; human diff review |

Recommended technical order, not task breakdown: use the accepted Q-03/Q-04 decisions to detail the persisted model and list-lock contract; add migration/RPC/typed results; implement focused round service and query state; integrate actions/dialogs/localization/styles; run focused checks and local workflow; review docs and privacy effects. If detailed anonymization analysis shows that the accepted Q-04 round summaries cannot be considered sufficiently anonymous, stop and revisit the global retention policy before implementation.

## 10. Shared documentation updates

- `spec.md`: records the accepted Q-03/Q-04 technical decisions for traceability; no other behavior change is proposed.
- `docs/architecture.md`: after approval, record the round/appearance relationship and anonymized-history consequence at a conceptual level; keep exact schema in the migration and this plan.
- `docs/app-flow.md` / `docs/design.md`: already aligned during clarification; update after implementation only if realized states differ from this approved plan.
- `docs/global-plan.md`: selected slice already links the spec and records clarification outcomes; update implementation state only after validation/closure, not from this plan.
- No `tasks.md`, code, migration, or test file is created at this stage.

