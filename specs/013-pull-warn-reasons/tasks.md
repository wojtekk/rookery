# Tasks: Explain Why a Repository Wasn't Updated by Pull All

**Input**: Design documents from `/specs/013-pull-warn-reasons/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/update-outcome.md, quickstart.md

**Tests**: Automated tests **are** included — the constitution's Development
Workflow requires any change to a mutating operation (`update.ts` = pull) to
leave a runnable check that fails if the safety/behavior breaks. Reason
categorization is that logic. The icon + tooltip geometry remain manual
(quickstart.md), consistent with features 011/012 (no DOM/CSS harness in-repo).

**Organization**: The reusable warning affordance (shared type → IPC → renderer
icon/tooltip) is **foundational** — both user stories render the *same* icon and
differ only in where their reason is produced in `update.ts`. US1 (P1) produces
attempt-failure reasons; US2 (P2) produces stuck-skip reasons.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 (user-story phases only)

---

## Phase 1: Setup

No setup tasks: established single-project Electron/TS layout, no new files
beyond edits, no new dependency (Principle V). Proceed to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The source-agnostic warning pipeline every story shares — the
reason type across IPC, the git-error capture, and the reusable `.row-warn-ico`
+ tooltip. **No user story can be verified until this is complete.**

**⚠️ CRITICAL**: Blocks US1 and US2.

- [X] T001 [P] In `src/shared/types.ts`, add `UpdateReasonCategory`
      (`diverged | fetch-failed | stash-failed | timed-out | update-failed |
      unavailable | detached`), `UpdateReason { category; detail? }`, and add an
      optional `reason?: UpdateReason` to `RepoUpdateOutcome` (per
      `contracts/update-outcome.md` / `data-model.md`; additive, backward-compatible)

- [X] T002 [P] In `src/main/git/probe.ts`, capture `execFile`'s third callback
      argument (`stderr`) in `runGit` and attach it to the rejected `Error`
      (`(err as { stderr?: string }).stderr = stderr`) before `reject(err)` —
      one-line change, inert for every existing caller (research Decision 3, FR-003)

- [X] T003 In `src/renderer/renderer.ts`, after `updateAll()` returns, derive a
      `warnings = new Map(outcomes.filter(o => o.reason).map(o => [o.path, o.reason]))`
      alongside the existing `failedPaths` (which stays `result === 'failed'` for
      the red tint + "Failed" filter — FR-012); reset both on each new run and
      never persist (FR-011); thread `warnings` into `renderRows(...)` (depends on T001)

- [X] T004 In `src/renderer/view/table.ts`, render a reusable `.row-warn-ico`
      (`⚠`) on the **slug line** inside `name-cell` when the row has a `warnings`
      entry (FR-014), with `aria-label`/`data-tip` from the reason (FR-013);
      **generalize** the existing failed-only `⚠`/`FAIL_TOOLTIP` (`table.ts:36-38,
      220-224`) into this single icon so no row shows two `⚠`; keep the `.fail`
      light-red row class keyed on `failed` (FR-012) (depends on T001, T003)

- [X] T005 In `src/renderer/styles.css`, make the slug line a flex row so
      `.row-warn-ico` is a `flex-shrink:0` sibling and the slug text keeps
      `min-width:0` + ellipsis (long slug truncates first, icon never clipped —
      research Decision 4, FR-014); add a warn-tooltip variant with
      `white-space: pre-line` + a `max-width` for the category line + git detail,
      reusing the existing `.tip-up` flip rule (research Decision 5, FR-006/007) (depends on T004)

- [X] T006 In `src/renderer/renderer.ts`, extend the delegated `mouseover`
      selector (`:357`) so `positionRowIconTooltip` also handles `.row-warn-ico`
      (left-column origin → default leftward growth + `.tip-up` bottom-flip); and
      extend `pruneFixedFailedPaths` (`:129`) to also drop a warning whose cause is
      locally resolved on a manual Refresh — `unavailable`→availability ok,
      `detached`→on a branch, attempt-failure→row now clean (FR-008) (depends on T003, T004)

- [X] T006b In `src/main/update.ts`, refactor the internal helpers
      (`updateRepoInner`/`classifyAndMerge`/`updateRepo`) to return
      `{ result, reason? }` instead of a bare `UpdateResult`, and have `updateAll`
      carry an optional `reason` onto each `RepoUpdateOutcome`. This step adds the
      **plumbing only** — every `reason` is left `undefined`, so behavior and all
      existing outcomes are unchanged (FR-010). Extracting this shared refactor
      here (not inside a story) lets US1 and US2 each add only their own category
      labels, independently (depends on T001)

**Checkpoint**: The icon + tooltip render for any outcome carrying a `reason`,
and `update.ts` now has a `reason` slot to fill; `failedPaths` tint/filter
unchanged. No reason *values* are produced yet (US1/US2).

---

## Phase 3: User Story 1 — See why a repository stayed outdated (Priority: P1) 🎯 MVP

**Goal**: Every working tree whose "Pull all" attempt failed shows the warn
icon with a plain-language category and, when git errored, the underlying text.

**Independent Test**: quickstart Scenarios A, B, C — a diverged repo and an
unreachable-remote repo each show the icon with the right category (and git
detail for the fetch failure); updated/already-current repos show none.

- [X] T007 [US1] In `src/main/update.ts`, fill in the attempt-failure `reason`
      values on the return-shape added in T006b — label each existing non-success
      branch: diverged (`:107`)→`diverged`; fetch throw (`:102`)→`fetch-failed`
      (detail from `err.stderr`/`err.message`, trimmed + capped); stash
      push/restore fail (`:119`,`:131`)→`stash-failed`; deadline
      (`:138`)→`timed-out`; other git throw→`update-failed` (detail). Behavior of
      Pull all itself is unchanged (FR-010) (depends on T002, T006b)

- [X] T008 [P] [US1] In `tests/update.test.ts`, add cases: a diverged temp repo
      → `result:'failed'`, `reason.category:'diverged'`; an unreachable-remote repo
      → `reason.category:'fetch-failed'`, `reason.detail` non-empty; an updated and
      an already-current repo → **no** `reason` (the constitution runnable-check
      for this mutating op; FR-001/002/003/010) (depends on T007)

**Checkpoint**: MVP — attempt failures are explained on the row (Scenarios A–C).

---

## Phase 4: User Story 2 — Understand a repository skipped because it is stuck (Priority: P2)

**Goal**: A tree skipped as stuck (directory unavailable or detached HEAD) shows
the warn icon with its skip reason; a no-upstream tree never warns.

**Independent Test**: quickstart Scenarios D, E, F — an unavailable and a
detached-HEAD tree each show the icon with the right reason; a no-upstream tree
shows none.

- [X] T009 [US2] In `src/main/update.ts`, in `updateAll`'s skip branch
      (`:198-201`), derive the skip reason from the entry via a small **pure**
      helper `skipReason(entry)`: `availability !== 'ok'`→`unavailable`;
      `head.detached`→`detached`; otherwise (no tracked upstream / local-only)
      →`undefined` (no reason, never warned — FR-004/005). Attach it to the
      skipped `RepoUpdateOutcome`. Independent of US1 — fills the skip branch, not
      the attempt branches (depends on T006b)

- [X] T010 [P] [US2] In `tests/update.test.ts` (or a small pure test alongside
      `tests/filter.test.ts` conventions), unit-test `skipReason`: unavailable
      entry→`unavailable`, detached entry→`detached`, tracked→`undefined`,
      local-only/no-upstream→`undefined` (FR-005) (depends on T009)

**Checkpoint**: US1 + US2 both explained via the one shared icon (Scenarios A–F).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the whole suite, the TS build across main+renderer, and the
manual visual/interaction scenarios this feature relies on.

- [X] T011 [P] Run `pnpm test` — full suite (currently 102) plus T008/T010 must pass
- [X] T012 [P] Run `pnpm build` — confirm TypeScript compiles across main,
      preload, and renderer with the widened `RepoUpdateOutcome`
- [ ] T013 Run the full `quickstart.md` walkthrough against `pnpm start`:
      Scenarios A–L plus H2 (long slug), G (feature-007 coexistence), H/H2
      (tooltip never clipped), I (session-only), J (refresh prune), L (accessible)

**Checkpoint**: Feature complete and validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: T001 and T002 are independent [P]; T003→T004→T005
  and T006 build the renderer/CSS in order; T006b (the `update.ts` return-shape
  refactor) depends only on T001. Blocks all stories.
- **User Story 1 (Phase 3)**: needs T002 (stderr) + T006b (return shape). Fills
  attempt-failure reasons; renders through the Foundational icon.
- **User Story 2 (Phase 4)**: needs T006b only. Fills the skip branch —
  **independent of US1** (different code region of `update.ts`) and
  independently testable.
- **Polish (Phase 5)**: after the desired stories.

### Within Each User Story

- Reason production (`update.ts`) before its test.
- US1 is the MVP; US2 reuses the same rendered icon with no renderer changes.

### Parallel Opportunities

- T001 ∥ T002 (different files, no shared dependency).
- T008 ∥ (nothing else in US1); T010 ∥ (nothing else in US2); both are test-only.
- T011 ∥ T012 (independent verification commands).
- T003–T006 are **not** parallel: T004 needs T003's `warnings` threading, T005
  needs T004's markup, T006 shares `renderer.ts` with T003.

---

## Parallel Example: Foundational

```bash
# T001 and T002 touch different files with no shared dependency:
Task: "Add UpdateReason + reason? to src/shared/types.ts"
Task: "Attach stderr to the rejected error in src/main/git/probe.ts"
```

---

## Implementation Strategy

### MVP First (Foundational + User Story 1)

1. Phase 2 (T001–T006b): the shared warning pipeline + reusable icon + the
   `update.ts` return-shape refactor.
2. Phase 3 (T007–T008): produce and test attempt-failure reasons.
3. **STOP and VALIDATE**: quickstart Scenarios A–C — this resolves the reported
   bug (the three repos would now show *why* they weren't updated).

### Incremental Delivery

1. Foundation + US1 → the failed/outdated repos are explained (MVP).
2. US2 → stuck-skip repos (unavailable/detached) explained via the same icon.
3. Phase 5 → suite, build, and full manual walkthrough close it out.

---

## Notes

- [P] = different files / independent verification, no incomplete dependency.
- The warn icon is **one** affordance shared by both stories (FR-015) — US1/US2
  differ only in `update.ts` reason production, not in rendering.
- FR-012 is a *non*-change: `failedPaths` keeps driving the red tint + "Failed"
  filter; the icon is additive and broader.
- Constitution: T008 satisfies the mutating-operation runnable-check for
  `update.ts`; T013 is the "exercise against a real repo incl. a failure path".
- Commit after each task or logical group; stop at a checkpoint to validate a
  story independently.
