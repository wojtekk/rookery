# Tasks: Skip Refresh When a Delete Is Cancelled

**Input**: Design documents from `/specs/021-no-refresh-on-cancel-delete/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: One new automated test file. Unlike the last several renderer-only
fixes, this change introduces a real decision point (refresh vs. no-refresh
keyed on `DeleteOutcome`), so per the constitution's Development Workflow
mandate (a guard/safety behavior touching a mutating operation must leave a
runnable check), the decision is extracted into a pure function and covered
by `tests/delete-refresh.test.ts` — see research.md Decision 1.

**Organization**: By user story. Spec.md defines a single user story (US1,
P1) — there is no P2/P3 split for this fix. No Setup or Foundational phase:
there is no project initialization and no shared prerequisite beyond the
existing `DeleteOutcome` type this fix consumes.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 (user-story phase only)

---

## Phase 1: User Story 1 — Cancel a delete without triggering a refresh (Priority: P1) 🎯 MVP

**Goal**: Cancelling a delete confirmation (at either confirmation step)
does not reload the repository list from disk or lock/dim the table; a
completed deletion continues to refresh exactly as today.

**Independent Test**: Click a row's delete icon, click Cancel on the
confirmation dialog, and confirm the table does not reload/lock — the row
list stays exactly as it was, with no rescan (per spec.md User Story 1).

- [X] T001 [US1] Create `src/shared/delete.ts` exporting
      `shouldRefreshAfterDelete(outcome: DeleteOutcome): boolean` — returns
      `false` only when `outcome.outcome === 'cancelled'`, `true` for
      `'deleted'` and `'failed'`. Mirror `src/shared/actions.ts`'s doc-comment
      style (pure, no Electron/DOM). Per research.md Decision 1/2.
- [X] T002 [P] [US1] Create `tests/delete-refresh.test.ts` (pattern:
      `tests/actions.test.ts`) with three cases against
      `shouldRefreshAfterDelete` from `src/shared/delete.ts`: `{ outcome:
      'deleted' }` → `true`, `{ outcome: 'cancelled' }` → `false`, `{
      outcome: 'failed', reason: 'x' }` → `true`. Depends on T001's export
      existing.
- [X] T003 [P] [US1] In `src/renderer/renderer.ts`'s `onDelete` handler
      (line 353), replace `void api.deleteRow(target).then(() =>
      doRefresh())` with a callback that calls `doRefresh()` only when
      `shouldRefreshAfterDelete(outcome)` is true; import
      `shouldRefreshAfterDelete` from `../shared/delete.js`. Replace the
      handler's stale comment (currently claims the renderer "just
      refreshes afterward regardless of outcome") with one noting that a
      cancelled delete is a no-op and is the one outcome that skips the
      refresh. Depends on T001's export existing.

**Checkpoint**: US1 fully satisfied and independently verifiable —
quickstart Scenarios A, B, C, D.

---

## Phase 2: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the new unit test and the full existing suite pass,
then manually validate the end-to-end behavior quickstart.md relies on for
the parts an automated test can't reach (real dialogs, real disk rescan).

- [X] T004 [P] Run `pnpm test` to confirm the existing `node --test` suite
      plus the new `delete-refresh.test.ts` cases all pass.
- [ ] T005 Run the full `quickstart.md` walkthrough (Scenarios A–D) against
      `pnpm start`, including both cancellation points (the initial and the
      risk-warning dialogs) and the completed/failed-deletion regression
      checks.

**Checkpoint**: Feature complete and validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately.
- **Polish (Phase 2)**: Depends on User Story 1 being complete.

### Within User Story 1

- T001 (the pure function) blocks T002 (tests it) and T003 (consumes it) —
  both of which can then proceed in parallel, since they touch different
  files and neither depends on the other's completion.

### Parallel Opportunities

- T002 and T003 can run in parallel once T001 is done (different files).
- T004 and T005 (Phase 2) are independent verification methods and can run
  in parallel.

---

## Parallel Example: User Story 1

```bash
# After T001 (src/shared/delete.ts) is done, launch together:
Task: "Create tests/delete-refresh.test.ts covering all three DeleteOutcome variants"
Task: "Update renderer.ts's onDelete handler to gate doRefresh() on shouldRefreshAfterDelete"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (US1): the pure predicate, its test, and the one-line
   renderer gate.
2. **STOP and VALIDATE**: run quickstart Scenarios A–D.
3. This alone resolves the reported bug's entire symptom.

### Incremental Delivery

1. US1 → validate → cancelling a delete no longer refreshes; a completed or
   failed delete still refreshes exactly as before (MVP, and the whole
   feature).
2. Phase 2 polish/regression checks close out the fix.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- [Story] label maps task to specific user story for traceability.
- Test-first is not mandated here (no TDD explicitly requested), but T002
  exists regardless per the constitution's runnable-check requirement for
  guard/safety behavior on a mutating operation's outcome.
- Commit after each task or logical group.
