# Tasks: Cleanup Gone Branches and Worktrees

**Input**: Design documents from `/specs/008-branch-cleanup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-cleanup.md

**Tests**: INCLUDED — the constitution requires a runnable safety check for any
mutating operation (pull, push, delete, remove) plus manual exercise of a failure
path. plan.md/research.md/quickstart.md specify an engine test matrix, so test
tasks are not optional here.

**Organization**: By user story. US1 (remove engine) and US2 (review overlay) are
both P1 and interlocked (the overlay is the consent gate for removal); US1 is
independently *tested* via the engine matrix (no UI), US2 via overlay behavior.
US3 (P2) is the running indicator + summary polish. Existing single-project
Electron/TS layout (`src/`, `tests/` at repo root); no new scaffolding.

**Already on `main` (reused, NOT re-created)**: `runGit(args, cwd, opts?)` with
`{ timeoutMs?, env? }` (`src/main/git/probe.ts`) and the exported `runPool`
(`src/main/scan.ts`) — both landed with feature 006.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (user-story phases only)

---

## Phase 1: Setup

**Purpose**: Create the new files so later tasks touch them independently. No new
dependencies (reuses `runGit`, `runPool`, `showNotice`, settings-modal CSS).

- [X] T001 Create empty stubs `src/main/cleanup.ts`, `tests/cleanup.test.ts`, and `src/renderer/view/cleanup.ts` (tsconfig already globs `src/`/`tests/`; no build wiring needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types + reusable primitives every story depends on. MUST complete before US1.

- [X] T002 [P] Add `CleanupReason`, `CleanupCandidate`, `CleanupSelection`, `CleanupResult`, `CleanupOutcome` types and the `scanCleanup(): Promise<CleanupCandidate[]>` + `executeCleanup(selection: CleanupSelection[]): Promise<CleanupOutcome[]>` methods on `RepoDashboardApi` in `src/shared/types.ts` (per data-model.md)
- [X] T003 [P] Make the family-grouping and non-interactive env reusable by cleanup: `export` `groupIntoFamilies` and `NON_INTERACTIVE_ENV` from `src/main/update.ts` (change `function`/`const` → `export …`); existing update usage unaffected (per research D6)

**Checkpoint**: Types compile; `cleanup.ts` can import `runGit`, `runPool`, `groupIntoFamilies`, `NON_INTERACTIVE_ENV`.

---

## Phase 3: User Story 1 — Clean up stale branches and worktrees in one action (Priority: P1) 🎯 MVP

**Goal**: The detect + remove engine (`scanCleanup` / `executeCleanup`) with its
IPC, the header **Cleanup** button, and the `doCleanup()` orchestration that runs
the two-phase flow per repository (not per worktree).

**Independent Test**: Automated engine matrix (T004) on temp-git-repo fixtures —
proves detection and removal without any UI. Maps to spec.md US1 acceptance
scenarios 1–4.

- [X] T004 [P] [US1] Write engine tests in `tests/cleanup.test.ts` using real temp-git-repo fixtures (pattern: `tests/delete-risk.test.ts`, quickstart.md setup): detect `[gone]` branch; detect `[gone]` branch + linked worktree; detect missing-directory worktree; detect merged-branch worktree; **current branch and main worktree never detected**; dedupe/precedence `gone-branch > missing-worktree > merged-worktree` (research D4); `executeCleanup` removes **only** the passed selection; a present worktree with an uncommitted file is **kept** and reported `skipped` (plain `worktree remove` refuses — Principle III); missing-dir worktree removed with `--force`; unmerged `[gone]` branch force-deleted via `branch -D` (depends on T001)
- [X] T005 [US1] Implement per-repo detection `scanRepoCleanup(repoPath): Promise<CleanupCandidate[]>` in `src/main/cleanup.ts`: `git fetch -p` → `git for-each-ref --format='%(refname:short) %(upstream:track) %(worktreepath)' refs/heads/` (candidate when track === `[gone]`) → `git worktree list --porcelain` (missing-dir via `prunable`/`fs.existsSync`; merged via `git merge-base --is-ancestor <branch> <defaultBranch>`); resolve default branch from the main worktree; skip current branch + main worktree; apply dedupe/precedence; build `CleanupCandidate` with `worktreeDirMissing` + stable `id` (research D1/D2/D3/D4, data-model.md) (depends on T002, T004)
- [X] T006 [US1] Implement `scanCleanup(rows): Promise<CleanupCandidate[]>` orchestrator in `src/main/cleanup.ts`: filter `kind === 'repository'`, `groupIntoFamilies`, `runPool(families, 6, …)`, each repo under `NON_INTERACTIVE_ENV` + a ~60s deadline race; flatten candidates; a repo that errors/times out contributes none and never throws (research D5/D6, contracts/ipc-cleanup.md) (depends on T003, T005)
- [X] T007 [US1] Implement `removeCandidate(candidate): Promise<CleanupResult>` in `src/main/cleanup.ts` per the command matrix (research D3): `gone-branch`+present-worktree → `git -C <repo> worktree remove <wpath>` (NO `--force`; failure ⇒ `skipped`, keep) then `git -C <repo> branch -D <branch>`; `gone-branch`+missing-dir → `worktree remove --force` then `branch -D`; `gone-branch` no worktree → `branch -D`; `missing-worktree` → `worktree remove --force`; `merged-worktree` → `worktree remove` (no `--force`, branch left intact); all paths tilde-expanded, `NON_INTERACTIVE_ENV`; git error/deadline ⇒ `failed` (depends on T005)
- [X] T008 [US1] Implement `executeCleanup(selection): Promise<CleanupOutcome[]>` orchestrator in `src/main/cleanup.ts`: group selection by repo into families, `runPool`, **sequential within a family**, per-repo deadline; one `CleanupOutcome{ id, result }` per selection item; empty selection → `[]`; a failing/timed-out repo never aborts the rest (FR-014, contracts/ipc-cleanup.md) (depends on T003, T007)
- [X] T009 [US1] Register IPC in `src/main/main.ts`: import `scanCleanup`/`executeCleanup`, add `ipcMain.handle('scanCleanup', () => scanCleanup(lastSnapshot))` and `ipcMain.handle('executeCleanup', (_e, selection) => executeCleanup(selection))` (depends on T006, T008)
- [X] T010 [P] [US1] Add `scanCleanup: () => ipcRenderer.invoke('scanCleanup')` and `executeCleanup: (selection) => ipcRenderer.invoke('executeCleanup', selection)` to `src/preload/preload.ts` (depends on T002)
- [X] T011 [US1] Add a **Cleanup** control to `src/renderer/view/toolbar.ts` (clone the `updateBtn` block: new `ctrl cleanup` with a `spin-icon` glyph; extend `ToolbarState` with `cleaning` and `ToolbarHandlers` with `onCleanup`; wire via `wireActivate` only when `!state.cleaning && !state.updating`, and render a disabled/busy cue when either bulk op is in flight) (depends on T002)
- [X] T012 [US1] Add `doCleanup()` orchestration in `src/renderer/renderer.ts`: re-entry guard (`if (cleaning || updating) return;`) → `api.scanCleanup()` → if empty, notice + return → else open the overlay (US2) → on confirm `api.executeCleanup(selected)` → summary (US3) → `await doRefresh()`; pass `onCleanup: () => void doCleanup()` and `cleaning` into `renderToolbar` (depends on T009, T010, T011; integrates with T016 (US2), T019 (US3))

**Checkpoint**: Engine test matrix passes; clicking Cleanup scans and (via the overlay) removes selected items; list refreshes.

---

## Phase 4: User Story 2 — Review and choose what gets deleted before removal (Priority: P1)

**Goal**: The review overlay: candidates grouped by repo, checkboxes selected by
default, worktree indicator, unselect to keep, cancel removes nothing.

**Independent Test**: With a scan result containing several candidates, the
overlay lists them all-checked; unchecking a subset and confirming removes exactly
the checked items; Cancel/backdrop/× removes nothing. Maps to spec.md US2 scenarios 1–4.

- [X] T013 [US2] Implement `src/renderer/view/cleanup.ts` (mirror `settings.ts`): module `isOpen` + `openCleanupOverlay(candidates, { onConfirm, onCancel })` + `renderCleanupOverlay(container)`; build `.scrim`→`.modal`→head/body/foot; group candidates by `repoPath` (header = `repoSlug`); one checkbox row per candidate (**checked by default**) showing branch/worktree label and a worktree-indicator glyph when `worktreePath` is set; footer ghost **Cancel** + primary **Remove N selected** (count updates live); backdrop-click/×/Cancel call `onCancel`; ARIA `role="dialog"`, `aria-modal="true"` (depends on T002)
- [X] T014 [P] [US2] Add overlay-list + checkbox CSS to `src/renderer/styles.css`: reuse `.scrim`/`.modal`/`.modal-head`/`.modal-body`/`.modal-foot`/`.btn`; add a candidate-list row style, `input[type=checkbox]` styling (none exists yet), a repo-group header, and a worktree-indicator glyph style (per research D8)
- [X] T015 [US2] Add `<div id="cleanupOverlay"></div>` next to `#settingsModal` in `src/renderer/index.html`; grab `els.cleanupOverlay` in `src/renderer/renderer.ts` and call `renderCleanupOverlay(els.cleanupOverlay)` inside `render()` (depends on T013)
- [X] T016 [US2] Integrate the overlay into `doCleanup()` in `src/renderer/renderer.ts`: `openCleanupOverlay(plan, { onConfirm: (selected) => …executeCleanup…, onCancel: () => { cleaning = false; render(); } })`; ensure only the still-checked candidates are sent to `executeCleanup` (FR-008/FR-009) (depends on T012, T013, T015)

**Checkpoint**: US1 + US2 work together — nothing is removed without confirming the overlay; unselected items survive; cancel is a no-op.

---

## Phase 5: User Story 3 — See that cleanup is running and get a summary (Priority: P2)

**Goal**: Busy/spin state + re-entry guard while running, a counts summary toast on
completion, and an empty-scan notice.

**Independent Test**: Trigger Cleanup — the button animates and cannot be
re-triggered while busy; on completion a counts toast appears; with nothing to
clean, a "Nothing to clean up" toast appears and no overlay opens. Maps to spec.md US3 scenarios 1–3 + FR-010.

- [X] T017 [US3] Add the `cleaning` re-entry guard + **cross-operation lock** in `src/renderer/renderer.ts` (module flag mirroring `updating`: set true before scan, `render()`, cleared on cancel/empty/completion) and pass both `cleaning` and `updating` through to the toolbar's busy/`aria-busy`; also gate the existing Pull-all path so the two bulk operations are mutually exclusive — `doUpdateAll` early-returns if `cleaning`, and the Pull-all button wires only when `!updating && !cleaning` (FR-012) (depends on T011, T012)
- [X] T018 [P] [US3] Extend the spin CSS in `src/renderer/styles.css`: add `.ctrl.cleanup.busy .spin-icon` to the existing `@keyframes spin` selector list and add `.ctrl.cleanup.busy` to the busy cursor/opacity rule (so the new button animates like Refresh/Pull all)
- [X] T019 [US3] Build the summary in `doCleanup()` (`src/renderer/renderer.ts`): tally `CleanupOutcome[]` into counts and `showNotice('Removed X · Y skipped · Z failed')` (mirror the Pull-all toast); emit `showNotice('Nothing to clean up')` for an empty scan and skip the overlay (FR-010/FR-013) (depends on T012, T016)

**Checkpoint**: All three stories complete — button animates, guarded, summarizes; empty and cancel paths handled.

---

## Phase 6: Polish & Validation

**Purpose**: Build/test green and constitution-mandated manual exercise.

- [X] T020 Run `npx tsc --noEmit` and `npm test`; fix any type/test failures (all engine cases from T004 must pass)
- [ ] T021 Execute `specs/008-branch-cleanup/quickstart.md` manual validation against a real fixture repo — MUST include the failure path: the present dirty worktree survives with its uncommitted file (Principle III), cancel removes nothing (FR-009), empty scan shows the notice (FR-010)
- [X] T022 [P] Verify no orphaned code from these changes and that the `CLAUDE.md` SPECKIT section (already updated in planning) still points at this plan

---

## Dependencies & Execution Order

### Phase order
- **Setup (T001)** → **Foundational (T002–T003)** → **US1 (T004–T012)** → **US2 (T013–T016)** → **US3 (T017–T019)** → **Polish (T020–T022)**.
- US1 and US2 are interlocked at the renderer (T012 ↔ T016); the US1 *engine* (T004–T010) is fully independent of US2 and can be completed + tested first.

### Key task dependencies
- T005 ← T002, T004 · T006 ← T003, T005 · T007 ← T005 · T008 ← T003, T007
- T009 ← T006, T008 · T010 ← T002 · T011 ← T002 · T012 ← T009, T010, T011
- T013 ← T002 · T015 ← T013 · T016 ← T012, T013, T015
- T017 ← T011, T012 · T019 ← T012, T016
- T020 ← all impl · T021 ← T020

### Parallel opportunities
- Foundational: T002 ‖ T003 (different files).
- US1 kickoff: T004 (tests) ‖ T010 (preload) ‖ T011 (toolbar) can start once T002 lands; the engine chain T005→T006/T007→T008 is sequential (same file `cleanup.ts`).
- US2: T014 (CSS) ‖ T013 (overlay module) — different files.
- US3: T018 (CSS) ‖ T017/T019 (renderer).

---

## Parallel Example: Foundational + US1 start

```bash
# After T001, run the two foundational tasks together (different files):
Task: "Add cleanup types + API methods in src/shared/types.ts"          # T002
Task: "Export groupIntoFamilies + NON_INTERACTIVE_ENV from src/main/update.ts"  # T003

# After T002, these US1 tasks are parallelizable (different files):
Task: "Write engine test matrix in tests/cleanup.test.ts"               # T004
Task: "Add preload forwarders in src/preload/preload.ts"                # T010
Task: "Add Cleanup toolbar control in src/renderer/view/toolbar.ts"     # T011
```

---

## Implementation Strategy

### MVP (US1 + US2 together — both P1)
1. Setup + Foundational (T001–T003).
2. US1 engine first (T004–T008) — get the test matrix green; this is the safety-critical core.
3. US1 IPC + trigger (T009–T012) and US2 overlay (T013–T016) — the overlay is the consent gate, so ship it with the engine, not after.
4. **STOP and VALIDATE**: quickstart manual run (T021), especially the dirty-worktree-kept path.

### Incremental
- US3 (T017–T019) layers busy/summary polish on the working MVP without changing removal behavior.
- Polish (T020–T022) last.

---

## Notes
- [P] = different files, no incomplete dependency. The engine chain in `cleanup.ts` (T005→T008) is **not** [P] — same file.
- The one deliberate divergence from the existing delete path: `git worktree remove` **without** `--force` for present worktrees (T007) — this is the Principle III safeguard; do not "simplify" it to match delete's `--force`.
- Reuse over reinvention: `runGit`, `runPool`, `groupIntoFamilies`, `NON_INTERACTIVE_ENV`, `showNotice`, `doRefresh`, and the `.scrim`/`.modal` CSS are all reused; only checkbox CSS + the two engine/overlay modules are genuinely new.
- Commit after each task or logical group; run `tsc`/tests before the manual pass.
