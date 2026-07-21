# Phase 1 Data Model: Label the Loader With the Active Operation

No new entity, field, relationship, or state transition, and no change to
`shared/types.ts`. This feature adds one rendering parameter over existing,
unchanged renderer state.

## `beginBusyLock` (existing — `renderer.ts`)

Signature change only: `beginBusyLock(): void` → `beginBusyLock(label:
string): void`. Not an entity — a required parameter threaded straight
through to `setLoaderVisible`.

| Call site | `label` argument |
|---|---|
| Startup IIFE (initial load) | `'Loading…'` |
| `doRefresh()` | `'Refreshing…'` |
| `doUpdateAll()` ("Pull all") | `'Pulling…'` |
| `doCleanup()` | `'Cleaning up…'` |

These four call sites are already mutually exclusive at runtime (the
existing `refreshing`/`updating`/`cleaning`/startup-`loadState` guards), so
the loader never needs to reconcile two labels at once.

## `setLoaderVisible` (existing — `view/loader.ts`)

Signature change only: `setLoaderVisible(container, visible): void` →
`setLoaderVisible(container, visible, label?): void`. When `visible` is
`true` and `label` is provided, the persistent `.loader-label` child's
`textContent` is set to `label`; the child is created once (alongside the
three `.loader-dot` children, now wrapped in `.loader-dots`) on first show,
exactly like the existing dots.

No IPC payload change, no persisted setting, no `shared/types.ts` edit.
