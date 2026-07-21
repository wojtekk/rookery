# Research: Duplicate-Clone Indicator

No open `NEEDS CLARIFICATION` items remained after `/speckit-clarify`. Research below records the design decisions that ground the plan in the existing codebase.

## R1 — Where the indicator is drawn (reuse the existing `collisionFragment` gate)

- **Decision**: Render the new icon in `buildRow` (`view/table.ts:290-295`) inside the existing `if (entry.collisionFragment)` block, alongside the current `.frag` text node — not replacing it.
- **Rationale**: `entry.collisionFragment` (`shared/types.ts:20`, computed by `assignCollisionFragments` in `scan.ts:126-150`) is already the exact, unit-of-truth signal for "this row collides with another." Reusing its gate means zero detection-logic change (FR-003) and the icon/text simply co-render whenever a collision exists today.
- **Alternatives considered**: A new field computed alongside `collisionFragment` — rejected as pure duplication; the existing boolean-ish presence of `collisionFragment` is sufficient to gate visibility.

## R2 — What the click searches for (reuse 016's search, no new filter)

- **Decision**: On click, call a new `RowActionHandlers.onFindDuplicate(key: string)` where `key = remote?.slug ?? entry.directoryName` (computed at the same call site in `buildRow` where `remote` is already in scope, `table.ts:298-299` shows the identical fallback pattern already used for the `.slug` cell). `renderer.ts` implements it as: `searchExpanded = true; searchQuery = key; render();`.
- **Rationale**: `filterRows` (`view/filter.ts`, 016) already matches a query against `remote.slug`, `directoryName`, `remote.rawUrl`, and branch as a case-insensitive substring — searching by slug (or directory name, when no remote is known) is guaranteed to surface every row sharing that slug/name, not just the pair that triggered the original collision detection. This is a free bonus: it can surface a same-remote clone under a *different* directory name too, even though detection itself still requires matching directory names (per FR-003's unchanged-detection constraint) — the search step is a separate, more permissive lookup, not a change to detection.
- **Alternatives considered**: Introducing a dedicated `onFindDuplicate` IPC/query mechanism — rejected; the existing renderer-only search state is already exactly this "narrow the table to matching rows" primitive (Principle V, avoid new mechanism when one exists).

## R3 — Bypassing the debounce (reuse the × clear button's pattern)

- **Decision**: The click sets `searchQuery` directly and calls `render()` synchronously, the same way `search.ts`'s `clear()` helper bypasses the 150 ms debounce today (`view/search.ts:68-72`, `renderer.ts` clear-path).
- **Rationale**: FR-004 requires the search to apply "immediately... without waiting for the normal typing debounce" — the debounce exists to coalesce keystrokes, which doesn't apply to a single discrete click. Reusing the existing bypass path (rather than adding a second debounce-skip mechanism) keeps the renderer's search-state handling to one settled pattern.

## R4 — Tooltip content (clarified 2026-07-21: cheap option)

- **Decision**: The new icon's tooltip text states the fact ("This repository is also cloned in another location") plus the row's own `collisionFragment` value — the exact same string already shown in the adjacent `.frag` text — rather than looking up or displaying the sibling row's actual path. Concrete safe phrasing: **"This repository is also cloned elsewhere (this copy is under …/{fragment})"**. Because `collisionFragment` is *this* row's own parent folder, the sentence MUST attribute it to "this copy", never phrase it as "cloned under …/{fragment}" (which would misread the row's own path as the sibling's location — the A1 finding).
- **Rationale**: Per the `/speckit-clarify` decision, no sibling-location data is threaded between rows; the tooltip's only job is to explain what the existing (confusing) fragment text means, not to add new information. This keeps `scan.ts`'s `assignCollisionFragments` completely untouched — it already computes exactly the string this tooltip needs.
- **Alternatives considered**: Passing each duplicate group's full list of sibling paths through `Row`/`WorkingTreeEntry` so the tooltip could name exactly where the other copy lives — rejected per clarification (adds cross-row data plumbing for a "nice to have" the click-to-search flow already satisfies by letting the user see the sibling row directly).

## R5 — Icon element type & lockout behavior (reuse `.row-delete-ico`'s recipe exactly)

- **Decision**: The new icon is a `<button class="row-dup-ico">` (not a bare `<span>` like the non-interactive `.row-warn-ico`), with `btn.disabled = locked` and `data-tip` for the tooltip — the identical shape as `buildDeleteCell` (`table.ts:243-256`).
- **Rationale**: This is a clickable row action, so it needs the delete icon's interactive pattern (native `disabled`, which already satisfies Principle IV's "no colour/opacity change, only `not-allowed` cursor" requirement for a disabled `<button>`), not the purely-informational warn icon's `<span>` pattern. No `stopPropagation` is needed: rows in this table have no competing click handler of their own (confirmed — `row` only sets `tabIndex`, no click listener), so today's delete/menu icons don't need it either and neither does this one.
- **Alternatives considered**: Making the whole `.frag` text clickable instead of adding a new element — rejected during brainstorming (Approach A) as insufficiently discoverable; a dedicated icon was the chosen approach.

## R6 — New icon glyph (extend the existing catalog, no new dependency)

- **Decision**: Add one new entry to `view/icons/catalog.ts` (a "copy/duplicate" glyph) following the exact recipe every existing entry uses — Tabler-outline style, `fill="none" stroke="currentColor" stroke-width="2"` inherited from `iconSvg()`'s wrapper (feature 015). The precise path data is an implementation-time detail (copied from the Tabler MIT icon set, like every other glyph in this catalog), not a plan-level decision.
- **Rationale**: Principle V — reuse the existing icon system and its established MIT-licensed source rather than inventing a new asset pipeline or dependency. The catalog already has a documented, repeatable pattern (`id`, `label`, `svg`) that every prior icon feature (011, 012, 013, 015, 016) has extended the same way.
- **Alternatives considered**: Reusing an existing icon id (e.g. `folder`) — rejected: none of the current 11 glyphs read as "duplicate/copy," and reusing an unrelated glyph would undercut the entire point of this feature (an unambiguous visual signal).
