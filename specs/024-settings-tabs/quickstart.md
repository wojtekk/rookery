# Quickstart / Validation: Tabbed Settings Window

Manual validation guide. See `spec.md` for requirement IDs and `research.md`
for the design decisions behind each mechanism. No new pure/branching logic
is introduced (see `plan.md` Constitution Check), so there is no new
automated test file — validation is entirely manual, against the running
app.

## Prerequisites

- `nvm use` (Node 24, per `.nvmrc`).
- At least one observed directory and at least one configured action, so
  both tabs have non-empty content to inspect.
- A way to inspect the accessibility tree (e.g. the Electron DevTools
  Accessibility pane) for scenario F.

## Build & run

```bash
pnpm run build      # tsc (main) + tsc (renderer) + copy assets
pnpm start           # build + electron .
pnpm test            # existing suite must still pass unchanged (no new tests added)
```

## Scenarios

### A. Default tab on open (US1 Acceptance Scenario 1 · FR-004)

1. Open Settings.
2. Expect: the "Directories" tab is visually active and its content (the
   observed-directory list) is the only settings group visible; "Actions"
   content is not visible. ✅ SC-001.

### B. Switch to Actions and back (US1 Acceptance Scenarios 2–3 · FR-005, FR-006)

1. With Settings open, click the "Actions" tab.
2. Expect: the action-launcher list/form replaces the directory list; the
   "Actions" tab is now visually distinguishable as active, "Directories" is
   not.
3. Click "Directories" again.
4. Expect: the directory list reappears, Actions content hides. ✅ SC-001,
   SC-002.

### C. Every existing control still works inside its tab (US2 · FR-002, FR-003)

1. On the Directories tab: add a directory, then remove it. Expect
   identical behavior/persistence to before this feature.
2. On the Actions tab: add an action, edit it, reorder it (up/down), then
   remove it. Expect identical behavior/persistence to before this feature.
   ✅ SC-003.

### D. Window chrome unaffected regardless of active tab (US2 Acceptance Scenario 3 · FR-007, FR-011)

1. On each tab in turn, confirm the header row shows only the "Settings"
   title and the ✕ close button — no other control appears there regardless
   of which tab is active.
2. On each tab in turn, close the window via the ✕, via a backdrop click,
   and via "Done".
3. Expect: all three close paths work identically on both tabs, and any
   pending re-scan behavior (from directory/action changes made during that
   session) is unchanged from before this feature. ✅ SC-004.

### E. In-progress Actions form survives a tab round-trip (Edge Case · FR-012)

1. Open Settings, go to the Actions tab.
2. Start adding a new action: type a name and a command, pick a non-default
   icon — do **not** submit.
3. Click the Directories tab, then click back to Actions.
4. Expect: the name, command, and icon selection you typed are all still
   present exactly as left (add-mode, not reset). Repeat starting from
   **Edit** on an existing action instead of Add — expect the same
   preservation, still in edit mode (not reverted to add mode).
5. Close and reopen Settings. Expect: the form is back to its normal blank,
   add-mode default — preservation does **not** survive a close/reopen.

### F. Keyboard and assistive-technology access (Edge Case · FR-008, FR-009)

1. Tab (keyboard) into the Settings modal until focus reaches the tab
   strip; confirm both tab buttons are reachable and each can be activated
   with Enter/Space.
2. Confirm keyboard focus can still reach every control inside whichever
   tab is currently active (directory add button / action form fields).
3. Using the DevTools Accessibility pane, confirm each tab button reports
   `role="tab"` with `aria-selected` matching the visibly active tab, and
   each panel reports `role="tabpanel"` labelled by its tab.

### G. Empty states are unaffected and tab-independent (Edge Case)

1. With zero observed directories, open Settings on the Directories tab.
   Expect the existing "No directories observed yet." message, unaffected
   by tabbing.
2. With zero configured actions, switch to the Actions tab. Expect the
   existing "No actions…" empty message, unaffected by tabbing to
   Directories and back.
