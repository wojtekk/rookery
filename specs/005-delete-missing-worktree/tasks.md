---
description: "Task list for Delete a Worktree Whose Directory Is Already Missing"
---

# Tasks: Delete a Worktree Whose Directory Is Already Missing

**Input**: Design documents from `/specs/005-delete-missing-worktree/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/delete.md, quickstart.md

**Tests**: Included for the git-mechanic proof (`git -C familyPath worktree remove <goneTarget> --force`) — the constitution's Development Workflow mandates "any code that mutates repository state (pull, delete, remove) MUST leave at least one runnable check that fails if the guard or safety behavior breaks," matching 004's existing precedent (`tests/delete-risk.test.ts`, real temp git repos, no mocking). The full dialog-skip + UI flow is validated manually via `quickstart.md` (requires real Electron dialogs, same "no DOM/process test harness" precedent as 003/004).

**Organization**: Single P1 user story. Foundational holds the shared type change and the pure git-mechanic proof (independent of any UI); User Story 1 wires that proof into the actual `deleteRow` flow end to end.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (setup, foundational, polish carry no story label)
- Exact file paths included in every task

## Path Conventions

Single-project Electron layout: `src/main`, `src/renderer`, `src/shared`, tests at repo-root `tests/` (compiled to `dist/tests/*.test.js`, run by `node --test`).

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching main/renderer/shared.

- [X] T001 Run `pnpm install && pnpm run build && pnpm test` from repo root and confirm a clean build and all 70 existing tests pass before making changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared type change and the proof that the underlying git command actually works against a missing directory, before wiring it into the live delete flow.

**⚠️ CRITICAL**: User Story 1 work cannot begin until this phase is complete.

- [X] T002 [P] Add `familyPath?: string` to `DeleteTarget` in `src/shared/types.ts` per `data-model.md` — the absolute path of a nested worktree's family/primary repository, populated only for nested worktree rows. Also update the existing comment above `DeleteTarget` ("`isWorktree` alone selects the removal path — no 'primary path' needed (research R2)"), which this change makes incorrect.
- [X] T003 [P] Add a test to `tests/delete-risk.test.ts` (real temp git repos, matching the project's existing convention — no mocking) proving `git -C <familyPath> worktree remove <path> --force` succeeds and deregisters the worktree from `git worktree list --porcelain` even when `<path>` has already been deleted from disk (research.md R1/R2). This is the pure git-mechanic proof; it does not touch `deleteRow` itself.

**Checkpoint**: The type exists and the underlying git command is proven correct against a missing directory; no UI or `deleteRow` changes yet.

---

## Phase 3: User Story 1 - Deleting a worktree row with a missing directory actually cleans it up (Priority: P1) 🎯 MVP

**Goal**: Clicking delete on a nested worktree row whose directory has already vanished from disk requires exactly one confirmation, actually deregisters the worktree from its family repository (not just reports success), and the row does not reappear on the next refresh.

**Independent Test**: With a worktree registered against an observed, present repository whose own directory has been deleted or moved outside the dashboard, click its delete icon, confirm once, and verify the row does not reappear after refresh and the family repository's worktree list no longer references it (quickstart.md scenario 1).

### Implementation for User Story 1

- [X] T004 [US1] In `src/renderer/view/table.ts`, thread `familyPath` from the parent row down to the delete click, in three steps: (1) widen `RowActionHandlers.onDelete`'s parameter type (currently the inline `{ path: string; isWorktree: boolean }` at line ~13) to include `familyPath?: string` — or switch it to the shared `DeleteTarget` type — since TypeScript's excess-property check will otherwise reject step (3)'s object literal; (2) add a `familyPath?: string` parameter to `buildRow` and `buildDeleteCell` (currently `buildDeleteCell(entry, isWorktree, handlers)` only receives the child `WorkingTreeEntry`, not the parent `Row`, so the value isn't in scope yet); (3) at the `row.worktrees` loop's call site (currently `buildRow(wt, row.remote, defaultHost, true, actions, handlers)`), pass `row.fullPath` as `familyPath`, and at the primary-row call site pass `undefined`. Populate unconditionally for every nested worktree row, not only ones currently rendering as unavailable (data-model.md: avoids a stale-snapshot race if the directory vanishes between render and click). (Depends on T002.)
- [X] T005 [US1] In `src/main/main.ts`'s `deleteRow`, add the missing-directory branch immediately after the first confirmation and before `probeRemoteUrl`/`computeDeleteRisk` are called: if `target.isWorktree && !(await pathExists(target.path))`, skip the risk check and second confirmation entirely, then either run `runGit(['-C', target.familyPath, 'worktree', 'remove', target.path, '--force'], target.familyPath)` and return `{ outcome: 'deleted' }` (catching failures as `{ outcome: 'failed', reason: err.message }`), or — if `target.familyPath` is `undefined` — return `{ outcome: 'failed', reason: 'Cannot remove: worktree directory is missing and its family repository is unknown.' }` without attempting removal. Per `contracts/delete.md`'s amended sequence and `data-model.md`'s decision table. (Depends on T002, T003.)
- [X] T006 [US1] Execute `quickstart.md` scenarios 1-3 (missing-directory worktree delete; unreadable family repository; regression check on a present, normal worktree) against disposable scratch repos and confirm each passes as described.

**Checkpoint**: A nested worktree row whose directory is missing is deleted with exactly one confirmation, actually deregisters from git, and does not reappear on refresh; a present worktree's delete flow is unaffected (regression-checked).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final regression across the whole delete feature (004 + 005 combined).

- [X] T007 Run `pnpm run build && pnpm test` and confirm zero regressions across the full suite (baseline 70 + new tests from T003).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks User Story 1.
- **US1 (Phase 3)**: after Foundational.
- **Polish (Phase 4)**: after US1.

### Within Foundational

- T002 (type) and T003 (git-mechanic test) touch different files and have no dependency on each other — both can run in parallel.

### Within User Story 1

- T004 (renderer) depends on T002 (needs the `familyPath` field to exist on the type).
- T005 (main.ts) depends on T002 and T003 (needs the type and the proven git-command shape).
- T004 and T005 touch different files and can run in parallel with each other once Foundational is done.
- T006 (manual validation) depends on T004 and T005 both being complete.

### Parallel Opportunities

- T002 [P] + T003 [P] in Foundational.
- T004 [P] + T005 [P] in User Story 1 (different files: `table.ts` vs `main.ts`).

---

## Parallel Example: Foundational

```bash
Task: "Add familyPath?: string to DeleteTarget in src/shared/types.ts"
Task: "Add a real-git-fixture test proving git -C familyPath worktree remove <goneTarget> --force works"
```

## Parallel Example: User Story 1

```bash
Task: "Populate familyPath for nested worktree rows in src/renderer/view/table.ts"
Task: "Add the missing-directory branch to deleteRow in src/main/main.ts"
```

---

## Implementation Strategy

### MVP (User Story 1, the only story)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (type + git-mechanic proof).
3. Complete Phase 3: User Story 1 (wire the proof into the live delete flow).
4. **STOP and VALIDATE**: quickstart scenarios 1-3 all pass — this is the entire feature.
5. Complete Phase 4: Polish (full-suite regression check).

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Commit after each task or logical group; keep `main` clean (work in this worktree per project rules).
- Every `quickstart.md` scenario MUST be run against disposable scratch repositories — this feature performs real, irreversible git operations.
- Out of scope (per spec.md Assumptions and research.md R4): the pre-existing `isWorktree` misclassification for top-level orphan-worktree rows. Do not fix it as part of this task list — it is a distinct root cause with its own risk surface.
