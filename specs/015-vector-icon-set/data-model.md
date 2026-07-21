# Phase 1 Data Model: Unified Vector Icon Set

This feature has no persisted or runtime *data* entities — the only "model" is
the compiled-in icon catalog. Documented here for completeness.

## Entity: IconEntry (in `catalog.ts`)

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `id` | `string` | unchanged | Stable key referenced by `Action.iconId`; MUST NOT change for existing launcher ids or user configs break. |
| `label` | `string` | unchanged | Human/accessible name. |
| `svg` | `string` | **content changed** | Inner markup only (no `<svg>` wrapper). Now Tabler stroke-only path data for every entry except IntelliJ. |
| `pickable` | `boolean?` | **new, optional** | `undefined`/`true` → offered in the Settings picker (launcher glyphs). `false` → fixed affordance, hidden from the picker. |

### Invariants

- Existing launcher `id`s are preserved exactly: `github`, `intellij`, `vscode`,
  `finder`, `terminal`, `git`, `folder`, `globe`, `code`, `rocket`, `gear`.
  (Their `svg` data changes; their ids do not — FR-012.)
- `ICON_IDS` = ids of entries with `pickable !== false`, in declaration order.
- Fixed-affordance entries (`pickable: false`): `trash`, `x`, `chevron-up`,
  `chevron-down`, `git-branch` — never in `ICON_IDS` (FR-010).
- Every entry renders monochrome via the wrapper's `currentColor` (no per-entry
  colour) — FR-003, Principle IV.

## Entity: iconSvg wrapper (in `catalog.ts`)

Single source of the `<svg>` element wrapped around every entry's `svg` inner
markup. Recipe changes from fill-based to stroke-based:

- **Before**: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" …>`
- **After**: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`

The IntelliJ entry overrides paint per-element (self-contained); all others
inherit from this wrapper. `FALLBACK_SVG` is stroke-only so it too inherits.

## Consumers (unchanged call shape)

| Consumer | Call | Change |
|----------|------|--------|
| Settings picker | `ICON_IDS`, `iconSvg(id)`, `iconLabel(id)` | none (picker auto-reflects new `ICON_IDS`) |
| Row launchers (`table.ts` `.menu`) | `iconSvg(action.iconId)` | none (data behind ids changed) |
| Row delete (`table.ts:228`) | now `iconSvg('trash')` | was `textContent = '×'` |
| Overlay controls (`settings.ts`, `cleanup.ts`) | now `iconSvg('x'|'trash'|'chevron-up'|'chevron-down'|'git-branch')` | was `textContent` glyphs |

No state transitions, no lifecycle, no validation rules beyond the invariants above.
