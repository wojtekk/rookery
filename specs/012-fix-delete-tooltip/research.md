# Phase 0 Research: Fix Delete Button Tooltip Clipping

## 1. Tooltip clipping fix

**Decision**: Extend the existing right-edge tooltip-alignment selector
(`src/renderer/styles.css:708-711`) to also cover `.row-delete-ico`:

```css
.menu [data-tip]:hover::after,
.row-delete-ico[data-tip]:hover::after {
  left: auto;
  right: 0;
}
```

**Rationale**: The base `[data-tip]:hover::after` rule
(`styles.css:691-706`) anchors tooltips with `left: 0`, growing rightward —
correct for most cells, but wrong for anything sitting at the row's right
edge. The codebase already solved this exact problem for `.menu`'s row-action
tooltips (`styles.css:707-711`) by flipping to `right: 0` for that column.
`.row-delete-ico` is deliberately its own fixed rightmost column, outside
`.menu` (`table.ts:184-185`, `styles.css:619-621`), so it never inherited that
fix. Reusing the identical rule (rather than duplicating a new one) is a
one-line selector-list addition and keeps both right-edge tooltips governed by
a single rule if the alignment value ever changes.

**Alternatives considered**:
- *Wrap the delete icon in `.menu`*: rejected — `table.ts:184-185` explains
  the delete icon is deliberately kept out of `.menu` so it doesn't disappear
  when a repository has zero configured actions; conflating the two would
  reintroduce that bug.
- *Add a brand-new, separate `.row-delete-ico[data-tip]:hover::after` rule*:
  functionally equivalent but duplicates the two-line rule body; the
  Development Workflow principle ("surgical changes... no unrequested
  refactors") favors reusing the existing selector rather than adding a
  near-duplicate block.
- *JS-computed positioning (e.g., measure viewport edge on hover)*: rejected —
  over-engineered for a tooltip whose overflow direction is static and known
  at author time; the codebase's existing pattern for this exact problem is
  already pure CSS.

## 1a. Vertical clipping on the last *visible* row (found during manual verification, revised)

**Decision**: A JS-measured flip, not a static CSS selector. On `mouseover`
of `.row-delete-ico` or `.row-action-ico` (delegated on `#list`, since rows
are re-created on every render), measure the space between the button's
bottom edge and `.list`'s visible bottom edge; if it's below a threshold,
toggle a `.tip-up` class that flips the tooltip to grow upward:

```css
.tip-up[data-tip]:hover::after {
  top: auto;
  bottom: calc(100% + 8px);
}
```

```ts
const TOOLTIP_MIN_SPACE_PX = 40; // tooltip box (~30px) + 8px gap, rounded up
function positionRowIconTooltip(btn: HTMLElement): void {
  const spaceBelow = els.list.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom;
  btn.classList.toggle('tip-up', spaceBelow < TOOLTIP_MIN_SPACE_PX);
}
```

Initially scoped to `.row-delete-ico` alone; per the second 2026-07-20
clarification, extended to also cover `.row-action-ico` (configurable per-row
launchers, feature 002) once it was clear they share the identical mechanism
and are equally affected. The CSS selector generalizes to any `.tip-up`
element (rather than enumerating both icon classes) since both need
byte-identical treatment; the JS selector list (`'.row-delete-ico,
.row-action-ico'`) is the only place both classes are named.

**Rationale (why the first attempt — `.row:last-child` — was wrong)**: An
initial attempt used a static `.row:last-child` selector, reasoning that
`.list`'s vertical clipping (`overflow-y: auto`, same mechanism as §1's
horizontal clipping) leaves no room below the *last row* for the tooltip's
default downward growth. Manual re-verification showed the bug persisting:
the row in question was the last **visible** row in a short window, not the
DOM's last child — more rows existed below it, reachable only by scrolling.
Whether a given row has enough room below it inside `.list`'s current
viewport is a runtime fact (window height, scroll position) that no static
CSS selector can express — `:last-child` answers "is anything after me in the
DOM," not "is there visible room below me right now." This requires an actual
geometry measurement, taken at hover time via `getBoundingClientRect()`.
Reproduced and confirmed in an isolated browser harness (real DOM structure
from `table.ts`/`styles.css`, 10 rows in a deliberately short `.list`): hovering
a mid-list row's delete icon, and separately a `.menu` action icon on the same
row, each with only ~7px of visible room below, did not flip under the old
rule, and does flip under the new one — both rendering fully within `.list`'s
bounds.

**Alternatives considered**:
- *`.row:last-child` (the original attempt)*: incorrect per above — doesn't
  account for scroll/viewport truncation.
- *Flip every row tooltip near the visible bottom edge, including the
  full-path name tooltip and the failed-pull glyph tooltip*: rejected — per
  the original 2026-07-20 clarification's "fix the specific trigger"
  precedent, scope is the delete icon and `.menu` action icons (the two icon
  types already sharing the right-edge horizontal fix); those other tooltips
  have not been reported as broken.
- *CSS Anchor Positioning (`position-try-fallbacks: flip-block`)*: the
  standards-native tool for exactly this problem, but was set aside as an
  unnecessary bet on a newer CSS feature when a few lines of JS — in the same
  shape as this file's existing `revealScrollbar`/`scheduleScrollbarHide`
  measurement-and-class-toggle pattern (`renderer.ts:98-110`) — solves it with
  less risk and no need to verify feature support in the pinned Electron/
  Chromium version.

## 2. Corner artifact (white box) handling

**Decision**: No dedicated `::-webkit-scrollbar-corner` styling is added.
Fixing item 1 removes the delete tooltip's rightward overflow, which is the
only known trigger for `.list` gaining a horizontal scrollbar (and thus an
unstyled corner square) during normal use.

**Rationale**: Per the 2026-07-20 clarification, the fix is scoped to the
specific overflow trigger, not general-purpose defensive styling for
currently-unobserved causes (YAGNI/surgical-change conventions). Root-cause
investigation found no `::-webkit-scrollbar-corner` rule anywhere in
`styles.css`, and traced the corner's new visibility to `border-radius: 14px`
having been removed from `.list` in the just-merged 011 scrollbar feature
(previously the radius visually clipped the same square). Since that removal
was intentional (011's spec: "drop the table's rounded corners... reads
better against the new thin scrollbar") and no other horizontal-overflow
source is known today, adding corner styling now would be speculative.

**Alternatives considered**:
- *Add `::-webkit-scrollbar-corner { background: var(--surface); }`
  defensively*: rejected per the clarification — would guard against a
  hypothetical future cause that doesn't currently exist, at the cost of an
  extra rule to maintain.
- *Re-add `border-radius` to `.list`*: rejected — reverses an intentional,
  already-shipped design decision from feature 011 for an unrelated bug.

## 3. Verification approach

**Decision**: Manual verification via `quickstart.md`, no new automated test.

**Rationale**: This is a static CSS selector change with no branching logic,
state, or computed values — nothing for `node --test` (the project's only
test harness, pure-logic parsing/filtering/sorting) to exercise. Prior
visual-only fixes in this project (e.g. spec 011) were verified the same way.
