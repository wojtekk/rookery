# Contract: UI Lockout Behavior

Regenerated for **Revision 2026-07-19e** (re-expanded lockout). This feature
exposes **no IPC and no external interface**. Its contract is the renderer's
observable UI behavior — the state machine and control-eligibility rules that
this document is the reference for `tasks.md`/`quickstart.md` to validate
against.

## Scope

- **No** changes to `src/shared/types.ts`, the preload bridge, or the main
  process.
- **No** native `inert` and **no** whole-UI/full-viewport overlay — each
  control below is blocked individually by its own render logic. The only
  things that visually dim are the table rows and the sort-header row;
  everything else that's blocked shows only a `not-allowed` cursor.
- `ToolbarState` keeps its existing shape `{ showWorktrees, refreshing,
  updating, cleaning, hasRepos }`; `renderSummary`/`renderRows` each gain one
  new boolean parameter (`locked`), described below.

## Busy state machine

`busy = refreshing || updating || cleaning`. Every non-dimming lock (buttons,
Settings, Worktrees toggle, filter chips, row actions, and the sort-header's
*functional* block) applies synchronously the moment `busy` flips, via
`render()`. The two dims (`#list.busy`, `.thead.busy`) and the loader are
deferred by the existing show-delay.

```text
        start op (re-entry guard passes; flag set; render())
 idle ──────────────────────────────────────────────▶ running (every lock active)
   ▲                                                       │  running button = .busy
   │                                                       │  every other control = blocked
   │                                                       │  (cursor-only, or dimmed for
   │                                                       │  rows/sort-header — see below)
   │                                                       │  start showTimer(150 ms)
   │        settle < 150 ms                                │  showTimer fires (op still running)
   │  ◀── clear showTimer ─────────────────────────────────┤
   │      (no dim/loader ever shown; locks were already    ▼
   │       active and are cleared below regardless)    running + dims
   │                                                       │  #list.busy + .thead.busy on
   │                                                       │  #tableLoader shown; busyLoaderShownAt = now
   │        settle (any outcome)                           │
   │  ◀── after remainingMinVisibleMs ─────────────────────┘  remove #list.busy + .thead.busy
   │      clear every lock, clear flag → render()              + #tableLoader together
 idle
```

### Transition rules

1. **Start** (a re-entry guard passes and a handler sets its flag):
   - call `render()` — the running button becomes `.busy`; every other
     control that operates on repositories becomes blocked (FR-001):
     - the other two buttons, Settings, the Worktrees toggle: `.disabled`,
       unwired, `aria-disabled="true"`, cursor `not-allowed`, **no colour
       change** (FR-003/FR-011/FR-012).
     - every filter chip: native `button.disabled = true`, cursor
       `not-allowed`, **no colour change** (FR-015).
     - every row-level action/delete button: native `button.disabled = true`,
       cursor `not-allowed`, **no colour change** (FR-016), on top of any
       pre-existing permanent "no remote configured" disablement (unaffected,
       stays dimmed separately).
     - every row: `tabIndex = -1` (FR-004's inertness half).
     - the sort-header row: its `onSort` callback becomes a no-op (FR-014's
       functional half — the dim half is deferred, see step 2).
   - start a 150 ms `busyShowTimer` for the *dimming* cues only.
   - note: the row directory-path tooltip (FR-017) is suppressed via a CSS
     rule scoped to `.list.busy`, so it rides the same 150 ms/400 ms timing as
     the row dim rather than locking immediately — a deliberate simplification
     (it's a perceptual cue paired with the dim, not a functional guard like
     the buttons/filters/row actions above).
2. **Show timer fires** (operation still running at 150 ms):
   - add `.busy` to `#list` (row dim, FR-004) and `.busy` to `.thead`
     (sort-header dim, FR-014); show `#tableLoader` (FR-005); record
     `busyLoaderShownAt`.
3. **Settle** (awaited call resolves, resolves-with-failure, or **rejects** —
   FR-013), from a `finally`:
   - clear `busyShowTimer`.
   - if the dims were never shown → clear every lock and the flag, then
     `render()`; done (no visual to remove).
   - if the dims were shown → after `remainingMinVisibleMs(busyLoaderShownAt,
     now)`, remove `#list.busy` + `.thead.busy` + hide `#tableLoader`
     together, then clear every lock and the flag, then `render()`.
   - the re-render restores each control to its pre-operation eligibility
     (FR-006): Pull all/Cleanup per `hasRepos`; everything else enabled.

### Invariants

- **INV-1 (FR-002/SC-005)**: at most one operation flag is ever true → the
  running button is unique and every other repository-operating control is
  blocked.
- **INV-2 (FR-013/SC-004)**: every path out of a non-idle state passes through
  "Settle," reached from a `finally` — so no unhandled rejection can leave any
  control permanently stuck blocked, dimmed, or non-interactive.
- **INV-3 (FR-005)**: the loader, once shown, is visible ≥
  `LOADER_MIN_VISIBLE_MS`; the two dims share its lifetime exactly.
- **INV-4 (FR-001/FR-009)**: from start to settle, every control named in the
  eligibility table below is not activatable by pointer or keyboard. **No**
  control is exempt anymore except the running button's own indicator and the
  loader itself.
- **INV-5 (FR-004/FR-014, dim ≠ colour-elsewhere)**: `#list.busy`/`.thead.busy`
  are the *only* two things that change colour/opacity while locked. Every
  other blocked control (Settings, Worktrees toggle, filter chips, row
  actions, the two non-running buttons) MUST render pixel-identical to its
  idle appearance except for the cursor.
- **INV-6 (FR-017)**: the row directory-path tooltip never appears while
  `#list.busy` is set; no other row tooltip is required to honor this.

## Control eligibility contract

Given `ToolbarState { showWorktrees, refreshing, updating, cleaning,
hasRepos }` and `busy = refreshing || updating || cleaning`:

- **Refresh**: `.busy` when `refreshing`. Blocked (`.disabled`, unwired,
  cursor `not-allowed`, no colour change) when `!refreshing && (updating ||
  cleaning)`. Wired only when `!busy`. Never gated by `hasRepos` (FR-008).
- **Pull all**: `.busy` when `updating`. Blocked when `!updating &&
  (refreshing || cleaning || !hasRepos)`. Wired only when `!busy &&
  hasRepos` (FR-001/FR-007).
- **Cleanup**: `.busy` when `cleaning`. Blocked when `!cleaning &&
  (refreshing || updating || !hasRepos)`. Wired only when `!busy && hasRepos`
  (FR-001/FR-007).
- **Settings**: blocked (`.disabled`, unwired, cursor `not-allowed`, no colour
  change) when `busy`; wired otherwise (FR-011 — **reinstated** vs. the
  2026-07-19b/d contract).
- **Worktrees toggle**: blocked when `busy`; wired otherwise (FR-012 —
  **reinstated**).
- **Filter chips** (`summary.ts`, `renderSummary(..., locked)`): each chip's
  native `button.disabled = locked` where `locked = busy`. No colour change;
  cursor `not-allowed` via CSS (FR-015).
- **Sort-header row** (`table.ts`/`renderer.ts`): the `onSort` callback passed
  to `wireSortHeaders` no-ops when `busy`; `.thead.busy` dims it (FR-014).
- **Row-level actions** (`table.ts`, `renderRows(..., locked)`): each
  row-action/delete button's native `button.disabled = true` when `locked =
  busy` (in addition to any pre-existing permanent disablement). No colour
  change from this lock; cursor `not-allowed` via CSS (FR-016).
- **Row surface**: `tabIndex = -1` when `locked = busy` (FR-004).
- **Row directory-path tooltip**: suppressed via
  `.list.busy .name[data-tip]:hover::after { display: none }` (FR-017).

> Contrast with the 2026-07-19b/d contract: there, only the three buttons
> blocked each other and everything else (Settings, toggle, filter chips, row
> actions) was explicitly exempt. Revision 2026-07-19e closes that exemption
> for every control except... nothing — every control that operates on
> repositories or reconfigures the view is now blocked while a long operation
> runs. The one design property retained from 2026-07-19b is *how*: still no
> single whole-app input barrier, still no whole-viewport dim; each control's
> own render/wiring logic is the mechanism, control by control.

## Non-goals

- Not a modal: the loader has no buttons and no dismiss; it clears only when
  the operation settles.
- No cancellation of a running operation (out of scope; operations are
  bounded by the existing 60 s main-process deadline).
- The row/sort-header dim is not itself an additional input barrier beyond
  what's described above — for rows, the actual barrier is `tabIndex=-1` +
  each action button's own `disabled`, not the dim's opacity; for the
  sort-header, the barrier is the guarded callback, not the dim.
