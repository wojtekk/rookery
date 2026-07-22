# Phase 1 Data Model: Tabbed Settings Window

No new persisted entity, field, or IPC payload (FR-010). This feature adds
one piece of transient, renderer-local UI state.

## `activeTab` (new — module-level in `src/renderer/view/settings.ts`)

Not a data entity — a DOM-view state variable, alongside the existing
`editingId`/`formIcon` transient state in the same file.

| Field | Type | Lifetime | Reset point |
|---|---|---|---|
| `activeTab` | `'directories' \| 'actions'` | Module-level, in-memory | `openSettingsModal()` (every window open) → `'directories'` |

## State transitions

```text
openSettingsModal()          → activeTab = 'directories'
click "Directories" tab      → activeTab = 'directories'; #tab-directories visible, #tab-actions hidden
click "Actions" tab          → activeTab = 'actions';     #tab-actions visible, #tab-directories hidden
renderSettingsModal() redraw → activeTab unchanged (re-applies its current value to the new DOM)
```

## Existing entities touched (unchanged shape)

- `Action[]` (`shared/types.ts`) — rendered inside the Actions tab panel
  exactly as today; `renderActionsSection`'s signature gains a return type
  (`HTMLElement`, the section it builds) so the caller can attach
  tab-panel attributes to it, but its parameters and internal logic are
  untouched.
- `directories: string[]` — rendered inside the Directories tab panel
  exactly as today.

No validation rules change: directory add/remove and action add/edit/
remove/reorder keep their existing constraints (`ACTION_LIMIT`, `canAdd`,
etc. in `shared/actions.ts`) untouched.
