# Quickstart / Validation: Fix Row Directory Tooltip Clipping

Manual validation guide — this fix is a one-line extension of an existing
`mouseover`-delegated measurement (`positionRowIconTooltip` in
`renderer.ts`), with no new pure logic to unit-test. See `spec.md` for
requirement IDs and `research.md` for the root-cause trace and why no CSS
change is needed.

## Prerequisites

- System `git` available.
- At least one observed repository configured, so the table has rows with a
  directory-path tooltip (hover a row's name/dirname area) to check. Turn
  the **Worktrees toggle** on for a repo with nested worktrees so a worktree
  row's tooltip can be checked too (scenario B).
- A way to shorten the app window's height (or add enough observed
  repositories) so the table needs to scroll — required to reproduce the
  original bug.
- At least one pair of colliding clones (same remote, same directory name,
  different parent folder) if you want to also confirm the duplicate-icon
  tooltip (feature 017/019) still behaves correctly alongside this change —
  not required to validate this feature's own scope.

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start           # build + electron .
```

## Automated tests

```bash
pnpm test            # builds, then: node --test dist/tests/*.test.js
```

Expected: the existing suite passes unchanged. This fix introduces no new
pure logic (it's a one-line selector-string extension), so no new automated
test cases are added — everything below is verified by running the app.

## Scenarios

### A. Directory tooltip on the last visible repository row (US1 · FR-001/002)

1. Launch the app with enough observed repositories that the table needs to
   scroll, or shorten the app window's height until it does.
2. Hover the name/dirname area of whichever row is currently the **last one
   visible** — just above the footer — while confirming (e.g. via DevTools)
   that it is *not* necessarily the table's actual last row.
3. Expect: the full directory-path tooltip renders, growing **upward**
   instead of downward, fully inside the table's visible area — not cut off
   or invisible. ✅ SC-001/SC-002.
4. Scroll down until the table's actual last row is the one visible at the
   bottom, and repeat: hover its name area.
5. Expect: same result — tooltip grows upward and is fully visible.

### B. Directory tooltip on a worktree row (US1 Acceptance Scenario 3 · FR-004)

1. Turn on the **Worktrees toggle** for a repository with nested worktrees.
2. Shorten the window (or scroll) so a nested worktree row is last visible.
3. Hover that worktree row's name area.
4. Expect: same as scenario A — the full directory path renders, flipped
   upward, not clipped. ✅ FR-004 (fix applies uniformly to worktree rows).

### C. No regression when there's room below (US1 Acceptance Scenario 2 · FR-003)

1. Hover the name area of a row that has ample space below it in the
   visible list (e.g. the first row, with a tall window).
2. Expect: the directory-path tooltip renders below the row exactly as it
   does today — no visible change. ✅ SC-003.

### D. Live resize/scroll re-evaluates on next hover (Edge Case)

1. Hover a row's name area near the bottom of the visible list; confirm it
   flips upward.
2. Move the mouse away, then resize the window taller (or scroll) so that
   same row now has room below it.
3. Hover the same row's name area again.
4. Expect: the tooltip now renders below the row — the flip decision is
   re-evaluated fresh on this new hover, not stuck from the prior one.

### E. No regression to the busy-lockout and duplicate-icon suppressions

1. Start a long operation (Refresh, Pull all, or Cleanup) and, while it
   runs, hover a row's name area.
2. Expect: no directory-path tooltip appears at all (Principle IV lockout,
   unchanged by this fix).
3. On a row with the duplicate-clone indicator (feature 017), hover the
   indicator icon itself (not the surrounding name area).
4. Expect: only the duplicate notice tooltip appears, not the directory
   path — unchanged by this fix.
