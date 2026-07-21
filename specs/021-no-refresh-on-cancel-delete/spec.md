# Feature Specification: Skip Refresh When a Delete Is Cancelled

**Feature Branch**: `021-no-refresh-on-cancel-delete`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "when I click refresh button should and then cancel deletion, refresh function (to reload all repos from disk) should not be triggered"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancel a delete without triggering a refresh (Priority: P1)

A user clicks a row's delete icon, sees the native confirmation dialog, and
clicks Cancel because they changed their mind. Today, the app still
refreshes — reloads the entire repository list from disk — afterward, the
same full rescan and brief UI lock/dim that a real delete or an explicit
Refresh click causes, even though nothing on disk changed. ("Refresh" and
"reload the repository list from disk" refer to the same operation
throughout this document.)

**Why this priority**: This is the entire reported bug. A no-op action
(declining to delete) should not cause visible, unnecessary work.

**Independent Test**: Click a row's delete icon, click Cancel on the
confirmation dialog, and confirm the table does not refresh/lock — the row
list stays exactly as it was, with no rescan.

**Acceptance Scenarios**:

1. **Given** a repository row, **When** the user clicks its delete icon and
   then clicks Cancel on the confirmation dialog, **Then** the repository
   list is not refreshed and the table does not lock/dim.
2. **Given** a row whose delete requires the second, risk-warning
   confirmation (e.g. it has uncommitted changes or no remote), **When** the
   user clicks Cancel on that second dialog, **Then** the repository list is
   likewise not refreshed.
3. **Given** a repository row, **When** the user confirms the delete and it
   completes successfully, **Then** the repository list is refreshed
   exactly as it is today, so the deleted row disappears from view.

---

### Edge Cases

- What happens when the delete fails for a reason other than cancellation
  (e.g. the directory can't be removed)? Out of scope — the user only
  reported the cancel case, and today's refresh-on-failure behavior is left
  unchanged (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT refresh (reload the repository list from
  disk) when a user cancels a delete at any confirmation step.
- **FR-002**: As a direct consequence of FR-001, the table MUST NOT lock or
  dim when a delete is cancelled — that lock/dim only ever occurs as part
  of a refresh, so skipping the refresh skips it too.
- **FR-003**: The system MUST continue to refresh after a delete that
  actually completes, unchanged from current behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cancelling a delete confirmation never causes the repository
  list to refresh or the table to lock/dim.
- **SC-002**: A completed deletion continues to remove the deleted row from
  view exactly as it does today (no regression).

## Assumptions

- A failed deletion (as opposed to a cancelled one) is out of scope for this
  fix — the user's report names only the cancel case, so today's behavior of
  refreshing after a failed delete is left unchanged.
- "Refresh" refers to the existing full rescan (reload of the repository
  list from disk) triggered after a delete completes, not any other data
  the app tracks.
