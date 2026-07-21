# Phase 1 Data Model: Fix Row Directory Tooltip Clipping

No data model changes. This feature adds no entity, field, relationship, or
state transition — it extends an existing DOM-measurement listener's
selector string to cover one more element (`.name`) that already carries
the data it displays (`entry.fullPath`, unchanged). No `shared/types.ts`
change, no IPC payload change, no persisted setting.
