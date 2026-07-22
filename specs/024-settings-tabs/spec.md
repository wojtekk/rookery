# Feature Specification: Tabbed Settings Window

**Feature Branch**: `024-settings-tabs`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "use tabs in settings windows to make settings organised, easy to use. First tab for directories second for buttons configuration"

## Clarifications

### Session 2026-07-22

- Q: Where should the two-tab strip (Directories / Actions) render within the Settings window? → A: Inside the modal body, below the "Settings" header and above the panels (header row keeps title + close only).
- Q: When the user is mid-edit in the Actions add/edit form, switches to the Directories tab, then returns to Actions — should the half-typed form be kept? → A: Preserve the in-progress input (name, command, icon, and edit-vs-add mode) across tab switches while the window stays open.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch between Directories and Actions with tabs (Priority: P1)

A user opens Settings and sees the configuration split into two clearly labelled
tabs. The first tab, "Directories", is shown by default and holds the observed-
directory list (add/remove). The second tab, "Actions", holds the per-row action
launcher configuration (add/edit/remove/reorder). Clicking a tab reveals that
tab's content and hides the other's, so the user only ever sees one group of
settings at a time.

**Why this priority**: This is the whole feature — organising the two existing
settings groups into tabs. Without it, nothing changes. It is independently
valuable and shippable on its own.

**Independent Test**: Open Settings; confirm the "Directories" tab is active and
its content visible while the "Actions" content is hidden; click "Actions" and
confirm the panels swap; click "Directories" again and confirm they swap back.

**Acceptance Scenarios**:

1. **Given** the Settings window is opened, **When** it first appears, **Then**
   the "Directories" tab is active and the observed-directory list is the only
   settings group visible.
2. **Given** the "Directories" tab is active, **When** the user clicks the
   "Actions" tab, **Then** the action-launcher configuration becomes visible and
   the directory list is hidden.
3. **Given** the "Actions" tab is active, **When** the user clicks the
   "Directories" tab, **Then** the directory list becomes visible and the action
   configuration is hidden.

---

### User Story 2 - Every existing setting still works inside its tab (Priority: P1)

All controls that exist today keep working exactly as before, now located inside
their respective tab: adding/removing observed directories on the Directories
tab, and adding/editing/removing/reordering action launchers on the Actions tab.

**Why this priority**: A reorganisation that breaks any existing control is a
regression, not an improvement. Preserving current behaviour is as critical as
the tabs themselves.

**Independent Test**: On the Directories tab, add and then remove a directory. On
the Actions tab, add, edit, reorder, and remove an action. Confirm each behaves
as it did before this feature.

**Acceptance Scenarios**:

1. **Given** the Directories tab is active, **When** the user adds or removes an
   observed directory, **Then** the directory list updates and the change is
   persisted, exactly as before this feature.
2. **Given** the Actions tab is active, **When** the user adds, edits, reorders,
   or removes an action, **Then** the action list updates and is persisted,
   exactly as before this feature.
3. **Given** either tab is active, **When** the user closes the window (X,
   backdrop click, or Done), **Then** the window closes and any pending re-scan
   behaviour occurs exactly as before this feature.

---

### Edge Cases

- **Empty states**: When no directories are observed, the Directories tab still
  shows its existing "No directories observed yet." message. When no actions are
  configured, the Actions tab still shows its existing "No actions…" message.
  Empty state on one tab MUST NOT affect the other or hide either tab.
- **Tab state on reopen**: Closing and reopening Settings returns to the default
  ("Directories") tab; the previously active tab is not remembered (see
  Assumptions).
- **In-progress action edit when switching away**: If the user is mid-edit in the
  Actions form and switches to the Directories tab and back, the half-typed input
  (name, command, chosen icon, and whether it is an add or an edit) is preserved,
  not reset — for as long as the Settings window stays open (see FR-011).
- **Keyboard access**: A user navigating by keyboard can move focus to a tab and
  activate it, and can reach every control within the active tab.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings window MUST present its configuration as two selectable
  tabs: "Directories" (first) and "Actions" (second).
- **FR-002**: The "Directories" tab MUST contain the observed-directory settings
  currently shown in Settings (list, add, remove), with no change to their
  behaviour.
- **FR-003**: The "Actions" tab MUST contain the action-launcher settings
  currently shown in Settings (list, add, edit, remove, reorder), with no change
  to their behaviour.
- **FR-004**: When the Settings window opens, the "Directories" tab MUST be the
  active tab.
- **FR-005**: Exactly one tab's content MUST be visible at a time; selecting a tab
  MUST show that tab's content and hide the other tab's content.
- **FR-006**: The currently active tab MUST be visually distinguishable from the
  inactive tab.
- **FR-007**: The window's title/header ("Settings"), close affordance (X),
  backdrop-click-to-close, and "Done" button MUST remain available regardless of
  which tab is active, behaving exactly as before this feature.
- **FR-008**: Tabs MUST be operable by keyboard (focusable and activatable), and
  the active tab's controls MUST remain reachable by keyboard.
- **FR-009**: Assistive technology MUST be able to identify the tabs, which tab is
  selected, and the content region each tab controls.
- **FR-010**: The feature MUST NOT add, remove, or alter any persisted setting,
  and MUST NOT change what a re-scan does or when it happens — it only changes how
  the existing settings are laid out.
- **FR-011**: The tab strip MUST render inside the modal body, below the "Settings"
  header and above the tab-panel content; the header row MUST continue to show only
  the "Settings" title and the close (X) affordance.
- **FR-012**: While the Settings window remains open, switching away from the
  Actions tab and back MUST preserve any in-progress action-form input — the typed
  name, the typed command, the selected icon, and whether the form is adding a new
  action or editing an existing one. (Closing and reopening the window still starts
  fresh; this preservation applies only across tab switches within one open
  session.)

### Key Entities

*Not applicable — this feature introduces no new data. It reorganises the
presentation of two existing settings groups (observed directories and action
launchers), which are unchanged.*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When Settings is opened, only one of the two settings groups
  (directories or actions) is visible at any time — never both, never neither.
- **SC-002**: A user can reach either settings group with a single tab click from
  the other.
- **SC-003**: 100% of the settings controls available before this feature remain
  available and functional after it (directory add/remove; action
  add/edit/remove/reorder; close via X/backdrop/Done).
- **SC-004**: No persisted configuration value, IPC message, or re-scan trigger
  differs before versus after this change (verified by comparing behaviour, not
  just visuals).

## Assumptions

- **Default tab**: The window opens on the "Directories" tab every time, matching
  the user's stated ordering ("First tab for directories"). The last-viewed tab is
  not remembered across opens — chosen for simplicity and because the modal is
  transient, renderer-only UI with no persisted view state today.
- **"Buttons configuration" = Actions**: The user's phrase "buttons
  configuration" refers to the existing per-row action launchers (the ⋮-menu
  action items), which are the only button-like, user-configurable controls in
  Settings. No new kind of button configuration is introduced.
- **Two tabs only**: The feature covers exactly the two settings groups that exist
  today (directories, actions). No third tab or new settings category is added.
- **In-progress action form preserved across tab switches**: Switching away from
  the Actions tab and back keeps any half-filled add/edit form intact for the life
  of the open window (clarified 2026-07-22, FR-012). This intentionally goes beyond
  the existing behaviour where the action form is transient DOM state cleared on
  every real re-render; a tab switch specifically must not clear it. Preservation
  does not survive closing and reopening the window.
- **Renderer-only, no scope creep**: This is a presentation reorganisation. No new
  IPC, main-process behaviour, dependency, or persisted setting is introduced, and
  the observed-directory and action-launcher logic themselves are untouched.
- **Existing empty-state and error messages are reused as-is** within their new
  tab locations (e.g., the directory-add error text, the "Limit reached" action
  message).
