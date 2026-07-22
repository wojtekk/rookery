// Pure RowState derivation (shared with summary.ts/table.ts) + state/worktree filtering. See data-model.md, FR-024/029.

import type { Remote, Row, RowState, WorkingTreeEntry } from '../../shared/types';

// 'failed' is a sibling of 'all', not a RowState member: it reflects the outcome of the last
// "Pull all" attempt (an event), not git-derived state, so it never participates in
// deriveRowState or any Record<RowState, ...> map (007 data-model.md). 'gone' and 'local-only'
// are two more siblings: both are git-derived (real, persistent facts) but deliberately kept out
// of RowState too, since folding them in would add more row-edge colours — each is surfaced
// instead via its own branch-cell tag (honest, non-colour cue) plus this filter.
export type StateFilter = RowState | 'all' | 'failed' | 'gone' | 'local-only';

/** A tracked branch whose remote counterpart was deleted (commonly: the PR already merged). */
export function isGone(entry: WorkingTreeEntry): boolean {
  return entry.availability === 'ok' && !entry.head.detached && entry.head.upstream.tracking === 'gone';
}

/** A branch with no upstream configured at all — never pushed (026 data-model.md). */
export function isLocalOnly(entry: WorkingTreeEntry): boolean {
  return entry.availability === 'ok' && !entry.head.detached && entry.head.upstream.tracking === 'local-only';
}

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
  if (stateFilter === 'gone') return isGone(entry);
  if (stateFilter === 'local-only') return isLocalOnly(entry);
  return deriveRowState(entry) === stateFilter;
}

/** True if `q` (already normalized, non-empty) is contained in the repo's slug, name, origin, or
 *  branch (016 data-model.md R3). A detached HEAD or a null remote simply contributes no text. */
function searchMatchesRepo(entry: WorkingTreeEntry, remote: Remote, q: string): boolean {
  if (entry.directoryName.toLowerCase().includes(q)) return true;
  if (remote && ((remote.slug && remote.slug.toLowerCase().includes(q)) || remote.rawUrl.toLowerCase().includes(q))) {
    return true;
  }
  return entry.availability === 'ok' && !entry.head.detached && entry.head.branch.toLowerCase().includes(q);
}

/** True if `q` is contained in the worktree's own name or branch — slug/origin are inherited from
 *  the parent and already covered by `searchMatchesRepo` there (016 data-model.md R3/R6). */
function searchMatchesWorktree(entry: WorkingTreeEntry, q: string): boolean {
  if (entry.directoryName.toLowerCase().includes(q)) return true;
  return entry.availability === 'ok' && !entry.head.detached && entry.head.branch.toLowerCase().includes(q);
}

/**
 * Applies the state filter (FR-029), worktree visibility (FR-024), and search (016 data-model.md).
 * A primary is shown when it matches the filter+search itself, or a worktree beneath it does
 * (surfacing the family); a worktree is shown only when worktrees are on, its family is shown, and
 * it matches the state filter and (the parent's search hit OR its own name/branch matches).
 * Empty `searchQuery` reduces `repoHit` to always-true, reproducing pre-016 behavior exactly.
 */
export function filterRows(
  rows: Row[],
  stateFilter: StateFilter,
  showWorktrees: boolean,
  failedPaths: Set<string> = new Set(),
  searchQuery = '',
): Row[] {
  const q = searchQuery.trim().toLowerCase();
  const result: Row[] = [];

  for (const row of rows) {
    if (row.kind === 'orphan-worktree') {
      if (matches(row, stateFilter, failedPaths) && (q === '' || searchMatchesRepo(row, row.remote, q))) {
        result.push(row);
      }
      continue;
    }

    const repoHit = q === '' || searchMatchesRepo(row, row.remote, q);
    const ownMatches = matches(row, stateFilter, failedPaths) && repoHit;
    const worktreeHits = (w: WorkingTreeEntry): boolean =>
      matches(w, stateFilter, failedPaths) && (repoHit || searchMatchesWorktree(w, q));
    const childMatches = showWorktrees && row.worktrees.some(worktreeHits);
    if (!ownMatches && !childMatches) continue;

    const worktrees = showWorktrees ? row.worktrees.filter(worktreeHits) : [];
    result.push({ ...row, worktrees });
  }

  return result;
}
