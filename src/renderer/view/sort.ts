// Pure sort + deterministic tie-break over the top-level Row[] snapshot. See data-model.md, FR-020.

import type { Row } from '../../shared/types';

export type SortDimension = 'slug' | 'directoryName' | 'lastChange' | 'localCount';
export type SortDirection = 'asc' | 'desc';

/** Repository name only (last path segment of slug) — host/owner are excluded so sort ignores organisation. */
function slugKey(row: Row): string {
  if (!row.remote || !row.remote.slug) return '';
  const segments = row.remote.slug.split('/');
  return segments[segments.length - 1] ?? '';
}

function localCount(row: Row): number {
  const own = row.availability === 'ok' ? row.local : 0;
  const worktrees = row.kind === 'repository' ? row.worktrees : [];
  const worktreeSum = worktrees.reduce((sum, w) => sum + (w.availability === 'ok' ? w.local : 0), 0);
  return own + worktreeSum;
}

/** Absent/equal primary key breaks the tie by directoryName then fullPath, always ascending (FR-020). */
function tieBreak(a: Row, b: Row): number {
  return a.directoryName.localeCompare(b.directoryName) || a.fullPath.localeCompare(b.fullPath);
}

/** Sorts primaries/orphan-worktrees only; each Repository's nested `worktrees` stay in place. */
export function sortRows(rows: Row[], dimension: SortDimension, direction: SortDirection): Row[] {
  const dir = direction === 'asc' ? 1 : -1;

  if (dimension === 'lastChange') {
    // Absent lastChange (unavailable or unborn HEAD) sorts last regardless of direction (data-model.md).
    return [...rows].sort((a, b) => {
      const ka = a.availability === 'ok' ? a.lastChange : null;
      const kb = b.availability === 'ok' ? b.lastChange : null;
      if (ka === null && kb === null) return tieBreak(a, b);
      if (ka === null) return 1;
      if (kb === null) return -1;
      return ka === kb ? tieBreak(a, b) : dir * ka.localeCompare(kb);
    });
  }

  const keyFn: (row: Row) => string | number =
    dimension === 'slug' ? slugKey : dimension === 'directoryName' ? (r) => r.directoryName : localCount;

  return [...rows].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka === kb) return tieBreak(a, b);
    return typeof ka === 'number' && typeof kb === 'number'
      ? dir * (ka - kb)
      : dir * String(ka).localeCompare(String(kb));
  });
}
