# Contract: Local-Only Filter Chip

This is a UI-application, not a library/API — the "contract" here is the pure-function surface `filter.ts` exposes to `summary.ts`/`renderer.ts`, since that's the interface between the filtering logic (behavior) and the chip rendering (presentation).

## `view/filter.ts` — new/changed exports

```ts
export type StateFilter = RowState | 'all' | 'failed' | 'gone' | 'local-only'; // was: ... | 'gone'

export function isLocalOnly(entry: WorkingTreeEntry): boolean; // new, mirrors isGone

// matches() gains one branch, evaluated the same place as the existing 'gone' branch:
//   if (stateFilter === 'local-only') return isLocalOnly(entry);
```

`filterRows(rows, stateFilter, showWorktrees, failedPaths, searchQuery)` itself is **unchanged** — `'local-only'` flows through as just another `StateFilter` value, the same way `'gone'` already does.

## `view/summary.ts` — new/changed behavior

```ts
function countLocalOnly(rows: Row[]): number; // new, mirrors countGone
```

`renderSummary(...)` appends one more chip after the existing "gone" chip:

```ts
makeChip('local-only', countLocalOnly(rows), activeFilter === 'local-only', () => onFilterChange('local-only'), undefined, locked)
```

Same `undefined` swatch class as "gone" (no colour), same `locked` plumbing (FR-005) — no change to `makeChip` itself.

## Behavioral guarantees (unchanged, verified by inspection — not new code)

- Every existing `StateFilter` value's behavior (`all`, per-`RowState`, `failed`, `gone`) is untouched — the new branch is additive only.
- The fixed chip order established today (All → Clean → Uncommitted → Out of sync → Unavailable → Failed → Gone) gains exactly one member at the end: Local-only.
- The search box and worktree-visibility toggle compose with `'local-only'` exactly as they already do with every other filter (no `filterRows` change).
