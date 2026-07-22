---
description: "Task list for feature 025 — Rebase Worktrees onto the Default Branch"
---

# Tasks: Rebase Worktrees onto the Default Branch

**Input**: Design documents from `specs/025-rebase-worktrees/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rebase-engine.md

**Tests**: Included — the engine is a mutating git operation, so the constitution's Development
Workflow requires a runnable check (pure unit tests + real-git-fixture tests, incl. a conflict path).

**Organization**: Grouped by user story. US1 + US2 (both P1) share the engine in `src/main/update.ts`
and ship together as the MVP; US3 (P2) hardens the safety guarantees; US4 (P2) adds the confirmation
guardrail and its re-enable control.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- File paths are relative to the repo root (the worktree `.worktrees/025-rebase-worktrees/`)

## Path Conventions

Single desktop app: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `tests/`.

---

## Phase 1: Setup (Governance Gate)

**Purpose**: Ratify the constitution amendment this feature depends on (merge gate, FR-014). No code
depends on it, but it MUST be ratified before merge.

- [X] T001 Amend `.specify/memory/constitution.md` to **v4.1.0** (MINOR): generalise Principle III's
  non-interactive-rebase latitude from "Pull-all" to any deliberate update action (covering "Rebase
  worktrees"), and add "Rebase worktrees" to Principle IV's enumerated long operations ("Refresh,
  Pull all, Cleanup, Rebase worktrees"). Update the Sync Impact Report header and bump
  `**Version**` / `**Last Amended**`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type + config surface every story builds on.

**⚠️ CRITICAL**: No user story work can begin until T002 is complete.

- [X] T002 Extend shared types in `src/shared/types.ts`: add `rebaseReminderSuppressed: boolean` to
  `Settings`; add `'default-branch-unknown'` and `'orphan-worktree'` to `UpdateReasonCategory`; add
  `rebaseWorktrees(): Promise<RepoUpdateOutcome[]>`, `confirmRebaseWorktrees(): Promise<{ proceed:
  boolean; suppress: boolean }>`, and `setRebaseReminderSuppressed(value: boolean): Promise<void>`
  to `RepoDashboardApi`.
- [X] T003 [P] In `src/main/config.ts`: add `rebaseReminderSuppressed: false` to `DEFAULT_SETTINGS`
  and register the `setRebaseReminderSuppressed` IPC handler (mirror `setShowWorktrees`).
- [X] T004 [P] In `src/renderer/view/table.ts`: add `REASON_SENTENCE` entries for
  `default-branch-unknown` and `orphan-worktree` (skip-phrased sentences).

**Checkpoint**: Types compile; settings round-trips the new flag; reason map is exhaustive.

---

## Phase 3: User Story 1 - Keep feature-branch worktrees current (Priority: P1) 🎯 MVP

**Goal**: One "Rebase worktrees" press replays every eligible linked worktree (including local-only
branches) onto the freshly-fetched `origin/<default>`, reporting updated / already-current / skipped.

**Independent Test**: Fixture repo with a local-only and a tracked feature worktree; advance
`origin/main`; press the button → both are rebased onto `origin/main` and reported updated
(quickstart D, E, G).

- [X] T005 [US1] Implement the happy-path engine `rebaseWorktrees(rows)` in `src/main/update.ts`:
  per-family default-branch resolution (`primary.head.branch` → `origin/HEAD` fallback), one
  `fetch origin <default>`, linked-worktree candidate selection (skip primary), eligibility +
  on-default/ancestor short-circuits, autostash → `git rebase origin/<default>` → restore →
  `updated`/`already-current`/`skipped`. Reuse `groupIntoFamilies`, `runPool`, `isDirty`,
  `restoreStash`, `expandTilde`, `NON_INTERACTIVE_ENV`, and the per-tree timeout wrapper. Export the
  pure helpers (`rebaseCandidates`, `worktreeSkipReason`, `resolveDefaultBranchName`) per
  contracts/rebase-engine.md.
- [X] T006 [US1] Wire IPC in `src/main/main.ts` (`ipcMain.handle('rebaseWorktrees', () =>
  rebaseWorktrees(lastSnapshot))`) and add the `rebaseWorktrees` bridge method in
  `src/preload/preload.ts`.
- [X] T007 [US1] In `src/renderer/view/toolbar.ts`: add the **Rebase worktrees** `.ctrl` button with
  `rebasing` busy state + `hasWorktrees` gate; add `rebasing`/`hasWorktrees` to `ToolbarState` and
  `onRebaseWorktrees` to `ToolbarHandlers`; include `rebasing` in every button's `busy`/lock
  expression. Add `.ctrl.rebase` styling in `src/renderer/styles.css` (mirror `.pull-all`).
- [X] T008 [US1] In `src/renderer/renderer.ts`: add `rebasing` state and `doRebaseWorktrees()`
  happy-path flow (set `rebasing`, rebuild `failedPaths`/`warnings`, `beginBusyLock('Rebasing…')`,
  call `api.rebaseWorktrees()`, summary notice, `endBusyLock`, `finally` release, then `doRefresh()`);
  derive `hasWorktrees` and pass it + `onRebaseWorktrees` into `renderToolbar`.
- [X] T009 [P] [US1] Pure unit tests in `tests/rebase-worktrees.test.ts`: `resolveDefaultBranchName`,
  `rebaseCandidates` (linked worktrees only, orphans excluded/flagged), `worktreeSkipReason`
  (unavailable/detached/on-default/local-only-eligible). Mirror `tests/update-eligibility.test.ts`.
- [X] T010 [US1] Real-git-fixture tests in `tests/rebase-worktrees.test.ts`: local-only worktree
  rebased onto `origin/<default>`; tracked worktree rebased onto default (not its own upstream);
  already-current; on-default skip (no reason); dirty worktree autostashed + restored. Mirror
  `tests/update.test.ts` fixture style.

**Checkpoint**: "Rebase worktrees" works end-to-end for the clean cases; MVP demoable.

---

## Phase 4: User Story 2 - Conflicting worktree left untouched & reported (Priority: P1)

**Goal**: A worktree whose rebase conflicts is aborted, restored byte-for-byte, and reported
`failed` with a conflict reason; fetch/timeout/unknown-default/orphan failures are reported likewise.

**Independent Test**: Fixture worktree whose commits conflict with `origin/main`; press the button →
worktree unchanged, no rebase in progress, reported `failed` with a conflict tooltip (quickstart H).

- [X] T011 [US2] Extend `rebaseWorktrees` in `src/main/update.ts` with the failure branches: conflict
  → `git rebase --abort` + `failed`/`rebase-conflict`; family fetch failure → `failed`/`fetch-failed`
  for all its worktrees; unresolved default → `failed`/`default-branch-unknown`; orphan rows →
  `skipped`/`orphan-worktree`; per-worktree timeout → `failed`/`timed-out` (abort in-progress rebase);
  stash push/restore failure → `failed`/`stash-failed` (work left recoverable). (Same file as T005 —
  sequential.)
- [X] T012 [US2] Real-git-fixture tests in `tests/rebase-worktrees.test.ts`: conflict leaves HEAD +
  commits + working tree identical and no `rebase-merge`/`rebase-apply` dir; restore-conflict keeps
  work in the stash and reports honestly; fetch-failed path. (Same file as T010 — sequential.)

**Checkpoint**: Both P1 stories complete — the feature is safe to ship behind the confirmation.

---

## Phase 5: User Story 3 - Never lose work; never touch the primary (Priority: P2)

**Goal**: Explicitly re-verify the two non-negotiable guarantees across every outcome path.

**Independent Test**: For each outcome, uncommitted work survives; the primary's working tree and
local default branch are byte-for-byte unchanged after a run (quickstart F, I).

- [X] T013 [US3] Fixture test in `tests/rebase-worktrees.test.ts` asserting the primary repo's
  working-tree contents and its local default-branch SHA are unchanged after a run (only
  remote-tracking refs move) — SC-005, FR-004. (Same file — sequential.)
- [X] T014 [US3] Fixture test in `tests/rebase-worktrees.test.ts` asserting uncommitted (tracked +
  untracked) work is present-or-recoverable after each outcome path (updated, already-current,
  conflict-abort, timeout) — SC-004, FR-010. (Same file — sequential.)

**Checkpoint**: Safety guarantees are locked by runnable checks.

---

## Phase 6: User Story 4 - Confirmation, suppression & re-enable (Priority: P2)

**Goal**: Warn before rewriting history unless suppressed; "do not remind me again" persists; the
reminder is re-enableable from a new "Other" Settings tab.

**Independent Test**: First press shows the warning; cancel = no-op; tick-and-confirm suppresses and
persists across restart; re-enable from Settings → warning returns (quickstart B, C, M, N).

- [X] T015 [US4] In `src/main/main.ts`: add the `confirmRebaseWorktrees` IPC handler using
  `dialog.showMessageBox(win, { type: 'warning', message, buttons: ['Rebase worktrees', 'Cancel'],
  defaultId: 0, cancelId: 1, checkboxLabel: 'Do not remind me again' })` returning `{ proceed:
  response === 0, suppress: checkboxChecked }`; add the bridge method in `src/preload/preload.ts`.
  (Same files as T006 — sequential.)
- [X] T016 [US4] In `src/renderer/renderer.ts`: gate `doRebaseWorktrees()` — when
  `!settings.rebaseReminderSuppressed`, call `api.confirmRebaseWorktrees()`; return on `!proceed`
  (no fetch/rebase/state change, FR-017); on `suppress`, `await api.setRebaseReminderSuppressed(true)`
  and update the cached `settings` before running. (Same file as T008 — sequential.)
- [X] T017 [US4] In `src/renderer/view/settings.ts`: widen `activeTab` to include `'other'`; add an
  "Other" tab button + tabpanel with a single labelled checkbox ("Warn before rebasing worktrees")
  reflecting `!rebaseReminderSuppressed`, calling `setRebaseReminderSuppressed(!checked)`; thread the
  setting + handler from `renderer.ts` into `renderSettingsModal`.

**Checkpoint**: All four stories complete and independently testable.

---

## Phase 7: Polish & Validation

**Purpose**: Build, full test run, and the mandatory manual mutating-op walkthrough.

- [X] T018 Run `pnpm build` and `pnpm test` — all existing + new tests green.
- [ ] T019 Execute the full `specs/025-rebase-worktrees/quickstart.md` walkthrough (scenarios A–N)
  against `pnpm start`, including at least one real conflict path and one fetch-failure path
  (constitution Development Workflow manual check for a mutating operation).
- [X] T020 [P] Update the "Active feature" narrative summary in `CLAUDE.md` to describe feature 025.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: Governance gate — independent of code; must be ratified before merge.
- **Foundational (T002–T004)**: T002 blocks everything; T003/T004 depend only on T002.
- **US1 (T005–T010)**: after Foundational. The MVP.
- **US2 (T011–T012)**: extends the same engine file as US1 — after T005.
- **US3 (T013–T014)**: after the engine has its failure paths (T011).
- **US4 (T015–T017)**: after Foundational; independent of the engine, but the renderer gate (T016)
  builds on the flow from T008.
- **Polish (T018–T020)**: after all desired stories.

### Key Sequential Chains (same-file, no [P])

- `src/main/update.ts`: T005 → T011
- `src/renderer/renderer.ts`: T008 → T016
- `src/main/main.ts` + `preload.ts`: T006 → T015
- `tests/rebase-worktrees.test.ts`: T009 → T010 → T012 → T013 → T014

### Parallel Opportunities

- T003 and T004 (different files, both after T002).
- T009 can be authored in parallel with T005 (different files) — TDD-friendly.
- T007 (toolbar+css) is independent of the engine work and can proceed alongside T005/T006.
- T017 (settings tab) is independent of the engine and can proceed alongside US1/US2.
- T020 (CLAUDE.md) parallel with the T018/T019 validation.

---

## Implementation Strategy

### MVP (Stories US1 + US2, both P1)

1. T001 (amendment) + T002–T004 (foundational).
2. T005–T010 (engine happy path + button + wiring + tests).
3. T011–T012 (conflict/failure safety) — ships with US1 since both are P1 and share the engine.
4. **STOP & VALIDATE**: quickstart D, E, G, H against a real fixture.

### Incremental Delivery

- Add US3 (T013–T014): lock the never-lose-work / never-touch-primary guarantees.
- Add US4 (T015–T017): confirmation + suppression + re-enable tab.
- Finish with Polish (T018–T020).

---

## Notes

- The engine (US1/US2) is one function with success and failure branches; splitting across two P1
  phases keeps each independently testable but they merge into the same `update.ts` diff.
- Reuse over addition: `RepoUpdateOutcome`, `failedPaths`/`warnings`, `groupIntoFamilies`, the
  timeout wrapper, and feature-024's Settings tab strip are all reused, not reinvented.
- Commit after each task or logical group; keep the primary repo on `main` — all work stays in the
  `025-rebase-worktrees` worktree.
