# Phase 1 Data Model: Fix Delete Button Tooltip Clipping

This fix adds no persisted data, no IPC payload, and no new domain entity.
The right-edge tooltip alignment (research.md Decision 1) is static,
declarative CSS with no JS-owned state. The vertical flip (Decision 1a) does
add one piece of small, ephemeral, in-memory UI state — the same shape as
feature 011's `.scrolling` class toggle — recomputed on every hover, never
persisted or sent across the IPC boundary.

## Entities

None in the domain-model sense. The spec's "Key Entities" language was
removed from spec.md per the `/speckit-analyze` review — both items it named
are DOM elements styled by CSS, not data the application models or stores.

### TipUpState (derived, ephemeral)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `.tip-up` (CSS class on a `.row-delete-ico` or `.row-action-ico` button) | presence/absence | toggled by `positionRowIconTooltip()` in `renderer.ts` | Sole driver of the tooltip's vertical growth direction in CSS |
| `TOOLTIP_MIN_SPACE_PX` | `40` (constant) | `renderer.ts` | Threshold below which the tooltip flips upward (tooltip box height ~30px + 8px gap) |

**Trigger**: a `mouseover` event bubbling up to `#list`, delegated (not one
listener per row/icon) since rows are destroyed and recreated on every
`render()`. Matches on `.row-delete-ico` and every `.row-action-ico` (a row's
configurable launcher icons) alike, since both anchor their tooltip from an
icon at/near the row's right edge and are equally affected.

**Computation**: `spaceBelow = list.getBoundingClientRect().bottom -
button.getBoundingClientRect().bottom`; the class is set if `spaceBelow <
DELETE_TOOLTIP_MIN_SPACE_PX`, cleared otherwise — recomputed fresh on every
hover, so it always reflects the current scroll position and window size, not
a stale snapshot.

**Invariant**: this is a per-button, hover-time recomputation, not a
persistent flag — no row is ever "permanently" flipped; scrolling the same
row into a roomier position and re-hovering recomputes it correctly.

## State transitions

None beyond the single boolean above. Hover on/off itself is the browser's
native `:hover` state, already handled by the existing
`[data-tip]:hover::after` rule (`styles.css:691-706`); `.tip-up` only changes
which direction the resulting tooltip grows.
