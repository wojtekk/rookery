# Data Model: Local-Only Branch Filter

This feature introduces no persisted or IPC-crossing data, and no new entity. It adds one value to an existing renderer-only session-state type (`StateFilter`) and one derived visibility rule over data the existing scan already collects (`WorkingTreeEntry.head.upstream`, `src/shared/types.ts`).

## `StateFilter` (existing type, `view/filter.ts`)

```ts
export type StateFilter = RowState | 'all' | 'failed' | 'gone' | 'local-only';
```

`'local-only'` joins `'failed'` and `'gone'` as a sibling of `RowState`, not a member of it — see research.md Decision 1. `stateFilter` itself (a module-level variable in `renderer.ts`) is unchanged in lifecycle: in-memory, session-only, reset to `'all'` only by explicit user action, never persisted.

## Derived predicate: `isLocalOnly` (new, `view/filter.ts`)

| Input | `isLocalOnly` result |
|-------|----|
| `availability: 'unavailable'` | `false` (no readable branch) |
| `head.detached: true` | `false` (no current branch to lack an upstream) |
| `head.upstream.tracking: 'local-only'` | `true` |
| `head.upstream.tracking: 'tracked'` (any ahead/behind) | `false` |
| `head.upstream.tracking: 'gone'` | `false` (distinct, pre-existing case) |

No new fields are added to `WorkingTreeEntry` or `Remote` — `head.upstream.tracking === 'local-only'` is already a member of the existing discriminated union (`src/shared/types.ts`) and already populated by the existing scan (`src/main/git/parse.ts`).

## Matching rule (per working tree, mirrors "gone")

`matches(entry, 'local-only', failedPaths)` ⇔ `isLocalOnly(entry)`.

Composition with search and the worktree-visibility toggle is unchanged — `filterRows` already threads any `StateFilter` value through the same per-row/per-worktree logic used by every existing filter (FR-004).

## Count (renderer-only, `view/summary.ts`)

`countLocalOnly(rows)` mirrors `countGone(rows)`: sums `isLocalOnly` over every row and, for `repository` rows, every one of their worktrees — always computed over the full, unfiltered fleet (FR-003), matching every other chip's count semantics.
