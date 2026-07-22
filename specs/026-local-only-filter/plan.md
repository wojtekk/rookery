# Implementation Plan: Local-Only Branch Filter

**Branch**: `026-local-only-filter` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-local-only-filter/spec.md`

## Summary

Add a new "local-only" filter chip, alongside the existing All/Clean/Uncommitted/Out of sync/Unavailable/Failed/Gone chips, that narrows the table to working trees whose current branch has no upstream configured at all — a state the app already detects (`head.upstream.tracking === 'local-only'`) and already surfaces as a branch tag, but that today has no matching filter. This mirrors the existing "gone" filter almost exactly: same non-`RowState` sibling treatment in `StateFilter`, same per-working-tree (not per-family) matching, same fleet-wide live count, same no-colour-change lockout while a long operation runs.

**Technical approach**: renderer-only. `view/filter.ts` gains an `isLocalOnly` predicate (mirrors the existing `isGone`) and a `'local-only'` branch in `matches()`; `StateFilter` gains `'local-only'` as a fourth non-`RowState` sibling. `view/summary.ts` gains a `countLocalOnly` helper (mirrors `countGone`) and one more `makeChip(...)` call, appended after the "gone" chip. No new IPC, no main-process change, no dependency, no persisted setting, no HTML/CSS change (the chip is generated entirely by `summary.ts` into the existing `#filters` container, and — like "gone" — needs no swatch colour).

## Technical Context

**Language/Version**: TypeScript 5.9.x (dual build: `tsconfig.json` for main, `tsconfig.renderer.json` for renderer), Node.js 24.

**Primary Dependencies**: Electron (devDependency); zero runtime dependencies — none added by this feature.

**Storage**: N/A — `stateFilter` keeps its existing in-memory, session-only lifetime in `renderer.ts`; no new state is introduced.

**Testing**: `node:test` via `pnpm test`. This feature *does* introduce new pure/branching logic (the `isLocalOnly` predicate and the new `matches()` branch), so it gets new cases in `tests/filter.test.ts` mirroring the existing `isGone`/`'gone'`-filter tests exactly.

**Target Platform**: Electron desktop application on the user's local OS.

**Project Type**: Desktop app (Electron) — `src/main`, `src/preload`, `src/renderer`, `src/shared`.

**Performance Goals**: N/A — one more `O(n)` predicate check per row, identical cost class to the existing "gone" check.

**Constraints**: Renderer-only; no new IPC/dependency/persisted setting; must compose with the existing search box, worktree-visibility toggle, and feature-009 long-operation lockout unchanged (FR-004/FR-005).

**Scale/Scope**: Single new filter chip; no scale dimension applies.

## Constitution Check

*GATE: evaluated against constitution v4.1.0.*

| Principle | Assessment |
|-----------|------------|
| **I. System-Native Delegation** | ✅ N/A — no git invocation; the data this filter reads is already collected by the existing scan. |
| **II. Read-Only by Default** | ✅ No mutation of any kind — a filter chip only changes what is displayed. |
| **III. Never Resolve Conflicts** | ✅ N/A — no pull/push/merge behavior touched. |
| **IV. Always-Observable State** | ✅ Directly serves this principle: branch tracking status is already a mandated minimum surfaced field (remote-tracked or local-only); this feature only adds a way to filter by that already-visible fact. The chip reuses the existing lockout wiring (`locked` param → native `disabled`, no colour change) verbatim — no new lockout logic. |
| **V. Local-Only, Minimal Footprint** | ✅ No new dependency; no telemetry/network; no new persisted setting. |

**Development Workflow**: Unlike a purely presentational diff, this feature adds one new predicate and one new `matches()` branch — real branching logic — so the constitution's "leave a runnable check" expectation applies: `tests/filter.test.ts` gets new cases mirroring the existing `isGone`/`'gone'`-filter coverage precisely, satisfying it without a new test file.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/026-local-only-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── filter-chip.md   # Phase 1 output — StateFilter/matches()/chip contract
└── checklists/
    └── requirements.md  # From /speckit-specify (16/16 passing)
```

### Source Code (repository root)

```text
src/renderer/
└── view/
    ├── filter.ts    # + isLocalOnly (mirrors isGone); StateFilter gains 'local-only'; matches() gains its branch
    └── summary.ts   # + countLocalOnly (mirrors countGone); one more makeChip(...) call after 'gone'

tests/
└── filter.test.ts   # + isLocalOnly predicate tests; + filterRows 'local-only' tests (mirror the 'gone' cases)
```

**Structure Decision**: Single Electron project, renderer-only change confined to the one module pair (`filter.ts`/`summary.ts`) that already implements the identical "gone" pattern. No new files besides the mirrored test cases and the plan-phase docs; no `index.html`/`styles.css` change since the chip is DOM-generated into the existing `#filters` container and needs no swatch colour, exactly like "gone".

## Complexity Tracking

No constitutional violations — section intentionally empty.
