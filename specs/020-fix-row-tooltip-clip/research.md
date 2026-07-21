# Phase 0 Research: Fix Row Directory Tooltip Clipping

No `NEEDS CLARIFICATION` markers remained in the Technical Context — this is
a small, precedent-based fix in a codebase whose relevant mechanism already
exists and was already researched under feature 012. This document records
the one real decision (how to extend that mechanism) and the root-cause
trace that led to it.

## Root cause

`table.ts`'s `buildRow` sets the directory-path tooltip via
`name.setAttribute('data-tip', entry.fullPath)` on the row's `.name`
element (line 311). The generic tooltip CSS
(`styles.css:842-856`, `[data-tip]:hover::after`) renders it downward
(`top: calc(100% + 8px)`) with no flip logic of its own.

Feature 012 already solved "tooltip clipped because the row is last
**visible**, not necessarily last in the DOM" for four other row elements
(`.row-delete-ico`, `.row-action-ico`, `.row-warn-ico`, `.row-dup-ico`): a
`mouseover`-delegated `positionRowIconTooltip()` in `renderer.ts` measures
`els.list.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom`
and toggles a `.tip-up` class when the remaining space is below
`TOOLTIP_MIN_SPACE_PX` (40px). A matching CSS rule,
`.tip-up[data-tip]:hover::after { top: auto; bottom: calc(100% + 8px); }`
(`styles.css:869-873`), is element-agnostic — it already flips *any* element
carrying both `[data-tip]` and `.tip-up`.

The only reason `.name` doesn't already benefit is that the delegated
listener's selector (`renderer.ts:441`,
`'.row-delete-ico, .row-action-ico, .row-warn-ico, .row-dup-ico'`) doesn't
list `.name`, so `.name` never receives the `.tip-up` toggle. This is a
coverage gap in the listener, not a missing mechanism — confirming the
user's own diagnosis ("calculate position in similar way to duplication
tooltip - it works well").

## Decision 1: How to make `.name`'s tooltip flip upward

**Decision**: Add `.name` to `positionRowIconTooltip`'s delegated
`mouseover` selector in `renderer.ts` (`target.closest(...)`). No CSS
change, no new function, no new state.

**Rationale**:
- The flip CSS rule is already generic and requires no per-element styling.
- The measurement function is already generic (`getBoundingClientRect()`
  math has no icon-specific assumptions).
- `.name` already carries `[data-tip]` and is a direct child of each row
  (`.row .name-cell .name`), so `.closest('.name')` from any hover target
  inside it (including the nested `.row-dup-ico` button and `.frag` span)
  resolves correctly — `Element.closest()` returns the nearest match
  starting from the hovered element itself, so hovering the nested
  `.row-dup-ico` still matches `.row-dup-ico` first (it's closer than the
  ancestor `.name`), leaving that icon's own independent `.tip-up` toggle
  unaffected.
- This one-line change automatically satisfies FR-004 (worktree rows too):
  `.wt .name` is the identical `.name` class, just under a `.wt`-flagged
  row; the selector doesn't need to special-case it.
- It automatically satisfies FR-005 (fresh evaluation per hover): the
  existing listener already re-measures on every `mouseover`, since rows
  are recreated on every render (per the listener's own comment).

**Alternatives considered**:
- *A `:last-child` CSS-only selector* — rejected. Feature 012's own research
  already proved this wrong for row tooltips: the last row **visible** in a
  scrolled or short window isn't necessarily the last row in the DOM, so a
  static selector can't express it (`research.md`/`plan.md` of 012).
- *A separate, `.name`-specific measurement function* — rejected as
  needless duplication (YAGNI): the existing function is already generic
  over any `[data-tip]` element; a second copy would just be the same
  logic under a different name.
- *Widening `.tip-up` to apply automatically to all `[data-tip]` elements
  via a MutationObserver or similar always-on mechanism* — rejected as
  over-engineering for a hover-triggered, single-element-at-a-time
  interaction; the existing `mouseover`-delegated approach is already the
  established, lightweight pattern for this exact problem across four
  other elements.

## Decision 2: Interaction with existing `.name`-scoped suppression rules

**Decision**: No change needed to either existing suppression rule.

**Rationale**: `styles.css` has two rules that hide `.name`'s tooltip
entirely under specific conditions:
- `.list.busy .name[data-tip]:hover::after { display: none; }` (long-
  operation lockout, Principle IV)
- `.name:has(.row-dup-ico:hover)::after { display: none; }` (suppress the
  path tooltip when the nested duplicate icon itself is hovered, feature
  017)

Both use `display: none`, which fully suppresses the tooltip regardless of
whether `.tip-up` is also present — `.tip-up` only changes `top`/`bottom`
positioning on the `::after` pseudo-element that would otherwise render.
Adding the `.tip-up` toggle to `.name` doesn't interact with either rule.

**Alternatives considered**: None needed — verified by reading the CSS
cascade rather than guessing, since a wrong assumption here would risk
silently breaking the busy-lockout suppression (a constitution-mandated
behavior, Principle IV).
