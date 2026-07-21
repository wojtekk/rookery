# Quickstart / Validation: Explain Why a Repository Wasn't Updated by Pull All

Validates the spec end-to-end. Pure logic is covered by `pnpm test`; the icon +
tooltip are visual and validated manually (no DOM/CSS harness in the repo,
consistent with features 011/012).

## Prerequisites

```sh
nvm use            # Node 24, per .nvmrc
pnpm install
pnpm test          # extended tests incl. reason categorization (see below)
pnpm build && pnpm start   # launch the Electron app
```

## Automated check (run first)

`pnpm test` — the full suite (currently 102) plus the new `update.test.ts`
cases MUST pass:

- a **diverged** temp repo → outcome `result: 'failed'`, `reason.category: 'diverged'`;
- an **unreachable-remote** repo → `result: 'failed'`, `reason.category: 'fetch-failed'`, `reason.detail` non-empty;
- an **updated** and an **already-current** repo → **no** `reason`;
- skip-reason derivation: `unavailable` → reason, `detached` → reason, **no-upstream → no reason**.

## Manual test fixtures

Point the app at an observed directory containing:

1. `diverged/` — local and `origin/main` both have unique commits.
2. `offline/` — a valid upstream whose remote is unreachable (e.g. bad host / offline).
3. `updatable/` — 1 commit behind a reachable upstream (will succeed).
4. `current/` — already up to date.
5. `gone/` — a tracked repo whose working-tree directory you delete after the scan.
6. `detached/` — `git checkout --detach`.
7. `no-upstream/` — a local-only branch with no tracked upstream, left behind.

Click **Pull all** once, then verify each scenario.

## Scenario A — Diverged shows a reason (US1, FR-001/002/004/006)

Hover the `⚠` icon next to `diverged`'s slug → tooltip leads with
"Diverged from upstream — fast-forward not possible". **Expected**: icon present;
plain-language category shown.

## Scenario B — Unreachable remote shows category + git detail (US1, FR-003, SC-003)

Hover `offline`'s warn icon → tooltip shows "Couldn't reach the remote" **and**
the underlying git error text below it (multi-line). **Expected**: both lines
readable. (If the fsmonitor daemon is mid-failure, its stderr appears here too —
that is the intended visibility.)

## Scenario C — Success shows nothing (US1, FR-004)

`updatable` (now updated) and `current` → **no** warn icon on either row.

## Scenario D — Unavailable is explained (US2, FR-004)

`gone` → warn icon; tooltip "Skipped — working tree unavailable".

## Scenario E — Detached is explained (US2, FR-004)

`detached` → warn icon; tooltip "Skipped — not on a branch (detached HEAD)".

## Scenario F — No-upstream is never warned (US2, FR-005)

`no-upstream` → **no** warn icon, even though it wasn't updated.

## Scenario G — Coexistence with feature 007 (FR-012)

- `diverged`/`offline` (failed) → warn icon **and** the faint-red row tint;
  selecting the "Failed" filter chip includes them.
- `gone`/`detached` (stuck skip) → warn icon but **no** red tint; the "Failed"
  filter does **not** include them.

## Scenario H — Tooltip is never clipped (FR-007)

Narrow the window and scroll so a warned row is the **last visible** row, then
hover its warn icon. **Expected**: the (possibly multi-line) tooltip flips
upward (`.tip-up`) and stays fully on-screen — not clipped by the list's bottom
edge. Confirm the same at minimum window width (no right-edge clip either).

## Scenario H2 — Long slug does not hide the icon (FR-014/FR-007)

Use a warned repo with a long org/slug (e.g. `finn/some-very-long-org-name/tf-auth0-pro`)
in a narrow window. **Expected**: the slug text truncates with an ellipsis while
the `⚠` icon stays fully visible at the end of the slug line (icon is a
non-shrinking sibling, not inside the truncated text).

## Scenario I — Warnings are session-only (FR-011)

Quit and relaunch the app (do **not** click Pull all). **Expected**: no warn
icons anywhere. Click Pull all → the warnings reappear for still-failing trees.

## Scenario J — Manual Refresh clears a resolved warning (FR-008)

After Scenario A, manually resolve `diverged` (merge/rebase yourself so the row
is clean), then click **Refresh** (not Pull all). **Expected**: its warn icon
clears. Restore `gone`'s directory and Refresh → its warn icon clears too.

## Scenario K — No network on hover (FR-009, SC-005)

Hovering any warn icon triggers no fetch (footer still reads
"…· no network traffic"); reasons are read from the last run only.

## Scenario L — Not colour-only / accessible (FR-013, SC-006)

The warn icon (not just the red tint) marks the row; its `aria-label` names the
reason, so the state is perceivable without colour.

## Success criteria mapping

| Scenario | Requirements / SC |
|----------|-------------------|
| A, B, C | US1; FR-001/002/003/004/006; SC-001/002/003 |
| D, E, F | US2; FR-004/005 |
| G | FR-012 |
| H, H2 | FR-007/014 |
| I | FR-011 |
| J | FR-008; SC-004 |
| K | FR-009; SC-005 |
| L | FR-013; SC-006 |
