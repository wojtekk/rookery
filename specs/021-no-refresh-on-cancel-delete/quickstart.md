# Quickstart / Validation: Skip Refresh When a Delete Is Cancelled

Manual validation guide, plus the new automated unit test. See `spec.md`
for requirement IDs and `research.md` for the root-cause trace.

## Prerequisites

- System `git` available.
- At least one observed repository configured (ideally two: one to cancel a
  delete on, one whose delete you'll let complete, to check both paths
  without losing your only test row).
- A repository (or worktree) whose delete triggers the **second**,
  risk-warning confirmation dialog — e.g. one with uncommitted changes or no
  remote — to exercise the second cancellation point (`main.ts:169`).

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start           # build + electron .
```

## Automated tests

```bash
pnpm test            # builds, then: node --test dist/tests/*.test.js
```

Expected: the existing suite passes, plus new cases in
`tests/delete-refresh.test.ts` covering all three `DeleteOutcome` variants
against `shouldRefreshAfterDelete` (`deleted`/`failed` → `true`,
`cancelled` → `false`).

## Scenarios

### A. Cancel the first confirmation dialog (US1 Acceptance Scenario 1 · FR-001/002)

1. Click a repository row's delete icon.
2. On the "Delete X?" dialog, click **Cancel**.
3. Expect: the table does not lock/dim, no loading indicator appears, and
   the row list is visibly unchanged throughout — no rescan happens.
   ✅ SC-001.

### B. Cancel the second, risk-warning confirmation dialog (US1 Acceptance Scenario 2 · FR-001/002)

1. Click the delete icon on a row with uncommitted changes or no remote
   (triggers the second confirmation after the first).
2. Click **Delete** on the first dialog, then **Cancel** on the second,
   risk-warning dialog.
3. Expect: same as scenario A — no rescan, no lock/dim, row list unchanged.
   ✅ SC-001.

### C. A completed deletion still refreshes (US1 Acceptance Scenario 3 · FR-003)

1. Click a row's delete icon and confirm through to completion (click
   **Delete** on every dialog shown).
2. Expect: the table locks/dims briefly, a rescan happens, and the deleted
   row disappears from the list — identical to today's behavior. ✅ SC-002.

### D. No regression to a failed deletion

1. Trigger a delete that fails for a reason other than cancellation (e.g.
   remove the directory's write permission, or delete a directory that
   vanishes mid-flow in another way).
2. Expect: the table still refreshes afterward, exactly as it does today —
   this fix intentionally leaves the failed-outcome path unchanged (see
   `spec.md` Assumptions).
