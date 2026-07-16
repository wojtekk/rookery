# Tasks: Local Repository Dashboard

**Input**: Design documents from `/specs/001-repo-dashboard/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md, design/README.md

**Tests**: Included — the plan mandates `node:test` coverage of the pure logic
(parse / identity / sort / filter) and the git-probe contract requires a read-only
assertion. UI is validated via quickstart.md scenarios (no renderer test framework).

**Organization**: By user story (US1 P1 → US2 P2 → US3 P3), each independently
testable. Paths follow plan.md (`src/{shared,main,preload,renderer}`, `tests/`).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (story phases only)

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create the Electron project tree per plan.md: `src/shared/`, `src/main/git/`, `src/preload/`, `src/renderer/view/`, `tests/`
- [ ] T002 Initialize the project in `package.json` + `tsconfig.json`: Electron 32+, TypeScript 5.x (strict), separate compile targets for main/preload/renderer; scripts `build` (tsc), `start` (electron), `test` (node:test); no runtime deps beyond Electron
- [ ] T003 [P] Wire `npm test` to run `node:test` over compiled `tests/*.test.js`
- [ ] T004 [P] Add `.editorconfig` + `tsc --noEmit` strict check; no linter dependency (per plan's minimal-footprint stance)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Must complete before any user story.

- [ ] T005 Define shared IPC types in `src/shared/types.ts` per data-model.md: `Head`, `WorkingTree`/`WorkingTreeEntry`, `Remote`, `Repository`, `OrphanWorktree`, `Row`, `RowState`, `Settings` (incl. `showWorktrees`, `defaultHost`)
- [ ] T006 Create the Electron shell in `src/main/main.ts`: `BrowserWindow` with `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`; load renderer (research R4)
- [ ] T007 Expose the typed IPC surface via `contextBridge` in `src/preload/preload.ts` as `window.repoDashboard` (all methods from contracts/ipc-api.md, stubbed for now)
- [ ] T008 [P] Settings load/save (atomic temp-file + rename JSON in `app.getPath('userData')`) in `src/main/config.ts`; defaults: sort `slug`/`asc`, `showWorktrees:true`, `defaultHost:'github.com'` (research R5)
- [ ] T009 [P] Git availability + version check (`>= 2.15`) implementing `getGitStatus()` in `src/main/git/probe.ts`, wired via IPC handler (FR-019, research R7)

**Checkpoint**: shell runs, IPC bridge present, settings persist, git presence known.

---

## Phase 3: User Story 1 - See my repositories at a glance (Priority: P1) 🎯 MVP

**Goal**: Point the app at a directory and see every repo once, with slug+host, dir
name, branch+tracking, dirty count, ahead/behind, worktrees grouped, state via
left-edge indicator + glyph, sortable and filterable.

**Independent Test**: Launch against a dir of several clones (mixed states, one with
a worktree, one on `github.schibsted.io`); each appears once with correct fields
matching `git status -sb`; sort and state-filter work.

### Tests for User Story 1
- [ ] T010 [P] [US1] Parsing tests (porcelain v2 → branch/upstream/ahead-behind/dirty incl. no-upstream & detached; `worktree list --porcelain`; remote-url schemes scp/ssh/git/https) in `tests/parse.test.ts` (git-probe P2/P4/P5)
- [ ] T011 [P] [US1] Canonical-identity / dedup / family grouping / external-primary-in-scope (orphan) tests in `tests/identity.test.ts` (FR-026)
- [ ] T012 [P] [US1] Sort dimension + deterministic tie-break + unavailable-row fallback tests in `tests/sort.test.ts` (FR-020)
- [ ] T013 [P] [US1] State filter + worktree filter (incl. unavailable rows) tests in `tests/filter.test.ts` (FR-029/FR-024)
- [ ] T014 [P] [US1] Read-only assertion test (racy-stat fixture; `.git/index` mtime+size unchanged after full probe; control assertion that plain `git status` DOES change it) in `tests/readonly.test.ts` (SC-005, git-probe read-only note)

### Implementation for User Story 1
- [ ] T015 [P] [US1] Git probe P1–P5 with `--no-optional-locks` (`rev-parse` identity, `status --porcelain=v2 --branch`, `log -1 --format=%cI`, `worktree list --porcelain`, `config remote.origin.url`) in `src/main/git/probe.ts` (research R1)
- [ ] T016 [P] [US1] Pure parsers (porcelain v2 → `Head`+local count; worktree list; remote url → `{host,slug}`) in `src/main/git/parse.ts`
- [ ] T017 [US1] Canonical identity + family grouping/dedup + orphan-worktree derivation in `src/main/git/identity.ts` (depends T015, T016; FR-026)
- [ ] T018 [US1] Scan observed dirs one level deep + inspect families through a bounded concurrency pool in `src/main/scan.ts` (depends T015–T017; FR-003, research R3)
- [ ] T019 [US1] Implement `listRepositories()` / `refresh()` returning `Row[]` in `src/main/main.ts` (depends T018; ipc-api.md)
- [ ] T020 [US1] Renderer bootstrap in `src/renderer/renderer.ts` + `src/renderer/index.html`: call IPC, hold view state (sort, state filter, worktree toggle, defaultHost)
- [ ] T021 [P] [US1] Pure sort + tie-break in `src/renderer/view/sort.ts` (depends T005; FR-020)
- [ ] T022 [P] [US1] Pure state + worktree filter in `src/renderer/view/filter.ts` (depends T005; FR-029/FR-024)
- [ ] T023 [US1] Table rendering in `src/renderer/view/table.ts`: primary rows + grouped worktrees; **left-edge state indicator + porcelain glyph** (no full-row wash); name/slug/**host only when `!= defaultHost`**; branch + tracking (`origin/branch` one token / `local-only` / `detached`); dirty count (>0 only); ahead/behind `↑x ↓y`; last change; `~`-tooltip; collision fragment; ⋮ kebab **deferred-actions slot** (FR-005/006/007/008/009/022/023/028; design/README.md)
- [ ] T024 [P] [US1] Fleet summary in `src/renderer/view/summary.ts`: proportional composition bar + state-filter chips with counts (FR-029)
- [ ] T025 [P] [US1] Command bar in `src/renderer/view/toolbar.ts`: Worktrees toggle (FR-024) — Refresh/Settings buttons added in US3/US2
- [ ] T026 [US1] `src/renderer/styles.css`: tokens; left-edge indicator + glyph; sortable-header + column layout; tooltip right-edge flip; hovered/focused-row `z-index` elevation (design gotchas); `prefers-reduced-motion`
- [ ] T027 [US1] Render a clear degraded state when `getGitStatus()` reports git missing/old, instead of empty/misleading data (FR-019)

**Checkpoint**: MVP — the dashboard lists, groups, colors, sorts, and filters repos.

---

## Phase 4: User Story 2 - Manage which directories are observed (Priority: P2)

**Goal**: Add/remove observed directories from the app; they persist across restarts;
an empty state guides first use.

**Independent Test**: Add a dir → its repos appear; remove → they disappear; restart
→ set persists; empty state shows when none.

- [ ] T028 [US2] Implement `addObservedDirectory()` (validate exists+readable, reject otherwise) / `removeObservedDirectory()` with persistence in `src/main/main.ts` + `src/main/config.ts` (FR-002/004/015/016; US2 scenario 4)
- [ ] T029 [US2] Settings modal in `src/renderer/view/settings.ts`: list observed dirs with per-dir repo count + "unreadable" flag; add/remove; preferences (default sort, worktrees, default host) (FR-002/016/006)
- [ ] T030 [US2] Guided empty state in `src/renderer/view/empty.ts`, shown when no observed dirs, with prominent "Add directory" action (FR-025)
- [ ] T031 [US2] Settings (gear) button in `src/renderer/view/toolbar.ts` opens the modal

**Checkpoint**: directory management self-sufficient and persistent.

---

## Phase 5: User Story 3 - Refresh the list on demand (Priority: P3)

**Goal**: Manual refresh re-reads local state; a single hung repo never blocks the
rest; no automatic refresh.

**Independent Test**: Change a repo outside the app → refresh updates it; simulate a
hung repo (stalled mount) → it shows unavailable within the budget while others
refresh; confirm nothing updates without a refresh action.

- [ ] T032 [US3] Per-inspection family-level deadline (`Promise.race` vs default 5 s timer, kill in-flight children, mark family `unavailable`) + per-spawn backstop timeout in `src/main/scan.ts` (FR-027, SC-007, research R3)
- [ ] T033 [US3] Refresh button with spinning reload icon + busy state in `src/renderer/view/toolbar.ts`, calling `refresh()` (FR-014)
- [ ] T034 [US3] Confirm no timer/background refresh anywhere; keep UI responsive during scan (optional `onScanProgress`) (FR-012/FR-017/SC-006)
- [ ] T035 [P] [US3] Isolation test: a family that exceeds the budget resolves as `unavailable` while others complete (`tests/` harness or quickstart scenario 8)

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T036 [P] Run quickstart.md validation scenarios 1–10
- [ ] T037 [P] Accessibility check: every state identifiable via glyph + numeric text in a grayscale screenshot (SC-008)
- [ ] T038 Performance check: ~50 repos visible < 10 s, no perceptible freeze during scan (SC-001/SC-006)
- [x] T039 [P] Reconcile Constitution Principle IV via `/speckit-constitution` — DONE: amended to v1.3.0 (left-edge indicator + glyph, non-color cue, green=ok, grey=unavailable)
- [ ] T040 [P] Add a top-level README note linking `specs/001-repo-dashboard/design/README.md` + mockup

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** blocks everything.
- **US1 (P3)** depends only on Foundational — the MVP.
- **US2 (P4)** depends on Foundational; reuses `config.ts` (T008) and toolbar (T025). Independently testable.
- **US3 (P5)** depends on Foundational + the scan/probe from US1 (T018) for the timeout to wrap; refresh button reuses toolbar.
- **Polish (P6)** after the desired stories.

### Within US1
- Tests (T010–T014) can be written first and fail.
- parse/probe (T015/T016) → identity (T017) → scan (T018) → IPC (T019) → renderer (T020, T023).
- Pure view modules (T021/T022/T024/T025) parallel to the main-process chain.

---

## Parallel Opportunities

- Setup: T003, T004.
- Foundational: T008, T009 (after T005–T007).
- US1 tests: T010–T014 all [P].
- US1 impl: T015/T016 [P]; then T021/T022/T024/T025 [P] alongside T017→T019.
- Polish: T036, T037, T039, T040 [P].

### Parallel Example: US1 tests
```bash
Task: "parse.test.ts — porcelain/worktree/remote-url"
Task: "identity.test.ts — identity/dedup/grouping/orphan"
Task: "sort.test.ts — dimensions + tie-break + unavailable"
Task: "filter.test.ts — state + worktree filters"
Task: "readonly.test.ts — .git/index untouched (racy-stat fixture)"
```

---

## Implementation Strategy

**MVP** = Phase 1 + Phase 2 + Phase 3 (US1): a read-only, sortable, filterable
dashboard. Stop, validate against the US1 independent test, demo.

**Increment**: add US2 (manage directories) → US3 (on-demand refresh + isolation) →
Polish. Each story is an independently shippable increment.

**Deferred (not in this feature)**: per-repo actions behind the ⋮ kebab (pull, open
in GitHub/IntelliJ/VS Code/Finder/Terminal). The T023 slot reserves layout for them.

---

## Notes
- [P] = different files, no incomplete dependency.
- Pure logic (parse/identity/sort/filter) is dependency-free and unit-tested; UI via quickstart.
- The read-only guarantee (T014) MUST force the racy-stat condition or it passes trivially.
- Commit per task or logical group.
