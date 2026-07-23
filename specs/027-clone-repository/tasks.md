---

description: "Task list for feature 027 — Clone a Repository"
---

# Tasks: Clone a Repository

**Input**: Design documents from `/specs/027-clone-repository/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/clone-engine.md

**Tests**: Included and REQUIRED — not TDD-by-preference but by Constitution v5.0.0
Development Workflow: "Any code that mutates repository state (pull, push, delete,
remove, clone) MUST leave at least one runnable check." The clone engine + gh parsers
therefore ship with unit/fixture tests; the DOM modal is validated via `quickstart.md`
(the established project convention — DOM-touching views aren't unit-tested).

**Organization**: Tasks grouped by user story. The feature is one cohesive modal, so
the shared, testable spine (types, engine, discovery, pure helpers, IPC) is Foundational;
US1 delivers the complete modal (MVP); US2/US3 are focused deltas to it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)
- Exact file paths are included in every task.

## Path Conventions

Existing Electron three-context layout: `src/shared/`, `src/main/`, `src/preload/`,
`src/renderer/` (+ `src/renderer/view/`), tests in `tests/` (compiled CommonJS, run via
`pnpm test`). All paths below are repo-root-relative.

---

## Phase 1: Setup (Contract Surface)

**Purpose**: Establish the cross-IPC type contract and the persisted setting that every
later task compiles against.

- [X] T001 [P] Add clone types to `src/shared/types.ts`: `RemoteRepoSummary`,
  `CloneableReposResult`, `CloneOutcome` (data-model §1–§3); add `lastCloneDirectory: string`
  to `Settings`; add `listCloneableRepos(forceRefresh?: boolean)`, `cloneRepository(url, destination)`,
  and `setLastCloneDirectory(dir)` to `RepoDashboardApi`.
- [X] T002 Add `lastCloneDirectory: ''` to `DEFAULT_SETTINGS` and register the
  `setLastCloneDirectory` IPC handler in `src/main/config.ts` (mirror `setDefaultHost`).

**Checkpoint**: Types compile; settings round-trip the new field.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The complete non-UI spine — clone engine, gh discovery, pure helpers, IPC,
preload — with its required tests. No user-facing UI yet.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

- [X] T003 [P] Implement pure helpers in `src/renderer/view/clone-model.ts` (type-only
  imports, no DOM): `deriveRepoName(url)`, `rankCloneCandidates(repos, query, limit=50)`,
  `buildDestination(dir, repoName)` per contracts/clone-engine.md.
- [X] T004 [P] Implement the clone engine in `src/main/clone.ts`:
  `cloneRepository(url, destination): Promise<CloneOutcome>` running `git clone -- <url> <dest>`
  via `runGit` with `NON_INTERACTIVE_ENV` (import from `update.ts`), expanding a leading `~`,
  passing url/dest as separate argv after `--`, returning `{ok:false,reason}` with trimmed
  git output on failure (reuse the `errorDetail` shape). Never throws across the boundary.
- [X] T005 [P] Implement discovery in `src/main/clone-discovery.ts`: pure
  `parseGhHosts(json)` and `parseGhRepoList(jsonl, host)`, plus `listCloneableRepos(forceRefresh)`
  that runs `gh auth status --json hosts` then `gh api --hostname <h> --paginate user/repos …
  --jq …` per successful host, unions results, fills `unavailableHosts`/`searchAvailable`/`reason`,
  and caches in a module-level variable (bypassed by `forceRefresh`). ENOENT/all-hosts-fail ⇒
  `searchAvailable:false` (never throws) per contracts/clone-engine.md.
- [X] T006 Register IPC in `src/main/main.ts`: `listCloneableRepos`, `cloneRepository`,
  `setLastCloneDirectory`. The `cloneRepository` handler MUST, on `{ok:true}`, add
  `dirname(expandTilde(destination))` to `observedDirectories` (if absent) via the settings
  write path before resolving (data-model §6).
- [X] T007 Expose the three new methods via `contextBridge` in `src/preload/preload.ts`
  (mirror existing `ipcRenderer.invoke` entries).
- [X] T008 [P] Unit tests in `tests/clone-search.test.ts` (imports `clone-model.ts`):
  `deriveRepoName` (ssh/https/`.git`/trailing-slash/garbage→null), `rankCloneCandidates`
  (prefix>substring>owner ranking, ≤50 cap, empty-query head), `buildDestination`
  (single-separator join with/without trailing slash).
- [X] T009 [P] Tests in `tests/clone-engine.test.ts`: pure `parseGhHosts`
  (success-account filter, malformed→[]) and `parseGhRepoList` (JSONL parse, bad-line skip,
  host stamping); real-`file://`-fixture `cloneRepository` outcomes — success, existing-
  non-empty-destination failure, invalid-URL failure (mirrors `rebase-worktrees.test.ts`
  fixture style; satisfies the Constitution runnable-check for the clone mutation).

**Checkpoint**: `pnpm test` green; engine + discovery callable over IPC; no UI yet.

---

## Phase 3: User Story 1 — Find and clone a repository by name (Priority: P1) 🎯 MVP

**Goal**: Open Clone, search 1k+ accessible repos, pick one, accept/adjust the
destination, clone, and see the new repo appear.

**Independent Test**: Search a known accessible repo by partial name, select it, accept
the default destination, Clone → it appears in the table (quickstart scenarios A–G).

- [X] T010 [US1] Add the **Clone** button (5th long op) to `src/renderer/view/toolbar.ts`:
  add `cloning` to `ToolbarState` and `onClone` to `ToolbarHandlers`; button is disabled
  while any of refreshing/updating/cleaning/rebasing/cloning is active, and contributes to
  `busy` (no `hasRepos` gate — clone is available with zero repos).
- [X] T011 [US1] Add `<div id="cloneModal"></div>` after `#cleanupOverlay` in
  `src/renderer/index.html`.
- [X] T012 [US1] Build the modal in `src/renderer/view/clone.ts` (mirror `cleanup.ts`
  module pattern: `isOpen` + `openCloneModal`/`renderCloneModal`/`close`, reuse `.scrim/.modal/
  .modal-head/.modal-body/.modal-foot/.btn`). Implements: in-modal loading state; search box
  → `rankCloneCandidates` over the discovery result; ranked dropdown (arrow-key nav, Enter to
  pick); pick fills the URL field (SSH default) with an SSH/HTTPS toggle; destination
  directory `<select>` from `observedDirectories` (default `lastCloneDirectory` else first);
  editable destination path auto-filled via `buildDestination`, with `destPathEdited` stopping
  auto-fill after a hand edit; Clone (disabled until URL+path valid) / Cancel footer.
- [X] T013 [US1] Wire `src/renderer/renderer.ts`: add module-level `cloning` flag; `onClone`
  opens the modal and kicks off `api.listCloneableRepos()` (in-modal spinner, **no** busy
  lock); implement `doClone(url, destination)` — set `cloning`, `beginBusyLock('Cloning…')`,
  call `api.cloneRepository`, `finally` clear `cloning` + `endBusyLock()`; on `{ok:true}`
  close modal, `settings = await api.getSettings()`, `await doRefresh()`, `showNotice(...)`;
  persist `lastCloneDirectory` via `api.setLastCloneDirectory`; mount `renderCloneModal(els.cloneModal)`
  in `render()` and add the `els.cloneModal` lookup.
- [X] T014 [US1] Add `.clone-*` rules to `src/renderer/styles.css`: search-results dropdown
  list (scrollable, ≤50 rows), form rows (URL + destination), and the SSH/HTTPS scheme toggle.

**Checkpoint**: Search → pick → clone → repo appears; parent dir auto-observed; the run
locks the UI like Pull all and releases on settlement. MVP shippable.

---

## Phase 4: User Story 2 — Clone directly from a URL (Priority: P2)

**Goal**: Clone by pasting an HTTPS/SSH URL with no search selection, and keep that path
working when discovery is unavailable.

**Independent Test**: Paste a URL without touching search → clone succeeds; with `gh`
unavailable, the modal shows a clear "search unavailable" reason but URL clone still works
(quickstart scenarios H, L).

- [X] T015 [US2] In `src/renderer/view/clone.ts`, make the URL field a first-class input
  independent of any selection: typing/pasting a URL drives `deriveRepoName` → destination
  auto-fill, and enables Clone on a valid URL alone (no dropdown pick required). Selecting a
  result still overwrites the URL (until hand-edited).
- [X] T016 [US2] Handle `searchAvailable === false` in `src/renderer/view/clone.ts`: render
  the `reason` text in place of the dropdown (never a blank list), keeping URL + destination
  fully usable (FR-012). Confirm `renderer.ts` opens the modal even when discovery fails.

**Checkpoint**: URL-only clone works with search absent; gh-down degrades gracefully.

---

## Phase 5: User Story 3 — Recover cleanly from a failed clone (Priority: P3)

**Goal**: A failed clone keeps the modal open with a specific reason and intact input;
partial-host discovery is surfaced; the long-op mutual-exclusion holds.

**Independent Test**: Clone into an existing non-empty dir → failure shown, input intact,
fixable + retryable; with one host down, results from the reachable host still load with a
skipped-host note (quickstart scenarios I, J, K).

- [X] T017 [US3] In `src/renderer/view/clone.ts` + `renderer.ts`: on `{ok:false}` keep the
  modal open, store/show `cloneError` (the git reason), and preserve all input (FR-011).
- [X] T018 [US3] In `src/renderer/view/clone.ts`: when `unavailableHosts` is non-empty show a
  dismissible skipped-host note (FR-013); add a **Refresh list** control calling
  `api.listCloneableRepos(true)` to re-run discovery on demand (research §5).
- [X] T019 [US3] Verify/close gaps in mutual exclusion: Clone disabled while
  refresh/pull-all/cleanup/rebase run, and those disabled while cloning (FR-008) — confirm
  the `toolbar.ts` `busy`/`cloning` wiring from T010 and the `doClone` guard in `renderer.ts`.

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `README.md`: add a "Clone" section noting the header action and the
  optional system `gh` CLI dependency for autocomplete (with graceful manual-URL fallback).
- [X] T021 Run `pnpm test` and `pnpm run build` — all tests green, both TS projects compile.
- [ ] T022 Execute the `quickstart.md` manual walkthrough (scenarios A–L) against `pnpm start`,
  including a real clone failure path and the gh-unavailable path (owed; satisfies the
  Constitution "manually exercised against a real repository incl. a failure path" rule).

---

## Post-implementation follow-ups (added 2026-07-23, outside the original 22-task plan)

- [X] T023 Fix Clone modal dismissing on a text-selection drag that ends on the scrim
  (`view/clone.ts`): track `mousedown` target separately from `click` target, only treat it as
  a backdrop dismiss when both originate on the scrim itself.
- [X] T024 Excluded clone organizations: `Settings.excludedCloneOwners`, `setExcludedCloneOwners`
  IPC, pure `filterExcludedOwners()` in `clone-discovery.ts` (applied at read time in `main.ts`
  so edits take effect without a fresh `gh` call), and a management UI under Settings → Other.
- [X] T025 Proactive, non-blocking duplicate-clone warning (Edge Cases revision): pure
  `parseRemoteSlug()` in `view/clone-model.ts` (duplicated from `main/git/parse.ts` — the
  renderer's ESM TS project can't import `src/main/`) matches a candidate URL against existing
  rows' `Remote`; shown inline, never disables Clone.
- [X] T026 Proactive, non-blocking destination-occupied warning (Edge Cases revision):
  `isDestinationOccupied()` in `main/clone.ts` (fs stat + readdir) behind a new
  `checkCloneDestination` IPC, debounced 300ms in `view/clone.ts`; shown inline, never disables
  Clone — the existing FR-011 git-failure-after-attempt path still covers proceeding anyway.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 blocks everything (shared types); T002 depends on T001.
- **Foundational (Phase 2)**: depends on Setup. T003/T004/T005 are [P] (different files);
  T006 depends on T004+T005; T007 depends on T001; T008 depends on T003; T009 depends on
  T004+T005. BLOCKS all user stories.
- **US1 (Phase 3)**: depends on Foundational. T010/T011 are independent files; T012 depends on
  T003 (helpers) + T005 (discovery shape); T013 depends on T012 + T006/T007 (IPC/preload);
  T014 independent CSS.
- **US2 (Phase 4)**: depends on US1 (edits the same modal); T015 before/with T016.
- **US3 (Phase 5)**: depends on US1 (same modal); T017/T018/T019 independent within the phase
  but T017/T018 edit `view/clone.ts` (sequential).
- **Polish (Phase 6)**: after all desired stories; T021/T022 last.

### Within Each User Story

- Foundational tests (T008/T009) precede reliance on the spine but can be written alongside
  T003/T004/T005.
- Modal shell (T012) before renderer wiring (T013); CSS (T014) any time after T012.
- Story complete + checkpoint validated before moving to the next priority.

### Parallel Opportunities

- Setup: T001 then T002 (T002 needs T001).
- Foundational: **T003, T004, T005 in parallel**; then T006; T007/T008/T009 in parallel.
- US1: T010, T011, T014 in parallel; T012 then T013.
- Cross-story `view/clone.ts` edits (T012, T015, T016, T017, T018) are the same file →
  sequential across phases.

---

## Parallel Example: Foundational spine

```bash
# After T001/T002, launch the three independent spine modules together:
Task: "Implement pure helpers in src/renderer/view/clone-model.ts"     # T003
Task: "Implement clone engine in src/main/clone.ts"                     # T004
Task: "Implement gh discovery in src/main/clone-discovery.ts"           # T005
# Then their tests in parallel once the modules land:
Task: "tests/clone-search.test.ts"                                      # T008
Task: "tests/clone-engine.test.ts"                                      # T009
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (spine + tests green) →
3. Phase 3 US1 (full modal) → **STOP & VALIDATE** search→pick→clone→appears → demo.

### Incremental Delivery

US1 (search + clone, MVP) → US2 (URL-only + gh-down fallback) → US3 (failure recovery +
partial hosts + lockout) → Polish (README, full build/test, manual quickstart).

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- The pure/DOM split (research §6) is why testable logic lives in `clone-model.ts` /
  `clone-discovery.ts` and the DOM modal (`clone.ts`) is quickstart-validated, not unit-tested.
- Constitution v5.0.0 already amended (Principle V gh latitude, IV 5th long op, II clone
  mutation) — no constitution task remains.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
- Owed at the end (agent cannot drive the Electron window): T022 manual walkthrough.

---

## Phase 7: Convergence

- [X] T027 In `doClone()` (`src/renderer/renderer.ts`), move `await doRefresh();` inside
  the `if (outcome.ok)` branch so it only runs on a successful clone. Currently it runs
  unconditionally after the try/finally, so a **failed** clone also triggers a full
  `Refreshing…` busy-lock/table-rescan cycle, contradicting contracts/clone-engine.md's
  "Renderer flow" (`doRefresh()` is documented only under `{ ok: true }`; `{ ok: false }`
  says only "keep the modal open, set `cloneError`, preserve all input") and plan.md's
  Summary ("on failure the modal stays open ... and the user's input intact" — no
  refresh implied). (contradicts)
