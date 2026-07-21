# Contract: Duplicate-Clone Indicator

This feature is renderer-internal (no IPC, no external API). The stable contracts are the extended `RowActionHandlers` interface and the new icon's render/behavior rules.

## 1. `RowActionHandlers` (extended interface) — `src/renderer/view/table.ts`

```ts
export interface RowActionHandlers {
  onRun: (actionId: string, target: { path: string; remoteUrl: string | null }) => void;
  onDelete: (target: { path: string; isWorktree: boolean; familyPath?: string }) => void;
  onFindDuplicate: (key: string) => void; // NEW
}
```

**Contract**:
- `onFindDuplicate` is called with exactly one string: `remote?.slug ?? entry.directoryName` for the clicked row.
- It is only ever invoked when `entry.collisionFragment !== null` and the row is not `locked` (the button is `disabled` otherwise, so no click reaches the handler — see §2).

## 2. Duplicate icon rendering — `buildRow` in `src/renderer/view/table.ts`

**Contract** (extends the existing `if (entry.collisionFragment)` block at `table.ts:290-295`):
- When `entry.collisionFragment` is non-null, render a `<button class="row-dup-ico">` alongside the existing `.frag` text node (both continue to co-exist; neither replaces the other).
- The button:
  - Uses the new catalog icon (`iconSvg('<new-id>')`, bundled static SVG — safe, no user input).
  - Sets `aria-label` and `data-tip` to an explanatory sentence that includes `entry.collisionFragment` (research.md R4) — no sibling-location lookup.
  - Sets `disabled = locked`, identical to `.row-delete-ico` (`table.ts:253`) — satisfies Principle IV's "no colour/opacity change while blocked, `not-allowed` cursor only" via the native disabled state.
  - On click, calls `handlers.onFindDuplicate(remote?.slug ?? entry.directoryName)`.
- Tooltip positioning reuses the existing `.tip-up`/`positionRowIconTooltip` mechanism (012/013) — no new tooltip-flip logic.
- **Backward compatibility (invariant)**: when `entry.collisionFragment` is `null`, output is byte-for-byte identical to today — no new element is added to rows without a detected duplicate.

## 3. Renderer wiring — `src/renderer/renderer.ts`

```ts
onFindDuplicate: (key: string): void => {
  searchExpanded = true;
  searchQuery = key;
  render();
},
```

**Contract**:
- Mirrors the existing × clear button's debounce-bypass shape: the module-level `searchQuery` is set directly and `render()` is called synchronously — no `setTimeout` scheduling.
- `searchExpanded` is forced `true` so a collapsed search box becomes visible with the new query already filled in (consistent with 016's `SearchState.expanded`).
- No other renderer state (filters, sort, worktree toggle) is touched — search continues to AND-compose with them exactly as 016 already specifies (spec.md Edge Cases).
