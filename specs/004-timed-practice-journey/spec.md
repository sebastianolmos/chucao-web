# VS-04 Timed Practice Journey

## 1. Status and references

| Field | Value |
|---|---|
| Spec ID | `004` |
| Slice | `VS-04 Timed practice journey` |
| State | Ready for technical planning |
| Capabilities | CAP-05, CAP-06, CAP-09, CAP-12 (timer preferences, partial) |
| Language | Product interface remains available in Spanish and English; user-authored concept text is not translated. |

Acceptance-defining references:

- `docs/global-plan.md`, sections 3–8 and **Selected slice: VS-04 Timed practice journey** — capability coverage, inclusion/exclusion, privacy controls, dependencies, and demonstration.
- `docs/app-flow.md`, `VIEW-06`, `VIEW-07`, `FLOW-05`, `FLOW-06`, and section 6 — entry points, associated and independent timer behavior, abandonment, and account preferences.
- `docs/design.md`, sections 3, 4 (`VIEW-06`, `VIEW-07`, `VIEW-10`), 5 (timer scene and controls), 6 (states and resources), and 7 — visual hierarchy, responsive composition, accessibility, reduced motion, and asset constraints.
- `docs/architecture.md`, sections 2, 4, 6, and 7; `ARCH-06` — account preference ownership, transient timer boundary, 1–59 minute range, and one responsive client.
- `docs/quality-project.md`, Q01–Q06, SEC01, SEC03, SEC04, SEC08, SEC10, WEB03, WEB04; `docs/catalog/data-protection.md`, DP02, DP10, DP12–DP14; `docs/catalog/verification.md`, V01, V03–V10.
- Chucao Desktop `README.md` at `https://github.com/sebastianolmos/chucao/blob/main/README.md`, consulted 2026-11-18 — source, author, modification, and license statement for `src/assets/chucao.wav`.
- Repository `README.md`, section **Licencia y créditos** — local attribution for the project creator, Comfortaa, and timer audio; exact upstream README blob SHA `a721a10598af41f798d71e009aa0ca8fea531022` was consulted for the source wording.
- Existing product behavior to preserve: `specs/001-account-and-first-private-list/spec.md`, `specs/002-concept-management/spec.md`, and `specs/003-persistent-round-and-selection/spec.md`.

The app-flow and design documents define acceptance constraints. Existing VS-01–VS-03 screens provide the visual and interaction style to reuse; VIEW-07 itself is planned and is not evidence of an implemented timer screen.

## 2. Context and objective

VS-01–VS-03 provide sign-in, private lists and concepts, and a persistent round with a Draw Result. This slice lets an authenticated person focus on explaining one selected concept or use an independent timer, control the timer, and reach a clear completion state. The animation and optional sound follow the timer's logical state.

The timer is a transient browser activity. VS-04 does not create a practice record when the timer completes or is abandoned. Saving completed practices, labels for independent practices, notes, ratings, and history belong to VS-05.

## 3. Actors and preconditions

- **Primary actor:** an authenticated Chucao user.
- For associated practice, the user has reached Draw Result for a selected active concept in an owned list. The concept title and optional description are user-authored content.
- For independent practice, the user starts the Independent Timer entry from My Lists without a list or concept context.
- The application can reach Supabase to read or update the user's account preferences. Timer controls remain usable in the current view if a preference write fails; the UI must distinguish a local change from a confirmed saved preference.
- The supported product context is the existing responsive PC and Android browser application in Spanish or English. Broader release compatibility evidence remains VS-07.
- Local development and acceptance use synthetic accounts and concepts.

## 4. Scope and exclusions

### Included

- Add Practice to the existing Draw Result and provide an Independent Timer entry from My Lists.
- Add a localized Credits and Licenses section to the existing Preferences dialog, limited to project and media attribution needed by this slice.
- Run an associated or independent timer with a selected duration from 1 through 59 minutes, inclusive.
- Use the saved account default duration as the initial duration when available; allow the user to choose a different duration before starting.
- For an account without saved timer preferences, use a 1-minute initial duration, enabled completion sound, and volume 50 on the user-facing 0–100 scale. When no account reduced-motion value is saved, honor the browser/system reduced-motion preference when available; otherwise use full animation.
- Start, pause, resume, and restart the timer. Restart requires confirmation and resets the current timer to its selected full duration. Added time is unavailable after start.
- Initially conceal an associated concept's description and allow the user to reveal or conceal it voluntarily. Independent practice has no concept description.
- Show a timer-synchronized Chucao scene, provide an optional completion sound according to the user's sound preference, and communicate completion in text.
- Expose account-level timer preferences for default duration, sound, volume, and reduced motion through the existing authenticated Preferences entry point, preserving its existing account, privacy, locale, and sign-out behavior.
- Keep all timer and preference interactions localized, responsive, keyboard-operable, and consistent with the existing Chucao visual and interaction style.
- Treat navigation away, reload, loss of session, or changing browser/device as abandonment. The active timer is not recovered and creates no practice/history record.

### Excluded

- Saving a completed practice or independent label; notes, satisfaction rating, Practice Closure actions, and practice/history views (VS-05).
- Any persistence or synchronization of active timer state, including across reloads, tabs, browser instances, or devices (CAP-14).
- Adding time after the timer starts, additional timer modes, list organization, public sharing, deployment, and release-wide browser validation.
- Changing the existing authentication, list, concept, round, or Draw Result behavior except for adding the Practice action after a successful draw.
- Introducing analytics, telemetry, tracking, or new device storage for timer activity.

## 5. User scenarios

### US-01 — Practice a selected concept

As an authenticated user who has drawn a concept, I want to practice with its description initially hidden and reveal it when I choose, so that I can attempt an oral explanation before consulting the description.

### US-02 — Use an independent timer

As an authenticated user, I want to start the same timer without choosing a list or concept, so that I can time an independent oral practice.

### US-03 — Control the timer and finish

As a user in either timer mode, I want to start, pause, resume, restart, and see a clear completion result so that the timer supports my practice without recording an abandoned or unsaved session.

### US-04 — Keep timer preferences across devices

As an authenticated user, I want my timer preferences to be associated with my account so that the same settings are available when I sign in on another supported device.

## 6. Functional requirements

### FR-01 — Entry and context

When the user chooses Practice from a successful Draw Result, the system shall open VIEW-07 with that result's concept context. When the user chooses Independent Timer from My Lists, the system shall open VIEW-07 without list or concept context. The two modes shall use the same timer behavior.

If an associated concept context is no longer available or the user's session is no longer valid, the system shall not start a timer against stale or unauthorized content and shall show a localized recovery/continuation state.

### FR-02 — Initial duration and pre-start selection

VIEW-07 shall start with the user's saved default timer duration when one exists. The user may choose a different duration before starting. Only whole-minute values from 1 to 59 inclusive are valid. An invalid value shall be rejected with a localized message; it shall not start a timer or change the saved default preference.

Changing duration for one timer session shall not silently overwrite the account default. The default changes only through the timer preferences control and takes effect on the next timer session; it shall not alter a prepared, running, paused, or completed session that is already open. The user may still adjust the selected duration directly in a prepared VIEW-07 session.

### FR-03 — Timer state transitions

The timer shall have prepared, running, paused, and completed states. The user shall be able to start from prepared, pause a running timer, resume a paused timer, and restart a prepared, running, paused, or completed timer after confirming the reset. Confirmed restart returns the timer to the full currently selected duration; cancellation leaves the timer state and remaining time unchanged.

The timer shall reach completion once when its remaining time reaches zero. It shall not accept added time after start. Elapsed time, rather than animation frames or UI refresh frequency, determines the logical remaining time. Pausing freezes elapsed-time accumulation; resuming continues from the remaining time. The timer continues to elapse while the page is backgrounded or the device is locked; when the page becomes active again, the displayed state shall reflect actual elapsed time, including completion when zero has passed.

### FR-04 — Associated concept presentation

In associated mode, VIEW-07 shall identify the selected concept and initially conceal its description. The user may reveal and conceal the description without changing timer state. Concept text shall be displayed as text, not interpreted as markup. The independent mode shall not show a concept or description placeholder.

### FR-05 — Completion scene and sound

While the timer is running, the Chucao scene shall represent progress in synchronization with the logical timer state. Pausing freezes its logical progress; resuming continues it; restart returns it to the beginning. At completion, the scene shall reach its destination and the interface shall announce or display a clear textual completion state.

The timer shall use the owner-created visual assets `src/assets/fly1.png`, `src/assets/fly2.png`, and `src/assets/tronco.png`, which the user confirms are approved for Chucao Web and need no separate asset credit. The completion sound shall use `src/assets/chucao.wav`, recorded by Gabriel Morales (XC870902, xeno-canto) under CC BY-NC-SA 4.0. The clip has been modified by noise reduction and fragment trimming; the edited audio and timer audiovisual sequence are distributed under CC BY-NC-SA 4.0 and excluded from MIT. Required attribution shall be available from Preferences and the repository README as specified in FR-10.

When completion sound is enabled, the system shall attempt to play it once on completion, subject to browser restrictions. Sound or animation failure, suppression, or delay shall not prevent or misrepresent logical timer completion. Sound is optional and shall not be required to understand timer state. The completed state shall provide a clear return action to List Detail for associated practice or My Lists for independent practice. The user may also restart the timer under FR-03. No practice closure/save actions are introduced.

### FR-06 — Abandonment and non-persistence

When the user invokes in-app navigation away from a running or paused VIEW-07 timer, the system shall ask whether to continue the timer or leave and abandon it. Choosing to continue shall keep the user in VIEW-07 with the timer state intact; a running timer continues to elapse while the confirmation is open. Choosing to leave shall abandon the timer. Leaving from a prepared or completed timer shall not require confirmation. Reloading, closing the browser, losing the authenticated session, or changing browser/device abandons the active timer without recovery; browser-controlled reload/close confirmation is not guaranteed. Completion or abandonment shall not create, update, or imply a saved practice, note, rating, or history entry in VS-04.

Timer progress and active-session details shall not be persisted to the database, browser storage, URL, or analytics/telemetry. Account-level timer preferences are the only new persistent values in this slice.

### FR-07 — Account timer preferences

The authenticated user shall be able to set and save their default duration, sound enabled state, sound volume, and reduced-motion preference from the existing Preferences entry point. The volume control shall be labelled on a user-facing 0–100 scale, where 0 is silent and 100 is the application's maximum. Its internal output mapping shall use a logarithmic decibel scale from mute through −60 dB to 0 dB; the account's initial value shall be 50. Preferences shall include an explicit control to preview the current completion sound at the selected volume, even when completion sound is disabled. Preview requires an explicit user action and shall not change the saved sound-enabled preference. These values shall be private to the user's authenticated account and available on the same user's supported devices. For an account with no saved timer preferences, the initial duration shall be 1 minute, completion sound shall be enabled, and volume shall start at 50 on the user-facing scale. When no account reduced-motion value is saved, the system shall honor the browser/system reduced-motion preference when available; otherwise it shall default to full animation. An explicitly saved account value shall override the system preference and be used across that user's supported devices.

Preference changes shall be written and report their save state in the current browser, but changes to default duration, sound, volume, or reduced motion shall affect only timer sessions entered after the change. They shall not alter a prepared, running, paused, or completed timer session that is already open, including when Preferences is opened during that session. If persistence fails, the selected preference shall remain visible and be marked unsaved with a retry option; it shall not report the preference as saved. A failed preference read shall not block use of the timer with the initial defaults defined above.

Only the allowed preference fields and values may be changed. The user shall not read or update another account's preferences through any application or direct data interface.

### FR-08 — Localization, responsive behavior, and accessible interaction

The timer, preference controls, validation, confirmations, completion, and recovery states shall be available in Spanish and English. Changing language shall preserve the current timer state and any unsaved local preference interaction, consistent with the existing locale behavior.

All controls shall have persistent labels or accessible names and visible keyboard focus. Timer changes shall be communicated without announcing every second continuously; important transitions such as pause, resume, restart, and completion shall be available to assistive technology. Frequent touch controls shall meet the shared 44–48 px target guidance. In reduced-motion mode, the Chucao shall remain still in its resting position while timer progress and completion remain understandable; full animation shall run when reduced motion is off.

### FR-09 — Truthful operation states

The interface shall distinguish initial preference loading, saving, saved, recoverable preference read/write failure, invalid duration, restart confirmation/cancellation, timer paused, timer completed, and unavailable/expired context. It shall not show a preference as saved before persistence succeeds, or show completion before the logical timer reaches zero.

### FR-10 — Credits and licenses

The existing Preferences dialog shall provide a localized, accessible Credits and Licenses section. It shall identify Sebastian Olmos as project creator; Comfortaa © 2011 The Comfortaa Project Authors under SIL OFL 1.1; and the Chucao sound by Gabriel Morales, XC870902/xeno-canto, under CC BY-NC-SA 4.0. It shall identify the audio modifications (noise reduction and fragment trimming) and state that the edited audio and timer audiovisual sequence are distributed under CC BY-NC-SA 4.0 and excluded from MIT. The relevant source and license links shall be available. The owner-created timer illustrations do not require separate attribution. The root README shall carry the corresponding attribution before distributing the audio or audiovisual sequence.

## 7. Applicable non-functional requirements

| ID | Requirement | Source and when required |
|---|---|---|
| NFR-01 | Reuse the current authenticated shell, navigation, locale toggle, Preferences dialog, CSS Modules, Mantine theme, Chucao colors/typography, and established form/dialog/error conventions. VIEW-07 follows the design hierarchy: concept, forest scene, and clock dominate; mobile stacks navigation, scene, concept, clock, controls, and revealable description; PC may place the description in a side panel. Do not redesign other views. | `docs/design.md` sections 3–6; `docs/app-flow.md` VIEW-06/VIEW-07. Required for this UI slice. |
| NFR-02 | Keep concept content and account preferences private to the authenticated owner; enforce preference ownership at the trusted data boundary, not only through hidden UI. | SEC01, SEC04; DP10. Required when preferences are persisted. |
| NFR-03 | Bound timer updates and exposed values; reject durations outside 1–59 minutes, keep preference fields allowlisted, and avoid unbounded animation/audio work. | Q04, SEC08. Required for this slice and before publication. |
| NFR-04 | Do not expose concept text, account data, credentials, or session details through errors, URLs, logs, browser storage, or diagnostic output. No privileged key may reach the client. | Q06, SEC10; DP02, DP13. Throughout implementation; release bundle review remains VS-07. |
| NFR-05 | Use accessible semantics and alternatives for Chucao artwork; essential timer state is available without color, animation, or sound. Keep page language and UI text correct in Spanish and English. | Q03, WEB03, WEB04. Required for this UI slice; supported-browser release review remains VS-07. |
| NFR-06 | Preserve account-level preference privacy, minimize persistent data to those preferences, and keep their retention consistent with account deletion and provider backup rules. Do not add telemetry or tracking. | DP02, DP10, DP12–DP14. Required when the changed preference processing is enabled. |
| NFR-07 | Credit third-party media in the repository README and the existing Preferences credits section before distributing it. Include Gabriel Morales, XC870902/xeno-canto, CC BY-NC-SA 4.0, the noise-reduction and fragment-trimming modifications, and that the edited audio and timer audiovisual sequence are excluded from MIT. Also credit Sebastian Olmos as project creator and Comfortaa © 2011 The Comfortaa Project Authors under SIL OFL 1.1. User-created timer illustrations need no separate attribution. | User-confirmed licensing and attribution requirement. Required in this slice and before distributing the audio or audiovisual sequence. |

## 8. Errors and boundary cases

- **Duration below 1 or above 59 minutes:** reject without starting or changing the saved default (FR-02).
- **Invalid/incomplete duration input:** keep the user in prepared state and identify the correction in the current language (FR-02, FR-09).
- **Restart cancellation:** preserve remaining time and timer state (FR-03).
- **Preference read failure:** show a recoverable error, do not claim account preferences loaded, and allow timer use with the initial defaults defined in FR-07 (FR-07, FR-09).
- **Preference write failure or timeout:** retain the current local value, mark it unsaved, and offer retry; retry shall not duplicate or corrupt the preference (FR-07, FR-09).
- **Session expiry while active:** abandon the timer without recovery or practice record and provide the existing session continuation/sign-in behavior (FR-01, FR-06).
- **Concept unavailable or unauthorized:** do not display stale private content or start associated practice; offer a localized return/reload/reauthentication path as applicable (FR-01).
- **Browser throttles or blocks sound:** logical completion remains visible; sound is not represented as having played unless the browser reports success (FR-05).
- **Page backgrounded or device locked:** elapsed time continues; on return, recalculate and display current state, including completion (FR-03).
- **Navigation, reload, or browser/device change:** abandon the active timer; reopening starts a fresh prepared timer using the saved preference, with no prior remaining time or practice record (FR-06).
- **In-app navigation while running or paused:** ask whether to continue or abandon. Cancelling keeps the current state and a running timer continues; confirming leaves VIEW-07 and abandons it (FR-06, FR-09).

## 9. Flows and design references

- **Entry:** `docs/app-flow.md`, VIEW-06 and FLOW-05 for associated practice; My Lists and FLOW-06 for independent timer. Draw Result gains Practice only after VS-04 is available.
- **Timer:** `docs/app-flow.md`, VIEW-07, FLOW-05, FLOW-06; duration is changed before start, reset requires confirmation, and leaving/reloading abandons without recovery.
- **Preferences:** existing authenticated Preferences dialog and shared interaction rules in `docs/app-flow.md` section 6; its existing locale, privacy, identity, and sign-out behavior remains intact. Add only the four timer preference controls in this slice.
- **Visual presentation:** `docs/design.md`, VIEW-06/VIEW-07/VIEW-10 in section 4, timer-scene and number/switch controls in section 5, view states and resource table in section 6, and accessibility constraints in section 7.
- Preserve the implemented VS-02/VS-03 shell, navigation, buttons, dialogs, feedback, spacing, colors, typography, and responsive conventions. Use the timer-specific composition above rather than copying the list/concept layouts.
- Use decorative art without redundant screen-reader announcements; provide appropriate alternatives for meaningful Chucao imagery. Do not rely on animation or sound to convey progress or completion.

## 10. Acceptance criteria

### AC-01 — Associated timer journey

Given an authenticated user has a successful Draw Result for an active concept with a description, when they choose Practice, the timer opens in associated mode with the description hidden. The user can reveal it, choose a valid duration, start, pause, resume, confirm restart, and let the timer reach zero. The visible result identifies completion and the scene reaches its destination; the completion sound is attempted once only when enabled. The completed state offers return to List Detail or restart. No practice/history record is created.

### AC-02 — Independent timer journey

Given an authenticated user is on My Lists, when they choose Independent Timer, the same duration and timer controls are available without a concept or description. Completion is visible and offers return to My Lists or restart. It creates no practice, label, note, rating, or history entry.

### AC-03 — Boundaries and timer transitions

Given the timer is prepared, values 1 and 59 minutes are accepted and values below 1, above 59, or non-whole values are rejected without starting. Pause freezes remaining time; resume continues from it; cancelling restart preserves it; confirming restart restores the full selected duration. Completion occurs once at zero and no post-start time is added.

### AC-04 — Abandonment

Given a timer is running or paused, when the user invokes in-app navigation, they can stay in the timer or confirm abandonment. Staying preserves the state and a running timer continues to elapse. Confirming abandonment, reloading, losing the session, or returning from another browser/device does not recover the old timer and creates no practice/history record. A fresh entry begins in prepared state using the account default if available. Navigation from prepared or completed state does not require an abandonment confirmation.

### AC-05 — Preferences persist privately

Given synthetic users A and B, when A changes timer preferences and the persistence operation succeeds, A sees the saved state after reload and on another supported session. B cannot read or change A's preferences directly or through the UI. An invalid field/value is rejected without changing A's stored preferences.

### AC-06 — Preference failure and retry

Given preference read or write failure, the interface identifies the failure and does not claim the account value is saved. A write failure leaves the selected value visible in Preferences and offers retry; a successful retry updates the account preference without duplicate or partial values. Preference changes apply to later timer sessions only and do not alter a timer session already open.

### AC-07 — Locale, accessibility, and reduced motion

Given either Spanish or English and a supported PC or Android viewport, the user can operate the journey by keyboard and touch with visible focus and understandable labels/errors. Language change preserves timer state. When there is no saved account setting, the browser/system reduced-motion preference determines whether the bird remains still or the full animation runs; if unavailable, full animation runs. An explicitly saved account setting overrides the system preference and applies across that user's supported devices beginning with the next timer session. Reduced motion retains timer/progress/completion meaning; screen-reader output announces meaningful transitions rather than every tick.

### AC-08 — Sound and visual resource failure

Given sound is disabled, blocked, unavailable, or delayed by the browser, the timer still completes and communicates completion. Given animation resources fail to load or reduced motion is enabled, the user still has a textual/numeric progress and completion state. No unapproved asset is packaged.

### AC-09 — Privacy and minimal persistence

Given timer activity and account preference operations, only the four timer preference values may be persisted by VS-04. No timer progress, concept text, practice content, or session detail is written to browser storage, URLs, diagnostics, or telemetry. Errors do not expose credentials or another user's data, and the client contains no privileged key.

### AC-10 — Preview the completion sound

Given the user is in Preferences, the 0–100 slider shows the selected volume and changes it using the logarithmic decibel output scale. At 0 the output is silent; at 100 it is at the application's maximum. Activating the sound-preview control attempts to play the current completion sound once at the selected volume, including when completion sound is disabled; at 0, it remains silent. Preview does not start, pause, complete, or change a timer, and does not alter the saved sound-enabled preference.

### AC-11 — Background and locked-device timing

Given a timer is running, when the page is backgrounded or the device is locked for part or all of its remaining duration, the timer continues to elapse. On return, the displayed remaining time reflects elapsed time, or the timer is completed if zero has passed. Browser restrictions may delay or suppress the completion sound but do not pause or change logical completion.

### AC-12 — Preferences do not alter an open session

Given a timer session is already open, when the user changes default duration, sound, volume, or reduced-motion preference in Preferences, the selected values are saved for later timer sessions and the open session retains the values it had on entry. Changing the session duration directly in prepared VIEW-07 remains available and does not overwrite the account default.

### AC-13 — Credits and license attribution

Given the user opens Credits and Licenses from the existing Preferences dialog, the section identifies the project creator, Comfortaa authors/license, Chucao sound source/license, audio modifications, and the CC BY-NC-SA 4.0 license and MIT exclusion for the edited audio and timer audiovisual sequence. Links to xeno-canto and the licenses are usable in Spanish and English. The root README contains the corresponding attribution before media distribution.

## 11. Dependencies and shared constraints

- VS-01–VS-03 authenticated session, private lists/concepts, Draw Result, localization, and responsive shell are available locally; this spec does not claim they are production-ready.
- Timer state remains client-only per `docs/architecture.md`, ARCH-06. Account timer preferences extend the existing profile preference set and must remain private to the Auth UUID.
- The user confirms `src/assets/fly1.png`, `fly2.png`, and `tronco.png` are their own and approved for reuse without special credits. The user also confirms `src/assets/chucao.wav` as the completion sound and the credit/license terms in Chucao Desktop's README. The repository README records the creator, font, audio source, modifications, and license exclusion. The user approved a minimal in-app Credits and Licenses section within the existing Preferences dialog; this does not add the full future Settings view.
- Browser background/locked-device restrictions may delay or suppress sound. The application guarantees logical timer state; browser-specific audio timing must be reviewed before release and is not promised universally.
- No telemetry, analytics, or new browser storage is in scope. If later added, reassess DP07 and update this spec before enabling it.
- Verification planning shall select only the smallest checks that protect durable timer transitions, duration boundaries, preference persistence/ownership, and the integrated entry-to-completion behavior. It shall not require an automated test for every requirement. Visual, audio, keyboard, assistive-technology, and responsive evidence may use focused human review where automation adds no meaningful evidence; exact methods and commands belong in `plan.md`.

## 12. Completion criteria

- All functional and non-functional requirements have acceptance evidence for the associated and independent paths.
- The selected local end-to-end journey works with synthetic accounts and real local Supabase persistence for preferences.
- Timer state remains transient; no saved practice or history effect occurs in VS-04.
- Existing authenticated shell, locale behavior, private data access, and VS-03 draw behavior remain intact.
- Preference ownership, allowed values, error/retry behavior, reduced motion, and truthful completion are verified.
- Timer preference defaults and behavior are resolved; approved asset sources/rights are confirmed; README and in-app attribution are specified and required before media distribution.
- Focused manual review confirms the practice view follows the shared Chucao visual style and PC/mobile composition; broader release compatibility remains VS-07.

## 13. Open questions

No product-level clarification questions remain. Timer state, preferences, credits, asset ownership, and post-completion navigation are defined. Technical implementation choices and the exact animation composition remain for the technical plan; media attribution is required before distribution.

