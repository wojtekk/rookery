# Quickstart / Validation: Fix Duplicate-Indicator Tooltip Collision

Manual validation guide — this fix is a single declarative CSS rule with no
new pure logic to unit-test. See `spec.md` for requirement IDs and
`research.md` for why the fix is CSS-only.

## Prerequisites

- System `git` available.
- At least two observed directories that are clones of the same remote
  sharing a directory name, so at least one row shows the duplicate-clone
  icon (`entry.collisionFragment` set, per feature 017). Any other row
  without this — the common case — is enough to check the no-regression
  scenario.

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
pure logic (it's a CSS selector addition), so no new automated test cases
are added — everything below is verified by running the app.

## Scenarios

### A. Duplicate icon shows only its own tooltip (US1 · FR-001/002/004)

1. Launch the app with at least one duplicate-clone row present (the
   layers-intersect icon visible next to the `…/parent-folder` fragment).
2. Hover directly over the duplicate-clone icon.
3. Expect: exactly one tooltip appears — "This repository is also cloned
   elsewhere (this copy is under …/{fragment})" — with no overlapping or
   double-rendered text behind it. ✅ SC-001.

### B. Name text still shows the path tooltip away from the icon (US1 · FR-003)

1. On the same duplicate row, move the pointer off the icon but keep it over
   the row's name text (the directory name or the `…/fragment` label).
2. Expect: only the directory-path tooltip (`~/.../full/path`) appears —
   the duplicate notice does not. ✅ SC-002.

### C. No regression on non-duplicate rows (US2 · FR-005)

1. Hover the name text of any row without a duplicate-clone icon.
2. Expect: the directory-path tooltip appears exactly as it did before this
   fix — same wording, timing, and position.

### D. No regression to other row icon tooltips (FR-005)

1. Hover the delete icon, then (if any are configured) a custom action icon,
   then — on a row with an update warning — the warning icon.
2. Expect: each shows its own tooltip exactly as before this fix; unaffected
   by the new rule, which only targets `.name`'s tooltip.

### E. No regression to the duplicate icon's click behavior

1. Click the duplicate-clone icon.
2. Expect: the search narrows to every row sharing that duplicate's identity,
   exactly as before this fix (feature 017's `onFindDuplicate` behavior is
   untouched).

### F. Pointer transition between icon and name text (Edge Case)

1. Hover the duplicate icon, then slide the pointer slowly onto the
   surrounding name text without leaving the row.
2. Expect: the duplicate notice disappears and the path tooltip appears in
   its place — the switch follows the pointer's exact position with no lag
   or stuck tooltip. ✅ SC-003.

### G. Lockout suppression still works (Constitution Principle IV / FR-017)

1. Start a long operation (Refresh, Pull all, or Cleanup) and, while it
   runs, hover a duplicate row's name text and separately its (now disabled)
   duplicate icon.
2. Expect: no tooltip appears from either — the existing long-operation
   tooltip suppression (`styles.css:868-872`) and the disabled duplicate
   icon's native inability to match `:hover` both continue to hold, unaffected
   by this fix.
