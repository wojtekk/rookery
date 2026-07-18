# Phase 1 Data Model: Filter Repositories Needing Attention

No new persisted or IPC-crossing types. This feature widens one existing
renderer-local type and one existing pure function.

## Widened type (`src/renderer/view/filter.ts`)

```ts
// Before (001):
export type StateFilter = RowState | 'all';

// After (007):
export type StateFilter = RowState | 'all' | 'failed';
```

`'failed'` is a sibling of `'all'`, not of the `RowState` members: like
`'all'`, it is a filter-bar concept with no corresponding `RowState` value —
it does not participate in `deriveRowState`, `STATE_ROW_CLASS`,
`STATE_GLYPH_CLASS`, or any other `Record<RowState, ...>` map in `table.ts`/
`summary.ts`. Those stay exactly as they are today.

## Widened predicate (`filterRows`)

```ts
export function filterRows(
  rows: Row[],
  stateFilter: StateFilter,
  showWorktrees: boolean,
  failedPaths: Set<string> = new Set(),
): Row[]
```

Internally, the three existing inline checks
(`stateFilter === 'all' || deriveRowState(x) === stateFilter`) are replaced by
one `matches(entry, stateFilter, failedPaths)` helper:

```ts
function matches(entry: WorkingTreeEntry, stateFilter: StateFilter, failedPaths: ReadonlySet<string>): boolean {
  if (stateFilter === 'all') return true;
  if (stateFilter === 'failed') return failedPaths.has(entry.fullPath);
  return deriveRowState(entry) === stateFilter;
}
```

All existing behavior — family surfacing (a primary shows if a hidden child
matches), worktree-visibility gating, orphan-worktree handling — is preserved
unchanged, because it's built on top of `matches()` the same way it was built
on top of the old inline check (FR-007: the Failed filter reuses this
existing machinery rather than a parallel code path).

## Filter-bar chip (`src/renderer/view/summary.ts`)

`renderSummary` gains one more rendered chip, positioned after the existing
four state chips:

| Chip | Count source | Swatch |
|------|---------------|--------|
| Failed | `failedPaths.size` | `.sw-fail` (new; reuses the `--fail` colour token from 006's `styles.css`) |

This chip is **not** added to the `STATES`/`SEG_CLASS` arrays that drive the
`sumbar` composition segments (see research.md R2) — it only ever appears as
a filter chip with its own count, sourced from `failedPaths` rather than a
per-`RowState` tally.

## Renderer state (`src/renderer/renderer.ts`) — no change to lifecycle

`failedPaths: Set<string>` already exists (006). This feature only *reads* it
in two more places (`renderSummary`, `filterRows`) than it does today
(`renderRows`); it does not change when the set is populated or cleared:

- Cleared at the start of every `doUpdateAll()` run (unchanged, FR-004/FR-005).
- Populated from `updateAll()`'s outcomes after a run completes (unchanged).
