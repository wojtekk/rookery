# Phase 1 Data Model: Startup Loading Indicator

This feature introduces **no persisted data**. It adds one transient, renderer-only
state plus two timing constants. Everything below is in-memory for the lifetime of a
window.

## Entity: Load phase (transient)

The conceptual "Load state" from the spec, made concrete as a small enum used by the
renderer to decide what to paint.

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `loadState` | enum | `'loading'` \| `'ready'` | `'loading'` from launch until the startup scan resolves; then `'ready'`. "Resolves" = **`refresh()`** completes (the slow live probe), not the fast `listRepositories()` — see contract §C. The spec's conceptual "failed" state (spec Key Entities) is **not** a third enum value: a failed/timed-out scan also sets `'ready'` and renders the empty screen (SC-005 accepts "error OR empty"), never a distinct error view this iteration. |
| `hasDirectories` | boolean (derived) | — | `settings.observedDirectories.length > 0`. Read from existing settings; not new storage. |

### Derived screen (pure decision)

`decideStartupScreen(loadState, hasDirectories)` → one of:

| Result | Condition | Renders |
|--------|-----------|---------|
| `'loader'` | `loadState === 'loading'` **and** `hasDirectories` | flat indeterminate loader (subject to timing gate below) |
| `'add-directory'` | `hasDirectories === false` | existing empty/add-directory screen (`empty.ts`) |
| `'results'` | `loadState === 'ready'` **and** `hasDirectories` | `list` (or the "No repositories found" empty variant if scan returned zero rows) |

**Invariant (SC-006 / FR-010)**: when `hasDirectories` is true, the `'add-directory'`
result is unreachable while `loadState === 'loading'`. The add-directory screen can only
appear when no directories are configured — never as a transient step before the loader.

### State transitions

```text
launch
  │  read settings (hasDirectories known)
  ▼
loadState = 'loading' ──(hasDirectories? → 'loader' : 'add-directory')
  │
  │  api.listRepositories() (fast) then api.refresh() (slow) — loadState holds 'loading'
  │  across BOTH; gate is refresh() resolving. try/catch: reject → still 'ready' (empty)
  ▼
loadState = 'ready' ──→ 'results'
```

There is no path back to `'loading'` from `'ready'` at startup. On-demand **refresh**
(US2) uses the separate, existing `refreshing` flag + toolbar affordance, not `loadState`.

## Loader visibility timing (transient)

Governs *when* the loader element is actually shown, layered on top of the decision above
to prevent flicker (FR-008).

| Constant | Value | Meaning |
|----------|-------|---------|
| `LOADER_SHOW_DELAY_MS` | ~150 | Wait this long after scan start before revealing the loader. If the scan finishes first, the loader is never shown. |
| `LOADER_MIN_VISIBLE_MS` | ~400 | Once shown, keep the loader visible at least this long before results may replace it. |

### Visibility sub-state (renderer-local)

| Field | Type | Notes |
|-------|------|-------|
| `loaderShownAt` | number \| null | Timestamp when the loader element became visible; `null` while hidden/pending. |

### Pure helpers (unit-tested)

- `remainingMinVisibleMs(shownAt: number \| null, now: number, minMs = LOADER_MIN_VISIBLE_MS): number`
  → `0` if never shown or the minimum has already elapsed; otherwise the ms still to wait
  before hiding. Drives the "hold before swap to results" delay.
- `decideStartupScreen(loadState, hasDirectories)` → `'loader' | 'add-directory' | 'results'` (above).

Timers (`setTimeout` for the show-delay and the min-visible hold) live in `renderer.ts`;
the arithmetic they depend on is pure and covered by `tests/loadstate.test.ts`.
