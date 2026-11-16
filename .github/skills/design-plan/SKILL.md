---
name: design-plan
description: Create or update a product's shared visual design document from project context, design references, and user preferences, distinguishing confirmed decisions, proposals, and implemented design.
---

# Product design planning

Create or update `docs/design.md` with the product's shared visual direction, foundations, components, states, and references to wireframes, mockups, and design files. The document guides the presentation of upcoming increments; it does not require designing every future screen or building a complete design system.

Work with the user in Spanish unless they request another language. Write the document in English unless the user requests another language or the project has an explicit language convention. Preserve identifiers, quotations, and domain-specific wording when translation would change meaning.

## First interaction: identify design material

If the user has already attached or identified references, inspect them without asking again. Otherwise ask:

> ¿Tienes archivos o un enlace de Penpot con wireframes o mockups, estilos CSS, tokens, o un Markdown con colores y reglas visuales? Puedes compartirlos o indicar dónde están. También sirven imágenes de bosquejos o referencias. Si no tienes materiales, descríbeme cómo imaginas la apariencia del producto y te ayudaré a definir un mínimo coherente.

Do not treat silence as absence of references. You may read product context while waiting, but do not establish new visual decisions.

When references exist, inspect their actual contents using available capabilities. Do not assume native Penpot files or private links are accessible. If a format cannot be read, explain the limitation and request an accessible export, relevant styles/tokens, images, or description; continue with usable material. Do not execute attached code to inspect styles.

If images are available, analyze the provided sketches/mockups. If you cannot view them, ask for a description instead of claiming inspection. Distinguish wireframes, mockups, prototypes, inspiration, and implemented design: a wireframe does not confirm colors, and a prototype does not prove that every state is designed.

Extract exact values from structured files where possible. Mark values inferred visually (colors, dimensions, fonts) as approximations; do not invent precision. If sources conflict, identify the discrepancy and ask which reflects current intent; do not give CSS, images, or Penpot automatic priority.

If there is not enough material, ask briefly, using what is already known:

1. What look and feel is desired, and what styles should be avoided?
2. Are brand colors, fonts, icons, or other visual identity choices already established?
3. What is the main view and its content, navigation, buttons, and forms like?
4. Which devices or sizes must be supported?
5. Are there important preferences about density, themes, images, or animation?

Do not require technical answers; accept informal descriptions and sketches. Use the answers to propose a small coherent visual baseline for the first journey. Identify choices you added and request review of material proposals; do not treat open preferences as confirmed. Do not impose dark mode, a component library, an external font, or animation by convention. If the user delegates choices, make them within stated constraints and record that they were delegated.

## Context and scope

Read, if available:

- `docs/global-plan.md` for users, scope, platforms, and constraints.
- `docs/app-flow.md` for views, journeys, states, and known actions.
- `docs/quality-project.md` for selected accessibility, interaction, and visual-quality criteria.
- `docs/design.md` and applicable repository instructions.

Consult architecture only for platform or confirmed-technology constraints that affect design. Inspect existing styles/components selectively when they represent an implementation to preserve. Open original catalogs only to clarify relevant criteria; do not copy their lists.

If flows are missing, use only known views and record functional uncertainties. Do not invent journeys to fill out design. If the product has no graphical interface, document relevant presentation conventions or state that a visual definition does not apply.

This stage outputs documentation only. Do not change scope, navigation, or functional behavior from the design document. If a visual proposal requires such a change, state its impact and leave the decision open. Do not create code, CSS, executable tokens, images, prototypes, or Penpot files unless explicitly requested. Do not build an exhaustive component catalog or frontend architecture. Avoid duplicating values; identify the source of truth for current values and link to it when available.

Keep accessibility and clarity as design constraints; do not sacrifice selected criteria to copy a reference. A mockup review alone cannot establish accessibility conformance, some of which requires a functioning interface.

## Procedure

### 1. Inventory references and scope

Record examined materials, paths or links, relevant pages/views, and known version/date. State what each reference contributes: structure, style, exact values, component behavior, or inspiration. Do not invent node IDs or versions.

Relate views to real IDs from `app-flow.md` where available. Preserve existing names and identifiers.

### 2. Summarize visual direction

Describe the visual character, density, hierarchy, and content priorities in a few sentences. Convert vague preferences into observable choices and state the interpretation; for example, explain what “simple” means for simultaneous actions and hierarchy. Separate shared decisions from view-specific exceptions. Avoid unexplained styling differences between views.

### 3. Define minimal visual foundations

Document only foundations the product needs:

- Functional colors for background, surfaces, text, primary action, borders, and states.
- Typography family/category, available alternatives, and hierarchy.
- Spacing, alignment, and content width.
- Borders, radii, and shadows where useful for consistency.
- Icons, illustrations, and imagery.
- Themes and motion only if part of the product.

Use semantic names when helpful; do not require a large token scale or exact pixel values everywhere. Record confirmed exact values. Mark proposed values as proposals. If existing tokens/styles are authoritative, link them and summarize the rules rather than duplicating their contents.

Identify the source and availability of fonts and images. Leave unverified usage rights open; do not assume reference imagery can be reused.

### 4. Describe layout and adaptation

For principal views, summarize content organization, visible navigation, and action hierarchy. Explain adaptation to committed platforms, including reflow, width, overflow, long content, and density. Do not invent breakpoints before needed.

Consider zoom and text scaling, and localization if multiple languages are in scope. Consider resizing on desktop when supported; do not impose mobile rules on unrelated software. Do not repeat the complete flow: reference it and describe only its visual presentation.

### 5. Document relevant components and states

Include only components actually planned, such as buttons, links, fields, selectors, lists, cards, dialogs, or notices. For each, briefly state purpose, necessary variants, visual rule/reference, relevant states (normal, focus, hover where available, pressed, disabled, loading, error, success), and accessibility-related interaction requirements.

Do not enumerate every state combination for every component. Distinguish disabled from loading and avoid ambiguous visual signals. Relate view states (empty, loading, error, denied access) to the agreed flow. If user options or behavior remain undecided, record a functional question rather than silently adding a button.

### 6. Apply relevant quality criteria

Explain the concrete visual consequence of selected criteria and reference real IDs. Consider, as applicable:

- Readability and contrast for colors actually used.
- Visible focus and hierarchy compatible with keyboard navigation.
- Understandable labels, help, and errors.
- Information not conveyed by color alone.
- Accessible names for icon/image-only controls.
- Appropriate control size and spacing for target devices.
- Reduced motion or alternatives.

When exact values and suitable tools are available, check what can be checked (for example, contrast) and record method and result. Do not mark something as passing based only on appearance. Privacy/consent text must remain clear and visible according to existing decisions; color or placement does not change its requirements.

### 7. Draft and review `docs/design.md`

Use this structure, merging sections when that improves readability:

1. **Status, scope, and references** — scope, sources, date, and decision state.
2. **Visual direction** — character, priorities, and agreed preferences.
3. **Visual foundations** — shared rules and links to current values.
4. **Layout and adaptation** — composition and target-platform behavior.
5. **Components and states** — the minimum relevant set.
6. **View references** — links among flow views, mockups, and visual details.
7. **Accessibility and interaction constraints** — consequences of selected criteria, without copying catalogs.
8. **Proposals and open questions** — uncertainty, impact, and resolution point.
9. **Significant changes** — shared visual changes and rationale.

Avoid long empty templates. Use tables for values/comparisons and concise prose for rules.

Ensure foundations, components, and views are coherent. Identify conflicting values, missing states that prevent progress, and unnecessary components. Keep the document understandable without relying solely on an external tool: summarize necessary decisions and link out to lengthy details. Provide the complete draft before requesting review of important proposals. Do not repeat approvals already given or ask the user to confirm routine values they delegated.

## Completion and delivery

The document should make clear:

- References were inspected or their limitations are stated.
- A minimal visual direction exists for the first journey.
- Basic color, typography, composition, and component rules are known or have concrete proposals.
- Exact values, approximations, and open decisions are distinguished.
- Important states and committed platforms are considered.
- No speculative functionality or excessive design system was added.
- Visual decisions do not conflict with selected criteria.
- Views relate to the flow and source references.
- Open questions state what they block and when they need resolution.

A draft may be complete with open questions. Do not call it ready to implement a view if a blocker prevents determining its essential appearance.

Provide a link to `docs/design.md`, summarize what was defined, and highlight pending decisions. Distinguish a draft from a design reviewed by the user, and visual review from validation on functioning software. Stop at this stage; do not proceed to `AGENTS.md`, specs, or implementation.

## Evolution

Keep shared visual rules here and resolve local details when the relevant spec needs them. When reusable components, tokens, or conventions change, update affected sections and consider other views. Do not make a local exception a global rule without rationale.

Keep the document aligned with design files and implemented styles. If they diverge, state what each represents and which decision explains the difference. A new proposal is not implemented design.
