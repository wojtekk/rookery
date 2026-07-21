# Phase 1 Data Model: Fix Duplicate-Indicator Tooltip Collision

This fix adds no persisted data, no IPC payload, and no new domain entity,
and no new JS-owned state of any kind. The suppression (research.md
Decision 2) is static, declarative CSS — `:has()` reads the browser's own
native `:hover` state on an existing element; nothing is computed, stored, or
passed between processes.

## Entities

None. The two tooltips already exist (`.name[data-tip]` = the row's full
path; `.row-dup-ico[data-tip]` = the duplicate notice), and neither their
content nor their data source changes. This fix only changes which one's
`::after` box is permitted to render at a given hover position.

## State transitions

None beyond the browser's native `:hover` pseudo-class, which already governs
both tooltips today. No new class is toggled, no new attribute is set or
read, and no existing one changes meaning.
