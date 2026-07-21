# Data Model: Duplicate-Clone Indicator

This feature introduces no persisted or IPC-crossing data, and no new fields on any existing type. It adds one derived rendering rule over data already computed today (`WorkingTreeEntry.collisionFragment`) and one more producer of 016's existing session-only search state.

## Entities

### Duplicate indicator (derived presentation, not stored)

| Source | Type | Notes |
|--------|------|-------|
| `entry.collisionFragment` | `string \| null` (`shared/types.ts:20`, unchanged) | Existing field, computed by `assignCollisionFragments` (`scan.ts:126-150`). Non-null exactly when this row shares a detection key (same remote identity + same directory name) with at least one other row. |

- **Visibility rule**: the indicator icon renders iff `entry.collisionFragment !== null` — identical gate to today's `.frag` text (`table.ts:290`), so no new truth table is introduced.
- **Tooltip text**: derived at render time as a fixed sentence + `entry.collisionFragment` (no new data; see research.md R4).
- **Lifecycle**: fully derived on every render from already-scanned data; nothing new is created, stored, or persisted.

### Search key (input to 016's existing `searchQuery`)

| Source | Type | Notes |
|--------|------|-------|
| `remote?.slug` | `string \| null` | Preferred key when the row's remote was parsed (`Remote` type, `shared/types.ts`). |
| `entry.directoryName` | `string` | Fallback key when `remote` is `null` or its `slug` is `null` (unparseable/no remote). |

- **Computed key** = `remote?.slug ?? entry.directoryName`, evaluated once at click time in `buildRow` where both values are already in scope (same fallback shape already used for the `.slug` cell, `table.ts:299`).
- **Consumer**: this key becomes the new value of 016's existing `searchQuery` module-level variable in `renderer.ts` — no new state container, just a new writer of an existing one.

## Interaction flow

```
entry.collisionFragment != null
        │
        ▼
render duplicate icon (button, disabled = locked)
        │  click (only when !locked)
        ▼
key = remote?.slug ?? entry.directoryName
        │
        ▼
renderer.ts: searchExpanded = true; searchQuery = key; render()
        │
        ▼
filterRows(rows, stateFilter, showWorktrees, failedPaths, searchQuery)   ← unchanged (016)
        │
        ▼
table narrows to every row whose slug/name/origin/branch contains `key`
```

No new entity, no new IPC message, no new persisted setting — the diagram above is entirely a composition of two already-existing pieces (the collision gate from `scan.ts`, and the search filter from 016).
