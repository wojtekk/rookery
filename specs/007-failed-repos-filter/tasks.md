# Tasks: Filter Repositories Needing Attention

**Input**: Design documents from `/specs/007-failed-repos-filter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Included for the pure-logic change (`filterRows`), matching the
project's existing convention (`filter.ts`/`sort.ts` are unit-tested;
DOM-rendering view modules like `summary.ts`/`table.ts`/`toolbar.ts` are not —
no jsdom or DOM-testing dependency exists in this project, and introducing one
for a single chip would violate the plan's "no new dependency" constraint).
User Story 2 is therefore verified manually (quickstart.md), not by a new
automated test file.

**Organization**: By user story (US1 = MVP). Existing single-project
Electron/TS layout (`src/`, `tests/` at repo root); no new project
scaffolding — every task edits an existing file.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 (user-story phases only)

---

## Phase 1: Foundational (Blocking Prerequisite)

**Purpose**: The one shared type both stories build on. MUST complete first.

- [X] T001 Widen `StateFilter` in `src/renderer/view/filter.ts` to `RowState | 'all' | 'failed'` (per data-model.md; `'failed'` is a sibling of `'all'`, not a new `RowState` member — no `Record<RowState, ...>` map elsewhere needs a new key)

**Checkpoint**: Type compiles; every downstream task can now reference `'failed'`.

---

## Phase 2: User Story 1 — Narrow the list to repositories needing attention (Priority: P1) 🎯 MVP

**Goal**: Selecting a new "Failed" filter chip shows only the repositories (and
surfaced parent rows) whose most recent "Pull all" attempt failed.

**Independent Test**: Run "Pull all" against a set where at least one
repository fails, select the "Failed" chip, and confirm only the failed
repositories (plus any surfaced parent whose failed child is hidden) remain
visible. Maps to spec.md US1 acceptance scenarios 1–3.

- [X] T002 [US1] Add a `matches(entry, stateFilter, failedPaths)` helper in `src/renderer/view/filter.ts` (`'all'` → true; `'failed'` → `failedPaths.has(entry.fullPath)`; otherwise → `deriveRowState(entry) === stateFilter`) and widen `filterRows(rows, stateFilter, showWorktrees, failedPaths: Set<string> = new Set())` to call it in place of the three existing inline checks (own row, child worktree, orphan worktree) — family-surfacing and worktree-visibility behavior is unchanged, just routed through one predicate (per data-model.md) (depends on T001)
- [X] T003 [P] [US1] Extend `tests/filter.test.ts`: a row whose `fullPath` is in `failedPaths` matches `'failed'` and others don't; a worktree's path is in `failedPaths` with worktrees hidden → its primary surfaces with just that worktree (mirrors the existing dirty family-surfacing test); an orphan-worktree's path in `failedPaths` matches directly; empty `failedPaths` → empty result for `'failed'`; calling `filterRows` with no 4th argument still behaves exactly as before (default-parameter regression guard) (depends on T002)
- [X] T004 [P] [US1] Add a "Failed" chip in `src/renderer/view/summary.ts`: append `makeChip('failed', failedPaths.size, activeFilter === 'failed', () => onFilterChange('failed'), 'sw-fail')` after the existing state chips; do NOT add `'failed'` to the `STATES`/`SEG_CLASS` arrays that drive the `sumbar` composition segments (per research.md R2 — failed overlaps with existing states and would double-count there); `renderSummary` gains a `failedPaths: Set<string>` parameter (depends on T001)
- [X] T005 [P] [US1] Add `.sw-fail` CSS class to `src/renderer/styles.css`, reusing the `--fail` colour token 006 already introduced (mirrors `.sw-dead`); `.seg-fail` is deliberately **not** added — 'failed' is excluded from the `sumbar` segments (R2), so a `seg-fail` class would never be applied by any code path (depends on T001)
- [X] T006 [US1] Wire `src/renderer/renderer.ts`: pass `failedPaths` into both the `renderSummary(...)` call and the `filterRows(sorted, stateFilter, settings.showWorktrees, failedPaths)` call in `render()` (depends on T002, T004)

**Checkpoint**: US1 fully works — selecting "Failed" narrows the list correctly. MVP deliverable.

---

## Phase 3: User Story 2 — See at a glance whether anything needs attention (Priority: P2)

**Goal**: The Failed chip's count is visible and accurate whether or not it is
the currently selected filter.

**Independent Test**: Run "Pull all" with a mix of outcomes and confirm the
Failed chip's count matches the actual number of failed repositories without
ever selecting the chip. Maps to spec.md US2 acceptance scenarios 1–2.

- [X] T007 [US2] Manually verify per quickstart.md that the Failed chip's count is correct and visible regardless of which filter is active, both before selecting it and after switching to/from another filter — no new implementation: `renderSummary` (T004) already renders every chip's count unconditionally of `activeFilter`, so this story is closed by the same code as US1, verified rather than built (depends on T004)

**Checkpoint**: Both user stories verified independently — narrowing (US1) and always-visible counting (US2).

---

## Phase 4: Polish & Cross-Cutting

- [X] T008 [P] Run `pnpm build` and `pnpm test`; resolve any type/lint failures
- [X] T009 Manual quickstart validation per `quickstart.md` — zero-state before any run, post-run count/narrowing, resolve-and-rerun clearing the entry, worktree family-surfacing with Worktrees off, and confirm the `sumbar` composition strip is unchanged (no new segment)

---

## Dependencies

- **Foundational (T001)** → everything.
- **US1 (T002–T006)**: T002 needs T001; T003 needs T002; T004/T005 need only T001 (parallel with T002/T003 — different files); T006 needs T002 and T004.
- **US2 (T007)**: needs T004 (verification only, no new code).
- **Polish (T008–T009)**: after the stories they validate.

## Parallel Opportunities

- **US1**: T003 (tests), T004 (chip), T005 (CSS) can all proceed in parallel once T001 lands (three different files, T004/T005 need nothing from T002/T003).
- **Polish**: T008 alone; T009 is manual and follows it.

## Implementation Strategy

- **MVP = US1 (Phases 1–2)**: the filter actually narrows the list correctly. Shippable on its own.
- **Increment 2 = US2**: no new code — confirms the count T004 already renders is correct and always visible.
- Do all code work in the existing `006-update-all-repositories` worktree/branch (this feature depends on 006's unmerged `failedPaths` state — see plan.md).

## Task Count

9 tasks — Foundational 1 · US1 5 · US2 1 · Polish 2.
