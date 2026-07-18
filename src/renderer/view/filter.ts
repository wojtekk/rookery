// Pure RowState derivation (shared with summary.ts/table.ts) + state/worktree filtering. See data-model.md, FR-024/029.

import type { Row, RowState, WorkingTreeEntry } from '../../shared/types';

// 'failed' is a sibling of 'all', not a RowState member: it reflects the outcome of the last
// "Pull all" attempt (an event), not git-derived state, so it never participates in
// deriveRowState or any Record<RowState, ...> map (007 data-model.md).
export type StateFilter = RowState | 'all' | 'failed';

/** Pure function of (availability, local, head) — never stored (data-model.md). Dirty wins over out-of-sync (FR-028). */
export function deriveRowState(entry: WorkingTreeEntry): RowState {
  if (entry.availability === 'unavailable') return 'unavailable';
  if (entry.local > 0) return 'dirty';
  const { head } = entry;
  if (!head.detached && head.upstream.tracking === 'tracked' && (head.upstream.ahead > 0 || head.upstream.behind > 0)) {
    return 'out-of-sync';
  }
  return 'clean';
}

/** Whether one entry matches the active filter — 'failed' checks failedPaths membership, not RowState (007 data-model.md). */
function matches(entry: WorkingTreeEntry, stateFilter: StateFilter, failedPaths: ReadonlySet<string>): boolean {
  if (stateFilter === 'all') return true;
  if (stateFilter === 'failed') return failedPaths.has(entry.fullPath);
  return deriveRowState(entry) === stateFilter;
}

/**
 * Applies the state filter (FR-029) and worktree visibility (FR-024). A primary is shown when it
 * matches the filter itself, or a worktree beneath it does (surfacing the family); a worktree is
 * shown only when worktrees are on, its family is shown, and it matches the filter itself.
 */
export function filterRows(
  rows: Row[],
  stateFilter: StateFilter,
  showWorktrees: boolean,
  failedPaths: Set<string> = new Set(),
): Row[] {
  const result: Row[] = [];

  for (const row of rows) {
    if (row.kind === 'orphan-worktree') {
      if (matches(row, stateFilter, failedPaths)) result.push(row);
      continue;
    }

    const ownMatches = matches(row, stateFilter, failedPaths);
    const childMatches = showWorktrees && row.worktrees.some((w) => matches(w, stateFilter, failedPaths));
    if (!ownMatches && !childMatches) continue;

    const worktrees = showWorktrees ? row.worktrees.filter((w) => matches(w, stateFilter, failedPaths)) : [];
    result.push({ ...row, worktrees });
  }

  return result;
}
