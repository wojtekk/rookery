# Contract: Search Filter

This feature is renderer-internal (no IPC, no external API). The stable contracts are the extended pure filter function and the search UI component's interface.

## 1. `filterRows` (extended pure function) — `src/renderer/view/filter.ts`

```ts
export function filterRows(
  rows: Row[],
  stateFilter: StateFilter,
  showWorktrees: boolean,
  failedPaths?: Set<string>,   // existing, default new Set()
  searchQuery?: string,        // NEW, default '' (empty ⇒ identical to prior behavior)
): Row[]
```

**Contract**:
- `searchQuery` is normalized internally as `searchQuery.trim().toLowerCase()`; `''` or whitespace-only ⇒ search inactive.
- Matching is case-insensitive substring (`includes`), literal (no regex/wildcards).
- Field mapping and the combined state×search visibility rule are exactly as specified in `data-model.md`.
- **Backward compatibility (invariant)**: calling with `searchQuery` omitted or `''` MUST return the same result as before this feature — the existing `filter.test.ts` cases are the enforcing guard and MUST remain green unchanged.
- Pure: no DOM, no I/O, no mutation of inputs (returns new row objects with narrowed `worktrees`, as today).

### Helper predicates (pure, may be unexported or exported for testing)

```ts
function searchMatchesRepo(entry: WorkingTreeEntry, remote: Remote, q: string): boolean
function searchMatchesWorktree(entry: WorkingTreeEntry, q: string): boolean
```
- `q` is assumed already normalized (non-empty) by the caller.
- `searchMatchesRepo`: true if `q` ⊆ any of slug / directoryName / rawUrl / branch (each when present).
- `searchMatchesWorktree`: true if `q` ⊆ directoryName or own branch (when not detached).

## 2. Search component — `src/renderer/view/search.ts`

```ts
export interface SearchState {
  query: string;      // current raw value (to keep the input in sync across re-renders)
  expanded: boolean;  // whether the input is open vs. collapsed to the icon
  busy: boolean;      // long operation running ⇒ non-interactive (FR-011)
}

export interface SearchHandlers {
  onQueryChange: (raw: string) => void; // called on debounced input AND immediately on clear
  onToggleExpanded: (expanded: boolean) => void;
}

export function renderSearch(container: HTMLElement, state: SearchState, handlers: SearchHandlers): void;
```

**Contract**:
- Collapsed: renders a `search` (magnifier) icon button. Activating it (click / Enter / Space) calls `onToggleExpanded(true)` and focuses the input.
- Expanded: renders a text input reflecting `state.query`, plus a × clear button shown only when `query` is non-empty. Clicking × (or pressing Esc) clears to `''` immediately (bypassing debounce) via `onQueryChange('')`, and Esc when already empty collapses.
- **Debounce is the caller's responsibility** (renderer.ts owns the timer); the component reports raw input changes and the renderer debounces before committing to `searchQuery`. (Alternatively the component may debounce internally — either is acceptable as long as the 150 ms trailing behavior and immediate-clear hold.)
- While `state.busy`: the icon/input is non-interactive with a `not-allowed` cursor and **no colour/opacity change** (Principle IV). Handlers are not wired (mirrors `renderToolbar`).
- Accessibility: icon has an accessible label ("Search repositories"); input has a label; disabled state exposes `aria-disabled`.

## 3. Renderer wiring — `src/renderer/renderer.ts`

- Module-level `let searchQuery = ''` and a debounce timer handle.
- `render()` computes `visible = filterRows(sorted, stateFilter, settings.showWorktrees, failedPaths, searchQuery)` and renders the no-match message when `rows.length > 0 && visible.length === 0`.
- The footer count (`Showing X of Y`) already reflects `visible.length` and needs no special-casing.
