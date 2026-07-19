# Implementation Plan: Block UI During Long Operations

**Branch**: `009-block-ui-during-operations` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-block-ui-during-operations/spec.md`
(current design = **Revision 2026-07-19e**; supersedes the 2026-07-19b/c/d
per-row/per-button-only design, T001–T008 of which are already implemented and
must be extended, not rewritten from scratch)

## Summary

While one of the three long operations (Refresh, Pull all, Cleanup) runs, block
every control that operates on repositories or reconfigures what's shown: the
*other two* of the three buttons, Settings, the Worktrees toggle, every filter
chip, the sort-header row, and every row-level action (delete, custom launch).
Nothing besides the loader and the running button's own busy indicator stays
active. Visual treatment is split: the repository table rows and the sort-header
row dim to barely-visible (the only two things that dim); every other blocked
control (Settings, Worktrees toggle, filter chips, row-level actions) MUST NOT
change colour/opacity at all — only the mouse cursor shows `not-allowed`. A
repository row's directory-path tooltip is suppressed for the duration. Also
disable Pull all/Cleanup when no repositories are discovered (Refresh stays
available, independent of the long-op lock), and guarantee every lock/dim is
released on *any* settlement (success, failure result, or rejection).

Technical approach: **renderer-only** (no new IPC, no main-process code, no new
dependency, no persisted setting). Still no whole-viewport dim and no native
`inert` — every control is blocked individually by its own render logic, which
is what keeps FR-013's settlement-based release correct per control:

1. **Toolbar buttons** (Refresh, Pull all, Cleanup, Settings, Worktrees toggle):
   `renderToolbar` already conditionally wires/unwires the three action buttons;
   extend the same `busy = refreshing || updating || cleaning` gate to Settings
   and the Worktrees toggle. Restyle `.ctrl.disabled` to drop the opacity dim
   (`0.45`) in favour of `cursor: not-allowed` only, with a hover override so
   `.ctrl:hover`'s colour/border change doesn't leak through while blocked. The
   running button's own `.busy` styling (opacity 0.7 + spin) is untouched.
2. **Filter chips**: `makeChip` already builds native `<button>` elements —
   thread a `locked: boolean` into `renderSummary` and set `btn.disabled =
   locked`. Native `disabled` removes click/keyboard activation and (in every
   evergreen browser) suppresses `:hover`, so no extra CSS is needed beyond an
   explicit `cursor: not-allowed` (UA default varies).
3. **Row-level actions**: `buildMenuCell`/`buildDeleteCell` already build native
   `<button>`s — thread the same `locked` flag through `renderRows` → `buildRow`
   and additionally set `btn.disabled = true` when locked (on top of the
   pre-existing "no remote configured" disablement, which is a different,
   dimmed, permanent case — keep that CSS class untouched and add a
   `:disabled` cursor rule instead of reusing `.disabled`).
4. **Row inertness**: set each row's `tabIndex` to `-1` while locked (was `0`),
   removing rows from the tab order in addition to their existing FR-004 dim.
5. **Sort-header row**: add a `.thead.busy` class (toggled alongside `.list.busy`
   in `beginBusyLock`/`endBusyLock`) styled with the same barely-visible
   opacity as row dim, plus `cursor: not-allowed`; guard the sort callback
   passed to `wireSortHeaders` with the same `busy` check used for `doRefresh`'s
   re-entry guard, so clicks/Enter/Space no-op while locked.
6. **Row directory-path tooltip**: CSS-only — `.list.busy .name[data-tip]:hover::after
   { display: none }` — no JS change; the tooltip mechanism itself
   (`[data-tip]:hover::after`) is untouched for every other row tooltip.
7. **Release** stays in the existing `finally` blocks of `doRefresh` /
   `doUpdateAll` / `doCleanup` (FR-013) — clearing the operation flag (which
   re-renders everything above) and the row/header dim + loader.

The empty-list gate (FR-007/FR-010) is unchanged and independent of this lock.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled per `tsconfig.renderer.json`

**Primary Dependencies**: Electron 40 (renderer process); no new runtime dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`; pure logic
unit-tested (`tests/loadstate.test.ts`), DOM/interaction behavior validated
manually via `quickstart.md`

**Target Platform**: Desktop (Electron) on the user's local OS

**Project Type**: Single-project desktop app (Electron main + renderer)

**Performance Goals**: No perceptible flicker on fast operations (reuse 150 ms
show-delay); dim + loader stay ≥ 400 ms once shown; every lock/unlock is O(1)
DOM work (native `disabled` toggles, class toggles, one toolbar/summary/table
re-render)

**Constraints**: Local-only, offline-by-design; no new dependency (Principle V);
surgical changes matching existing style (Development Workflow)

**Scale/Scope**: `renderer.ts` (thread a `busy` flag into `renderSummary`/
`renderRows` calls, toggle `.thead.busy`, guard the sort callback),
`toolbar.ts` (extend the busy gate to Settings/Worktrees toggle), `summary.ts`
(accept `locked`, set native `disabled` on filter chips), `table.ts` (accept
`locked`, set native `disabled` on row-action/delete buttons, set row
`tabIndex`), `styles.css` (retire `.ctrl.disabled`'s opacity, add cursor-only
rules, add `.thead.busy`, add the tooltip-suppression rule). No change to the
main process, IPC, or `src/shared/types.ts`. No change to `loadstate.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature is governed by **Principle IV as amended in constitution v3.0.0**,
which re-expands the v2.0.0 narrowing back to (almost) full lockout, with a
deliberate no-dim/cursor-only carve-out for controls other than the table rows
and sort header. Gate evaluation:

- **I. System-Native Delegation** — Unaffected.
- **II. Read-Only by Default, Destructive by Explicit Action** — Preserved.
  Refresh stays read-only; Cleanup's review overlay is unchanged; blocking
  Settings while an operation runs is itself in the spirit of this principle
  (no observed-directory-set mutation mid-scan).
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — **Directly implements** the v3.0.0 mandate:
  while a long operation runs, every control that operates on repositories is
  blocked; only the table rows and sort-header row dim; everything else blocked
  shows only a `not-allowed` cursor; the row tooltip is suppressed; still no
  whole-viewport dim and no native `inert`. Bulk actions with nothing to act on
  stay blocked; Refresh stays available on an empty list.
- **V. Local-Only, Minimal Footprint** — Preserved: no dependency, no persisted
  state; native `disabled` and CSS classes are the entire mechanism.

**Development Workflow** — FR-013 still touches the release path of mutating
operations (Pull all, Cleanup); the existing `finally`-based release is
extended to cover more controls but keeps the same single-path-per-operation
shape. `tests/loadstate.test.ts` remains valid and unchanged.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/009-block-ui-during-operations/
├── plan.md              # This file
├── research.md          # Phase 0 output (regenerated for Revision 2026-07-19e)
├── data-model.md        # Phase 1 output (regenerated)
├── quickstart.md        # Phase 1 output (regenerated)
├── contracts/
│   └── ui-lockout.md    # Phase 1 output — UI behavior contract (no IPC)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify + clarify)
└── spec.md
```

### Source Code (repository root)

```text
src/renderer/
├── index.html               # unchanged from T002 (table-wrap/tableLoader already
│                            #   in place)
├── styles.css               # retire .ctrl.disabled's opacity dim (cursor-only
│                            #   instead); add .thead.busy dim; add cursor rules
│                            #   for locked filter chips / row-action buttons;
│                            #   add the tooltip-suppression rule
├── renderer.ts               # toggle .thead.busy alongside .list.busy; guard the
│                            #   sort callback; pass a `busy` flag into
│                            #   renderSummary/renderRows
└── view/
    ├── toolbar.ts           # extend the busy gate to Settings + Worktrees toggle
    ├── summary.ts           # accept `locked`, set native `disabled` on chips
    ├── table.ts             # accept `locked`, set native `disabled` on row
    │                        #   action/delete buttons, set row tabIndex
    ├── loader.ts            # reused as-is
    └── loadstate.ts         # reused as-is

tests/
└── loadstate.test.ts        # existing timing-helper tests remain valid
```

**Structure Decision**: Single-project Electron layout (already established).
All changes live in `src/renderer/`; the main process, IPC surface, and
`src/shared/types.ts` are untouched. T001–T008 (the 2.0.0-scoped
per-row/per-button implementation) already landed; this revision *extends*
that code rather than reverting it — the table-wrap/tableLoader DOM
restructuring, the row-dim CSS, and the toolbar mutual-exclusion pattern are
all reused as the foundation for the newly-blocked controls.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
