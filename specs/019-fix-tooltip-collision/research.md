# Phase 0 Research: Fix Duplicate-Indicator Tooltip Collision

## 1. Why the two tooltips render at once

**Finding**: `buildRow` (`src/renderer/view/table.ts:311`) sets
`.name`'s own `data-tip` to the row's full path. When the row is a detected
duplicate, `buildDuplicateIcon` (`table.ts:244-262`) builds a
`<button class="row-dup-ico">` with its own `data-tip` (the "also cloned
elsewhere" notice), and `buildRow` appends it as a **child of `.name`**
(`table.ts:320`), not a sibling in `.name-cell`.

The app's one tooltip mechanism (`styles.css:836-854`,
`[data-tip]:hover::after`) has no built-in scoping to "the most specific
hovered element" — CSS's native `:hover` pseudo-class matches an element
whenever the pointer is over it **or any of its descendants**. So hovering
`.row-dup-ico` simultaneously satisfies `.name[data-tip]:hover` (the pointer
is "over" `.name` because it's over `.name`'s child) and
`.row-dup-ico[data-tip]:hover`. Each generates its own `::after` box, and
both render, stacked, because nothing suppresses either one.

No native `title` attribute is involved (confirmed by the project's own
comment at `table.ts:219-220` explaining `data-tip` was chosen specifically
to avoid Electron's native tooltip timing) — both boxes are the same custom
CSS mechanism, which is what makes a pure-CSS fix possible.

## 2. Fix mechanism

**Decision**: Add one rule using `:has()` so `.name` can react to its own
descendant's hover state:

```css
.name:has(.row-dup-ico:hover)::after {
  display: none;
}
```

Placed immediately after the existing `.list.busy .name[data-tip]:hover::after
{ display: none; }` rule (`styles.css:868-872`), which already establishes
the identical technique — suppress `.name`'s tooltip via `display: none` on
its own `::after` — for a different trigger (the long-operation lockout).
This fix is the same pattern for a second, independent trigger.

**Rationale**: `:has()` is the only mechanism that lets a *parent's* CSS
depend on a *descendant's* live state without JavaScript. Electron 40 (this
project's pinned version, confirmed via `package.json`) bundles a Chromium
release well past 132 — `:has()` shipped in Chromium 105 — so support is not
a concern; no feature-detection or fallback is needed. Because `.row-dup-ico`
is disabled (`btn.disabled = locked`, `table.ts:257`) while a long operation
runs, and disabled elements do not match `:hover`, this new rule and the
existing lockout-suppression rule never compete for the same hover — they
address two disjoint situations on the same element.

**Alternatives considered**:
- *Restructure the DOM — move `.row-dup-ico` out of `.name` into a sibling
  position in `.name-cell`*: would also fix the collision (a sibling's hover
  doesn't propagate to `.name`), and arguably matches how `.row-delete-ico`
  already lives in its own cell rather than nested inside another
  tooltip-bearing element. Rejected as the larger diff: it requires
  `table.ts` and layout CSS changes (the icon currently sits inline
  immediately after `.frag`'s text) to preserve today's visual position,
  where the `:has()` rule is a single line with zero layout risk. Noted here
  in case a future refactor of the name cell makes the structural fix free.
- *Merge both messages into one combined tooltip on the icon, dropping
  `.name`'s own tooltip for duplicate rows*: rejected per the user's explicit
  choice during design discussion — the path and the duplicate notice serve
  different purposes and should stay two distinct, purpose-built tooltips;
  only their simultaneous visibility was the bug.
- *A `mouseover`/`mouseout` JS listener toggling a suppression class (the
  same delegated-event shape as feature 012's `positionRowIconTooltip`)*:
  rejected — `:has()` achieves the identical outcome declaratively, with no
  event listener, no measurement, and no state to keep in sync; JS is
  reserved in this codebase (feature 012) for problems `:has()`/plain CSS
  genuinely cannot express, like a runtime viewport-space measurement. This
  problem has no such requirement.

## 3. Verification approach

**Decision**: Manual verification via `quickstart.md`, no new automated test.

**Rationale**: This is a single declarative CSS selector with no branching
logic, computed value, or state — nothing for `node --test` (the project's
only harness, pure-logic parsing/filtering/sorting) to exercise. Prior
CSS-only fixes in this project (011, 012, 015) were verified the same way.
