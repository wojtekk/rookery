# Phase 0 Research: Block UI During Long Operations

Regenerated for **Revision 2026-07-19e** (re-expanded lockout: block all
repository operations, cursor-only for controls that must not dim). Builds on
the already-implemented 2026-07-19b/d design (T001–T008: toolbar mutual
exclusion across the three buttons, `.list.busy` row dim, table-scoped loader);
this phase resolves how to *extend* that foundation rather than replace it.

## R1 — Extending the busy gate to Settings and the Worktrees toggle

**Decision**: Compute `const busy = state.refreshing || state.updating ||
state.cleaning;` once inside `renderToolbar`, and gate Settings' and the
Worktrees toggle's `wireActivate` calls on `!busy`, exactly like the three
action buttons already do. Add `.disabled`/`aria-disabled` to both when busy.

**Rationale**: `renderToolbar` already re-derives interactivity from scratch on
every call (`container.innerHTML = ''` then rebuild); reusing the existing
conditional-wiring pattern is the smallest diff and keeps every toolbar control
governed by one function, one gate.

**Alternatives considered**: A separate `ToolbarState.locked` field computed in
`renderer.ts` and passed in — rejected as redundant; `renderToolbar` already
receives `refreshing`/`updating`/`cleaning` and can derive `busy` itself.

## R2 — Cursor-only, no-dim blocked state for Settings/toggle/filters/row actions

**Decision**: Restyle `.ctrl.disabled` to drop `opacity: 0.45` in favour of
`cursor: not-allowed`, with a `.ctrl.disabled:hover` override resetting to the
non-hover `.ctrl` colours (`.ctrl` elements are plain `<div role="button">` and
always match `:hover` regardless of any disabled semantics — there is no native
disabled state for a `div`). For filter chips and row-action/delete buttons —
real `<button>` elements — set the native `disabled` property when locked:
native `disabled` already removes click/keyboard activation, removes the
element from the tab order, and (in Chromium/Firefox) suppresses `:hover`
entirely, so no colour ever changes; only an explicit `cursor: not-allowed`
needs adding since the browser default cursor for disabled buttons isn't
guaranteed to be `not-allowed`.

**Rationale**: Ladder rung 4 (native platform feature) — `<button disabled>` is
the correct built-in mechanism for "non-interactive, no visual change" on real
buttons; `.ctrl` isn't a native button, so it needs the existing
conditional-wiring + CSS-override approach instead. Two element types, two
matching mechanisms — not one hack forced onto both.

**Alternatives considered**: `pointer-events: none` everywhere — rejected,
because an element excluded from hit-testing shows no custom cursor at all (the
browser paints whatever's beneath it), which would defeat the explicit
"cursor changes to inactive" requirement.

## R3 — Row-level actions keep their existing "no remote configured" disablement separate

**Decision**: `.row-action-ico.disabled` (opacity 0.35, permanent — "no remote
configured") is untouched. The new, temporary long-op lock sets `btn.disabled =
true` *without* adding the `.disabled` class; a plain `:disabled` cursor rule
(`.row-action-ico:disabled { cursor: not-allowed }`, and the equivalent for
`.row-delete-ico`) covers both cases identically — a not-allowed cursor is
correct either way — without touching the opacity rule, which stays gated on
the `.disabled` class alone.

**Rationale**: Reusing `.disabled` would conflate two different meanings ("this
action will never work here" vs. "wait for the current operation") under one
dimmed visual treatment; the spec explicitly requires the temporary case to not
dim (FR-016).

## R4 — Sort-header dim + lock (carried from 2026-07-19d)

**Decision**: Toggle `.thead.busy` in `beginBusyLock`/`endBusyLock` alongside
`.list.busy`; style it with the same barely-visible opacity as row dim, plus
`cursor: not-allowed` (headers are plain `div`s, so cursor needs an explicit
rule, unlike native buttons). Guard the `onSort` callback passed to
`wireSortHeaders` with the same `refreshing || updating || cleaning` check used
for `doRefresh`'s re-entry guard — `wireSortHeaders` wires its listeners once
at startup (unlike the toolbar, which rewires every render), so gating inside
the callback is simpler than restructuring it to rewire conditionally.

## R5 — Row directory-path tooltip suppression

**Decision**: CSS-only — `.list.busy .name[data-tip]:hover::after { display:
none; }`. The tooltip mechanism (`[data-tip]:hover::after`, `styles.css`) is
shared by several row elements (action buttons, delete, the failed-pull glyph,
the directory name); scoping the suppression to `.name[data-tip]` specifically
leaves every other row tooltip untouched, matching FR-017's narrow scope.

**Alternatives considered**: Removing the `data-tip` attribute from the DOM
while locked — rejected as unnecessary DOM churn for a problem CSS already
solves (ladder rung 4).

## R6 — Row inertness beyond the existing dim

**Decision**: Set each row's `tabIndex` to `-1` while locked (was `0`), in
addition to the existing FR-004 dim. Combined with R3 (row-action/delete
buttons disabled), nothing inside a row is focusable or actionable while
locked, without needing `pointer-events: none` on the row itself — which would
also suppress the row-action buttons' own `cursor: not-allowed` feedback, per
R2's reasoning.

**Alternatives considered**: `pointer-events: none` on `.row` — rejected for
the same reason as R2's rejected alternative: it would make the individually
`disabled` buttons inside the row lose their own hover-cursor feedback too.

## R7 — Release timing unchanged

**Decision**: No change to `LOADER_SHOW_DELAY_MS`/`LOADER_MIN_VISIBLE_MS`/
`remainingMinVisibleMs` (`loadstate.ts`, reused as-is). Every newly-blocked
control (Settings, Worktrees toggle, filter chips, row actions, sort header)
locks **immediately** at operation start (synchronous re-render), exactly like
the three action buttons already do — only the *dim + loader* are deferred by
the show-delay, per the existing FR-005 contract. One timing model for the
whole feature, not a second one for the newly-locked controls.

**Rationale**: The timing helper is pure and already unit-tested; introducing
a second delay for "when do these new controls lock" would create two classes
of blocked control with different latency characteristics for no benefit — the
spec doesn't distinguish them by timing, only by whether they dim.

## Summary of decisions

| # | Decision | Requirements served | Net effect on existing code |
|---|----------|---------------------|-----------------------------|
| R1 | Extend the busy gate to Settings + Worktrees toggle | FR-001, FR-011, FR-012 | small edit to `toolbar.ts` |
| R2 | `.ctrl.disabled` drops opacity → cursor-only; native `disabled` for real buttons | FR-003, FR-015, FR-016 | CSS restyle; native `disabled` in `summary.ts`/`table.ts` |
| R3 | Keep `.disabled` (dimmed, permanent) separate from the temporary lock | FR-016 | one new `:disabled` cursor rule per button type |
| R4 | `.thead.busy` dim + guarded sort callback | FR-014 | CSS + `renderer.ts` |
| R5 | CSS-only tooltip suppression scoped to `.name[data-tip]` | FR-017 | one new CSS rule |
| R6 | Row `tabIndex = -1` while locked | FR-004 (inertness) | one line in `table.ts` |
| R7 | Reuse existing show-delay/min-visible timing for everything | FR-005, SC-002 | `loadstate.ts` unchanged |

No new dependency, no new IPC method, no new persisted setting. This revision
extends the T001–T008 foundation (toolbar mutual exclusion, row dim, table
loader) rather than reverting it.
