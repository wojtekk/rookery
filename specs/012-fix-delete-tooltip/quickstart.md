# Quickstart / Validation: Fix Delete Button Tooltip Clipping

Manual validation guide — this fix is CSS positioning plus a small DOM
measurement, with no new pure logic to unit-test. See `spec.md` for
requirement IDs and `research.md` for why no `::-webkit-scrollbar-corner`
styling is added.

## Prerequisites

- System `git` available.
- At least one observed repository configured, so the table has a delete icon
  to hover. Turn the **Worktrees toggle** on for a repo with nested worktrees
  so a worktree row's delete icon can be checked too.
- At least one configurable row action (Settings → Actions) enabled, so the
  table has `.menu` action icons to hover alongside the delete icon.
- A way to narrow the app window (or resize the display) to check the
  narrow-width edge case.

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
pure logic (it's a CSS selector change), so no new automated test cases are
added — everything below is verified by running the app.

## Scenarios

### A. Full tooltip on a repository row (US1 · FR-001/002/004)

1. Launch the app with at least one repository row visible.
2. Hover the row's delete ("X") icon.
3. Expect: the full "Delete" tooltip renders, growing leftward from the icon,
   fully inside the table's right edge — not cut off. ✅ SC-001.
4. Shorten the app window's height so the table needs to scroll (more rows
   exist than fit on screen), then hover the delete icon on whichever row is
   currently the **last one visible** — just above the footer — while
   confirming (e.g. via DevTools) that it is *not* the table's actual last
   row (more rows exist below, reachable by scrolling).
5. Expect: the tooltip renders fully, growing upward instead of downward
   (there's no visible room below that row) — not invisible or clipped by the
   table's bottom edge, even though this isn't the DOM's last row. ✅ Edge
   case in spec.md; research.md Decision 1a.
6. Scroll down until the table's actual last row is the one visible at the
   bottom, and repeat: hover its delete icon.
7. Expect: same result — tooltip grows upward and is fully visible.

### B. Full tooltip on a worktree row (US1 · FR-001)

1. Turn on the **Worktrees toggle** for a repository with nested worktrees.
2. Hover the delete icon on a nested worktree row.
3. Expect: same as scenario A — full "Delete" text, not clipped. ✅ FR-001
   (fix applies uniformly to worktree rows, not just top-level rows).

### C. Narrow window (US1 Acceptance Scenario 2 · FR-002)

1. Narrow the app window to the smallest supported width.
2. Hover a delete icon.
3. Expect: the tooltip still renders fully within the table area. ✅ FR-002.

### D. Scrolled table (US1 Acceptance Scenario 3 · FR-002)

1. With enough rows to scroll, scroll the table partway down.
2. Hover a delete icon on a row now visible mid-scroll.
3. Expect: tooltip renders identically to the unscrolled state. ✅ FR-002.

### E. No corner artifact on hover (US2 · FR-003)

1. With the table idle (no corner artifact visible), hover a delete icon —
   including the delete icon on the last row, closest to the table's bottom
   edge.
2. Expect: no white/light box appears in the table's bottom-right corner,
   before, during, or after the hover. ✅ SC-002.

### F. No regression to delete behavior (FR-005)

1. Click a row's delete icon and complete (or cancel) the resulting
   confirmation.
2. Expect: identical behavior to before this fix — only the hover tooltip's
   position changed, not the click/confirmation flow.

### G. Full tooltip on configurable action icons (FR-006)

1. With at least one row action enabled (Settings → Actions), shorten the app
   window so the table scrolls, then hover a `.menu` action icon (e.g. the
   GitHub or terminal launcher) on whichever row is last **visible** — again
   confirming it is not the table's actual last row.
2. Expect: the action's name tooltip renders fully, growing upward and
   leftward from the icon — not clipped by the table's bottom edge, matching
   scenario A's result for the delete icon. ✅ FR-006/SC-004.
3. Click the action icon (or cancel) to confirm launching it still works
   unchanged — only the hover tooltip's position changed.
