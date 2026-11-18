# Chucao Web — Product Design

## 1. Status, scope, and references

**Status:** Visual baseline implemented for VS-01 and local VS-02/T10; future study views remain planned
**Date:** 2026-11-18
**Scope:** Shared visual direction, foundations, interface composition, reusable components, interaction states, accessibility constraints, and visual resources for the MVP study journey.

This document defines the shared visual direction. VS-01 and the VS-02/T10
shell, Access, Preferences, My Lists, List Detail, concept detail, and related
dialogs are implemented for local scope. The user confirmed manual review of
the final T10 visual/interaction changes on 2026-11-18; this is not a claim of
accessibility conformance or release-wide browser validation. Later study
views remain design guidance until their slices are implemented.

### References

- [`temp/design.md`](../temp/design.md): primary visual-design source, including palette, typography, layouts, components, timer scene, and review checklist.
- [`docs/global-plan.md`](./global-plan.md): product scope, responsive PC/Android target, Comfortaa, timer rules, localization, and confirmed capabilities.
- [`docs/app-flow.md`](./app-flow.md): views `VIEW-01` through `VIEW-11`, journeys, states, and navigation behavior.
- [`docs/quality-project.md`](./quality-project.md): selected criteria for keyboard use, focus, labels, contrast, reduced motion, touch targets, responsive behavior, and image alternatives.
- Existing implementation evidence: `src/main.tsx` loads Comfortaa through
  Fontsource and configures Mantine; the VS-01/VS-02 shell and list/concept
  views are in `src/App.tsx`, `src/app/app.module.css`,
  `src/features/lists/lists.module.css`,
  `src/features/concepts/concepts.module.css`, and `src/index.css`.

The design rules are not by themselves accessibility proof; the current
implementation has been reviewed manually for the validated VS-01 desktop and
mobile scenarios.

## 2. Visual direction

Chucao should feel warm, friendly, playful, and calm: an illustrated study notebook inspired by the forest rather than a generic productivity dashboard. The interface should keep the active concept and the next useful action visually dominant while using the chucao and forest scene as distinctive identity elements.

Shared visual characteristics:

- Cream background and light reading surfaces.
- Dark coffee-brown text, borders, icons, and solid offset shadows.
- Pastel action colors with clear semantic roles.
- List creation and concept addition share a centered dialog treatment with a
  cream header, light surface, warm dimmed backdrop, and centered actions.
- Add List uses the lilac action treatment; View and Edit use cyan. These
  actions use coffee-brown text and a stronger same-hue hover. Destructive
  actions use red tones and remain separately labelled.
- Rounded typography and generous reading space.
- Cards that make grouping and progress easy to scan.
- Nature illustrations used deliberately in access, empty states, and timed practice.

The visual system must remain understandable without color, illustration, sound, hover, or animation. Primary actions should be prominent but destructive actions should remain visually and structurally separated.

## 3. Visual foundations

### 3.1. Semantic color foundation

These are initial product values from `temp/design.md`. They are the shared baseline and must be checked for contrast in the implemented combinations before release.

| Semantic role | Initial value | Use |
|---|---:|---|
| App background | `#FFF5DB` | Main page and dialog background |
| Text and structure | `#5C2D00` | Main text, borders, icons, and solid shadows |
| Header accent | `#FFBF4F` | Header strip and identity details |
| List surface | `#BDF9FF` | List cards and list-related grouping |
| Practice surface/action | `#ECC9FF` | Draw, practice, and timer actions |
| Confirmation action | `#CDFAB4` | Create, save, and ordinary confirmation |
| Destructive action | `#FFC4C4` | Delete actions and destructive confirmation |
| Secondary action | `#FFFCA8` or cream | Back, cancel, and secondary navigation |
| Input surface | White or warm white | Text inputs and textareas |

Semantic variables should be the source of truth in implementation. Interaction variants must be derived centrally rather than redefined per view. Coffee-brown text remains the default text color on pastel surfaces.

Color must not be the only indication of status, selection, error, completion, or destruction. Text, shape, border, icon, or position must provide a second cue.

### 3.2. Typography

**Primary family:** Comfortaa, bundled through Fontsource. The existing implementation loads weights 400 and 700.

| Role | Initial size |
|---|---:|
| Application name | 32–40 px |
| Main screen title | 24–32 px |
| Section title | 18–22 px |
| Featured concept | 26–36 px |
| Body, form, and button text | Approximately 16 px |
| Supporting information | 14 px |
| Timer | 48–72 px, constrained by available space |

Body descriptions and notes should use approximately 1.5–1.65 line height and a moderate reading width. Comfortaa must be tested with long Spanish and English paragraphs before introducing a complementary font.

Long titles may wrap. Timer digits should remain visually stable using tabular figures when supported or a fixed-width arrangement.

### 3.3. Spacing, shape, and elevation

Use the shared initial spacing scale: **4, 8, 12, 16, 24, and 32 px**.

- Mobile side margins begin around 16 px.
- Cards and forms use 16–24 px internal padding.
- Sections use 24–32 px separation.
- Controls use approximately 1–2 px coffee-brown borders.
- Controls begin with 6–8 px radius; cards and dialogs with 10–12 px radius.
- Interactive buttons and cards may use an approximately 3 px right/down solid coffee-brown offset shadow without blur.
- Reading surfaces use less prominent elevation than action controls.

Values are initial design proposals and should be refined through visual and responsive review without creating local exceptions.

### 3.4. Icons, illustration, audio, and imagery

Icons must have accessible names when meaningful and must not replace visible labels for essential actions. Decorative illustrations require appropriate empty alternatives so they are not redundantly announced.

The forest timer scene uses SVG/vector layers, transparent raster images where needed, and the existing trunk illustration from Chucao Desktop when its reuse rights and source are confirmed. Audio remains optional and must never be required to understand completion.

#### Chucao asset request

When the corresponding views are prepared, **request the original chucao image resources created by the project owner**:

1. **Main/access and identity views:** the chucao artwork used in the primary visual presentation and empty states.
2. **Page icon:** the chucao artwork or approved derivative intended for the favicon and related browser identity.
3. **Flying animation:** the transparent resting and flight frames needed for the timer scene, including the two flight frames described in `temp/design.md`.

The request must occur before implementing each dependent view or animation. Do not substitute the current Vite favicon or invent replacement chucao artwork as if it were approved product identity. Record the received asset names, intended use, dimensions/formats, credits, and usage permission in the relevant implementation/specification record.

## 4. Layout and adaptation

### 4.1. Shared shell

After authentication, every current authenticated view uses a shared navbar. It has the Chucao bird and title at left, which return to My Lists, and a single destination-language toggle plus Preferences button at right. The navbar uses `#fdeab7`, defined by `--chucao-navbar` in `src/index.css`. Preferences opens a dialog with the signed-in email, sign-out, and Privacy entry. Access remains separate and keeps its existing language and privacy controls.

Keep the authenticated navbar compact on mobile. The Access language selector
and Privacy entry are centered. Preferences uses a centered bold title, a
centered sign-out action, and a contrasting close control. Long unspaced
concept titles and descriptions wrap within their cards and detail panels.
Successful list and concept actions use short stacked snackbars at the
lower-left; the notification surface overlays the page and does not reflow it.
A simple developer credit appears in the footer across Access, loading/error,
and authenticated views.

Use a full-width cream application canvas so desktop viewports do not expose
contrasting lateral strips. Constrain reading content, panels, and list grids
inside internal containers with an initial maximum width of approximately
900–1200 px. On mobile, use a single-column composition and compact
navigation. Essential actions must remain reachable without hover.

Layouts must accommodate:

- PC and Android browsers.
- Narrow and wide widths, including landscape orientation.
- Browser zoom and text scaling.
- Longer translated labels and validation messages.
- Long concept titles, descriptions, notes, and list names.
- Virtual keyboards and full-screen mobile forms/dialogs.

Cards may move from one column to two or more columns as space permits. Buttons may stack vertically on narrow screens. Reading areas remain moderately narrow on wide screens.

### 4.2. View presentation references

The functional behavior and transitions belong to [`docs/app-flow.md`](./app-flow.md). The following visual rules describe only presentation and action hierarchy.

| Flow view | Visual composition |
|---|---|
| `VIEW-01` Access | Cream surface, chucao identity art, application name, short explanation, one prominent “Continue with Google” action, centered language selector, centered privacy link, and the developer footer. Access remains outside the authenticated navbar. |
| `VIEW-02` My Lists | Shared authenticated navbar above one bordered panel containing centered title/context, shadowed list-name cards with practiced/total counts in an independently scrollable area, and a centered Add List action that opens a dialog styled like Add Concepts. A simple developer credit appears in the app footer. |
| `VIEW-03` List Detail | Short Back control at upper left, centered list title, a bordered scrollable list of concept names with right-aligned View actions, and one Add Concepts action below. |
| `VIEW-04` Add Concepts | Dialog matching the supplied desktop reference, with Individual/By Batch modes, persistent labels, pasted-batch review, accepted/omitted summary, and clear confirm/cancel hierarchy. |
| `VIEW-05` Concept Detail | One upper-left Back action to the collection, centered title, aligned description/edit form, centered Edit above Delete actions, and a destructive confirmation dialog; long unspaced text wraps without clipping. |
| `VIEW-06` Draw Result | Cream dialog over a warm darkened backdrop; concept centered; at VS-03 show the secondary “Back to list” action, then add the lilac “Practice” action when VS-04 is delivered. |
| `VIEW-07` Practice | Concept, forest scene, and clock are dominant. Mobile stacks navigation, scene, concept, clock, controls, and revealable description; PC may place description/notes in a side panel. |
| `VIEW-08` Practice Closure | Preserve concept context; show satisfaction selector, optional note, save status, and a clear completion action. Independent practice includes an optional free-text concept label before rating/note. |
| `VIEW-09` History | Practices and rounds sections, visible filters with reset, stacked mobile entries, aligned desktop columns, and explicit distinction between `0` and `Unrated`. |
| `VIEW-10` Settings | Group language, default duration, sound/volume, reduced motion, and credits/licences by purpose; immediate changes show their result and save state. |
| `VIEW-11` Account | Show available name/email and “Signed in with Google”; separate sign-out from account deletion; do not show password controls. |

VS-04 adds only timer controls and a concise Credits and Licenses section to the existing authenticated Preferences dialog. It does not introduce the full `VIEW-10` Settings surface; keep the credit content readable, localized, and consistent with the dialog's established visual treatment.

The timer design must reflect the confirmed behavior: duration is configured before starting, time cannot be added after starting, and reload/navigation/abandonment does not recover the active timer.

## 5. Components and states

The planned implementation uses Mantine, CSS Modules, CSS variables, React Hook Form, and a shared Mantine theme. This document defines visual responsibilities, not a component architecture.

| Component | Purpose and variants | Relevant states and requirements |
|---|---|---|
| Primary/secondary/destructive button | Main action, cancel/back, and delete confirmation | Normal, hover, pressed, keyboard focus, disabled, processing; destructive meaning is never conveyed by color alone |
| Google sign-in button | Provider-specific authentication action | Ready, redirecting, error/retry; retain Google identification and accessible name without inheriting generic action styling |
| Text input and textarea | List names, titles, descriptions, notes, labels | Normal, focus, invalid, disabled, processing; persistent labels, nearby help/errors, counters where limits apply |
| Number input and slider | Timer duration and volume | Valid/invalid, focus, disabled, saved/processing; duration is limited to 1–59 minutes |
| Switch | Sound and reduced motion | On/off, focus, disabled, saving; state must have text or accessible semantics |
| Tabs and filters | Pending/Seen, Active/Archived, History categories and filters | Selected state uses border/shape/text as well as color; reset filters is visible |
| Menu | Less frequent list/concept/account actions | Keyboard navigable, focus managed, destructive actions separated and clearly labelled |
| Modal/dialog | Draw result, forms, destructive confirmations, session notices | Focus enters and returns to origin; loading and error states are distinct; consequences are explicit |
| Progress indicator | Round progress | Numeric text accompanies the bar; progress is not represented by color alone |
| Satisfaction selector | Rating 1–5, explicit zero, and Unrated | Keyboard/touch usable; selected value is textual; `0` and `Unrated` are visually distinct |
| List/concept card or row | Scanable owned content and actions | Empty, loading, selected, seen/pending, error, and long-content states |
| Timer scene | Forest, chucao, clock, and completion state | Prepared, running, paused, finished, restarted, and reduced-motion alternatives |
| Notice/toast | Save confirmation, recoverable error, session expiry | Short confirmations may be transient; actionable errors remain visible; no success state before persistence completes |
| Add List/Add Concepts dialog | Create a list name or enter/review concepts | Cream header, light surface, centered action group, focused form labels/errors; cancel remains secondary and destructive confirmation uses red action styling |

Interactive targets should generally provide a 44–48 px touch area. Small icons may be visually compact when contained in a larger interactive surface.

## 6. View states and resource references

Shared data states are presented consistently across views:

- **Loading/checking:** concise progress indication without suggesting completion.
- **Empty:** explain what is absent and provide one concrete next action where applicable.
- **Processing:** identify the action and prevent duplicate submission.
- **Saved/success:** confirm the completed operation and update the affected content.
- **Validation error:** place an understandable correction message beside the affected input.
- **Recoverable error/offline:** preserve only data the flow explicitly retains and offer retry where meaningful.
- **Expired session:** explain that Google reauthentication is required; do not present unsaved values as saved.
- **Destructive confirmation:** identify the target and consequences; cancel is secondary and deletion is distinct.
- **Reduced motion:** retain timer, completion, and progress information with static or simplified presentation.

Resource dependencies:

| Resource | Current status | Required action |
|---|---|---|
| Chucao main/access illustration | Implemented for VS-01 as `src/assets/stand.png` | Reuse for Access and authenticated identity shell; confirm final artwork/rights before publication |
| Chucao favicon artwork | Implemented for VS-01 as `src/assets/icono.ico` | Reconfirm approved derivative, dimensions, and usage permission before publication |
| Chucao flight frames | `src/assets/fly1.png` and `src/assets/fly2.png`, owner-created and approved for VS-04 (confirmed 2026-11-18) | Use for the timer scene; no separate asset credit required |
| Trunk/forest element | `src/assets/tronco.png`, owner-created and approved for VS-04 (confirmed 2026-11-18) | Use in the timer scene; no separate asset credit required |
| Completion audio | `src/assets/chucao.wav`; user-confirmed source: Gabriel Morales, XC870902/xeno-canto, CC BY-NC-SA 4.0; noise reduction and fragment trimming | Include source/license attribution in README and Preferences before distribution; keep sound optional and independent of reduced motion |

## 7. Accessibility and interaction constraints

The design is constrained by `Q03`, `WEB03`, `WEB04`, and the relevant security/privacy criteria:

- Verify contrast for each actual text/control/background combination; the palette alone is not evidence of conformance.
- Provide visible keyboard focus that is not represented only by the solid shadow.
- Use persistent labels, accessible names, associated errors, and meaningful headings.
- Keep actions equivalent across keyboard, touch, and responsive layouts.
- Use at least 44–48 px interactive target areas for frequent controls.
- Express status, selection, error, completion, and destruction through text, shape, border, icon, or position in addition to color.
- Provide appropriate alternatives for chucao and forest imagery; do not redundantly announce decorative art.
- Keep reduced-motion presentation understandable and preserve the logical timer and completion message.
- Avoid continuous screen-reader announcements for every timer tick; announce relevant transitions such as pause and completion.
- Allow Spanish and English text to expand without clipping or fixed-width assumptions.
- Keep privacy information and account-deletion consequences clear and reachable; visual styling must not hide these responsibilities.

Contrast, keyboard, screen-reader, zoom, touch, and reduced-motion conformance require validation on functioning software. This document records constraints, not test results.

Mantine buttons use the CSS variables for base and hover background, text, and
border colors. View-specific CSS Modules set these variables so the
library's component styles do not restore the default blue/white treatment.

## 8. Proposals and open questions

| Question | Impact | Resolution point |
|---|---|---|
| Which exact color variants pass contrast for text, controls, disabled states, and focus indicators? | Determines final semantic tokens and accessible component variants. | Resolve during the design-system/specification pass and verify before UI release. |
| Does Comfortaa remain readable for long descriptions and notes in both languages? | May require a complementary reading font or adjusted measure/line height. | Resolve with representative content before implementing long-form views. |
| Which owner-created assets are approved for the main/access illustration and favicon? | Affects the existing identity art and browser icon; timer frames and trunk for VS-04 have been confirmed. | Resolve before publication of the affected identity resources. |
| What exact responsive breakpoints or layout thresholds are needed? | Affects when cards, buttons, panels, and navigation reflow. | Resolve through implementation prototypes and PC/Android checks; do not predefine unnecessary breakpoints now. |
| Should a complementary icon set be selected if Mantine defaults do not fit the illustrated identity? | Affects consistency of menus, status, and action affordances. | Resolve before building reusable action menus and icon-only controls. |
| What final compact representation should be used for `0`, `Unrated`, pending, seen, archived, and deleted historical content? | Affects scanability and language clarity across History and list views. | Resolve in the history and concept specifications while preserving the agreed semantics. |

The following are not open product-behavior decisions here: responsive PC/Android support, Spanish/English support, Google-only access, the timer duration range, no post-start added time, no active-timer recovery, and the existence of reduced-motion behavior are already established elsewhere.

## 9. Significant changes

| Date | Change | Rationale |
|---|---|---|
| 2026-11-18 | Updated VIEW-06 to stage its actions: Return to List at VS-03 and Practice when VS-04 is delivered. | Keeps the visual action hierarchy aligned with the selected slice boundaries without showing an inactive control. |
| 2026-11-18 | Recorded the validated VS-02/T10 shared navbar, Preferences and list-creation dialogs, list/concept layouts, progress count, footer, and semantic action/hover colors. | Carries reusable visual decisions into future views while keeping later study screens planned and accessibility/release conformance unclaimed. |
| 2026-11-16 | Created the visual design baseline from `temp/design.md`, the global plan, application flow, quality criteria, and existing Mantine/Comfortaa evidence. | Establishes a shared visual direction without implementing the interface or claiming validation. |
| 2026-11-16 | Recorded the owner-created chucao asset request for the main presentation, favicon, and flying animation resources. | Prevents placeholder or invented artwork from becoming an unapproved product identity and identifies the assets that block dependent views. |
| 2026-11-16 | Aligned timer presentation with the confirmed no-recovery and no-add-time behavior. | Keeps the design document consistent with the current global plan and application flow rather than obsolete source proposals. |
| 2026-11-17 | Implemented and reviewed the VS-01 visual foundation: full-width cream canvas, coffee-brown structure, solid offset shadows, Comfortaa, responsive panels/cards, `stand.png`, and `icono.ico`. | Establishes the reusable visual base for later slices and records the desktop lateral-background correction and shared language-selector presentation. |
