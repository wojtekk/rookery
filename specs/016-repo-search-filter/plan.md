# Implementation Plan: Debounced Repository Search Filter

**Branch**: `016-repo-search-filter` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-repo-search-filter/spec.md`

## Summary

Add a debounced text search that filters the repository table by matching a case-insensitive substring against each row's remote slug, directory name, origin URL, and current branch. The query is entered through an **expandable search icon** in the header, cleared via a dedicated **× button** (or by deleting the text), and applied ~150 ms after typing stops. It composes (logical AND) with the existing "Failed" state filter and the Worktrees toggle, participates in the feature-009 long-operation lockout, and follows the clarified worktree rule (a matching repo shows all its worktrees; a repo matching only via a worktree branch shows just that worktree under its parent).

**Technical approach**: renderer-only. Extend the existing pure `filterRows` (`view/filter.ts`) with an optional `searchQuery` parameter (empty ⇒ today's exact behavior — the built-in regression guard). Add a small `view/search.ts` component for the expand/collapse icon+input+clear affordance, a module-level `searchQuery` string in `renderer.ts` with a native `setTimeout` debounce, a distinct "no matches" message when the query hides everything, and a `search` (magnifier) glyph in the icon catalog. No IPC, no main-process change, no new dependency, no persisted setting.

## Technical Context

**Language/Version**: TypeScript 5.9.x (dual build: `tsconfig.json` for main, `tsconfig.renderer.json` for renderer), Node.js 24.

**Primary Dependencies**: Electron (devDependency); zero runtime dependencies — none added by this feature.

**Storage**: N/A. Search state is session-only, in-memory (a module-level variable in the renderer). Not persisted to settings.

**Testing**: `node:test` via `pnpm test` (`node --test dist/tests/*.test.js` after `tsc`). Pure logic is unit-tested; the pure surface here is `filterRows` (extended in `tests/filter.test.ts`).

**Target Platform**: Electron desktop application on the user's local OS.

**Project Type**: Desktop app (Electron) — `src/main`, `src/preload`, `src/renderer`, `src/shared`.

**Performance Goals**: Filtered result visible within ~1 debounce period + render (~150–250 ms) after typing stops (SC-002); no per-keystroke recompute. Matching is O(rows × fields) substring — negligible for the target scale.

**Constraints**: Offline-only (Principle V); renderer-only; no new IPC/dependency/persisted setting; the disabled search control MUST NOT change colour/opacity while a long operation runs — only a `not-allowed` cursor (Principle IV).

**Scale/Scope**: Designed for lists of at least 50 repositories (SC-001), realistically up to a few hundred rows including worktrees.

## Constitution Check

*GATE: evaluated against constitution v4.0.0.*

| Principle | Assessment |
|-----------|------------|
| **I. System-Native Delegation** | ✅ No git invocation. Filtering operates purely on already-observed row data. |
| **II. Read-Only by Default** | ✅ Search is a read-only view filter — no working-tree, branch, history, or filesystem mutation; triggers no git call (FR-012). |
| **III. Never Resolve Conflicts** | ✅ N/A — no pull/push/merge behavior touched. |
| **IV. Always-Observable State** | ⚠️→✅ Search is a view-reconfiguring control, so it MUST join the long-operation lockout (FR-011) and MUST NOT change colour/opacity when blocked — only `not-allowed` cursor. The empty-result state MUST be honest: a distinct "no matches" message vs. "no repositories discovered" (FR-005). Both are designed in (see research R4, R5). No auto/timed refresh introduced. |
| **V. Local-Only, Minimal Footprint** | ✅ Debounce via native `setTimeout` (no library); no new dependency; no telemetry/network; session-only state (no new persisted setting). |

**Development Workflow**: not a mutating operation, but the combined filter predicate is non-trivial branching logic → it leaves a runnable check (new `filterRows` search cases in `tests/filter.test.ts`), satisfying the "one runnable check" rule.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/016-repo-search-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── search-filter.md # Phase 1 output — extended filterRows + search component contract
└── checklists/
    └── requirements.md  # From /speckit-specify (16/16 passing)
```

### Source Code (repository root)

```text
src/renderer/
├── index.html                 # add a #search container in the header (near #toolbar / fleet-head)
├── styles.css                 # expandable icon+input, × clear button, busy not-allowed (no colour change)
├── renderer.ts                # module-level searchQuery + debounce; wire search into render(); no-match message
└── view/
    ├── filter.ts              # EXTEND filterRows with optional searchQuery; add search-match helpers
    ├── search.ts              # NEW — expandable search icon → input + × clear component
    └── icons/catalog.ts       # add 'search' (magnifier) glyph ('x' already exists for clear)

tests/
└── filter.test.ts            # EXTEND — search substring, field coverage, worktree rule, AND-composition, empty-query regression
```

**Structure Decision**: Single Electron project, renderer-only change. The feature reuses the existing `view/filter.ts` pure-logic seam (already unit-tested and already implementing the chosen worktree-surfacing shape) and the existing toolbar/summary lockout pattern (`busy` flag threaded through `render()`), keeping the diff surgical (Principle: surgical changes, match existing style).

## Complexity Tracking

No constitutional violations — section intentionally empty.
