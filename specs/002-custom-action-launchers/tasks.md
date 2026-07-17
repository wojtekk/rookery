# Tasks: Custom Per-Repository Action Launchers

**Input**: Design documents from `/specs/002-custom-action-launchers/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/ (ipc-api.md,
launch.md), research.md, quickstart.md

**Tests**: Included — the plan mandates `node:test` over the pure action logic
(`shared/actions.ts`) and the launch **argument-safety** contract
(`tests/launch.test.ts`). UI is validated via quickstart.md scenarios (no renderer
test framework, per 001).

**Organization**: By user story (US1 P1 → US2 P2 → US3 P3), each independently
testable. Additive over the existing 001-repo-dashboard tree; paths follow plan.md.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (story phases only)
- `(∆)` = modifies an existing 001 file; `(new)` = new file

---

## Phase 1: Setup

- [X] T001 Create the new source directories per plan.md: `src/main/actions/` and `src/renderer/view/icons/` (no new npm dependency — launch uses the existing `child_process`; icons are static assets)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Must complete before any user story. These are the shared types,
pure logic, persistence, and IPC surface every story builds on.

- [X] T002 [P] Extend `src/shared/types.ts` (∆) per data-model.md: add `Action` (`id`, `name`, `iconId`, `command`); add `actions: Action[]` to `Settings`; widen `Remote` to the three-variant union carrying `rawUrl` (parsed `{host,slug,rawUrl}` | unparseable `{host:null,slug:null,rawUrl}` | `null` no-origin)
- [X] T003 [P] Create `src/shared/actions.ts` (new): `ACTION_LIMIT = 6` (FR-003); `DEFAULT_ACTIONS` seed set of five (research R5 table); pure ops `add` / `edit` / `remove` / `moveUp` / `moveDown` (one position, clamped — FR-014) / `canAdd` (len < limit — FR-003); `commandUsesRemote(command)` (literal `${2}` token test) and `isActionEnabledForRow(action, remote)` (FR-013)
- [X] T004 Write `tests/actions.test.ts` (new) FIRST and ensure it fails: `ACTION_LIMIT` never exceeded via `add`; `moveUp`/`moveDown` change exactly one adjacent pair and are no-ops at the ends (FR-014); `isActionEnabledForRow` — `${2}` cmd + `remote===null` → disabled, `${2}` cmd + `{host:null,slug:null,rawUrl}` → **enabled**, non-`${2}` cmd → always enabled (FR-013); `DEFAULT_ACTIONS` equals the five in order (FR-012) [depends T002, T003]
- [X] T005 [P] Retain the raw origin URL in `src/main/git/parse.ts` (∆): P5 already reads `remote.origin.url`; return it as `Remote.rawUrl` for all present-origin cases (parsed and unparseable) instead of discarding it (research R3, data-model.md) [depends T002]
- [X] T006 Extend `src/main/config.ts` (∆): load/save `actions` in the settings JSON (reuse atomic temp-file + rename); seed `DEFAULT_ACTIONS` **only when the `actions` key is absent** (first-run sentinel — never re-seed an intentionally-emptied list) (FR-010, FR-012, research R5) [depends T002, T003]
- [X] T007 Expose `getActions` / `setActions` / `runAction` on `window.repoDashboard` via `contextBridge` in `src/preload/preload.ts` (∆), stubbed (contracts/ipc-api.md)
- [X] T008 [P] Create the icon catalog `src/renderer/view/icons/catalog.ts` (new) mapping `iconId → bundled SVG` plus the vendored glyphs (`github`, `intellij`, `vscode`, `finder`, `terminal`, and a few extras) as static SVG assets — offline, no uploads (FR-011, research R4)

**Checkpoint**: types, pure action logic (tested), raw remote URL, actions
persistence + seeding, IPC stubs, and icons all present.

---

## Phase 3: User Story 1 - Configure and launch a custom action (Priority: P1) 🎯 MVP

**Goal**: On first run the ⋮ menu is pre-populated with the five defaults; the user
can add an action (icon + name + command) in Settings; selecting an action from any
row launches its command with that row's own path (`${1}`) and raw remote URL
(`${2}`), non-blocking; `${2}` actions are disabled on remote-less rows; the menu is
hidden entirely when zero actions exist.

**Independent Test**: Fresh `userData` → every row's ⋮ lists the five defaults;
selecting VS Code opens the repo (space-in-path repo still opens correctly); add
`code-insiders ${1}`, see it in Settings immediately and in the menu; a remote-less
row shows GitHub disabled with an explanation; remove all actions → menu disappears.

### Tests for User Story 1
- [X] T009 [P] [US1] Write `tests/launch.test.ts` (new) FIRST and ensure it fails: for `${1}`/`${2}` values containing space, `"`, `$(…)`, backtick, `;`, `*`, the value observed by a stub template (e.g. `printf '%s' ${1}`) equals the input exactly — proving intact substitution, no splicing, no interpretation (FR-005); the `${2}`-with-`null`-remote precondition returns `{ok:false}` without spawning (FR-013 guard) (contracts/launch.md)

### Implementation for User Story 1
- [X] T010 [US1] Implement the launch path in `src/main/actions/launch.ts` (new): `spawn($SHELL||'/bin/sh', ['-l','-c','set -f; IFS=; '+command, shell, path, remoteUrl??''], {detached, stdio:'ignore'})`; guard `${2}`+null-remote before spawn; resolve `{ok:true}` on launch (failure detection added in US3) (research R1, contracts/launch.md) [depends T002]
- [X] T011 [US1] Wire `getActions()` (from config) and `runAction(actionId, {path, remoteUrl})` (look up action, call `launch.ts`) IPC handlers in `src/main/main.ts` (∆); `getSettings`/`refresh` now carry `actions`/`rawUrl` (contracts/ipc-api.md) [depends T006, T010]
- [X] T012 [US1] Render the ⋮ menu in `src/renderer/view/table.ts` (∆): list actions in order with their catalog icon on every row (FR-004); disable any `${2}` entry on rows with no `remote.rawUrl` via `isActionEnabledForRow`, with a "no remote" tooltip (FR-013); hide the whole kebab when `actions.length === 0` (FR-009); on select, call `runAction` with the row's own `fullPath` and `remote?.rawUrl ?? null` (US1-3/4) [depends T003, T008, T011]
- [X] T013 [US1] In `src/renderer/renderer.ts` (∆): load `getActions()` into view state on startup and re-load after Settings changes so the menu and Settings list stay in sync (FR-008) [depends T011]
- [X] T014 [US1] Add the Actions section to `src/renderer/view/settings.ts` (∆): render the ordered list; an add form (icon picker from the catalog, name, command) validating non-empty name/command + known `iconId` (FR-002), saving via `setActions` and reflecting immediately (FR-008); disable the add control with an explanation when `!canAdd` (limit reached), re-enabling on removal (FR-003) [depends T003, T008]
- [X] T015 [US1] Styles in `src/renderer/styles.css` (∆): kebab dropdown menu, action icon + label rows, disabled-entry appearance + tooltip, and the Settings actions-list layout [depends T012, T014]

**Checkpoint**: MVP — seeded defaults launch; user can add actions; per-row `${2}`
disable and empty-menu hiding work; launches are non-blocking.

---

## Phase 4: User Story 2 - Edit, reorder, and remove actions (Priority: P2)

**Goal**: Manage the existing list — edit an action's icon/name/command, remove one,
and move it up/down one position — with every change reflected immediately in
Settings and in every row's ⋮ menu.

**Independent Test**: Edit an action's name+command → menu reflects it on next open;
move an action up/down → menu order matches immediately; remove one → it disappears
from every menu and the rest keep their relative order.

- [X] T016 [US2] Extend `src/renderer/view/settings.ts` (∆): per-row Edit (populate the form, save via `setActions`), Remove (via `remove` + `setActions`), and Up/Down move buttons wired to `moveUp`/`moveDown` + `setActions`, one position per click, disabled at the ends (FR-001, FR-014); removing the last action leaves `actions: []` so the menu hides (FR-009) [depends T014]
- [X] T017 [P] [US2] Styles for the edit/remove/up-down controls on each Settings action row in `src/renderer/styles.css` (∆) [depends T016]

**Checkpoint**: full list management (edit/reorder/remove); menu order and contents
track Settings. Pure reorder/limit/remove logic already covered by T004.

---

## Phase 5: User Story 3 - Clear feedback when an action fails to launch (Priority: P3)

**Goal**: A launch that can't start (tool not installed, mistyped command) surfaces a
non-blocking, action-and-row-specific error within 2 s while the dashboard stays
fully interactive.

**Independent Test**: Add `not-a-real-cmd ${1}`, run it → a clear error names the
action (and row); the list stays scrollable/interactive; other actions unaffected.

- [X] T018 [US3] Add grace-window failure detection to `src/main/actions/launch.ts` (∆): listen for `spawn` `error` and an early `exit` (code 127 command-not-found / 126 not-executable) within ~500 ms → resolve `{ok:false, reason}`; otherwise resolve `{ok:true}` and `child.unref()` (research R2, contracts/launch.md) [depends T010]
- [X] T019 [US3] Surface failures in the renderer: `runAction`'s `{ok:false, reason}` (via `src/main/main.ts` ∆ + `src/renderer/view/table.ts` ∆) shows a non-blocking, action-and-row-specific error (e.g. a transient toast/inline notice) that never blocks the row list (FR-007, SC-004) [depends T018]
- [X] T020 [P] [US3] Extend `tests/launch.test.ts` (∆): a non-existent command (`no-such-cmd-xyz ${1}`) resolves `{ok:false}` within the grace window (exit-127 path) (contracts/launch.md) [depends T018]

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T021 [P] Run quickstart.md validation scenarios 1–10
- [X] T022 [P] Accessibility: kebab menu keyboard focus + ARIA roles; disabled `${2}` entry's explanation reachable (not color/hover-only); action icons carry accessible labels
- [X] T023 Constitution v1.4.0 spot-check: no timer/interval and no app-originated network added; launches occur only on explicit ⋮ selection; confirm `runAction` never builds a command string containing `path`/`remoteUrl` (Principle II/V, argument-safe mandate)
- [X] T024 [P] Update the top-level README note to mention the configurable ⋮ launchers and link `specs/002-custom-action-launchers/`

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks everything.
- **US1 (Phase 3, P1)** depends only on Foundational — the MVP.
- **US2 (Phase 4, P2)** depends on Foundational + US1's Settings section (T014); reuses the pure ops (T003) and `setActions` (T007/T011). Independently testable.
- **US3 (Phase 5, P3)** depends on US1's `launch.ts` (T010) to extend with failure detection, and on `runAction` wiring (T011).
- **Polish (Phase 6)** after the desired stories.

### Within US1
- Test first: T009 (launch argument-safety) fails → then T010 (launch.ts).
- Main chain: T010 → T011 → T012 (menu) → T013 (renderer state); Settings add (T014) parallel to the menu chain; styles (T015) last.

---

## Parallel Opportunities

- Foundational: T002, T003, T005, T008 are [P] (different files); T004 after T002/T003; T006 after T002/T003; T007 standalone.
- US1: T009 [P] first; then T014 (settings add) can proceed alongside the T010→T011→T012 main chain.
- US2: T017 [P] after T016.
- US3: T020 [P] after T018.
- Polish: T021, T022, T024 [P].

### Parallel Example: Foundational
```bash
Task: "types.ts — Action + Settings.actions + Remote.rawUrl"
Task: "shared/actions.ts — ACTION_LIMIT + pure ops + DEFAULT_ACTIONS"
Task: "parse.ts — retain rawUrl on Remote"
Task: "icons/catalog.ts — bundled SVG manifest"
```

---

## Implementation Strategy

**MVP** = Phase 1 + Phase 2 + Phase 3 (US1): seeded defaults, add-action, and the
argument-safe launch path. Stop, validate against the US1 independent test, demo.

**Increment**: add US2 (edit/reorder/remove) → US3 (failure feedback) → Polish. Each
story is an independently shippable increment over the existing dashboard.

**Security spine (do not defer)**: T009 + T010 together establish the argument-safe
substitution (`${1}`/`${2}` as shell positional parameters, never command text) that
Constitution v1.4.0 mandates. T009 must fail before T010 and pass after.

---

## Notes
- [P] = different files, no incomplete dependency.
- Pure logic (`shared/actions.ts`) is dependency-free and unit-tested (T004); launch
  safety is contract-tested (T009/T020); UI via quickstart.
- The launch test (T009) MUST assert the *value observed by the command* equals the
  input across shell-hostile characters, or it gives false confidence.
- Commit per task or logical group. No new runtime dependency in any task.
