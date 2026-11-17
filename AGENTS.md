# Chucao Web Agent Instructions

## Project

Chucao Web is a responsive React application for organizing private concept lists
and practicing oral explanations. The repository is in early development: the
current code contains a minimal Google/Supabase session proof, while domain
lists, persistence, RLS, localization, and the complete study journey remain
planned or under construction.

The confirmed product and architecture context lives in `docs/global-plan.md`,
`docs/architecture.md`, `docs/app-flow.md`, `docs/design.md`, and
`docs/quality-project.md`. Treat planned behavior as requirements, not as
evidence that it is implemented.

## Commands

Run commands from the repository root. Dependencies must be installed first
with `npm install`; local Supabase commands require Docker and the configured
local environment.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run the TypeScript project build and create the Vite production artifact. |
| `npm run lint` | Run Oxlint with the repository configuration. |
| `npm run preview` | Serve the previously built production artifact locally. |
| `npx supabase start` | Start the configured local Supabase services when database/Auth work requires them. |

`package.json` currently has no test or formatter script. Do not invent a
replacement command or install testing infrastructure for a documentation task.
The frontend requires the public Supabase URL and publishable key through the
repository's Vite environment configuration; never put privileged credentials
in the client or committed files.

## Conventions and boundaries

- Keep user-facing product behavior available in Spanish and English. Preserve
  user-authored text; do not translate list names or future study content.
- Follow the existing React, TypeScript, Vite, Mantine, CSS Modules, Supabase,
  React Hook Form, TanStack Query, and i18next decisions. Reuse existing
  patterns before adding dependencies or abstractions.
- Use the authenticated Supabase Auth UUID as the ownership identity. Private
  data must be protected at the trusted Supabase/database boundary; UI hiding
  is not authorization.
- Keep Google OAuth and Supabase session handling managed by the confirmed
  provider flow. Do not add application-managed passwords, privileged keys, or
  secrets to browser code.
- Preserve unrelated working-tree changes. Never reset, revert, or overwrite
  work that was not created for the current request.
- Keep changes within the requested slice or task. Do not expand functionality
  to later slices, weaken requirements, disable checks, or change requirements
  to match an incorrect implementation.
- Before destructive actions, publication, production access, real-user data,
  or external side effects, confirm that the request authorizes that action.

## Active work

1. Use the spec and task named in the current request.
2. If none is named, consult the repository's existing tracking mechanism.
3. If exactly one unambiguous candidate exists, identify it before changing code.
4. If there are multiple candidates or insufficient information, ask before
   changing code.

Do not select work by highest folder number, newest date, or first unchecked
item. For implementation, read the selected `spec.md`, its `plan.md` and
`tasks.md` when they exist, and the dependencies or decisions they reference.
Documentation work does not require inventing an active implementation task.

## Read as needed

| Work | Read relevant context |
| --- | --- |
| Scope or slice selection | `docs/global-plan.md` and the selected spec |
| Shared technical decisions | Affected sections of `docs/architecture.md` |
| Navigation, states, or interaction | Relevant sections of `docs/app-flow.md` |
| Presentation and responsive UI | Relevant sections of `docs/design.md` |
| Persistence and ownership | Architecture ownership rules and `supabase/` migrations/schema |
| Increment quality | Applicable rows in `docs/quality-project.md` and `docs/catalog/quality.md` |
| Data, providers, or exposure | Global privacy decisions and `docs/catalog/data-protection.md` |
| Verification planning or review | `docs/catalog/verification.md` and the selected spec |
| Scope or quality changes | Global plan, quality project criteria, and affected catalog sections |

Read only the additional files needed for the requested change. Verification
criteria belong in the spec, technical plan, and tasks; do not create a
verification file for every spec.

## Verification and completion

Run the smallest applicable repository checks for the change and scale them to
risk. For implementation, check affected behavior, persistence, authorization,
accessibility, error states, and regressions as applicable. For documentation
only, do not run unrelated suites merely to produce evidence.

Report concisely:

- What changed and which spec/task/criterion it addresses.
- Checks run and whether they passed, failed, were skipped, or were not run.
- What remains unverified or blocked.
- Any decision or human review still required.
- Which documentation or task state was updated.

Do not claim implementation, compliance, or release readiness from a plan,
configuration, dependency, or intended future check alone.
