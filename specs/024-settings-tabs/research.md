# Phase 0 Research: Tabbed Settings Window

No `NEEDS CLARIFICATION` markers remained in the Technical Context — both
open questions from `/speckit-clarify` (tab-strip placement, in-progress
form preservation) are already resolved in `spec.md`'s Clarifications
section. This document records the three real implementation decisions made
while designing the change.

## Decision 1: How the two panels are hidden/shown

**Decision**: Both panels (`Directories`, `Actions`) stay in the DOM at all
times; a tab click toggles the native boolean `hidden` attribute on the
inactive panel and `aria-selected` on the two tab buttons. No conditional
`appendChild`/`remove`, no re-render.

**Rationale**:
- `settings.ts`'s existing pattern already keeps DOM-only, non-persisted UI
  state (`editingId`, `formIcon`) alive across calls without a full
  re-render for local interactions like icon selection (`selectIcon`) — a
  tab switch is the same kind of local, non-mutating interaction.
- FR-012 requires the Actions add/edit form's typed input to survive a
  round-trip through the Directories tab. Because `<input>` values live in
  the DOM node itself, never destroying the Actions panel's DOM on tab
  switch makes preservation free — there is nothing to save/restore.
- `.settings-section` sets no `display` property, so the UA default
  `[hidden] { display: none }` applies with no CSS override needed.

**Alternatives considered**:
- *Re-render only the active panel's content, discard the other* — rejected:
  reintroduces exactly the state-loss FR-012 forbids, and would need a
  parallel save/restore mechanism for the Actions form that the DOM already
  provides for free.
- *CSS `display` swap driven by a data attribute on `.modal-body`* —
  functionally identical to the native `hidden` attribute but adds a
  selector pair (`.modal-body[data-tab="actions"] #tab-directories`, etc.)
  for no benefit over toggling `hidden` directly on each panel.

## Decision 2: Where `activeTab` state lives and when it resets

**Decision**: A module-level `activeTab: 'directories' | 'actions'` variable
in `settings.ts`, reset to `'directories'` inside `openSettingsModal()`
(called once per window open) and otherwise left untouched by
`renderSettingsModal` (so a full re-render triggered by adding a directory
or changing actions redraws on whichever tab the user was already viewing).

**Rationale**:
- Mirrors the existing `editingId`/`formIcon` module-variable pattern in the
  same file — no new state-management approach introduced.
- FR-004 and the "Tab state on reopen" edge case only require the
  *close→reopen* transition to land back on Directories; nothing in the spec
  requires resetting the tab on every in-session re-render, and doing so
  would be actively worse UX (e.g. adding a directory while on the Actions
  tab would otherwise silently kick the user back to Directories).

**Alternatives considered**:
- *Reset `activeTab` at the top of every `renderSettingsModal` call* —
  rejected: would snap the user back to Directories after any data-driven
  re-render (e.g. `onModified`/`onActionsChanged`), which is not requested
  and would feel broken.
- *Persist `activeTab` beyond the window's lifetime (e.g. in `config.ts`)* —
  rejected by the spec's own Assumptions ("last-viewed tab is not
  remembered across opens") and out of scope (FR-010 forbids new persisted
  settings).

## Decision 3: Keyboard/ARIA depth

**Decision**: Plain `<button role="tab">` elements in a `role="tablist"`
container, each `aria-controls`-linked to a `role="tabpanel"` section with
`aria-labelledby` pointing back. No roving-tabindex arrow-key navigation.

**Rationale**: FR-008 requires tabs to be "focusable and activatable" by
keyboard — native `<button>` already satisfies that via Tab+Enter/Space,
identical to every other button in this modal (`Edit`, `Remove`, icon
picker options). FR-009 requires AT to identify the tabs, the selected tab,
and each tab's content region — covered by `role`/`aria-selected`/
`aria-controls`/`aria-labelledby`. Full WAI-ARIA APG tablist behavior (left/
right arrow-key roving focus) is a UX enhancement neither FR asks for.

**Alternatives considered**:
- *Full roving-tabindex arrow-key tablist* — rejected as scope beyond both
  FRs (ponytail: two buttons don't need arrow-key roving; add if a future
  spec explicitly asks for full tablist keyboard parity).
