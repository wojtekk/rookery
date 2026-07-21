# Contract: Header/Fleet-Head Layout Relocation

This is a UI-application, not a library/API — the "contract" here is the DOM/CSS shape the renderer must produce, since that's the interface between `index.html`+`styles.css` (structure) and `renderer.ts`+`view/*.ts` (behavior).

## Before

```html
<header class="bar">
  <div class="mark">…</div>
  <div class="bar-spacer"></div>
  <div id="search"></div>          <!-- 016: renderSearch mounts here -->
  <div id="toolbar"></div>
</header>

<section class="fleet">
  <div class="fleet-head">
    <span class="fleet-title" id="fleetTitle">Fleet</span>   <!-- summary.ts writes "Fleet — N repositories" -->
    <div class="counts" id="filters"></div>                   <!-- summary.ts: state-filter chips -->
  </div>
  <div class="sumbar" id="sumbar"></div>
</section>
```

## After

```html
<header class="bar">
  <div class="mark">…</div>
  <div class="bar-spacer"></div>
  <div id="toolbar"></div>          <!-- #search removed; spacer absorbs the freed width -->
</header>

<section class="fleet">
  <div class="fleet-head">
    <div id="search"></div>                                   <!-- moved here: leftmost -->
    <div class="counts" id="filters"></div>                   <!-- unchanged, now wraps below #search if needed -->
  </div>
  <div class="sumbar" id="sumbar"></div>
</section>
```

## Behavioral guarantees (unchanged, verified by inspection — not new code)

- `renderSearch(container, state, handlers)` (`view/search.ts`) is invoked with the same `container` element reference (`document.getElementById('search')`) — only that element's position in the document changes, not its identity, contents, or event wiring.
- `state.busy` (long-operation lockout), the 150ms debounce, the × clear button, and Esc-to-clear/collapse are all owned by `renderer.ts`/`search.ts` and are not touched by this feature.
- `renderSummary(els, ...)` (`view/summary.ts`) keeps its `filters`/`sumbar` behavior identical; only the `title` field is removed from its input contract (`SummaryElements`) since there is no longer an element to write into.

## New layout rule (from `/speckit-clarify`, 2026-07-21)

- `.fleet-head` MUST allow its two children (`#search`, `#filters`) to wrap onto separate lines when both cannot fit on one row at the current width — the search control never shrinks or clips, and filter chips never clip; they wrap to a second line instead (spec FR-007).
