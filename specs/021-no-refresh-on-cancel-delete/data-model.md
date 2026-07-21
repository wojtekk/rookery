# Phase 1 Data Model: Skip Refresh When a Delete Is Cancelled

No new entity, field, relationship, or state transition. This feature adds
one pure function over an existing type:

## `DeleteOutcome` (existing, unchanged — `shared/types.ts:85`)

```ts
type DeleteOutcome = { outcome: 'deleted' } | { outcome: 'cancelled' } | { outcome: 'failed'; reason: string };
```

## `shouldRefreshAfterDelete` (new — `shared/delete.ts`)

A pure function, not an entity: `(outcome: DeleteOutcome) => boolean`.

| `outcome.outcome` | Return value | Renderer effect |
|---|---|---|
| `'deleted'` | `true` | `doRefresh()` runs (row disappears) — unchanged |
| `'cancelled'` | `false` | `doRefresh()` skipped — the fix |
| `'failed'` | `true` | `doRefresh()` runs — unchanged |

No IPC payload change, no persisted setting, no `shared/types.ts` edit.
