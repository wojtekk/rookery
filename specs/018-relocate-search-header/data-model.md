# Data Model: Relocate Search Icon Above the Table

This feature introduces no persisted data, no IPC-crossing data, no new fields on any existing type, and no new state variable. It is a pure DOM-position and CSS change over state that already exists (016's `searchQuery`/`searchExpanded`, both untouched).

## Entities

None. The only "entity" this feature touches is a DOM/render-contract shape, not a data model:

### `SummaryElements` (existing interface, `view/summary.ts`) — one field removed

| Field | Before | After | Notes |
|-------|--------|-------|-------|
| `title` | `HTMLElement` (required) | *(removed)* | No longer written to — the element it pointed at (`#fleetTitle`) is deleted from `index.html`. |
| `filters` | `HTMLElement` | `HTMLElement` (unchanged) | Still the `#filters` counts container. |
| `sumbar` | `HTMLElement` | `HTMLElement` (unchanged) | Still the composition bar. |

No other type changes anywhere in `shared/types.ts`, `main/`, or `preload/` — this is renderer-view-only.

## Interaction flow

```
index.html (static markup)
  .bar            → no longer contains #search
  .fleet-head     → #search (moved here, leftmost) + #filters (unchanged, now second)

renderer.ts render()
  renderSearch(els.search, ...)   — unchanged call, only els.search's parent DOM position differs
  renderSummary(els, ...)         — unchanged call, minus the now-deleted `title` field
```

No new control flow, no new branch, no new failure mode — the existing 016 search state machine and its long-operation lockout are reused byte-for-byte.
