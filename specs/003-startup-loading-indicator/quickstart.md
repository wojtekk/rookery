# Quickstart: Startup Loading Indicator

Validation guide proving the feature end-to-end. See [contracts/loadstate.md](./contracts/loadstate.md)
and [data-model.md](./data-model.md) for the logic being exercised.

## Prerequisites

- Node 22 (`.nvmrc`), `pnpm install` completed, system `git` available.
- At least one observed directory containing several git repositories (so the startup
  scan takes a perceptible moment).

## Build & run

```sh
pnpm run build      # tsc (main + renderer) + copy assets
pnpm start          # launches Electron
```

## Automated check (pure logic)

```sh
pnpm test           # builds, then node --test dist/tests/*.test.js
```

Expected: `tests/loadstate.test.ts` passes — covering `decideStartupScreen` (all four
loadState×hasDirectories combinations, incl. the SC-006 no-flash guarantee) and
`remainingMinVisibleMs` (never-shown → 0, already-elapsed → 0, mid-window → positive,
never negative).

## Manual validation scenarios

| # | Setup | Action | Expected (maps to) |
|---|-------|--------|--------------------|
| 1 | ≥1 directory with repos, scan > ~150 ms | Launch app | Flat indeterminate loader, **centered**, visible from launch until the list renders; then it disappears and the list appears. No add-directory flash. (US1, FR-001/002/003, SC-001/002/006) |
| 2 | Same as #1, loader visible | While loading | Window can be moved, resized, closed — UI not frozen. (FR-005, SC-004) |
| 3 | Directory whose scan finishes < ~150 ms (e.g. one tiny repo) | Launch app | No jarring flash — loader either never appears or, if shown, stays ≥ ~400 ms. (FR-008, SC-001 edge) |
| 4 | **No** directories configured | Launch app | Add-directory / empty screen appears immediately; the loader does **not** appear. No loader-then-empty churn. (FR-006, Edge: no directories) |
| 5 | Directories configured but scan fails/errors | Launch app | Loader resolves to an error/empty state; it never spins indefinitely. (FR-007, SC-005) |
| 6 | List already rendered | Trigger refresh | Toolbar busy affordance indicates refresh in progress until the updated list renders (existing behavior). (US2, FR-009) |

## What "done" looks like

- Scenarios 1–6 pass by observation.
- `pnpm test` green (incl. new `loadstate.test.ts`).
- With directories configured, the add-directory screen is never seen at startup (watch
  carefully / slow-motion screen capture for scenario 1) — SC-006 at 100%.
