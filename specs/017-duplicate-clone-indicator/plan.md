# Implementation Plan: Duplicate-Clone Indicator

**Branch**: `017-duplicate-clone-indicator` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-duplicate-clone-indicator/spec.md`

## Summary

Replace today's unexplained "…/parent-folder" text fragment (shown when two rows are clones of the same remote repository sharing a directory name) with a dedicated, clickable **duplicate indicator** icon. Hovering it explains — in a tooltip — that the row is cloned in more than one place, still using only the row's own already-computed parent-folder name (no new cross-row data). Clicking it opens the existing repository search (if collapsed) and immediately applies a query that identifies the repository (its remote slug when known, else its directory name), narrowing the table to every clone of that repository via the search feature already shipped in 016.

**Technical approach**: renderer-only. Add one new icon glyph to the existing catalog (`view/icons/catalog.ts`), render it as a `<button class="row-dup-ico">` next to `.frag` in `buildRow` (`view/table.ts`) whenever `entry.collisionFragment` is set, and wire its click through a new `RowActionHandlers.onFindDuplicate` callback implemented in `renderer.ts` (sets `searchExpanded = true`, `searchQuery = <key>`, then `render()` — bypassing the debounce, the same way the existing × clear button does). No changes to `scan.ts`'s collision detection, `filter.ts`'s matching, or any IPC/main-process code.

## Technical Context

**Language/Version**: TypeScript 5.9.x (dual build: `tsconfig.json` for main, `tsconfig.renderer.json` for renderer), Node.js 24.

**Primary Dependencies**: Electron (devDependency); zero runtime dependencies — none added by this feature.

**Storage**: N/A. Reuses 016's existing session-only, in-memory `searchQuery`/`searchExpanded` renderer state. Nothing new is persisted.

**Testing**: `node:test` via `pnpm test` (`node --test dist/tests/*.test.js` after `tsc`). No new pure/branching logic is introduced (see Constitution Check), so no new required unit test file — consistent with how 016's own click/blur wiring in `renderer.ts` wasn't separately unit-tested beyond `filterRows`'s existing tests.

**Target Platform**: Electron desktop application on the user's local OS.

**Project Type**: Desktop app (Electron) — `src/main`, `src/preload`, `src/renderer`, `src/shared`.

**Performance Goals**: Click-to-narrowed-table is a synchronous state update + `render()` call — same-frame, no debounce (FR-004). Negligible cost, identical order of magnitude to every other row-icon click already in the table.

**Constraints**: Offline-only (Principle V); renderer-only; no new IPC/dependency/persisted setting; the indicator MUST NOT change colour/opacity while a long operation runs — only a `not-allowed` cursor, via native `disabled` on the new `<button>` (Principle IV, matching `.row-delete-ico`'s existing pattern).

**Scale/Scope**: Same table already handling hundreds of rows (016); this feature touches only the subset of rows with a non-null `collisionFragment`.

## Constitution Check

*GATE: evaluated against constitution v4.0.0.*

| Principle | Assessment |
|-----------|------------|
| **I. System-Native Delegation** | ✅ No git invocation. The indicator and its click reuse already-observed row data and the existing search feature. |
| **II. Read-Only by Default** | ✅ Purely a view/presentation change plus a read-only search filter update — no working-tree, branch, history, or filesystem mutation; no git call. |
| **III. Never Resolve Conflicts** | ✅ N/A — no pull/push/merge behavior touched. |
| **IV. Always-Observable State** | ✅ The indicator is a row-level action, so it joins the existing long-operation lockout exactly like `.row-delete-ico` (native `disabled`, no colour/opacity change — FR-006). Its tooltip reuses the existing `.tip-up`/`positionRowIconTooltip` upward-flip so it never clips (FR-007). No new colour-only signal is introduced — the icon shape plus tooltip text are the non-colour cue (FR-002). |
| **V. Local-Only, Minimal Footprint** | ✅ No new dependency; the one new icon is hand-authored SVG path data added to the existing catalog, matching feature 015's Tabler-outline recipe. No telemetry/network. |

**Development Workflow**: not a mutating operation (Principle II — search is read-only), and the only new logic (`remote?.slug ?? directoryName` key selection) is a trivial one-line fallback, not a branch/loop/parser/money/security path — so the constitution's mandatory "runnable check" rule for mutating operations does not apply here. This lands as a manual quickstart walkthrough, consistent with every prior renderer-only presentation feature (012, 013, 015, 016) in this project.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/017-duplicate-clone-indicator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── duplicate-indicator.md  # Phase 1 output — icon/click contract
└── checklists/
    └── requirements.md  # From /speckit-specify (16/16 passing)
```

### Source Code (repository root)

```text
src/renderer/
├── renderer.ts                # ADD onFindDuplicate handler: expand search, set searchQuery, render() (bypasses debounce)
├── styles.css                 # ADD .row-dup-ico sizing/cursor, reusing .row-delete-ico/.tip-up conventions
└── view/
    ├── table.ts                # EXTEND buildRow: render the new icon next to .frag when entry.collisionFragment is set;
    │                           # ADD onFindDuplicate to the RowActionHandlers interface
    └── icons/catalog.ts        # ADD one new icon id (duplicate/copy glyph, same Tabler-outline recipe as every existing entry)

tests/
# No new test file required — no new pure/branching logic (see Constitution Check).
# Manual quickstart.md walkthrough is the verification for this renderer-only presentation change.
```

**Structure Decision**: Single Electron project, renderer-only change. The feature reuses 016's search plumbing (`searchQuery`/`searchExpanded`/`render()`) and the existing row-icon conventions (`.row-delete-ico`'s `disabled`/`data-tip` pattern, the `.tip-up` upward-flip tooltip mechanism from 012/013) rather than inventing new ones, keeping the diff surgical.

## Complexity Tracking

No constitutional violations — section intentionally empty.
