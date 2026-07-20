# Quickstart / Validation: Custom Modern Table Scrollbar

Manual validation guide — this feature is pure renderer DOM/CSS behavior with
no new pure logic to unit-test. See `spec.md` for requirement IDs and
`data-model.md` for the reveal/hide state machine.

## Prerequisites

- System `git` available.
- Enough observed directories/repositories configured that the table's row
  list overflows its visible height (so it's actually scrollable). Turn the
  **Worktrees toggle** on for at least one repo with nested worktrees, so
  expand/collapse can be exercised while the scrollbar is visible.
- A way to toggle the OS "reduce motion" preference for the reduced-motion
  scenario (macOS: System Settings → Accessibility → Display → Reduce motion;
  Windows: Settings → Accessibility → Visual effects → Animation effects off;
  Linux: desktop-environment-specific).

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start           # build + electron .
```

## Automated tests

```bash
pnpm test            # builds, then: node --test dist/tests/*.test.js
```

Expected: the existing suite passes unchanged. This feature introduces no new
pure logic (it's DOM event wiring + CSS), so no new automated test cases are
added — everything below is verified by running the app.

## Scenarios

### A. Hidden at rest (US1 · FR-001/002/003)

1. Launch the app with a scrollable table; don't touch it.
2. Expect: no scrollbar track or thumb visible anywhere along the table's
   right edge, on whatever OS you're running. ✅ SC-001.
3. Resize/filter the table down until all rows fit without scrolling.
4. Expect: still nothing visible — no scrollbar renders when there's nothing
   to scroll. ✅ FR-003 edge case.

**Cross-platform scope note (FR-001/SC-001)**: this scenario is realistically
run on whichever single OS the developer is on. The practical cross-platform
check for this feature is the existing 3-OS `electron-builder` matrix in
`.github/workflows/release.yml` (from feature 010) — since the styling relies
only on Electron's bundled Chromium (identical rendering engine on all three
platforms), a build succeeding there is the operative signal that the other
two platforms render the same way, not a repeat of this manual walkthrough.

### B. Reveal on scroll, fade after idle (US2 · FR-004/006/007/011)

1. With the scrollbar hidden, scroll the table with the mouse wheel or
   trackpad.
2. Expect: a thin line-style thumb fades in near-instantly, sized/positioned
   to reflect how much of the list is visible and where you are in it. ✅ SC-002.
3. Stop scrolling and wait roughly a second without touching anything.
4. Expect: the thumb fades back out. ✅ SC-003.
5. Scroll again, and just before the fade-out would complete, scroll once
   more.
6. Expect: the thumb stays visible (the hide timer reset), not a flicker of
   hide-then-show. ✅ User Story 2, Acceptance Scenario 3.
7. While the thumb is visible, trigger a refresh (or expand/collapse a
   worktree group) so the row count/height changes.
8. Expect: the thumb's size/position updates immediately to the new content
   length, without needing an extra scroll nudge. ✅ FR-011.

### C. Reveal on hover, and drag-to-scroll (US3 · FR-005/008)

1. With the scrollbar hidden and the table idle, move the pointer over the
   table without scrolling.
2. Expect: the thumb fades in from hover alone. ✅ FR-005.
3. Move the pointer away (without having scrolled) and expect the thumb to
   fade back out after the same delay as scenario B.
4. Hover the table again, press down on the thumb, and drag it up/down,
   including dragging the pointer briefly outside the table's horizontal
   bounds while still holding the mouse button.
5. Expect: the table scrolls to track the drag the whole time, the thumb
   stays visible throughout, and releasing the mouse button ends the drag
   normally. ✅ FR-008, User Story 3 Acceptance Scenario 3.

### D. Keyboard scroll reveal (Clarification, 2026-07-20 · FR-004)

1. With the scrollbar hidden, click a row to focus it, then press
   Arrow-Down/Page-Down/End repeatedly.
2. Expect: the table scrolls (unchanged from before this feature) **and** the
   thin scrollbar fades in exactly as it does for mouse-wheel scrolling.
3. Stop pressing keys and confirm it fades out the same way as scenario B.

### E. No layout shift (FR-009/SC-005)

1. With the table idle (scrollbar hidden) note the row list's width and the
   right edge of the row text/action column.
2. Trigger a reveal (scroll or hover).
3. Expect: no row content shifts, reflows, or gets clipped differently when
   the thumb appears — it overlays rather than reserving space.

### F. Reduced motion (Clarification, 2026-07-20 · FR-007)

1. Enable the OS "reduce motion" preference (see Prerequisites), then relaunch
   or refocus the app.
2. Repeat scenario B's scroll trigger.
3. Expect: the thumb still shows and hides at the same trigger points and
   after the same ~1s delay, but the transition is an instant cut rather than
   a fade.

### G. Coexistence with the long-operation dim (existing Feature 009 behavior)

1. Start a long operation (Refresh, Pull all, or Cleanup) on a table with
   enough rows to scroll, while it's running.
2. Scroll the (dimmed) table.
3. Expect: the scrollbar still reveals/hides normally and scrolling still
   repositions the (still-blocked) list; nothing about the scrollbar implies
   the dimmed rows became actionable. ✅ Edge case in spec.md.

### Note: FR-012 (graceful fallback) is not a runnable scenario

FR-012 requires falling back to a native scrollbar if the styling technique
is unsupported. Per research.md Decision 4, this isn't exercised here: CSS
silently no-ops unknown pseudo-elements, and Electron pins a fixed, known-
supporting Chromium version, so there is no reachable environment in this
app to actually observe the fallback in. It's verified by inspection of that
reasoning, not by a scenario above.
