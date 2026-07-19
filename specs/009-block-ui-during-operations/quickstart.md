# Quickstart / Validation: Block UI During Long Operations

Regenerated for **Revision 2026-07-19e** (re-expanded lockout). Manual
validation guide — this feature is renderer/DOM behavior; the pure timing
helper is unit-tested, everything else is verified by running the app. See
`spec.md` for requirement IDs and `contracts/ui-lockout.md` for the state
machine.

## Prerequisites

- System `git` available.
- At least two observed directories configured, including some repositories
  behind their upstream (so Pull all has real work) and at least one with a
  `[gone]` branch or stale worktree (so Cleanup has candidates). Have the
  Worktrees toggle **on** for at least one repo with nested worktrees (to
  check worktree-row dimming/inertness).

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start          # build + electron .
```

## Unit test (pure timing helper)

```bash
pnpm test           # builds, then: node --test dist/tests/*.test.js
```

Expected: `tests/loadstate.test.ts` passes. This revision introduces no new
pure logic (the timing helper is reused unchanged), so no new unit cases are
required.

## Scenarios

### A. Everything blocks during Pull all (US1 · FR-001/003/004/005/011/012/014/015/016)

1. With repositories listed, click **Pull all**.
2. Expect immediately: **Pull all** shows its busy cue; **Refresh**, **Cleanup**,
   **Settings**, and the **Worktrees toggle** all show they are non-interactive
   (`.disabled`) — no colour/opacity change on any of them beyond what
   `.disabled` already meant before this revision (cursor `not-allowed` only).
   ✅ FR-003/FR-011/FR-012.
3. Expect immediately: every **filter chip** stops responding to click/keyboard
   (they do **not** dim — hover them and confirm no colour change, only the
   cursor becomes `not-allowed`). ✅ FR-015.
4. Expect immediately: every row's **delete** and **launch-action** buttons
   stop responding (same no-dim, cursor-only treatment). ✅ FR-016.
5. Expect immediately: the **sort-header row** stops responding to click on
   any column. ✅ FR-014 (functional half).
6. Expect within ~150 ms: the **table rows** dim to barely-visible (including
   nested worktree rows if shown) and the **sort-header row** dims the same
   way; the loader dots appear centred over the table. ✅ FR-004/FR-005/FR-014
   (visual half).
7. Hover a repository row's name during the run → **no directory-path tooltip
   appears**. ✅ FR-017.
8. Try Tab-ing through the page → repository/worktree rows are skipped (not
   focusable) while locked. ✅ FR-004 (inertness).
9. When Pull all finishes: row dim, sort-header dim, and loader disappear;
   every control (buttons, Settings, toggle, filter chips, sort header, row
   actions) returns to its list-appropriate state. ✅ FR-006.

### B. Cleanup, including the review overlay (US1 · FR-006)

1. Click **Cleanup**. Expect the same full lockout (buttons, Settings, toggle,
   filter chips, sort header, row actions) plus the row/header dim + loader
   while the scan runs.
2. When the review overlay opens, everything outside the overlay stays locked;
   interact with the overlay itself (it's unaffected by this feature). Confirm
   or cancel.
3. On cancel: every lock/dim releases, controls return to normal. On confirm:
   locks/dims hold through removal, then release. ✅ FR-006.

### C. Refresh (US1 · FR-001)

1. Click **Refresh**. Refresh shows busy; every other control described in
   Scenario A locks the same way. ✅

### D. Empty-list gating (US2 · FR-007/008/010 · SC-003)

1. Remove all observed directories (or start with none discovered) so the list
   is empty.
2. Expect **Pull all** and **Cleanup** rendered `.disabled` (not activatable);
   **Refresh** stays enabled. ✅ FR-007/008.
3. Configure a directory with repositories and Refresh → Pull all / Cleanup
   become enabled. ✅
4. Filter test (FR-010): with repositories present, click the **Failed** chip
   so zero rows are visible. Expect Pull all / Cleanup **remain enabled**
   (this empty-list gate is independent of, and unaffected by, the
   long-operation lock in Scenario A). ✅ SC-003.

### E. Recovery on failure / rejection (FR-006/013 · SC-004)

1. Force a failure path: point an observed repo at an unreachable remote (or
   temporarily rename `git` on PATH) and run Pull all / Refresh.
2. Expect the operation ends (bounded by the 60 s deadline or an immediate
   error) and **every** lock/dim fully releases — no lingering row dim,
   sort-header dim, or loader; no button/Settings/toggle/filter chip/row
   action left blocked — even though the operation failed. ✅ FR-006/FR-013.
3. Stronger check: if the underlying IPC call *rejects* rather than resolving
   with a failure result, the UI still fully restores. This is the regression
   the `finally` blocks guarantee, now covering more controls than before.

### F. No flicker on fast operations (FR-005 · SC-002)

1. With a tiny/fast repo set, click Refresh so it completes in well under
   150 ms.
2. Expect: **no** row-dim/sort-header-dim/loader flash — the visuals never
   paint for sub-150 ms operations. (Every functional lock — buttons,
   Settings, toggle, filter chips, sort activation, row actions — still
   applies immediately and clears on settlement regardless of duration; only
   the *dims and loader* follow the show-delay.) ✅
3. For an operation that crosses 150 ms, the dims + loader stay visible ≥
   400 ms even if work finishes at ~200 ms. ✅ INV-3.

### G. One operation at a time (FR-002 · SC-005)

1. Start Pull all; before it finishes, try to start Cleanup, Refresh, or a
   second Pull all (pointer and keyboard) — and also try Settings/toggle/
   filter/sort/row actions.
2. Expect no second operation starts and none of the other controls respond
   either. ✅

### H. Worktree-row dimming + inertness (FR-004 · Session 2026-07-19c/e)

1. With the Worktrees toggle **on** so nested worktree rows are visible, start
   any long operation.
2. Expect **both** repository rows and their nested worktree rows dim together
   to barely-visible, and both kinds of row are equally non-focusable/inert
   for the duration. ✅

### I. Cursor-only controls never change colour (FR-003/015/016 · SC-002)

1. Start any long operation and, while it runs, hover (without clicking) each
   of: the two non-running action buttons, Settings, the Worktrees toggle,
   every filter chip, and a row's delete/launch buttons.
2. Expect: for every one of these, the cursor shows as inactive
   (`not-allowed`) and **no border, background, text colour, or opacity
   changes** compared to their normal idle appearance. Only the table rows
   and the sort-header row are allowed to visually dim.

## Pass criteria

All scenarios A–I behave as described, and `pnpm test` passes. Cross-reference
Success Criteria SC-001…SC-005 in `spec.md`. Special attention to SC-001/SC-002
(everything that operates on repositories blocks; only rows and the sort
header ever change appearance) — the defining behavior of this revision.
