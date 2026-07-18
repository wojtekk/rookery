# Tasks: Update All Repositories

**Input**: Design documents from `/specs/006-update-all-repositories/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED — the constitution requires a runnable safety check for any
mutating operation (and manual exercise of a failure path), and plan.md/
quickstart.md specify a TDD engine test matrix. Test tasks are therefore not
optional here.

**Organization**: By user story (US1 = MVP). Existing single-project Electron/TS
layout (`src/`, `tests/` at repo root); no new project scaffolding.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (user-story phases only)

---

## Phase 1: Setup

**Purpose**: Create the new files so later tasks touch them independently. No new
dependencies (reuses `runGit`, `runPool`, existing UI helpers per plan.md).

- [X] T001 Create empty stubs `src/main/update.ts`, `tests/update.test.ts`, and `tests/update-eligibility.test.ts` (tsconfig already globs `src/`/`tests/`; no build wiring needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types + plumbing every story depends on. MUST complete before US1.

- [X] T002 [P] Add `UpdateResult` and `RepoUpdateOutcome` types and the `updateAll(): Promise<RepoUpdateOutcome[]>` method on `RepoDashboardApi` in `src/shared/types.ts` (per data-model.md)
- [X] T003 [P] Widen `runGit` in `src/main/git/probe.ts` with a backward-compatible `opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv }` (merge into the `execFile` options; default `timeout` = `SPAWN_TIMEOUT_MS`, default `env` = `process.env`); existing callers unaffected
- [X] T004 [P] Export `runPool` from `src/main/scan.ts` (change `async function runPool` → `export async function runPool`) so the update orchestrator can reuse the bounded pool
- [X] T005 Add pure eligibility helpers to `src/main/update.ts`: `flattenWorkingTrees(rows)` (primary + `worktrees` + orphan worktrees) and `isEligible(entry)` = `availability === 'ok' && !head.detached && head.upstream.tracking === 'tracked'`; return an `{ eligible, ineligible }` partition (depends on T001, T002)

**Checkpoint**: Types compile; helpers unit-testable in isolation.

---

## Phase 3: User Story 1 — Update every repository in one click (Priority: P1) 🎯 MVP

**Goal**: Clicking a header control fast-forwards every eligible repo/worktree to
its upstream, auto-stashing dirty work; diverged repos are left untouched.

**Independent Test**: Automated engine matrix (T006) + manual — a behind repo
advances, a dirty+behind repo advances with edits intact, a diverged repo is
untouched (`git log` unchanged). Maps to spec.md US1 acceptance scenarios 1–4.

- [X] T006 [P] [US1] Write engine tests in `tests/update.test.ts` using real temp-git-repo fixtures (pattern: `tests/delete-risk.test.ts`): clean+behind→`updated`; dirty(tracked+untracked)+behind→`updated` with working-tree edits restored (SC-002); equal→`already-current`; local-ahead→`already-current`; **diverged→`failed`** (HEAD unchanged, no merge commit, stash restored — mandatory failure path); fetch-fail→`failed` (depends on T001)
- [X] T007 [US1] Implement `updateRepo(absPath): Promise<UpdateResult>` state machine in `src/main/update.ts` per contracts/update.md + data-model.md: dirty-detect via plumbing (`diff-files`/`diff-index --cached`/`ls-files --others --exclude-standard`) → `stash push --include-untracked` → `fetch <remote> <branch>` → classify via `rev-parse HEAD @{u}` + `merge-base --is-ancestor` → `merge --ff-only` (behind) / `already-current` (equal or ahead) / `failed` (diverged); restore stash (`pop`, fallback `apply --index`+`drop`; on pop-conflict leave in stash → `failed`); rollback stash on any failure. All git calls use non-interactive env `GIT_TERMINAL_PROMPT=0` + `GIT_SSH_COMMAND='ssh -oBatchMode=yes -oStrictHostKeyChecking=accept-new'` and the update `timeoutMs` (depends on T002, T003, T005, T006)
- [X] T008 [US1] Bound the whole per-repo sequence with a deadline in `src/main/update.ts` (withDeadline-style race + `execFile` SIGKILL timeout) → `failed` on breach after best-effort stash rollback; define `UPDATE_TIMEOUT_MS` (~60000) for fetch/merge (FR-013, SC-007) (depends on T007)
- [X] T009 [US1] Implement `updateAll(rows): Promise<RepoUpdateOutcome[]>` orchestrator in `src/main/update.ts`: partition via `flattenWorkingTrees`/`isEligible`, run eligible through `runPool` (size ~6) calling `updateRepo` with tilde-expanded path (reuse `expandTilde` from `main.ts` — import or pass expanded), emit an outcome for **every** working tree (ineligible → `skipped`), catch per-repo errors → `failed` (never throw for one repo) (depends on T005, T007, T008)
- [X] T010 [US1] Register IPC in `src/main/main.ts`: import `updateAll`, add `ipcMain.handle('updateAll', () => updateAll(lastSnapshot))` (depends on T009)
- [X] T011 [P] [US1] Add `updateAll: () => ipcRenderer.invoke('updateAll')` to `src/preload/preload.ts` (depends on T002)
- [X] T012 [US1] Add a **Pull all** control to `src/renderer/view/toolbar.ts` (new `ctrl` with a `spin-icon`; extend `ToolbarState`/`ToolbarHandlers` with `onUpdateAll`), wired to fire the handler on click/Enter/Space via the existing `wireActivate` (depends on T002)
- [X] T013 [US1] Wire `doUpdateAll()` in `src/renderer/renderer.ts`: call `api.updateAll()`, then `await doRefresh()`; pass `onUpdateAll: () => void doUpdateAll()` into `renderToolbar` (depends on T010, T011, T012)

**Checkpoint**: US1 fully works end-to-end — click → eligible repos fast-forward, diverged untouched, list refreshes. MVP deliverable.

---

## Phase 4: User Story 2 — In-progress feedback & failure visibility (Priority: P2)

**Goal**: Animated icon + re-entry guard while running; one-line summary on
completion; failed repos shown light-red.

**Independent Test**: Run and observe the icon spin for the whole run, a second
click during the run does nothing, a summary toast appears, and diverged/failed
rows show the light-red edge **and** a non-colour failed cue (glyph + tooltip)
distinguishing them from ordinary out-of-sync rows. Maps to spec.md US2
scenarios 1–3 + FR-014.

- [X] T014 [US2] Add `updating: boolean` to `ToolbarState` in `src/renderer/view/toolbar.ts` and render the Pull-all icon with the spin animation while `updating` (mirror `.ctrl.refresh.busy`); add the matching `.ctrl.<pullall>.busy .spin-icon { animation: spin 0.8s linear infinite; }` rule in `src/renderer/styles.css` (depends on T012)
- [X] T015 [US2] Add `updating` state + re-entry guard in `src/renderer/renderer.ts` (`if (updating) return; updating = true; render(); ...; finally { updating = false; render(); }`), mirroring `doRefresh`; pass `updating` into `renderToolbar` state (depends on T013, T014)
- [X] T016 [US2] After the run, show a one-line counts summary via the existing `showNotice` in `src/renderer/renderer.ts` (e.g. `Updated N · M already current · K skipped · J failed`) (depends on T013)
- [X] T017 [P] [US2] Add `--fail-edge` (light red) CSS custom property and a `.row.fail` leading-edge rule at highest precedence (over `--dirty-edge` and `--sync-edge`) in `src/renderer/styles.css` (data-model.md colour precedence) (depends on T001)
- [X] T018 [US2] Add transient `failedPaths: Set<string>` in `src/renderer/renderer.ts` (cleared at run start, populated from `outcomes.filter(o => o.result === 'failed').map(o => o.path)`); thread it into `renderRows` and, for rows whose `fullPath ∈ failedPaths`, apply in `src/renderer/view/table.ts` BOTH the `.row.fail` light-red edge AND a redundant non-colour cue — a failed status glyph (e.g. `⚠`) plus a tooltip like "pull failed — open in your merge tool" (Principle IV: colour MUST NOT be the sole signal of state; FR-014) (depends on T013, T017)

**Checkpoint**: Run is observable start-to-finish; failures are visible and honest.

---

## Phase 5: User Story 3 — Ineligible repositories are left alone (Priority: P3)

**Goal**: Repos with no remote, no tracked upstream, detached HEAD, or unavailable
are never touched and are reported `skipped`.

**Independent Test**: Feed rows containing each ineligible kind; assert none are
passed to `updateRepo` and all are reported `skipped`. Maps to spec.md US3
scenarios 1–3.

- [X] T019 [P] [US3] Write eligibility tests in `tests/update-eligibility.test.ts`: local-only (`remote: null`), no-upstream (`tracking: 'local-only'`), detached HEAD, and `availability: 'unavailable'` → partitioned as ineligible and reported `skipped`; a tracked+available entry → eligible. Assert ineligible working trees are never handed to the update engine (depends on T005, T009)
- [X] T020 [US3] Harden `updateAll` in `src/main/update.ts` so `skipped` outcomes are emitted for **all** ineligible working trees across `kind: 'repository'` primaries, their `worktrees`, and `orphan-worktree` rows (so summary counts are complete) (depends on T009)

**Checkpoint**: Safety guarantee verified — the button never mutates an ineligible repo.

---

## Phase 6: Polish & Cross-Cutting

- [X] T021 [P] Run `pnpm build` and `pnpm test`; resolve any type/lint failures
- [ ] T022 Manual quickstart validation per `quickstart.md` — behind, dirty+behind, no-remote, local-only, diverged, and unreachable-remote (hang-termination) scenarios; confirm no credential prompt and no auto-merge (constitution: manual exercise of a mutating op incl. a failure path)
- [X] T023 [P] Constitution re-check: verify Principle I (no prompts), III (no auto-merge/rebase — diverged repos have unchanged `git log`), and IV (light-red failed edge present **and** paired with a non-colour cue — glyph/tooltip — so failed state is distinguishable without colour) hold in the running app

---

## Dependencies

- **Setup (T001)** → everything.
- **Foundational (T002–T005)** → all user stories. T002/T003/T004 are mutually parallel; T005 needs T001+T002.
- **US1 (T006–T013)**: T006 (tests) parallel with nothing blocking; T007 needs T002/T003/T005/T006; T008→T007; T009 needs T005/T007/T008; T010→T009; T011 needs T002 (parallel with T007–T010); T012 needs T002; T013 needs T010/T011/T012.
- **US2 (T014–T018)**: all need US1's trigger (T012/T013). T017 [P] independent (CSS only, needs T001). T018 needs T013/T017.
- **US3 (T019–T020)**: need T005/T009 (US1 engine + orchestrator).
- **Polish (T021–T023)**: after the stories they validate.

## Parallel Opportunities

- **Foundational**: T002, T003, T004 together (three different files).
- **US1 kickoff**: T006 (tests) alongside T011 (preload) while T007–T010 proceed.
- **US2**: T017 (CSS var) alongside T014–T016.
- **US3**: T019 (tests) alongside T020.
- **Polish**: T021 and T023 together.

## Implementation Strategy

- **MVP = US1 (Phases 1–3)**: the update actually happens and is safe (diverged
  left untouched). Shippable on its own.
- **Increment 2 = US2**: makes the run observable (spinner, summary, light-red).
- **Increment 3 = US3**: locks the ineligible-safety guarantee with dedicated tests.
- Write US1 engine tests (T006) before the engine (T007) — the diverged→failed
  test is the constitution-mandated safety check.
- Do all code work in a worktree under `.worktrees/` (never on `main`).

## Task Count

23 tasks — Setup 1 · Foundational 4 · US1 8 · US2 5 · US3 2 · Polish 3.
