# Implementation Plan: Relocate Search Icon Above the Table

**Branch**: `018-relocate-search-header` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-relocate-search-header/spec.md`

## Summary

Move the existing header search control (`#search` — icon, expand-to-input, clear button, all from feature 016) out of the top title bar and into the `.fleet-head` row directly above the table, as its leftmost element, replacing the "Fleet — N repositories" text that row used to show (the count already lives in the footer). When the expanded search input and the filter chips can't both fit on one line, the chips wrap to a second line (clarified 2026-07-21). This is a pure DOM-position + CSS change: `renderSearch`/`renderSummary`'s own logic, the search state machine, and the long-operation lockout are all untouched.

**Technical approach**: renderer-only, no new component. `index.html` moves the `<div id="search"></div>` node from inside `.bar` to the front of `.fleet-head` (before the existing `#filters` counts container) and deletes the `<span id="fleetTitle">` node. `summary.ts`'s `SummaryElements` drops its `title` field and the line that set its text, since there's no title element left to write to. `renderer.ts` drops the now-unused `fleetTitle` element lookup and the `title` field passed into `renderSummary`. `styles.css` repositions `.fleet-head` (`flex-wrap: wrap` so `.counts` wraps under `#search` per the clarification) and removes the now-dead `.fleet-title` rule; the top `.bar` needs no change — its existing `.bar-spacer { flex: 1 }` already absorbs the freed space between the logo and `#toolbar` for free.

## Technical Context

**Language/Version**: TypeScript 5.9.x (dual build: `tsconfig.json` for main, `tsconfig.renderer.json` for renderer), Node.js 24.

**Primary Dependencies**: Electron (devDependency); zero runtime dependencies — none added by this feature.

**Storage**: N/A — no state of any kind is introduced; `searchQuery`/`searchExpanded` (016) keep their existing in-memory, session-only lifetime untouched.

**Testing**: `node:test` via `pnpm test` (`node --test dist/tests/*.test.js` after `tsc`). No new pure/branching logic is introduced (see Data Model) — this is a DOM/CSS reshuffle with no new test file.

**Target Platform**: Electron desktop application on the user's local OS.

**Project Type**: Desktop app (Electron) — `src/main`, `src/preload`, `src/renderer`, `src/shared`.

**Performance Goals**: N/A — no data processing changes; render cost is identical (same DOM nodes, different parent).

**Constraints**: Renderer-only; no new IPC/dependency/persisted setting; must not regress the feature-009 long-operation lockout or the feature-016 search behavior (both reused unchanged, per FR-004).

**Scale/Scope**: Single-screen layout change; no scale dimension applies.

## Constitution Check

*GATE: evaluated against constitution v4.0.0.*

| Principle | Assessment |
|-----------|------------|
| **I. System-Native Delegation** | ✅ N/A — no git invocation of any kind; pure presentation move. |
| **II. Read-Only by Default** | ✅ No mutation of any kind — relocates a DOM node and deletes a text node. |
| **III. Never Resolve Conflicts** | ✅ N/A — no pull/push/merge behavior touched. |
| **IV. Always-Observable State** | ✅ The search control's existing long-operation lockout (busy/disabled, cursor-only, no colour change) is reused verbatim — FR-004 requires it stay byte-for-byte identical. The filter chips it now shares a row with keep their own unchanged lockout. No new observable state is introduced. |
| **V. Local-Only, Minimal Footprint** | ✅ No new dependency; no telemetry/network; no new persisted setting. |

**Development Workflow**: Not a mutating operation and introduces no new branching/pure logic (removing a `textContent` assignment and moving a DOM node are not decision points) — the constitution's "one runnable check" rule for non-trivial logic does not apply, matching feature 017's precedent for a presentation-only diff.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/018-relocate-search-header/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── header-layout.md # Phase 1 output — relocation contract (DOM/CSS, no behavioral surface)
└── checklists/
    └── requirements.md  # From /speckit-specify (16/16 passing)
```

### Source Code (repository root)

```text
src/renderer/
├── index.html            # move <div id="search"> from .bar into .fleet-head (before #filters); delete <span id="fleetTitle">
├── styles.css            # .fleet-head: flex-wrap + gap for the clarified chip-wrap rule; remove dead .fleet-title rule
├── renderer.ts            # drop the fleetTitle element lookup and the `title` field passed to renderSummary
└── view/
    └── summary.ts         # SummaryElements loses `title`; drop the els.title.textContent assignment
```

**Structure Decision**: Single Electron project, renderer-only change. No new files, no new component — reuses `view/search.ts`'s `renderSearch` (016) and `view/summary.ts`'s `renderSummary` unmodified in behavior, only changing what DOM node hosts the former and what fields the latter's `SummaryElements` contract requires (surgical diff, matching feature 017's precedent for presentation-only changes).

## Complexity Tracking

No constitutional violations — section intentionally empty.
