---
description: "Task list for Startup Loading Indicator"
---

# Tasks: Startup Loading Indicator

**Input**: Design documents from `/specs/003-startup-loading-indicator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/loadstate.md, quickstart.md

**Tests**: Included for the pure logic module (`loadstate.ts`) — the spec/plan/contract
explicitly call for `node:test` coverage of the screen decision and min-visible timing.
DOM/paint behavior is validated manually via `quickstart.md` (no DOM test harness in this project).

**Organization**: Grouped by user story. This is a **renderer-only** change (no main/IPC/storage).
US1 is the whole feature; US2 (refresh) is mostly existing behavior to verify.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 (setup, foundational, polish carry no story label)
- Exact file paths included in every task

## Path Conventions

Single-project Electron layout: `src/main`, `src/preload`, `src/renderer`, `src/shared`,
tests at repo-root `tests/` (compiled to `dist/tests/*.test.js`, run by `node --test`).

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching the renderer (the Electron binary
install has been fragile on this machine — verify it works before, so any later failure is
attributable to our change, not the toolchain).

- [X] T001 Run `pnpm run build && pnpm test` from repo root and confirm both are green (all existing `dist/tests/*.test.js` pass, Electron builds) before making changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure decision + timing core that the loader and the boot rewiring both
depend on. Isolated from DOM/timers so it is unit-testable (matches the project's
`view/filter.ts` + `tests/filter.test.ts` convention).

**⚠️ CRITICAL**: US1 cannot be implemented until this phase is complete.

- [X] T002 Create pure logic module `src/renderer/view/loadstate.ts` per `contracts/loadstate.md` §A: export types `LoadState` (`'loading' | 'ready'`) and `StartupScreen` (`'loader' | 'add-directory' | 'results'`); export constants `LOADER_SHOW_DELAY_MS = 150` and `LOADER_MIN_VISIBLE_MS = 400`; implement `decideStartupScreen(loadState, hasDirectories)` (per the 4-row decision table — `hasDirectories === true` must never yield `'add-directory'`) and `remainingMinVisibleMs(shownAt, now, minMs = LOADER_MIN_VISIBLE_MS)` (0 when `shownAt === null` or elapsed; otherwise `minMs - (now - shownAt)`; never negative). No DOM, no clock reads inside the functions.
- [X] T003 Create `tests/loadstate.test.ts` (import from `../src/renderer/view/loadstate`) covering: all 4 `decideStartupScreen` combinations incl. the SC-006 invariant (`hasDirectories === true` never → `'add-directory'`); `remainingMinVisibleMs` for never-shown (`null` → 0), already-elapsed (→ 0), mid-window (→ positive ≤ minMs), and never-negative. Run `pnpm test` and confirm the new file is picked up and passes.

**Checkpoint**: Pure core exists and is proven by `node:test`.

---

## Phase 3: User Story 1 - See that data is loading at startup (Priority: P1) 🎯 MVP

**Goal**: On launch with directories configured, show a flat, indeterminate, centered loader
until the repository list renders — and never flash the add-directory screen first.

**Independent Test**: Launch with ≥1 configured directory containing repos; a centered flat
loader is visible from launch until the list renders, no interaction, no add-directory flash
(quickstart scenarios 1, 3, 4).

- [X] T004 [P] [US1] Add a `<div class="loader" id="loader" hidden></div>` container to `src/renderer/index.html` in the content area, as a sibling of `#list` and `#empty` (lines 44-45).
- [X] T005 [P] [US1] Add flat indeterminate centered loader styles + `@keyframes` to `src/renderer/styles.css`: center in the content area (same region as `#list`/`#empty`), flat/minimal (no percentage, no heavy chrome), GPU-friendly `transform`/`opacity` animation only (must not block the main thread). Reuse the existing `@media (prefers-reduced-motion: no-preference)` block (line 912) / `@keyframes spin` (line 930) idioms.
- [X] T006 [US1] Create `src/renderer/view/loader.ts` exporting `setLoaderVisible(container: HTMLElement, visible: boolean): void` per `contracts/loadstate.md` §B: idempotent; when showing, also hide `#list` and `#empty` so exactly one of loader/list/empty is visible; no `title`/ARIA this iteration. (Depends on T004.)
- [X] T007 [US1] Rewire the boot IIFE in `src/renderer/renderer.ts` (lines 163-170) per `contracts/loadstate.md` §C: `await api.getSettings()` and compute `hasDirectories` BEFORE first content paint; set `loadState = 'loading'`; render via `decideStartupScreen(...)` (add-directory screen if no dirs, else schedule the loader after `LOADER_SHOW_DELAY_MS` via `setTimeout`, recording `loaderShownAt`); keep `loadState = 'loading'` across BOTH `listRepositories()` and `refresh()` (do NOT paint the intermediate `listRepositories()` result); on `refresh()` resolution set `loadState = 'ready'` and, if the loader was shown, defer the swap to results by `remainingMinVisibleMs(loaderShownAt, now)` before rendering results. (Depends on T002, T006.)
- [X] T008 [US1] Wrap the startup scan in `renderer.ts` in `try/catch` (covering `getSettings`/`listRepositories`/`refresh`) so a rejected/failed scan still sets `loadState = 'ready'` (in `catch`/`finally`) and resolves the loader to the empty state — never an indefinite spinner (FR-007 / SC-005). Optionally surface the failure via the existing `showNotice(...)` toast. (Depends on T007.)
- [X] T009 [US1] Gate the empty-state branch in `render()` (`src/renderer/renderer.ts` lines 107-114) on `loadState === 'ready'` so `render()` no longer unconditionally re-shows `#empty` for zero rows during the loading window (M1 / `contracts/loadstate.md` §C step 6). While `loadState === 'loading'` and `hasDirectories`, the loader owns the content area and both `#list` and `#empty` stay hidden. (Depends on T007.)

**Checkpoint**: US1 fully functional — startup loader shows/hides correctly, no add-directory flash, no infinite spinner on failure.

---

## Phase 4: User Story 2 - See that data is refreshing on demand (Priority: P2)

**Goal**: An explicit refresh surfaces a loading affordance until the refreshed list renders.

**Independent Test**: With the list displayed, trigger refresh; a loading affordance appears
until the updated list renders (quickstart scenario 6).

- [X] T010 [US2] Verify the existing explicit-refresh affordance satisfies FR-009: `doRefresh()` (`src/renderer/renderer.ts` lines 62-69) sets `refreshing` and `render()` passes it to `renderToolbar` (line 74) → toolbar busy state. Confirm this still holds after the US1 changes (the startup loader must NOT hijack on-demand refresh — refresh keeps the already-rendered list and uses the toolbar affordance, per research Decision 6). Adjust `renderer.ts`/`src/renderer/view/toolbar.ts` only if a gap is found.

**Checkpoint**: Both stories work; refresh uses the toolbar affordance, startup uses the content-area loader.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T011 [P] Execute `quickstart.md` manual validation scenarios 1-6 (loader visible on slow scan, responsive window, fast-scan no-flash, no-dirs add-directory-only, scan-failure resolves, refresh affordance) and confirm each passes.
- [X] T012 Run `pnpm run build && pnpm test` and confirm `dist/tests/loadstate.test.js` passes with zero regressions in the existing suite.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks US1.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: independent of US1's core but must be re-verified after US1 lands (T010 checks US1 didn't regress refresh).
- **Polish (Phase 5)**: after US1 (and US2) complete.

### Within User Story 1

- T004 and T005 are parallel (HTML vs CSS, different files).
- T006 depends on T004 (needs the `#loader` element contract).
- T007 depends on T002 (pure logic) + T006 (loader render).
- T008 and T009 both depend on T007 (they modify the same boot/render flow) → run sequentially, not [P].

### Parallel Opportunities

- T004 [P] + T005 [P] (index.html + styles.css) can run together.
- T002 and T003 are sequential (test imports the module → compile coupling).

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 Setup (T001) → 2. Phase 2 Foundational (T002-T003) → 3. Phase 3 US1 (T004-T009).
4. **STOP and VALIDATE**: quickstart scenarios 1, 3, 4, 5 (startup loader + no-flash + failure).
5. Ship — this is the entire core value.

### Incremental

- Add US2 verification (T010) → then Polish (T011-T012).

---

## Notes

- Renderer-only: no tasks touch `src/main`, `src/preload`, `src/shared`, or storage.
- `[P]` = different files, no incomplete-task dependency.
- H1 (T008), H2 (T007), M1 (T009) trace directly to the reviewed contract fixes — do not drop them.
- Commit after each task or logical group; keep `main` clean (work in a worktree per project rules).
