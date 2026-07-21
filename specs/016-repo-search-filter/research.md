# Research: Debounced Repository Search Filter

No open `NEEDS CLARIFICATION` items remained after `/speckit-clarify`. Research below records the design decisions that ground the plan in the existing codebase.

## R1 — Debounce mechanism

- **Decision**: Native `setTimeout` / `clearTimeout` trailing debounce (150 ms) held in a module-level handle in `renderer.ts`. On each `input` event, clear the pending timer and schedule a new one that sets `searchQuery` and calls `render()`.
- **Rationale**: Principle V (no new dependency; a few lines of code beats a library). The renderer already uses timers for the scrollbar reveal and loader delay, so the pattern is established.
- **Alternatives considered**: `lodash.debounce` / rxjs — rejected (new runtime dependency for ~5 lines). `requestAnimationFrame` — wrong tool (frame cadence, not idle-delay).
- **Note**: The **× clear** button and Esc bypass the debounce (clear immediately) — instant feedback is expected when the user explicitly clears.

## R2 — Where matching lives (reuse `filterRows`)

- **Decision**: Extend the existing pure `filterRows(rows, stateFilter, showWorktrees, failedPaths)` in `src/renderer/view/filter.ts` with a trailing optional `searchQuery = ''` parameter. Add small pure helpers `searchMatchesRepo(entry, remote, q)` and `searchMatchesWorktree(entry, q)`.
- **Rationale**: `filterRows` is already the single, unit-tested choke point for row/worktree visibility, already called once in `render()` (renderer.ts:284), and its worktree handling (filter worktrees to matches, surface the family) is the exact shape the FR-008 clarification chose. An empty query reduces the new code to today's behavior, so the existing 13 filter tests act as a regression guard for free.
- **Alternatives considered**: A separate `searchRows()` pass composed after `filterRows` — rejected: two passes would each need their own worktree-surfacing logic and could disagree; one predicate keeps the AND-composition truthful and testable.

## R3 — Match semantics & field mapping

- **Decision**: Case-insensitive substring ("contains"), query trimmed of leading/trailing whitespace, whitespace-only ⇒ inactive (FR-006). Query treated as literal text (FR-004) — plain `String.prototype.includes` after `toLowerCase()`, no regex.
- **Field mapping** (from `shared/types.ts`):
  - **Repository/orphan row**: `remote.slug` (when `Remote` has a slug), `directoryName` (the "name"), `remote.rawUrl` (the "origin"), and `head.branch` (when not detached).
  - **Worktree entry**: `directoryName` and `head.branch` (its own). Slug/origin are inherited from the parent remote and are already covered by the parent's match (see R6), so they are not re-tested at worktree level.
- **Rationale**: Exactly the four spec fields (FR-003), mapped to the real types. `Remote` has three shapes (parsed slug, unparseable, none) — `slug` is only searched when present; `rawUrl` is searched whenever a remote exists; a `null` remote contributes no slug/origin text (still matchable by name/branch). A detached HEAD contributes no branch text.

## R4 — Empty-result state (FR-005, Principle IV honesty)

- **Decision**: Distinguish two empty states in `render()`:
  - `rows.length === 0` → existing "no repositories discovered" empty state (unchanged).
  - `rows.length > 0 && visible.length === 0` → a new **"No repositories match your search."** message shown in the list area (or a lightweight message row), only when a search/filter is actually narrowing.
- **Rationale**: A blank table under an active query reads as "broken." The current code only shows the empty state when `rows.length === 0`, so a new branch is required. Keeps state honest (Principle IV).
- **Alternatives considered**: Reusing `empty.ts`'s discovered-empty view — rejected: its copy ("add observed directories") is wrong and misleading for a no-match case.

## R5 — Long-operation lockout (FR-011, Principle IV)

- **Decision**: Thread the existing `busy` flag (`refreshing || updating || cleaning`, renderer.ts:244) into the search component. While busy: the expand icon is non-interactive and, if already expanded, the input is non-editable — both showing only a `not-allowed` cursor, with **no colour/opacity change** (matching the toolbar's `.ctrl.disabled` treatment and the constitution's split-visual rule).
- **Rationale**: Search reconfigures what is shown; constitution v4.0.0 Principle IV requires such controls to be blocked during long operations, and requires that non-row controls do not dim. Mirrors `renderToolbar`'s `wireActivate`-guarding + `disabled` class pattern.
- **Note**: A native `<input disabled>` greys out by default — the CSS must neutralize that (keep colour, set `cursor: not-allowed`, block pointer/typing) rather than relying on the `disabled` attribute's default styling. `readonly` + `aria-disabled` + a CSS `pointer-events`/cursor treatment is the likely approach; finalized during implementation.

## R6 — Worktree visibility truth (FR-008 + FR-010 AND-composition)

- **Decision**: For each repository family, compute `repoSearchHit = query empty || searchMatchesRepo(primary)`. Then:
  - **primary shown** iff `(ownState && repoSearchHit)` OR at least one worktree is shown.
  - **worktree shown** iff `showWorktrees && stateMatches(wt) && (repoSearchHit || searchMatchesWorktree(wt))`.
  - Orphan-worktree row shown iff `stateMatches(row) && (query empty || searchMatchesRepo(row))` (it carries its own remote).
- **Rationale**: Encodes the clarified rule exactly — a repo that matches the query surfaces all its (state-passing) worktrees; a repo matching only via a worktree branch surfaces just that worktree; AND-composition with the state filter is preserved because `stateMatches` still gates every worktree. Empty query ⇒ `repoSearchHit` always true ⇒ identical to current behavior. See data-model.md for the full truth table.

## R7 — UI placement & affordance (expandable icon + × clear)

- **Decision**: A new `#search` container in the header (`index.html`), rendered by `view/search.ts`. Collapsed = a `search` magnifier icon button; activating expands to a text input with a trailing **× clear** button (shown only when non-empty). Esc or × clears and (when empty) collapses.
- **Rationale**: Matches the clarified "expandable search icon" choice; keeps the resting header uncluttered. The icon catalog (feature 015) already has `x` for the clear button; a `search` magnifier glyph must be added to `catalog.ts` (Tabler set, `stroke:currentColor` wrapper).
- **Alternatives considered**: Always-visible input — rejected per clarification. Placing inside `renderToolbar` — rejected: keeps the search component independently testable and avoids reflowing the command-bar buttons.
