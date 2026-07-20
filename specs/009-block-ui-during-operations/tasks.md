# Tasks: Block UI During Long Operations

**Input**: Design documents from `/specs/009-block-ui-during-operations/`
(current design = **Revision 2026-07-19e**, re-expanded lockout — block all
repository operations, cursor-only for controls that must not dim)

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ui-lockout.md ✓, quickstart.md ✓

> **Two-part history**: T001–T009 below implement Revision 2026-07-19b/d (the
> per-row/per-button design narrowed by constitution v2.0.0) and are **already
> done** — build/tests are green, only T009's manual quickstart pass is still
> owed. T010–T016 (new, at the bottom) implement Revision 2026-07-19e
> (constitution v3.0.0), which re-expands the lockout to (almost) every
> repository-operating control. T010+ *extend* the T001–T008 code; they do not
> revert it.

**Tests**: No new pure logic is introduced — the timing helper in `loadstate.ts`
is reused unchanged — so there is **no new unit-test task** (YAGNI). The existing
`tests/loadstate.test.ts` must keep passing; all DOM/interaction behavior is
validated manually via `quickstart.md`.

**Organization**: Grouped by user story. US1 (P1) is the MVP. US2 (P2) is an
independent gate that was already delivered by the prior implementation and is
*unchanged* by this revision — its tasks here are preserve-and-verify.

> ⚠️ **This is a transform, not greenfield.** The code currently in this worktree
> implements the *superseded* whole-UI lockout (native `inert` on `.app`, a
> full-viewport `.busy-overlay` scrim). Most tasks below therefore **remove or
> rescope** existing code. See `plan.md` "Structure Decision" — this revision is
> largely subtractive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (Setup, Foundational, Polish carry no story label)
- Exact file paths are included in every task.

## Path Conventions

Single-project Electron app. Renderer-only change: all source under
`src/renderer/`; no test file changes. Main process, IPC surface, and
`src/shared/types.ts` are untouched (see `contracts/ui-lockout.md` §Scope).

> ⚠️ **Worktree required** (global rule): all edits happen in
> `.worktrees/009-block-ui-during-operations`, never on `main`.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before transforming anything.

- [X] T001 Verify baseline builds and tests pass: run `pnpm run build` then `pnpm test` from repo root and confirm both are green before editing.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Re-scope the DOM/CSS from a whole-UI scrim to a table-scoped loader +
row dim. Pure structure/appearance — no behavior yet, safe for both stories.

**⚠️ CRITICAL**: T002/T003 must land before US1's orchestration (T005) can show the new cues.

- [X] T002 [P] In `src/renderer/index.html`: wrap `#list` in a `<div class="table-wrap">` (a positioned container) and move the loader host **inside** that wrap as a sibling of `#list`, renaming `#busyOverlay` → `#tableLoader` (class `.table-loader`, `hidden` by default). Remove the old full-viewport `<div class="busy-overlay" id="busyOverlay">` that currently sits outside `.app` (per research.md R3).
- [X] T003 [P] In `src/renderer/styles.css`: retire the full-viewport `.busy-overlay` scrim rules (`position: fixed; inset: 0` dark backdrop, lines ~696-709); add `.table-wrap { position: relative }`, `.table-loader` (absolute, centred over the wrap, **transparent** background — no dark scrim — reusing the existing `.loader-dot` dots, `hidden` when `[hidden]`), and `.list.busy` (row dim via `opacity: ~0.18` — "barely visible" per FR-004; keep it ≥ ~0.12 so state glyphs/colours stay faintly perceptible, and add a short `transition: opacity` so the dim fades rather than snaps). Keep `.ctrl.refresh/.pull-all/.cleanup.busy` and `.ctrl.disabled` as-is (they already provide FR-003's running/blocked cues).

**Checkpoint**: Table-scoped loader host + row-dim CSS exist (hidden/inert); no JS wiring yet.

---

## Phase 3: User Story 1 - See which action is running and can't start a conflicting one (Priority: P1) 🎯 MVP

**Goal**: While one of Refresh/Pull all/Cleanup runs, the other two of those three
buttons are non-interactive (each showing its own state), the table rows dim to
barely-visible (repository + worktree rows), the loader shows over the table
(150 ms show-delay / 400 ms min-visible), and every cue releases on *any*
settlement — while Settings, the Worktrees toggle, filter chips, sort, and row
actions stay fully interactive (FR-001/002/003/004/005/006/009/013).

**Independent Test**: Start each long operation on a non-empty list; for its full
duration the other two buttons cannot be activated (pointer or keyboard), the
active one shows busy, the rows dim, and the loader shows over the table — while
Settings/toggle/filter/sort/row actions all still work; after it ends (incl. a
forced failure/rejection) the buttons restore and no dim/loader lingers.
(quickstart.md Scenarios A, B, C, E, F, G, H.)

### Implementation for User Story 1

- [X] T004 [P] [US1] In `src/renderer/view/toolbar.ts`, extend mutual exclusion to include Refresh so any one of the three blocks the other two: block Refresh (`.disabled`, unwired, `aria-disabled="true"`) when `!refreshing && (updating || cleaning)`; add `refreshing` to the existing Pull all and Cleanup lock conditions; keep the running button's `.busy`. Leave the Settings and Worktrees-toggle wiring **unconditional** (never blocked). (FR-001/002/003/009; contracts/ui-lockout.md §Toolbar eligibility.)
- [X] T005 [US1] In `src/renderer/renderer.ts`, rework `beginBusyLock`/`endBusyLock`: **remove** `els.app.inert = true/false`; on the 150 ms `busyShowTimer` add the `busy` class to `els.list` and show the renamed `#tableLoader` via `setLoaderVisible` (record `busyLoaderShownAt`); on teardown clear the timer and, if the loader was shown, remove `list.busy` + hide the loader together after `remainingMinVisibleMs`, else do nothing visual. Update the `els` map: rename `busyOverlay` → `tableLoader` and drop the now-unused `els.app`. (FR-004/005; contracts/ui-lockout.md state machine; reuses `loadstate.ts` unchanged.)
- [X] T006 [US1] In `src/renderer/renderer.ts`, verify/retain the `finally`-based release in `doRefresh`, `doUpdateAll`, and `doCleanup` (including Cleanup's `onConfirm`/`onCancel` and the `scanCleanup` catch) so the flag reset + `endBusyLock()` run on resolve, failure-result, **or reject/throw** — now releasing the row dim + loader rather than `inert`. Also drop `els.app.inert` from the startup path (the initial load reuses `beginBusyLock`/`endBusyLock`). Additionally, add a defense-in-depth re-entry guard to `doRefresh` (`if (updating || cleaning) return`) to match `doUpdateAll`/`doCleanup`, so the at-most-one invariant (FR-002/SC-005) holds in code, not only via toolbar wiring. This is behaviorally safe: both `doUpdateAll` and the Cleanup `onConfirm` call `doRefresh()` only *after* their `finally` has reset `updating`/`cleaning` to `false`, so the guard never blocks a legitimate post-op refresh. (FR-002/006/013 / INV-1/INV-2; depends on T005.)

**Checkpoint**: US1 fully functional — per-button block + row dim + table loader during every long op, always recovering, with the rest of the UI live. MVP shippable.

---

## Phase 4: User Story 2 - Disable bulk actions when there is nothing to act on (Priority: P2)

**Goal**: When the discovered repository set is empty, Pull all and Cleanup are
disabled while Refresh stays enabled; gating uses the full discovered set
(`rows`), never the filtered view (FR-007/008/010). Already delivered by the prior
implementation and unchanged by this revision — preserve it through the T004 edit.

**Independent Test**: Empty discovered set → Pull all + Cleanup non-interactive,
Refresh interactive; populate via Refresh → they enable; repositories present but
the Failed filter hiding every row → Pull all + Cleanup **stay** enabled.
(quickstart.md Scenario D.)

### Implementation for User Story 2

- [X] T007 [US2] In `src/renderer/view/toolbar.ts`, ensure the T004 rewrite preserves the `hasRepos` gate: Pull all / Cleanup remain unwired + `.disabled` when `!hasRepos`, and Refresh is never gated by `hasRepos` (FR-007/008). Confirm in `src/renderer/renderer.ts` that `hasRepos` is still derived as `rows.length > 0` from the full discovered set, not `visible`/filtered (FR-010). (Depends on T004; mostly verification — the mechanism already exists.)

**Checkpoint**: US1 and US2 both independently functional; empty-set gating and the new per-button lock coexist without regression.

---

## Phase 5: Polish & Cross-Cutting

- [X] T008 Run `pnpm run build` then `pnpm test`; confirm `tests/loadstate.test.ts` still passes and there are no type errors (watch for dangling references to the removed `els.app` / `#busyOverlay`).
- [ ] T009 Execute `quickstart.md` scenarios A–H manually via `pnpm start`: per-button block, row dim (incl. worktree rows), table loader timing, Settings/toggle/filter/sort/row actions staying live, empty-list gating, filter-hidden staying enabled, failure/rejection recovery, one-at-a-time. **Not completed by the implementing agent** — confirmed the app boots cleanly (no console/main-process errors) but interactive click/keyboard/timing verification requires a human running the app; still owed before merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none — start immediately.
- **Foundational (T002, T003)**: after Setup. Blocks US1's visual wiring (T005).
- **US1 (T004–T006)**: T004 needs only Setup; T005 needs T002+T003; T006 needs T005.
- **US2 (T007)**: after T004 (same file); independent of the US1 renderer work otherwise.
- **Polish (T008, T009)**: after all desired stories.

### Within US1

- T005 (cue rework) before T006 (`finally` teardown must call the reworked `endBusyLock`).
- T004 (toolbar) is independent of T005/T006 (different file) — hence [P].

### Parallel Opportunities

- T002 ∥ T003 (different files: `index.html`, `styles.css`).
- T004 (`toolbar.ts`) ∥ T005/T006 (`renderer.ts`) — disjoint files. T007 also touches `toolbar.ts`, so sequence T004 → T007.
- US2 (T007) can proceed as soon as T004 lands, in parallel with T005/T006.

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 (baseline green) → T002/T003 (rescope DOM/CSS) → T004 (toolbar mutual exclusion) → T005 (row dim + table loader) → T006 (`finally` recovery + startup cleanup).
2. **STOP & VALIDATE**: quickstart Scenarios A, B, C, E, F, G, H. This is the core Principle IV (v2.0.0) behavior and is shippable alone.

### Incremental Delivery

1. Setup + Foundational → DOM/CSS rescoped.
2. US1 → validate → ship (MVP: per-button lock + row dim + loader, always recovers).
3. US2 → validate Scenario D → ship (empty-set gating preserved, filter-safe).
4. Polish → full build/test + quickstart A–H.

---

---

## Phase 6: User Story 1 continued — full repository-operation lockout (Revision 2026-07-19e)

**Goal**: Extend the already-shipped per-button lock so that Settings, the
Worktrees toggle, filter chips, the sort-header row, and every row-level
action are ALSO blocked while a long operation runs — matching FR-001/
FR-011/FR-012/FR-014/FR-015/FR-016/FR-017. Table rows and the sort-header row
dim (the only two things that dim); everything else blocked must render
pixel-identical to idle except for the cursor.

**Independent Test**: Repeat quickstart.md Scenario A end-to-end: start any
long operation and confirm Settings, the Worktrees toggle, every filter chip,
the sort-header row, and every row's delete/launch buttons all stop
responding (pointer + keyboard) with no colour/opacity change (cursor
`not-allowed` only), while the table rows and sort-header row dim and the
loader shows; confirm the row directory-path tooltip doesn't appear; confirm
everything restores on settlement (Scenario E covers the failure path).

### Implementation for User Story 1 (continued)

- [X] T010 [P] In `src/renderer/styles.css`: restyle `.ctrl.disabled` — drop `opacity: 0.45`, add `cursor: not-allowed`, and add `.ctrl.disabled:hover { border-color: var(--line); color: var(--muted); }` to cancel `.ctrl:hover`'s colour change (divs always match `:hover`, unlike native buttons). Add `.thead.busy { opacity: 0.18; cursor: not-allowed; }` (same barely-visible opacity as `.list.busy`). Add `.filter:disabled { cursor: not-allowed; }`. Add `.row-action-ico:disabled { cursor: not-allowed; }` and `.row-delete-ico:disabled { cursor: not-allowed; }` (plain `:disabled` rules — do NOT touch the existing `.row-action-ico.disabled { opacity: 0.35 }`, which stays reserved for the permanent "no remote configured" case, R3). Add `.list.busy .name[data-tip]:hover::after { display: none; }` (FR-017; no other `[data-tip]` tooltip is affected). (research.md R2/R3/R4/R5.)
- [X] T011 [P] [US1] In `src/renderer/view/toolbar.ts`: derive `const busy = state.refreshing || state.updating || state.cleaning;` inside `renderToolbar`. Gate the Settings button and the Worktrees toggle's `wireActivate` calls on `!busy` (both are currently unconditional), and apply the same `.disabled`/`aria-disabled` treatment they already have for the busy/blocked buttons. Do NOT change their wiring based on `hasRepos` — only `busy` gates them. (FR-011/FR-012; research.md R1.)
- [X] T012 [P] [US1] In `src/renderer/view/summary.ts`: add a `locked: boolean` parameter to `renderSummary` (after `failedPaths`), and in `makeChip` set `btn.disabled = locked` on every chip (including 'all' and 'failed'). No CSS/class change needed here beyond T010's `.filter:disabled` rule. (FR-015; research.md R2.)
- [X] T013 [P] [US1] In `src/renderer/view/table.ts`: thread a `locked: boolean` parameter through `renderRows` → `buildRow` → `buildMenuCell`/`buildDeleteCell`. In both button builders, set `btn.disabled = true` when `locked` is true (in addition to, not instead of, the existing "no remote configured" disablement in `buildMenuCell`, which keeps its own `.disabled` class untouched — R3). In `buildRow`, set `row.tabIndex = locked ? -1 : 0`. (FR-004 inertness/FR-016; research.md R3/R6.)
- [X] T014 [US1] In `src/renderer/renderer.ts`: in `render()`, compute `busy` (reuse the module-level `refreshing`/`updating`/`cleaning`) and pass it as the new `locked`/`busy` argument to `renderSummary(...)` and `renderRows(...)`. In `beginBusyLock`/`endBusyLock`, toggle a `busy` class on `els.thead` alongside `els.list` (add `thead: document.getElementById('thead')` is already in `els` — reuse it). Guard the callback passed to `wireSortHeaders` with `if (refreshing || updating || cleaning) return;` before calling `onSort`. (FR-014 functional half; FR-015/FR-016 wiring; depends on T012/T013 for the new parameters.)
- [X] T015 Run `pnpm run build` then `pnpm test`; confirm `tests/loadstate.test.ts` still passes and there are no type errors from the new `renderSummary`/`renderRows` parameters.
- [ ] T016 Execute `quickstart.md` scenarios A–I manually via `pnpm start`, with particular attention to Scenario I (no control besides the two dims ever changes colour) and Scenario H (worktree rows are equally inert). **Not completed by the implementing agent** — confirmed the app boots cleanly (no console/main-process errors) but interactive click/hover/cursor verification requires a human running the app; still owed before merge.

**Checkpoint**: Every control that operates on repositories is blocked while
a long operation runs; only the table rows and sort-header row visually dim;
everything else is cursor-only; the directory-path tooltip is suppressed;
recovery-on-settlement still holds for every one of these controls.

---

## Phase 7: Convergence

- [X] T017 CRITICAL: Gate the empty-state "+ Add directory…" button on `!busy` per FR-011 (missing). `src/renderer/view/empty.ts`'s `renderEmptyState` wires its button unconditionally to `onAddDirectory`, and `renderer.ts:266` passes `() => { openSettingsModal(); render(); }` with no `busy` check — unlike the toolbar's Settings button, which is correctly gated in `toolbar.ts`. Since the empty state renders whenever `rows.length === 0`, which can coincide with a running Refresh (FR-008 keeps Refresh available on an empty list), a user can open Settings mid-operation through this second path, violating FR-011/Constitution Principle IV. Fix: thread the same `busy` flag already computed in `render()` into `renderEmptyState` (new parameter) and either disable the button (native `<button disabled>`, cursor `not-allowed`, no colour change — same treatment as the toolbar Settings button, FR-003) or skip wiring its click handler while `busy`. **Verified already satisfied**: `empty.ts`'s `locked` parameter (`btn.disabled = locked`) and `renderer.ts`'s `renderEmptyState(..., busy)` call both shipped in the same commit as T010–T016 (confirmed via `git blame`); `pnpm run build && pnpm test` re-run clean (102/102 passing) — no code change needed.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Renderer-only: **no** new IPC, main-process, dependency, or persisted setting (plan.md; contracts/ui-lockout.md §Scope).
- This revision is largely **subtractive**: the load-bearing removals are `els.app.inert` and the full-viewport scrim. Do not reintroduce a whole-UI dim or input barrier.
- T006 also preserves the earlier latent-freeze fix: flags must clear on the reject path, not only the happy path.
- **FR-013 recovery is validated manually** (quickstart Scenario E — a forced failure/rejection). This satisfies the constitution's Development-Workflow rule to exercise at least one failure path by hand; no automated renderer test is added because the project has no DOM/async test harness and the convention is manual DOM validation (YAGNI). If a harness is ever introduced, a reject-path regression test for the three `finally` blocks is the first thing to add.
- **Startup continuity**: the initial load reuses `beginBusyLock`/`endBusyLock`, so after this change the startup path also dims the (skeleton) rows and shows the table loader instead of the old full-viewport scrim. This is intended continuity from the unified-busy-lock refinement, not new feature scope — verify it still looks right in T009.
- Commit after each task or logical group; keep the diff surgical (match existing style).
- All work in `.worktrees/009-block-ui-during-operations`, never on `main`.
