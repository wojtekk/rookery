---
description: "Task list for Delete Repository Row"
---

# Tasks: Delete Repository Row

**Input**: Design documents from `/specs/004-delete-repository-row/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-api.md, contracts/delete.md, quickstart.md

**Tests**: Included for the pure risk-combination logic (`computeDeleteRisk`) — the
constitution's Development Workflow mandates "any code that mutates repository
state (pull, delete, remove) MUST leave at least one runnable check that fails
if the guard or safety behavior breaks," and `contracts/delete.md` already
specifies `tests/delete-risk.test.ts`. Dialog sequencing, trash/worktree-remove,
and fetch-failure behavior are validated manually via `quickstart.md` (they
require real git repos / real dialogs, matching the project's existing
"no DOM/process test harness" precedent from 003).

**Organization**: Grouped by user story. US1 and US2 are both P1 and share one
function (`deleteRow`'s dialog sequence) by construction — the spec explicitly
calls them equally critical ("US2 is the safety mechanism the whole feature
exists to provide... as critical as the baseline delete flow itself"), so they
are implemented together in US1 and MUST ship together; US2's phase is the
verification specific to its risk-warning scenarios. US3 (P2) is a genuinely
separate, additive code change (the worktree-removal branch) layered on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)
- Exact file paths included in every task

## Path Conventions

Single-project Electron layout: `src/main`, `src/preload`, `src/renderer`, `src/shared`,
tests at repo-root `tests/` (compiled to `dist/tests/*.test.js`, run by `node --test`).

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching main/preload/renderer.

- [X] T001 Run `pnpm install && pnpm run build && pnpm test` from repo root and confirm a clean build and all 63 existing tests pass before making changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared types and the pure risk-assessment logic every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `DeleteTarget`, `DeleteRiskResult`, and `DeleteOutcome` types to `src/shared/types.ts` per `data-model.md`, and add `deleteRow(target: DeleteTarget): Promise<DeleteOutcome>` to the `RepoDashboardApi` interface. (`DeleteRiskResult` ended up defined in `delete.ts` itself, per data-model.md's "not IPC-visible" note — only `DeleteTarget`/`DeleteOutcome` are in `shared/types.ts`.)
- [X] T003 Add `probeFetch(dir: string): Promise<boolean>` to `src/main/git/probe.ts` per `research.md` R3: runs `git -C dir fetch` via the existing `runGit` helper (inherits `SPAWN_TIMEOUT_MS`), returns `true` on success and `false` on any rejection (including timeout) — never throws. Also exported `runGit` itself (was private) for reuse by the worktree-removal step (T014).
- [X] T004 Create `src/main/delete.ts` and implement `computeDeleteRisk(path: string, hasRemote: boolean): Promise<DeleteRiskResult>` per `data-model.md`'s algorithm: when `hasRemote` is false, skip fetching entirely and add the `"has no remote configured"` reason; when `hasRemote` is true, call `probeFetch` and add `"sync status could not be verified"` on failure; always call `probeStatus` + `parsePorcelainStatusV2` and add `"has uncommitted changes that will be lost"` when `local > 0`; **only when `hasRemote` is true**, check the branch's upstream state — `tracking === 'local-only'` → add `"branch has no upstream / has never been pushed"`, **else** `tracking === 'tracked' && ahead > 0` → add `"has commits that have not been pushed"` (the `hasRemote` guard was added during implementation: without it, a no-remote repo double-counts "no remote" and "local-only" as two reasons for the same underlying fact — caught by T005's own tests). `delete.ts` deliberately has **no** `electron` import (discovered during implementation: requiring `electron` outside the Electron runtime throws in this project's installed version, which would break `delete-risk.test.ts`) — the dialog/shell-touching orchestration (`deleteRow`) lives in `main.ts` instead, alongside `pickDirectory`/`runAction`. (Depends on T002, T003.)
- [X] T005 Create `tests/delete-risk.test.ts` using real temp git repositories (`fs.mkdtempSync` + `execFileSync('git', ...)`, matching the project's existing convention in `readonly.test.ts`/`identity.test.ts` rather than mocking) covering `data-model.md`'s six invariants: clean+remote+fetch-ok+zero-ahead → safe; each of {dirty, no-remote, unreachable-remote/fetch-fails, local-only tracking with a remote present, unpushed-ahead} alone → exactly one reason; dirty+no-remote together → both reasons, one result; and a no-remote repo yields exactly `["has no remote configured"]`, not also `"branch has no upstream"` (proves both the fetch-skip and the double-counting fix). All 7 tests pass. (Depends on T004.)

**Checkpoint**: Risk-assessment core exists and is proven by `node:test` (70/70 tests green including the 7 new ones); no UI or IPC changes yet.

---

## Phase 3: User Story 1 - Remove a clean, disposable repository row (Priority: P1) 🎯 MVP

**Goal**: Every row shows an always-visible delete ("x") icon on its right side;
clicking it on a clean, fully-synced, non-worktree row shows exactly one
confirmation and deletes the directory (trash-backed) from disk and the
dashboard. Because US2's second-dialog logic lives in the same `deleteRow`
function, this phase also delivers US2's mechanism (verified separately in
Phase 4) — the two ship together per spec (both P1).

**Independent Test**: With a clean, fully-pushed repository row, click delete,
confirm once, and verify the directory is gone from disk (recoverable in OS
trash) and the row disappears after refresh (quickstart scenarios 1-3).

### Implementation for User Story 1

- [X] T006 [P] [US1] Add a fixed rightmost grid column to the row layout in `src/renderer/styles.css` (`.row`/`.thead` shared `grid-template-columns`, both the default and the `max-width: 920px` responsive breakpoint) for the delete icon, plus a matching empty `<span>` in `index.html`'s `.thead`; add a `.row-delete-ico` style (same size/shape family as `.row-action-ico` but always visible, with a red hover state signaling danger).
- [X] T007 [US1] In `src/renderer/view/table.ts`, add a `buildDeleteCell(entry, isWorktree, handlers)` helper rendering a `×` button with `aria-label="Delete"`; wire its click to `handlers.onDelete({ path: entry.fullPath, isWorktree })`. Appended this cell in `buildRow` after the existing `buildMenuCell` call so it renders on every row regardless of `actions.length`. Added an `onDelete` field to the `RowActionHandlers` interface. (Depends on T006.)
- [X] T008 [US1] Implemented the `deleteRow` orchestration in `src/main/main.ts` (not `delete.ts` — see T004's note) per `contracts/delete.md`: dialog 1 → determine `hasRemote` via `probeRemoteUrl` → `computeDeleteRisk` → dialog 2 if at-risk → removal. The whole flow from after dialog 1 through removal is one `try/catch`; on any failure it checks whether the path still exists (`fs.stat`) and treats "already gone" as `{outcome:'deleted'}` rather than a stale-state error — this also covers the "row disappears during confirmation" edge case (E1/T020), since there is no cached state anywhere in the sequence to go stale. Both the trash (`shell.trashItem` → `fs.rm` fallback) and the worktree-remove branch are implemented together here (see T014 — folded in during implementation rather than left as a literal TODO stub, since the correct final logic was already known). (Depends on T004.)
- [X] T009 [US1] Wired `deleteRow` into `src/main/main.ts`'s `registerIpc()` via `ipcMain.handle('deleteRow', ...)`, expanding the tilde-shortened `target.path` (via the existing `expandTilde`) before use — rows carry tilde-shortened `fullPath` values, same as `runAction` already does. (Depends on T008.)
- [X] T010 [US1] Added the `deleteRow` bridge method to `src/preload/preload.ts`'s `api` object, matching the existing method style.
- [X] T011 [US1] Wired the renderer's `onDelete` handler in `renderer.ts` (alongside the existing `onRun` handler) to call `api.deleteRow(target)` and then `doRefresh()` regardless of outcome — no renderer-side branching on the result. (Depends on T007, T009, T010.)

**Checkpoint**: A delete icon is visible on every row; clicking it on a clean, non-worktree row deletes it after one confirmation; a dirty/unsynced/remote-less non-worktree row correctly shows a second confirmation (US2's mechanism, verified next); worktree rows also already work (T014 was folded in here — see US3 below). Build is clean and all 70 automated tests pass; **interactive GUI verification (quickstart scenarios) could not be run in this session** — see Polish notes.

---

## Phase 4: User Story 2 - Warn before losing uncommitted work or unrecoverable history (Priority: P1)

**Goal**: Confirm the second-dialog mechanism built in Phase 3 correctly
triggers for every risk condition, combines multiple simultaneous risks into
exactly one prompt, and that cancelling it changes nothing.

**Independent Test**: With a repository row that is dirty, unpushed, or
remote-less, click delete, confirm the first prompt, and verify the second
prompt appears naming the specific reason(s) before anything is deleted
(quickstart scenarios 4-8).

### Verification for User Story 2

- [X] T012 [P] [US2] Re-read `computeDeleteRisk`'s reasons-to-dialog-detail formatting in `deleteRow` (`risk.reasons.map(r => \`• ${r}\`).join('\n')`) against every reason string from `data-model.md` — each reads clearly as a standalone bullet continuing dialog 1's "Delete "dirname"?" / dialog 2's "This action is destructive..." framing (matches common OS-native destructive-dialog phrasing that drops an explicit subject, e.g. "has unsaved changes"). No wording change needed.
- [ ] T013 [US2] Execute `quickstart.md` manual scenarios 4-8 (dirty → second dialog; no-remote → second dialog; unpushed → second dialog; dirty+no-remote → exactly one combined second dialog; unreachable remote → treated as at-risk) against disposable scratch repos and confirm each passes, and that cancelling the second dialog in each case leaves the repository untouched. **BLOCKED in this environment**: Electron itself fails to launch here ("Electron failed to install correctly, please delete node_modules/electron and try installing again") — a pre-existing sandbox limitation, not caused by this feature. Requires a human pass on a machine where `pnpm start` actually launches the app.

**Checkpoint**: All of US1 + US2's non-worktree acceptance scenarios pass by code inspection and automated test; the two P1 stories are complete together as the shippable MVP pending the human GUI pass noted above.

---

## Phase 5: User Story 3 - Deleting a worktree row cleanly removes the worktree (Priority: P2)

**Goal**: Clicking delete on a linked or orphan worktree row removes it via
`git worktree remove` (deregistering it from its parent), not a plain folder
delete.

**Independent Test**: With a linked worktree row, click delete and confirm
(plus the second dialog if it's dirty/unsynced), then verify `git worktree
list` on the parent repository no longer shows it (quickstart scenarios 9-10).

### Implementation for User Story 3

- [X] T014 [US3] Implemented the `isWorktree === true` branch in `deleteRow` (`src/main/main.ts`, folded into T008 rather than left as a stub) as `runGit(['-C', target.path, 'worktree', 'remove', target.path, '--force'], path.dirname(target.path))` (research R2 — the process `cwd` is the *parent* directory, never `target.path` itself). `runGit` exported from `git/probe.ts` (T003). **Verified with an ad-hoc real-repo script** (not a permanent test — `deleteRow` itself can't be unit-tested, see T004): created a primary repo + linked worktree via `git worktree add`, ran the exact `-C <target> ... --force` invocation with `cwd` set to the parent, confirmed the worktree directory was removed AND `git worktree list --porcelain` on the primary no longer listed it. Any other git failure surfaces as `{outcome:'failed', reason: err.message}` via the same try/catch as T008.
- [ ] T015 [US3] Execute `quickstart.md` manual scenarios 9-10 (linked worktree row delete; orphan worktree row delete) against a disposable scratch repo with `git worktree add`, and confirm the parent's `git worktree list --porcelain` no longer includes the removed path after each. **BLOCKED in this environment** — same Electron launch limitation as T013; the underlying git mechanic is verified (see T014), but the full click-through-the-UI flow needs a human pass.

**Checkpoint**: All three user stories are functionally complete in code and covered by automated tests + one ad-hoc real-git verification; full interactive GUI validation is pending a human pass (T013/T015/T016-T020).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The remaining edge cases from `spec.md` and `quickstart.md` that
cut across all stories, plus final regression.

- [ ] T016 [P] Execute `quickstart.md` manual scenario 11 (trash recoverability: delete a non-worktree repo, confirm it's present and restorable in the OS trash/recycle bin). **BLOCKED in this environment** — see T013.
- [ ] T017 [P] Execute `quickstart.md` manual scenario 12 (simulate a `shell.trashItem` failure — e.g. a filesystem/volume without trash support — and confirm the `fs.rm` fallback in T008 still succeeds with no third prompt). **BLOCKED in this environment** — see T013.
- [ ] T018 [P] Execute `quickstart.md` manual scenario 13 (delete a directory externally right before confirming; confirm `deleteRow` treats the already-missing path as `{outcome:'deleted'}`, not a failure). **BLOCKED in this environment** — see T013.
- [ ] T019 [P] Execute `quickstart.md` manual scenario 14 (a directory with restrictive permissions; confirm `{outcome:'failed'}` surfaces an error via `dialog.showErrorBox` or equivalent and the row remains on the dashboard). **BLOCKED in this environment** — see T013.
- [ ] T020 [P] Execute `quickstart.md` manual scenario 15 (delete the target directory externally between dialog 1 and dialog 2, and again between dialog 2 and removal; confirm the live re-check / already-missing handling in `deleteRow` (T008) resolves each case as a successful removal rather than a stale-state error — spec.md Edge Case "Row disappears during confirmation"). **BLOCKED in this environment** — see T013.
- [X] T021 Run `pnpm run build && pnpm test` and confirm `dist/tests/delete-risk.test.js` passes with zero regressions in the existing 63-test suite. Result: clean build, **70/70 tests pass** (63 pre-existing + 7 new).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks all user stories.
- **US1 (Phase 3)**: after Foundational — delivers the MVP mechanism (including US2's dialog-2 branch, left wired but only exercised by clean/safe inputs until Phase 4 verifies it).
- **US2 (Phase 4)**: after US1 (verifies behavior US1's implementation already contains) — ships together with US1 as the P1 MVP.
- **US3 (Phase 5)**: after US1 — adds the worktree-removal branch US1 left as a `TODO`.
- **Polish (Phase 6)**: after US1, US2, and US3 are complete.

### Within Foundational

- T002 (types) has no dependency and can start immediately.
- T003 (`probeFetch`) has no dependency and can run in parallel with T002.
- T004 (`computeDeleteRisk`) depends on T002 (types) and T003 (`probeFetch`).
- T005 (test) depends on T004.

### Within User Story 1

- T006 (CSS) and T008 (main logic) have no dependency between them and can run in parallel.
- T007 (table.ts UI) depends on T006 (needs the new column to place the button in).
- T009 (main.ts wiring) and T010 (preload) both depend on T008 and can run in parallel with each other.
- T011 (renderer wiring) depends on T007, T009, and T010 — it is the integration point.

### Parallel Opportunities

- T002 [P] + T003 [P] in Foundational.
- T006 [P] in US1 (independent of T008's main-process work).
- T012 [P] in US2 (independent review task).
- T016-T020 [P] in Polish (independent manual scenarios, different failure modes).

---

## Parallel Example: Foundational

```bash
Task: "Add DeleteTarget/DeleteRiskResult/DeleteOutcome types to src/shared/types.ts"
Task: "Add probeFetch to src/main/git/probe.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Add a fixed rightmost delete-icon grid column in src/renderer/styles.css"
Task: "Implement the deleteRow orchestration function in src/main/delete.ts"
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 together)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (risk-assessment core, proven by `node:test`).
3. Complete Phase 3: User Story 1 (full delete flow for non-worktree rows).
4. Complete Phase 4: User Story 2 (verify the risk-warning mechanism US1 built).
5. **STOP and VALIDATE**: quickstart scenarios 1-8 all pass. This is the MVP —
   ship here if worktree deletion can wait; the spec deliberately makes both
   P1 stories mandatory together because deleting without the safety warning
   would be a data-loss regression, not a smaller-but-safe slice.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 together → MVP (repository-row deletion, fully safety-gated).
3. Add US3 → worktree rows delete correctly too.
4. Polish → edge cases (trash fallback, already-gone, permission failure) confirmed.

---

## Notes

- `[P]` = different files (or, within Foundational, no shared-state dependency), no incomplete-task dependency.
- US1 and US2 intentionally share one implementation task (T008) because the
  spec rates them equally critical (P1/P1) — do not ship US1 without US2's
  dialog-2 branch already wired, even though US2's own phase is verification-
  only.
- Commit after each task or logical group; keep `main` clean (work in this
  worktree per project rules).
- Every scenario in `quickstart.md` MUST be run against disposable scratch
  repositories — this feature performs real, irreversible git/filesystem
  operations.
