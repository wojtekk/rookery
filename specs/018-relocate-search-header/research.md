# Research: Relocate Search Icon Above the Table

No items in Technical Context were marked `NEEDS CLARIFICATION` — this is a small, self-contained relocation grounded directly in the existing renderer code. The decisions below record the concrete choices made while reading that code, so Phase 1 has a settled basis.

## R1: Where exactly does `#search` move to, and in what order?

**Decision**: Move the `<div id="search"></div>` node from `.bar` (top title bar) to the front of `.fleet-head`, immediately before the existing `#filters` counts container.

**Rationale**: `.fleet-head`'s current DOM order is `.fleet-title` (left) → `.counts` (right, via `justify-content: space-between`). The spec's User Story 1 requires the search icon be "the leftmost control in that row" (acceptance scenario 1). Putting `#search` exactly where `.fleet-title` sits today — first child — satisfies that without touching `.counts`'s position or the chips' own render logic (`summary.ts`) at all.

**Alternatives considered**: Appending `#search` after `.counts` (rightmost) — rejected, contradicts the spec's explicit "leftmost" requirement and the feature description's "top-left corner."

## R2: Does the top `.bar` need new CSS once `#search` is removed from it?

**Decision**: No. `.bar` is `display: flex` with a `.bar-spacer { flex: 1 }` between the logo/title block and `#search`/`#toolbar`. Removing `#search` just leaves the spacer immediately followed by `#toolbar`; the spacer still absorbs all free space and pushes `#toolbar` to the right edge exactly as before.

**Rationale**: Verified by reading `styles.css:59-96` — the flex-spacer pattern already handles a variable number of trailing children with no hardcoded widths or gaps that would leave a hole. This satisfies FR-006 ("reflow cleanly... no leftover empty gap") with a zero-line CSS diff.

**Alternatives considered**: Adding an explicit `justify-content` override on `.bar` — rejected as unnecessary; the existing spacer already does the job (YAGNI).

## R3: Is removing `SummaryElements.title` safe?

**Decision**: Yes — drop the `title: HTMLElement` field from `SummaryElements` (`view/summary.ts`) and its single write site (`els.title.textContent = ...`), plus the `fleetTitle` lookup and the `title: els.fleetTitle` wiring in `renderer.ts`.

**Rationale**: Grep confirms exactly four references to `fleetTitle`/`SummaryElements.title`/`.fleet-title` in the whole codebase (the `index.html` element, its one CSS rule, its one `renderer.ts` lookup/wiring line, and its one `summary.ts` write) — no other file reads or depends on it. Deleting all four leaves no orphan.

**Alternatives considered**: Keeping the field but leaving it unwritten/blank — rejected; an unused interface field is exactly the kind of dead surface the project's "surgical changes, remove only orphans your changes created" convention calls out, and it's fully safe to delete outright here.

## R4: How does the clarified chip-wrap behavior get implemented?

**Decision**: `.fleet-head` gains `flex-wrap: wrap` (plus a small `row-gap` so a wrapped second line isn't flush against the first). `justify-content: space-between` is kept — with exactly two flex items, a wrapped single item on its own line renders at the line's start, so no extra alignment override is needed for the wrapped case.

**Rationale**: This is the standard, dependency-free CSS pattern for "let a fixed-priority element (search) keep its size and let a secondary group (filter chips) drop to a new line rather than clip" — directly matching the user's chosen option (chips wrap to a second line) from the `/speckit-clarify` session.

**Alternatives considered**: `overflow-x: auto` scroll strip for `.counts` — rejected by the clarification answer (chips wrap, not scroll). A fixed `max-width` clamp on the expanded search input — rejected; the clarification didn't ask the search control to shrink, only for the chips to accommodate it.
