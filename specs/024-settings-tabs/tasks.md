---

description: "Task list for Tabbed Settings Window"
---

# Tasks: Tabbed Settings Window

**Input**: Design documents from `/specs/024-settings-tabs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-tabs.md, quickstart.md

**Tests**: Not requested — plan.md's Constitution Check confirms no new pure/branching
logic is introduced (DOM-attribute toggling only), matching features 017/018's
precedent. Verification is entirely manual, via `quickstart.md`, and is tracked
as tasks within each user story below.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
verification of each. Both stories are P1 and touch the same two files
(`src/renderer/view/settings.ts`, `src/renderer/styles.css`) — no test files,
no new files, per plan.md's Structure Decision.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Phase 1: Setup

No tasks — no new dependency, project structure, or config is introduced
(plan.md Technical Context: "zero runtime dependencies added"). Skipped.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The tab-panel DOM shape and styling both user stories render into.

**⚠️ CRITICAL**: Must complete before either user story's tasks.

- [X] T001 [P] Add `.tab-strip`, `.tab-btn`, `.tab-btn.active` rules to
  `src/renderer/styles.css` (near the existing `.settings-section` rules,
  ~line 1120), per `contracts/settings-tabs.md`'s DOM shape — active tab
  visually distinguishable per FR-006, no color/opacity dependency on any
  other feature's lockout styling.
- [X] T002 Change `renderActionsSection`'s signature in
  `src/renderer/view/settings.ts` to return the `HTMLElement` it builds
  (add `: HTMLElement` return type and a final `return section;` — or
  equivalent existing root var); no change to its internal list/form/event
  logic (data-model.md).
- [X] T003 Add a module-level `let activeTab: 'directories' | 'actions' =
  'directories';` in `src/renderer/view/settings.ts` alongside the existing
  `isOpen`/`editingId`/`formIcon` vars, and reset it to `'directories'` at
  the top of `openSettingsModal()` (data-model.md, FR-004).

**Checkpoint**: CSS classes exist, `renderActionsSection` exposes its root
element, `activeTab` state exists and resets correctly on open.

---

## Phase 3: User Story 1 - Switch between Directories and Actions with tabs (Priority: P1) 🎯 MVP

**Goal**: A tab strip lets the user show exactly one of the two settings
groups at a time, defaulting to Directories.

**Independent Test**: Open Settings; confirm Directories is active and
visible, Actions hidden; click Actions, confirm panels swap; click
Directories again, confirm they swap back (spec.md US1).

### Implementation for User Story 1

- [X] T004 [US1] In `renderSettingsModal` (`src/renderer/view/settings.ts`),
  build the tab-strip block — `<div class="tab-strip" role="tablist"
  aria-label="Settings sections">` containing the two `<button type="button"
  role="tab">` elements (ids `tab-btn-directories`/`tab-btn-actions`,
  `aria-controls` pointing at the matching panel id, `aria-selected` and
  `.active` class reflecting the current `activeTab`) — inserted into
  `modalBody` below `.modal-head` and above the two panels, per
  `contracts/settings-tabs.md` (FR-001, FR-011).
- [X] T005 [US1] Attach `id="tab-directories"`, `role="tabpanel"`,
  `aria-labelledby="tab-btn-directories"` to the directories section element,
  and `id="tab-actions"`, `role="tabpanel"`, `aria-labelledby="tab-btn-actions"`
  to the element returned by `renderActionsSection` (T002) in
  `src/renderer/view/settings.ts`; set the `hidden` attribute on whichever
  panel doesn't match the current `activeTab` (FR-002, FR-003, FR-005).
- [X] T006 [US1] Wire a click handler on each tab button in
  `src/renderer/view/settings.ts` that sets `activeTab`, toggles `hidden` on
  the two panel elements and `aria-selected`/`.active` on the two buttons —
  no re-render, no removal/recreation of either panel, so in-progress Actions
  form state is never touched by the switch (FR-005, FR-006, FR-012 —
  preservation follows for free from this DOM-persistence approach per
  `research.md` Decision 1).
- [ ] T007 [US1] Run `quickstart.md` Scenario A — open Settings, confirm the
  "Directories" tab is active and its content is the only settings group
  visible (FR-004, SC-001).
- [ ] T008 [US1] Run `quickstart.md` Scenario B — click "Actions", confirm the
  panels swap and the active tab is visually distinguishable; click
  "Directories" again, confirm they swap back (FR-005, FR-006, SC-001, SC-002).

**Checkpoint**: Tabs render, default to Directories on open, and switching
shows/hides content correctly with correct ARIA state — spec.md US1's
acceptance scenarios all pass.

---

## Phase 4: User Story 2 - Every existing setting still works inside its tab (Priority: P1)

**Goal**: Confirm the reorganisation introduced no regression to any existing
directory or action control.

**Independent Test**: On Directories, add then remove a directory. On
Actions, add, edit, reorder, and remove an action. Confirm each behaves
exactly as before this feature (spec.md US2).

**No implementation tasks** — US1's tasks (T004–T006) only wrap existing
markup in tab-panel attributes and never touch directory/action list, form,
or IPC logic (contracts/settings-tabs.md's "Behavioral guarantees"). This
story is verification-only:

- [ ] T009 [US2] Run `quickstart.md` Scenario C — add/remove a directory on
  the Directories tab, then add/edit/reorder/remove an action on the Actions
  tab; confirm identical behavior and persistence to before this feature
  (FR-002, FR-003, SC-003).
- [ ] T010 [US2] Run `quickstart.md` Scenario D — confirm the header row
  shows only the "Settings" title and ✕ close button on both tabs (FR-011),
  then close the Settings window via ✕, backdrop click, and "Done" from each
  tab in turn; confirm all three close paths and any pending re-scan behave
  identically regardless of active tab (FR-007, SC-004).
- [ ] T011 [US2] Run `quickstart.md` Scenario E — start an Actions add (and
  separately an edit), switch to Directories and back, and confirm the typed
  name/command/icon and add-vs-edit mode are preserved; then close and reopen
  Settings and confirm the form resets to blank/add-mode (FR-012).

**Checkpoint**: All pre-existing controls verified unchanged; spec.md US2's
acceptance scenarios all pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T012 [P] Run `quickstart.md` Scenario F — keyboard-focus the tab strip,
  activate a tab with Enter/Space, confirm focus still reaches every control
  in the active tab, and confirm `role="tab"`/`aria-selected`/`role="tabpanel"`
  in the DevTools Accessibility pane (FR-008, FR-009).
- [ ] T013 [P] Run `quickstart.md` Scenario G — confirm empty-state messages
  on each tab are unaffected by switching tabs.
- [X] T014 Run `pnpm run build && pnpm test` from the repo root — confirm the
  build succeeds and all existing tests still pass unchanged (no new test
  file was added per plan.md's Constitution Check).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. Blocks
  Phase 3.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (needs the CSS classes,
  `activeTab` var, and `renderActionsSection`'s new return value).
- **User Story 2 (Phase 4)**: Depends on Phase 3 (verifies behavior of the
  tabs T004–T006 build) — not independently implementable since it has no
  code of its own, only verifies US1's output.
- **Polish (Phase 5)**: Depends on Phase 3 (Scenario F/G verify the same DOM
  T004–T006 produce) and, for T014, on all prior phases.

### Parallel Opportunities

- T001 (CSS) can run in parallel with T002/T003 (both in `settings.ts`, but
  T002 and T003 touch different, non-overlapping parts of the same file so
  are sequenced, not marked [P], to avoid edit conflicts in one file).
- T012 and T013 (both read-only manual checks) can run in parallel with each
  other.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T003).
2. Complete Phase 3: User Story 1 (T004–T008).
3. **STOP and VALIDATE**: T007/T008 already exercise spec.md US1's three
   acceptance scenarios — this alone is a demoable, shippable increment
   (SC-001, SC-002).

### Incremental Delivery

1. Foundational → Foundation ready.
2. User Story 1 → tabs switch, verified against Scenarios A/B → demo-ready MVP.
3. User Story 2 → regression-verify every existing control → ship.
4. Polish → keyboard/AT and empty-state verification, build/test confirmation.

## Format validation

All tasks above use `- [ ] T0NN [P?] [Story?] Description with file path` —
Setup/Foundational/Polish tasks carry no `[Story]` label; US1/US2 tasks carry
`[US1]`/`[US2]`; every task names its exact file path or, for verification
tasks, the exact `quickstart.md` scenario to run.
