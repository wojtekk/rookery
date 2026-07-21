# Implementation Plan: Fix Row Directory Tooltip Clipping

**Branch**: `020-fix-row-tooltip-clip` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-fix-row-tooltip-clip/spec.md`

## Summary

A repository (or worktree) row's directory-path tooltip (`.name[data-tip]`,
set to `entry.fullPath` in `table.ts`'s `buildRow`) has no upward-flip logic,
so on whichever row is last **visible** in a scrolled or short-window table,
it renders downward past `.list`'s bottom edge and is clipped/hidden — the
exact bug the user hit and screenshotted.

The app already has a proven fix for this identical problem, built for the
delete/action/warning/duplicate row icons under feature 012 (and reused by
013/017/019): a `mouseover`-delegated `positionRowIconTooltip()` in
`renderer.ts` measures the icon's remaining space inside `.list`'s visible
bounds and toggles a `.tip-up` class, which a generic `.tip-up[data-tip]:hover
::after` CSS rule flips upward. That rule is already element-agnostic — it
matches any element carrying `.tip-up`, not just the four icon classes. The
only reason `.name` doesn't already benefit from it is that the delegated
listener's `target.closest(...)` selector
(`'.row-delete-ico, .row-action-ico, .row-warn-ico, .row-dup-ico'`) never
lists `.name`.

Technical approach: **renderer-only, one-line extension of an existing
mechanism** — add `.name` to that `closest()` selector so `.name`'s tooltip
is measured and flipped exactly like the other four. No new CSS rule, no new
function, no new state: the generic `.tip-up[data-tip]:hover::after` rule and
`positionRowIconTooltip()`'s logic already handle any element unmodified.
This also automatically covers worktree rows (FR-004): `.wt .name` is the
same `.name` class, just nested under a `.wt` row.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled per `tsconfig.renderer.json`; CSS in `src/renderer/styles.css`

**Primary Dependencies**: Electron 40 (renderer process, Chromium engine); no new runtime dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`; this fix is
DOM geometry + CSS positioning with no new pure/branching logic (the change
is a one-line addition to an existing selector string), so it is validated
manually via `quickstart.md`, consistent with how feature 012 (the mechanism
this reuses) and feature 019 (the most recent tooltip fix) were verified.

**Target Platform**: Desktop (Electron) on the user's local OS — macOS,
Windows, Linux, rendered by Electron 40's bundled Chromium

**Project Type**: Single-project desktop app (Electron main + renderer); this
fix touches one line in the renderer's `renderer.ts`

**Performance Goals**: N/A — reuses the existing `mouseover`-delegated
`getBoundingClientRect()` measurement already running for the other four row
tooltips; adding `.name` to its selector adds no new listener and no
measurable cost.

**Constraints**: No new dependency (Principle V); MUST NOT change the
tooltip's content (`entry.fullPath`) or its trigger (hover) — only its
above/below placement; MUST NOT affect the existing `.list.busy .name[data-
tip]:hover::after` suppression (long-operation lockout) or the `.name:has
(.row-dup-ico:hover)::after` duplicate-icon suppression, both of which key
off `.name` directly and are unaffected by adding a `.tip-up` class toggle.

**Scale/Scope**: One selector-string edit in `renderer.ts`, affecting the
directory-path tooltip on every repository row and nested worktree row; no
other tooltip's behavior changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This is a one-line extension of an already-shipped CSS + DOM-measurement
mechanism (feature 012). It touches none of the constitution's mutation,
state-colour, or lockout mechanics.

- **I. System-Native Delegation** — Unaffected; no git interaction.
- **II. Read-Only by Default, Destructive by Explicit Action** — Unaffected;
  no mutating operation is touched.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Unaffected in substance: the directory
  path remains available on demand exactly as the constitution requires
  ("full path MUST be available on demand (e.g., tooltip)") — this fix only
  makes that existing guarantee actually hold when the row is last visible.
  The constitution's long-operation tooltip suppression
  (`.list.busy .name[data-tip]:hover::after`) is untouched: it fires on a
  `display: none` that takes precedence regardless of `.tip-up`.
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry, no network activity; the entire change is one selector-string
  edit reusing existing code.

**Development Workflow** — No mutating operation is touched, so the
runnable-check-on-mutation rule doesn't apply; this is a visual fix with no
new branching logic, validated manually per `quickstart.md`, matching how
feature 012/019 (the mechanism's origin and most recent reuse) were verified.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/020-fix-row-tooltip-clip/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── spec.md
```

No `contracts/` directory: this fix exposes no external interface (no IPC, no
API, no CLI surface) — it is entirely internal renderer CSS/JS, same as
feature 012's precedent.

### Source Code (repository root)

```text
src/renderer/
└── renderer.ts     # extend positionRowIconTooltip's mouseover-delegated
                     #   target.closest(...) selector (around line 441) to
                     #   also match '.name', so the directory-path tooltip is
                     #   measured and flipped by the same existing function
                     #   already used for .row-delete-ico/.row-action-ico/
                     #   .row-warn-ico/.row-dup-ico — no change to styles.css
                     #   (the generic .tip-up[data-tip]:hover::after rule
                     #   already matches any element) and no change to
                     #   view/table.ts (the data-tip attribute already exists)

tests/               # no new test file — no new parsing/filtering/sorting
                     #   logic to unit-test (a selector-string extension is
                     #   not a decision point, matching feature 017/018's
                     #   precedent); verified manually via quickstart.md
```

**Structure Decision**: Single-project Electron layout (already established).
The entire change is a one-line selector extension in
`src/renderer/renderer.ts`; no change to `view/table.ts`, `styles.css`, the
main process, IPC surface, or `src/shared/types.ts`.

## Complexity Tracking

*No violations — this section is not needed.*
