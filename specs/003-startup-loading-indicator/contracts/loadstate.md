# Contract: Load-state view logic & loader render

This app exposes no network/API surface. Its "contracts" are (a) the pure-logic module
signatures other renderer code depends on, and (b) the DOM/visual contract of the loader.
Both are internal but stable within the renderer.

## A. Pure logic — `src/renderer/view/loadstate.ts`

```ts
export type LoadState = 'loading' | 'ready';
export type StartupScreen = 'loader' | 'add-directory' | 'results';

export const LOADER_SHOW_DELAY_MS: number;   // ~150
export const LOADER_MIN_VISIBLE_MS: number;  // ~400

/** Which of the three startup screens to paint. Pure; no DOM, no time. */
export function decideStartupScreen(loadState: LoadState, hasDirectories: boolean): StartupScreen;

/**
 * Milliseconds still required before a shown loader may be replaced by results.
 * Returns 0 when the loader was never shown (shownAt === null) or the minimum
 * has already elapsed. Never returns negative.
 */
export function remainingMinVisibleMs(shownAt: number | null, now: number, minMs?: number): number;
```

### Behavioral contract

`decideStartupScreen`:

| loadState | hasDirectories | → |
|-----------|----------------|---|
| `'loading'` | `true` | `'loader'` |
| `'loading'` | `false` | `'add-directory'` |
| `'ready'` | `true` | `'results'` |
| `'ready'` | `false` | `'add-directory'` |

Guarantee: `hasDirectories === true` never yields `'add-directory'` (SC-006 / FR-010).

`remainingMinVisibleMs(shownAt, now, minMs = LOADER_MIN_VISIBLE_MS)`:

- `shownAt === null` → `0` (loader never appeared; nothing to hold).
- `now - shownAt >= minMs` → `0` (already visible long enough).
- otherwise → `minMs - (now - shownAt)` (a positive value ≤ `minMs`).
- Never returns a negative number.

## B. Loader render — `src/renderer/view/loader.ts`

```ts
/** Show/hide the flat indeterminate loader in the content area. Idempotent. */
export function setLoaderVisible(container: HTMLElement, visible: boolean): void;
```

### DOM/visual contract

- The loader occupies the content area (same region as `#list`/`#empty`), **centered**.
- It is **flat, indeterminate** (no percentage, no numeric progress), consistent with the
  minimal design (FR-002).
- While the loader is visible, `#list` and `#empty` are `hidden`; exactly one of
  loader / list / empty is visible at any time.
- The window chrome remains interactive throughout (FR-005 / SC-004): the animation is
  CSS-driven and must not run on or block the main thread.
- No `title`/native tooltip; no ARIA live announcement this iteration (accessibility
  explicitly out of scope per spec).

## C. Boot orchestration contract — `src/renderer/renderer.ts`

"Scan start" = the moment the startup IIFE begins. "Scan complete" = when **`refresh()`**
resolves (see step 3) — NOT when `listRepositories()` resolves. The `LOADER_SHOW_DELAY_MS`
timer is measured from scan start.

The startup IIFE MUST, in order:

1. `await api.getSettings()` and compute `hasDirectories` **before** the first content paint.
2. Set `loadState = 'loading'`; render per `decideStartupScreen(...)` (add-directory screen
   if no directories — otherwise schedule the loader after `LOADER_SHOW_DELAY_MS`).
3. Run the existing startup scan. It is two calls: `listRepositories()` (fast, returns the
   last-known list) then `refresh()` (slow, live git probe). `loadState` MUST stay
   `'loading'` across **both** — the loader (or add-directory screen) remains until
   `refresh()` resolves, so the user is never shown a stale list with no affordance while
   the live probe runs. The intermediate `listRepositories()` result is NOT painted on its
   own during startup.
4. On `refresh()` resolution set `loadState = 'ready'`; if the loader was shown, defer the
   swap to results by `remainingMinVisibleMs(loaderShownAt, now)`; then render results.
5. **Failure handling (FR-007 / SC-005)**: the whole scan MUST be wrapped in `try/catch`
   (covering `getSettings`/`listRepositories`/`refresh`). On rejection, set
   `loadState = 'ready'` in a `finally`/`catch` so the loader can never spin forever. A
   failed scan resolves to the same empty/ready screen as a zero-row success (there is no
   distinct error screen this iteration — SC-005 accepts "error OR empty"); surface the
   failure via the existing `showNotice(...)` toast if desired, not a dedicated view.
6. **`render()` must be `loadState`-aware (integration)**: today `render()` sets
   `els.empty.hidden = rows.length > 0` unconditionally, so any `render()` during the
   loading window (rows still `[]`) would re-show `#empty` and fight the loader. The empty
   branch MUST be gated so `#empty` is shown only when `loadState === 'ready'`; while
   `loadState === 'loading'` and `hasDirectories`, the loader owns the content area and both
   `#list` and `#empty` stay hidden (upholds §B: exactly one of loader/list/empty visible).
