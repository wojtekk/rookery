# Quickstart / Validation: Label the Loader With the Active Operation

Manual validation guide. See `spec.md` for requirement IDs and `research.md`
for the design decisions. No new automated test is added (see `research.md`
Decision 4) — this checklist is the sole verification.

## Prerequisites

- System `git` available.
- At least two observed repositories configured, one of them with a
  `[gone]` branch or stale worktree (to make Cleanup have something to
  show) and reachable upstreams (to make Pull all take visible time).

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start           # build + electron .
pnpm test            # existing suite must still pass unchanged
```

## Scenarios

### A. Initial load (US1 Acceptance Scenario 1 · FR-001/002/006)

1. Quit and relaunch the app with directories already configured.
2. While the startup loader is visible, look above the three dots.
3. Expect: a label reading "Loading…" sits above the dots, and disappears
   the instant the table's rows appear. ✅ SC-001.

### B. Refresh (US1 Acceptance Scenario 2)

1. Once loaded, click **Refresh**.
2. Expect: the label reads "Refreshing…" for the duration the loader is
   visible, then disappears with the dots.

### C. Pull all (US1 Acceptance Scenario 3)

1. Click **Pull all**.
2. Expect: the label reads "Pulling…" for the duration the loader is
   visible, then disappears with the dots.

### D. Cleanup (US1 Acceptance Scenario 4)

1. Click **Cleanup**.
2. Expect: the label reads "Cleaning up…" while the initial scan runs (the
   loader shown before the review overlay opens), then disappears with the
   dots once the overlay opens.

### E. Label reads as part of the loader, not a banner (US2 · FR-003/005 · SC-002)

1. Trigger any of the above and look at the loader as a whole.
2. Expect: the label sits directly above the dots (not beside or below),
   uses a small, muted text style close in visual weight to the dots — not
   bold, not full-strength text colour, not noticeably larger than the row
   of dots beneath it.

### F. Screen reader announcement (FR-007 — optional, best-effort)

1. With VoiceOver (or another screen reader) running, trigger Refresh.
2. Expect: the operation label is announced once, politely (no
   interruption of other speech), not repeated on every animation frame.
   If a screen reader isn't available in your environment, this scenario
   can be skipped — FR-007 is otherwise covered by code inspection (the
   label element carries `role="status"`, created once and only ever
   text-mutated, matching this app's existing toast-notice live-region
   pattern).

### G. No regression to existing loader behavior

1. Repeat scenario A but close the app before the loader would appear
   (i.e., with no observed directories) — expect the "add a directory"
   onboarding screen, no loader, no label (unchanged from today).
2. Confirm the long-operation lockout (dimmed rows, disabled Settings/
   filters/row actions) still behaves identically to before this change
   during Refresh/Pull all/Cleanup.
