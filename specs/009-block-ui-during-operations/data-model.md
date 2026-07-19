# Phase 1 Data Model: Block UI During Long Operations

Regenerated for **Revision 2026-07-19e**. This feature adds no persisted data
and no IPC payloads. The "model" is the renderer's in-memory UI state and the
derived values that drive every lock/dim. All state is module-level in
`src/renderer/renderer.ts` unless noted.

## Entities

### BusyState (derived)

The single source of truth for "is a long operation running" and *which* one.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `refreshing` | `boolean` | existing module var | Refresh in flight |
| `updating` | `boolean` | existing module var | Pull all in flight |
| `cleaning` | `boolean` | existing module var | Cleanup in flight (spans the review overlay too) |
| `busy` (derived) | `boolean` | `refreshing \|\| updating \|\| cleaning` | Drives every lock and both dims (rows, sort header) |

**Invariant (FR-002 / SC-005)**: at most one of the three flags is true at a
time. Enforced by the existing re-entry guards plus toolbar mutual-exclusion
wiring (all three participate).

### LoaderTiming (reused as-is)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `LOADER_SHOW_DELAY_MS` | `150` | `loadstate.ts` (existing) | Delay before the dim+loader paint |
| `LOADER_MIN_VISIBLE_MS` | `400` | `loadstate.ts` (existing) | Minimum on-screen time once shown |
| `busyLoaderShownAt` | `number \| null` | existing module var | Timestamp the loader became visible; `null` = not shown |
| `busyShowTimer` | `timeout handle` | existing module var | Pending 150 ms show timer for the row/header dim + loader |

Only the *dim + loader* are deferred by this timer (R7). Every lock (button
block, Settings, Worktrees toggle, filter chips, sort activation, row
actions) applies **immediately** at `busy = true`, via the synchronous
`render()` call.

### DiscoveredRepositorySet vs VisibleRepositoryView (read-only here)

| Concept | Renderer value | Role |
|---------|----------------|------|
| Discovered repository set | `rows` (full array from `api.refresh()`) | **Authoritative** for the empty-list gate (FR-007/FR-010); independent of the long-op lock |
| Visible repository view | `visible` (`filterRows(sortRows(rows, …), …)`) | What is rendered; MUST NOT gate bulk actions |
| `hasRepos` (derived) | `rows.length > 0` | Toolbar input gating Pull all / Cleanup |

### ToolbarState (unchanged shape, wider effect)

`src/renderer/view/toolbar.ts` — `{ showWorktrees, refreshing, updating,
cleaning, hasRepos }`, unchanged. What changes is that `renderToolbar` now
derives `busy` internally and applies it to **two more controls** (Settings,
Worktrees toggle) that previously ignored it entirely.

| Field | Type | Effect after Revision 2026-07-19e |
|-------|------|----------------------------|
| `showWorktrees` | `boolean` | Worktrees toggle; now **blocked** while `busy` (was: never blocked) |
| `refreshing` | `boolean` | Refresh shows `.busy`; blocks every other control |
| `updating` | `boolean` | Pull all shows `.busy`; blocks every other control |
| `cleaning` | `boolean` | Cleanup shows `.busy`; blocks every other control |
| `hasRepos` | `boolean` | When `false` (and not `busy`), Pull all & Cleanup render `.disabled` and unwired; Refresh unaffected (FR-007/FR-008) |

### SummaryLock (new — `renderSummary`'s `locked` parameter)

| Field | Type | Source | Effect |
|-------|------|--------|--------|
| `locked` | `boolean` | `busy`, passed in from `render()` | Sets `button.disabled = locked` on every filter chip (`makeChip`); native `disabled` handles click/keyboard/tab-order/hover suppression |

### RowLock (new — `renderRows`'s `locked` parameter)

| Field | Type | Source | Effect |
|-------|------|--------|--------|
| `locked` | `boolean` | `busy`, passed in from `render()` | Each row's `tabIndex` becomes `-1` (was `0`); each row-action/delete `<button>` additionally gets `button.disabled = true` (on top of any pre-existing permanent "no remote" disablement, which is a separate, dimmed case — R3) |

## Control eligibility matrix

Rows = control; columns = state. "blocked, dimmed" = non-interactive AND
visually dimmed. "blocked, cursor-only" = non-interactive, no colour change,
`cursor: not-allowed`. "enabled" = interactive, normal appearance.

| Control | Idle, has repos | Idle, empty set | Long op running |
|---------|-----------------|-----------------|-----------------|
| Refresh | enabled | enabled (FR-008) | busy if it's the runner, else **blocked, cursor-only** |
| Pull all | enabled | **blocked, cursor-only** (FR-007) | busy if it's the runner, else **blocked, cursor-only** |
| Cleanup | enabled | **blocked, cursor-only** (FR-007) | busy if it's the runner, else **blocked, cursor-only** |
| Settings | enabled | enabled | **blocked, cursor-only** (FR-011) |
| Worktrees toggle | enabled | enabled | **blocked, cursor-only** (FR-012) |
| Filter chips | enabled | enabled | **blocked, cursor-only** (FR-015) |
| Sort headers | enabled | enabled | **blocked, dimmed** (FR-014) |
| Row-level actions (delete, launch) | enabled | n/a (no rows) | **blocked, cursor-only** (FR-016) |
| Table rows (surface) | enabled, normal | n/a | **dimmed**, removed from tab order (FR-004) |
| Row directory-path tooltip | shows on hover | n/a | **suppressed** (FR-017) |

The rightmost column is the crux of Revision 2026-07-19e: everything is
blocked while a long op runs, but only two rows in this table ("Table rows"
and "Sort headers") actually change appearance.

## Visual state

| Element | Idle | Long op, < 150 ms | Long op, ≥ 150 ms |
|---------|------|-------------------|-------------------|
| Running button | normal | `.busy` (immediate) | `.busy` |
| Other two buttons, Settings, Worktrees toggle | normal / empty-gated | `.disabled`, cursor `not-allowed`, no colour change (immediate) | same |
| Filter chips | normal | native `disabled`, cursor `not-allowed`, no colour change (immediate) | same |
| Row-level action/delete buttons | normal (or permanently `.disabled` if no remote) | native `disabled`, cursor `not-allowed`, no colour change (immediate) | same |
| `#list.busy` (row dim + inertness) | off | off | **on** — rows barely visible, `tabIndex=-1` |
| `.thead.busy` (sort-header dim + lock) | off | off (guard already blocks activation) | **on** — barely visible; guard has blocked activation since t=0 |
| `#tableLoader` dots | hidden | hidden | **visible** ≥ 400 ms once shown |
| Row directory-path tooltip | shows on hover | suppressed (immediate, via `.list.busy` ancestor selector) | suppressed |

Non-dimming locks (buttons, Settings, toggle, filter chips, row actions) and
the sort-header's *functional* lock all apply at **t=0** (synchronous
`render()`); only the two *dims* (`#list.busy`, `.thead.busy`) and the loader
are deferred to the 150 ms timer, consistent with FR-005's existing timing
contract. On settlement (any outcome — FR-006/FR-013): `busyShowTimer` is
cleared; if the dims were shown, they and the loader are removed together
after the remaining minimum-visible ms; every lock (native `disabled` flags,
toolbar wiring, the sort guard, row `tabIndex`) clears immediately via the
same re-render that clears the operation flag. Every control returns to its
**pre-operation eligibility** (Pull all/Cleanup per `hasRepos`; everything
else enabled).
