# Quickstart & Validation: Filter Repositories Needing Attention

Runnable validation for the feature. Assumes the repo builds (`pnpm build`)
and the app launches (`pnpm start`).

## Automated: pure filter tests

```bash
pnpm test            # or: node --test dist/tests/filter.test.js
```

Required cases (extends the existing `filterRows` matrix in `filter.test.ts`):

| Fixture setup | Filter | Expected |
|---|---|---|
| One row's `fullPath` is in `failedPaths`, others aren't | `'failed'` | only that row is returned |
| A worktree's path is in `failedPaths`, its primary isn't, worktrees hidden | `'failed'` | the primary surfaces with just that worktree (family-surfacing, matches existing `'dirty'` behavior) |
| An orphan-worktree's path is in `failedPaths` | `'failed'` | it is returned (no family to surface) |
| `failedPaths` is empty | `'failed'` | empty result |
| No `failedPaths` argument passed at all | `'all'` / any `RowState` | behaves exactly as before 007 (default-parameter regression guard) |

## Manual: full UX flow

**Setup**: a dashboard with a mix of repositories, including at least one that
will fail a "Pull all" run (e.g., a diverged repository, per 006's quickstart).

**Steps & expected outcomes**

1. Before ever running "Pull all": look at the filter bar. The **Failed**
   chip shows **0**; selecting it shows an empty list (spec FR-005).
2. Run "Pull all" with a mix of outcomes including at least one failure.
3. After it completes: the **Failed** chip's count matches the number of
   failed repositories reported in the summary toast (spec FR-003).
4. Select the **Failed** chip: only the failed repositories (and, if a failed
   repository is a worktree with Worktrees toggled off, its surfaced parent)
   remain visible (spec FR-002/FR-007). Selecting it deselects whichever
   other filter chip was previously active (FR-006).
5. Resolve one failed repository and run "Pull all" again so it now succeeds:
   the Failed chip's count decreases and that repository drops out of the
   Failed filter view (spec FR-004, acceptance scenario US1.2).
6. Run "Pull all" again while the Failed filter is still selected: the list
   may transiently show empty while the run is in progress (documented edge
   case), then repopulate with the new run's failures once it completes.

## Non-goals to verify are absent

- The `sumbar` composition strip's proportions are unchanged by this feature
  (no new segment) — confirm it still sums to the total repository count.
- No new IPC call, no new persisted setting (check `getSettings()`/settings
  file are untouched by exercising this feature).
