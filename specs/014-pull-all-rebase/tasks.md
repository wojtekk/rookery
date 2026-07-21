---
description: "Task list for feature 014 — Rebase Diverged Repositories on Pull All"
---

# Tasks: Rebase Diverged Repositories on Pull All (match `git pull --autostash`)

**Input**: Design documents from `specs/014-pull-all-rebase/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/update-engine.md

**Tests**: **Required** (not optional) — the constitution's Development Workflow mandates that
any code mutating repository state leaves a runnable check that fails if the safety behavior
breaks, and that a mutating change be manually exercised against a real repo including a
conflict path. Rebase is a mutating operation, so test tasks are first-class here.

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1 and ship
together (two halves of the same `classifyAndMerge` diverged branch); US3 (P2) hardens the
never-lose-work guarantee.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Single project, three layers: `src/shared/`, `src/main/`, `src/renderer/`, `tests/` at repo
root (see plan.md → Structure Decision). Run `nvm use` before any `pnpm`/`node` command.

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing a mutating operation.

- [X] T001 Run `nvm use && pnpm install` then `pnpm build && pnpm test` on branch `014-pull-all-rebase`; confirm the existing suite (103 tests) is green before any change. Note the current `tests/update.test.ts` diverged test asserts `failed`/`diverged` (it will be retargeted in T005).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type + environment changes both P1 stories depend on. Small, but must
land first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `'rebase-conflict'` to the `UpdateReasonCategory` union in `src/shared/types.ts` (place it in the attempt-failure group, after `'update-failed'`, per data-model.md). Keep the explanatory comment accurate (attempt-failure categories carry `detail`).
- [X] T003 Extend `NON_INTERACTIVE_ENV` in `src/main/update.ts` with `GIT_EDITOR: 'true'` and `GIT_SEQUENCE_EDITOR: 'true'` so a rebase can never block on an editor (research Decision 5; Principle I "never prompt"). Add a one-line `ponytail:`-style comment explaining why.

**Checkpoint**: Types compile (`pnpm build`); the new reason exists but is unused; suite still green.

---

## Phase 3: User Story 1 — Diverged repo updates via rebase (Priority: P1) 🎯 MVP

**Goal**: An eligible diverged repository (local commits + advanced upstream) whose rebase
applies cleanly is brought up to date by "Pull all" — local commits replayed atop the
upstream, uncommitted work (tracked + untracked) restored, reported `updated`, no merge
commit. Matches `git pull --autostash`.

**Independent Test**: A clone with a local un-pushed commit and an upstream commit touching a
*different* file (plus a dirty edit + an untracked file) → `updateRepo` returns `updated`;
`git log` shows the local commit rebased on top; no merge commit; edits restored; stash empty.

- [X] T004 [US1] Implement the clean-rebase path: in `classifyAndMerge` (`src/main/update.ts`), replace the diverged branch `return { result: 'failed', reason: { category: 'diverged' } }` with a new `rebaseOntoUpstream(dir, opts)` helper that runs `git rebase @{u}` and returns `{ result: 'updated' }` on success (research Decision 1/2; contracts/update-engine.md). Leave the fast-forward (`merge --ff-only`) and classification branches unchanged (FR-003).
- [X] T005 [US1] Retarget the existing test `updateRepo: diverged (both advanced) + dirty → failed …` in `tests/update.test.ts`: make the local and remote commits touch **different files** (non-conflicting) and assert `result === 'updated'`, `reason === undefined`, HEAD advanced with the local commit present atop the remote commit, **no merge commit** (`git rev-list --merges` empty / parent count == 1), tracked+untracked edits restored, `stashList(work) === ''` (INV-1, INV-3, FR-002/FR-009).

**Checkpoint**: US1 fully functional — the reported bug is fixed for the clean case. `pnpm test` green.

---

## Phase 4: User Story 2 — Conflicting repo fails safely and explains itself (Priority: P1)

**Goal**: When the rebase cannot complete without a conflict, "Pull all" aborts it, restores
the repository byte-for-byte, reports `failed` with a `rebase-conflict` reason, and surfaces a
distinguishable, hand-off tooltip. Never resolves, never leaves a rebase in progress.

**Independent Test**: A clone whose local commit and upstream commit edit the *same lines* →
`updateRepo` returns `failed`/`rebase-conflict`; HEAD, local commits, and working tree
(tracked + untracked) unchanged; no `.git/rebase-merge`; stash empty.

- [X] T006 [US2] Complete the failure path in `rebaseOntoUpstream` (`src/main/update.ts`): wrap `git rebase @{u}` in try/catch; on catch run `git rebase --abort` (best-effort, swallow its errors) then return `{ result: 'failed', reason: { category: 'rebase-conflict', detail: errorDetail(err) } }` (research Decision 3; contracts/update-engine.md; FR-004/005/006). The same catch also covers **FR-011**: a rebase killed by the spawn/family timeout throws → the `--abort` clears any in-progress rebase before the outer `updateRepo` maps the run to `timed-out` (no rebase left in progress). Add a `ponytail:` comment noting the catch serves both the conflict and killed-spawn cases.
- [X] T007 [P] [US2] Add `REASON_SENTENCE['rebase-conflict']` in `src/renderer/view/table.ts`: `'Update blocked — rebase hit a conflict; resolve it in your merge tool'` (data-model.md presentation; FR-006). Confirm no other renderer change is needed (`renderer.ts` `isWarningResolved` falls through to the clean-row rule — research Decision 7).
- [X] T008 [US2] Add a new test in `tests/update.test.ts`: diverged clone with local + remote commits editing the **same lines** of `tracked.txt`, plus a dirty edit to another tracked file and an untracked file. Assert `result === 'failed'`, `reason.category === 'rebase-conflict'`, `reason.detail` non-empty, `headSha(work)` == pre-op HEAD, local commit still present, `tracked.txt` restored to its pre-op content (no conflict markers), the dirty edit + untracked file restored, no `.git/rebase-merge` directory exists, and `stashList(work) === ''` (INV-2, INV-3).

**Checkpoint**: Both P1 stories done — clean divergence updates, conflicting divergence fails safely and legibly. `pnpm test` green; `pnpm build` clean.

---

## Phase 5: User Story 3 — Never lose uncommitted work (Priority: P2)

**Goal**: Prove uncommitted work survives every outcome path, including the restore-conflict
case (autostash pop conflicts with newly rebased content).

**Independent Test**: After a clean rebase whose stash pop conflicts, the outcome is reported
honestly (not silent success) and the uncommitted work remains recoverable in the stash.

- [X] T009 [US3] Add a restore-conflict test in `tests/update.test.ts` (FR-008): a diverged clone where the rebase applies cleanly but the autostashed dirty edit collides with the rebased content, so `restoreStash`'s pop **and** `apply --index` both fail. Assert `result === 'failed'`, `reason.category === 'stash-failed'`, and the stash is **preserved** (`stashList(work)` non-empty → work recoverable). If a deterministic collision fixture proves impractical, document that in a `ponytail:` note and instead assert the existing `restoreStash`→`stash-failed` contract via the closest reproducible path; do not delete the assertion.
  - Implemented deterministically: local diverges on a different file (clean rebase), while the
    dirty edit and the remote's advancing commit both touch the same line of `tracked.txt` from a
    shared 3-line base — forcing a genuine 3-way conflict on stash pop, not a fuzzy-context guess.

**Checkpoint**: The never-lose-work guarantee has explicit coverage across updated / conflict-abort / restore-conflict.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 Run `pnpm build && pnpm test`; confirm the full suite passes (prior 103 + new/retargeted cases) with no `diverged` regressions in the untouched branches (already-current, local-ahead, fetch-failed, shared-stash family). Explicitly confirm `tests/update-eligibility.test.ts` and the `skipReason` test stay green — this is the automated guard for **FR-010** (ineligible repos — detached / no-upstream / unavailable — are never rebased, since the rebase lives only inside the eligible-and-diverged branch).
  - 105/105 tests pass (103 baseline + T008 + T009; T005 retargets rather than adds). `update-eligibility.test.ts` (5/5) and `skipReason` confirmed green in isolation.
- [X] T011 Governance gate (FR-012): verify `.specify/memory/constitution.md` is at **v4.0.0** with the Principle III rebase amendment and updated Sync Impact Report (done via `/speckit-constitution` this session) — this is a merge blocker; confirm it is present.
  - Confirmed: version footer reads `4.0.0 | Last Amended: 2026-07-21`; Sync Impact Report documents the Principle III relaxation.
- [ ] T012 Execute `quickstart.md` scenarios A (diverged→rebased/updated), B (conflict→failed/rebase-conflict, safe restore, tooltip), and C (no regressions) against a real repo via `pnpm start`. Records the constitution-required manual exercise of a mutating operation including the conflict path. *(Requires driving the live Electron window — perform manually; note if deferred.)*
  - **Deferred**: cannot drive real mouse/hover interaction against the Electron window from this environment (same limitation as features 009/010/012/013). Owed before merge, same as those.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none.
- **Foundational (T002–T003)**: after Setup; **blocks all stories** (types + env used by the rebase).
- **US1 (T004–T005)**: after Foundational. Delivers the MVP.
- **US2 (T006–T008)**: after Foundational; T006 edits the same helper T004 creates → sequential with T004. T007 is independent (renderer file) and may run in parallel once T002 lands.
- **US3 (T009)**: after US1 (needs the clean-rebase path to reach the restore step).
- **Polish (T010–T012)**: after all desired stories.

### Within/Across Stories

- T004 then T006 (same function `rebaseOntoUpstream`, must be sequential).
- T005 depends on T004; T008 depends on T006; T009 depends on T004+T006.
- T007 [P] depends only on T002 (the new enum value), not on the engine tasks.

### Parallel Opportunities

- T007 (renderer tooltip string) can run in parallel with T004/T005/T006 once T002 is in.
- Test authoring (T005, T008, T009) touches one shared file (`tests/update.test.ts`); treat as sequential edits to avoid conflicts (not marked [P]).

---

## Implementation Strategy

### MVP First (US1)

1. T001 (baseline green) → T002–T003 (foundational) → T004–T005 (US1).
2. **STOP and VALIDATE**: the originally-reported diverged repos now update via rebase.
3. This alone fixes the bug for the common (non-conflicting) case.

### Incremental Delivery

1. Foundation → US1 (MVP: clean divergence updates).
2. US2 (conflict safety + legible reason) — ships with US1 for a complete P1 (do not merge US1 without US2's safety half).
3. US3 (never-lose-work hardening).
4. Polish: full suite + governance gate + manual quickstart.

---

## Notes

- Whole feature is ~3 source edits (`types.ts`, `update.ts`, `table.ts`) + 3 test edits; the
  existing autostash wrapper already sets the tree clean before the rebase (research Decision 1),
  so no new stash logic is needed.
- [P] = different files, no incomplete-task dependency.
- Commit after each task or logical group; end commit messages with the `Co-Authored-By` line and a `ref:` Jira trailer per repo convention.
- Do not merge until T011 (constitution v4.0.0) and T012 (manual conflict-path exercise) are satisfied.
- **FR-011 (timeout mid-rebase) has no dedicated automated test — accepted.** A deterministic
  60 s/5 s timeout fixture is impractical in `node:test`; the guarantee is instead enforced
  structurally by T006's catch (any killed rebase → `--abort` → no rebase in progress) and
  exercised for real in the T012 quickstart. If the timeout logic is ever refactored, revisit
  whether a fault-injection test becomes worthwhile.
