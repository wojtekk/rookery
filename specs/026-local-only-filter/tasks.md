---

description: "Task list for Local-Only Branch Filter"

---

# Tasks: Local-Only Branch Filter

**Input**: Design documents from `/specs/026-local-only-filter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/filter-chip.md, quickstart.md

**Tests**: This feature adds real branching logic (a new predicate and a new `matches()` arm in `view/filter.ts`), so plan.md's Development Workflow gate requires a runnable check — new cases in the existing `tests/filter.test.ts`, mirroring its `isGone`/`'gone'`-filter coverage exactly. No new test *file* is needed.

**Organization**: The spec has a single user story (US1, P1) — this is the entire feature. Tasks are grouped Setup → Foundational (empty) → US1 → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (Setup and Polish carry no story label)

## Path Conventions

Single Electron project. Source under `src/renderer/view/`; tests under `tests/`; run from `.worktrees/026-local-only-filter`.

---

## Phase 1: Setup

- [X] T001 Confirm toolchain and green baseline in `.worktrees/026-local-only-filter`: run `nvm use` (Node 24), `pnpm install`, then `pnpm test` and confirm the existing suite passes before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

No dedicated foundational tasks: this feature adds no shared engine, entity, or new dependency — it mirrors the existing "gone" filter one-for-one within `view/filter.ts` and `view/summary.ts` (research.md). Proceed to Phase 3.

---

## Phase 3: User Story 1 - Isolate branches that were never pushed (Priority: P1) 🎯 MVP

**Goal**: A new "local-only" filter chip, alongside the existing All/Clean/Uncommitted/Out of sync/Unavailable/Failed/Gone chips, shows only working trees whose current branch has no upstream configured — and only those.

**Independent Test**: With a fleet mixing tracked, gone, local-only, detached, and unavailable working trees, clicking the "local-only" chip shows exactly the local-only ones and hides the rest; clicking "All" restores the full set (quickstart B, C).

- [X] T002 [US1] In `src/renderer/view/filter.ts`, widen `StateFilter` to `RowState | 'all' | 'failed' | 'gone' | 'local-only'`; add `export function isLocalOnly(entry: WorkingTreeEntry): boolean` immediately after `isGone`, mirroring its guard shape (`availability === 'ok' && !head.detached && head.upstream.tracking === 'local-only'`); add `if (stateFilter === 'local-only') return isLocalOnly(entry);` to `matches()` alongside the existing `'gone'` branch (data-model.md, contracts/filter-chip.md).
- [X] T003 [P] [US1] In `src/renderer/view/summary.ts`, add `function countLocalOnly(rows: Row[]): number` immediately after `countGone`, mirroring its body exactly (sum `isLocalOnly` over each row and, for `repository` rows, every worktree); import `isLocalOnly` alongside the existing `isGone` import; in `renderSummary`, append one more `makeChip(...)` call after the "gone" chip: `makeChip('local-only', countLocalOnly(rows), activeFilter === 'local-only', () => onFilterChange('local-only'), undefined, locked)` (contracts/filter-chip.md).
- [X] T004 [P] [US1] In `tests/filter.test.ts`, add test cases mirroring the existing `isGone`/`'gone'`-filter coverage: (a) an `isLocalOnly` test asserting `true` for an available, non-detached entry with `upstream.tracking === 'local-only'`, and `false` for tracked, detached, and unavailable entries (mirrors the `isGone` test at line 61); (b) a `filterRows: 'local-only' matches by upstream tracking, independent of RowState` test (mirrors line 68); (c) a `filterRows: 'local-only' surfaces a family when only a hidden worktree's branch is local-only` test (mirrors line 76).

**Checkpoint**: The "local-only" chip renders with a correct live count, filters the table to exactly the matching working trees, composes with search/worktree-toggle/lockout unchanged, and `pnpm test` passes with the new cases.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T005 Run full build + suite: `pnpm test` in `.worktrees/026-local-only-filter`; confirm all existing tests plus the new T004 cases pass.
- [ ] T006 Execute all `quickstart.md` scenarios (A–J) against `pnpm start` (manual — an agent cannot drive real mouse/click interaction against the Electron window from this environment).
- [X] T007 [P] Update the root `CLAUDE.md` "Active feature" narrative to describe feature 026 (currently describes 025) — documentation-only touch-up.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: empty — nothing blocks US1 beyond Setup.
- **User Story (Phase 3)**: after Setup.
- **Polish (Phase 4)**: after Phase 3 is complete.

### User Story Dependencies

- **US1 (P1)**: after Setup. No dependency on any other story — it's the only one.

### Parallel Opportunities

- T003 (`summary.ts`) and T004 (`tests/filter.test.ts`) are [P] — different files, both only need T002's new `isLocalOnly`/`StateFilter` export done first.
- T007 in Polish is [P] (independent doc-only file, no dependency on T005/T006's outcome).

---

## Parallel Example: User Story 1

```bash
# After T002 (filter.ts) lands, these touch independent files and can run together:
Task: "T003 Add countLocalOnly + chip call in src/renderer/view/summary.ts"
Task: "T004 Add isLocalOnly/'local-only' test cases in tests/filter.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 3 US1 (T002–T004) → **STOP & validate** the chip filters correctly and the new tests pass (quickstart A–D) → demoable MVP. Since US1 is the entire feature, this is also the finished feature.

### Incremental Delivery

1. Setup ready (green baseline).
2. US1 → local-only filter chip fully functional (MVP = whole feature).
3. Polish → full suite green + manual quickstart + doc update.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Renderer-only: no IPC, no main-process change, no new dependency, no persisted setting (plan.md).
- Backward-compat invariant: `filterRows`'s signature and every existing `StateFilter` value's behavior are untouched — the new branch is additive only (contracts/filter-chip.md).
- Commit after each task or logical group; stop at the Phase 3 checkpoint to validate the story independently.
