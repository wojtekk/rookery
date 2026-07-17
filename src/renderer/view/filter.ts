// Pure RowState derivation (shared with summary.ts/table.ts) + state/worktree filtering. See data-model.md, FR-024/029.

import type { Row, RowState, WorkingTreeEntry } from '../../shared/types';

export type StateFilter = RowState | 'all';

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

/**
 * Applies the state filter (FR-029) and worktree visibility (FR-024). A primary is shown when it
 * matches the filter itself, or a worktree beneath it does (surfacing the family); a worktree is
 * shown only when worktrees are on, its family is shown, and it matches the filter itself.
 */
export function filterRows(rows: Row[], stateFilter: StateFilter, showWorktrees: boolean): Row[] {
  const result: Row[] = [];

  for (const row of rows) {
    if (row.kind === 'orphan-worktree') {
      if (stateFilter === 'all' || deriveRowState(row) === stateFilter) result.push(row);
      continue;
    }

    const ownMatches = stateFilter === 'all' || deriveRowState(row) === stateFilter;
    const childMatches = showWorktrees && row.worktrees.some((w) => deriveRowState(w) === stateFilter);
    if (!ownMatches && !childMatches) continue;

    const worktrees = showWorktrees
      ? row.worktrees.filter((w) => stateFilter === 'all' || deriveRowState(w) === stateFilter)
      : [];
    result.push({ ...row, worktrees });
  }

  return result;
}
