# Feature Specification: Delete Repository Row

**Feature Branch**: `004-delete-repository-row`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Add icon delete. It's always on the right side. Can be removed or edited. Always ask for confirmation. For worktree it remove worktree. If directory is dirty ask user second time to make him aware that some work haven't been commited and will be lost. If repo was not synchronised with remote or remote is not defined, second confirmation is required too that action is destructive, can't be reversed. Use system trash if this is possible. User could be asked max twice: 1. confirm deletion 2. confirm that action is destructive. Preferred icon looks like 'x'"

## Clarifications

### Session 2026-07-17

- Q: When determining if a repository is "at risk" (to decide whether the
  second, destructive-action warning is shown), should the check use the
  row's last-known scanned/refreshed state, or fully re-verify live at the
  moment of deletion, including checking the remote? → A: Fully re-verify
  everything live at delete-time, including checking against the remote —
  the dirty check and the remote-sync check are both freshly determined when
  delete is clicked, not read from the last scan/refresh.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove a clean, disposable repository row (Priority: P1)

A user viewing the dashboard wants to stop tracking a repository they no longer
need on disk. They click a delete ("x") icon that is always visible on the
right side of that row, confirm they want to delete it once, and the
repository is removed from disk and from the dashboard.

**Why this priority**: This is the core capability — without it there is no
delete feature at all. A repository with no uncommitted work and no
unique/unpushed history is the lowest-risk case and defines the baseline flow
(single confirmation) that every other case builds on.

**Independent Test**: With a repository row that is clean (no uncommitted
changes) and fully pushed to a remote, click its delete icon, confirm once,
and verify the directory is gone from disk and the row disappears from the
dashboard.

**Acceptance Scenarios**:

1. **Given** a repository row is displayed, **When** the user looks at the
   row, **Then** a delete ("x") icon is visible on the right side of the row
   regardless of hover or selection state.
2. **Given** the user clicks the delete icon on a clean, fully-synced
   repository row, **When** a confirmation dialog appears and the user
   confirms, **Then** the repository directory is deleted and the row is
   removed from the dashboard without any further prompt.
3. **Given** the confirmation dialog is shown, **When** the user cancels or
   dismisses it, **Then** nothing is deleted and the row remains unchanged.

---

### User Story 2 - Warn before losing uncommitted work or unrecoverable history (Priority: P1)

A user clicks delete on a repository that has uncommitted changes, or that has
no remote (or has commits not pushed to its remote). Because deleting it would
permanently destroy work that exists nowhere else, the user is warned a second
time, in terms specific to what is at risk, before the deletion proceeds.

**Why this priority**: This is the safety mechanism the whole feature exists
to provide — without it, delete is a silent data-loss trap. It is as critical
as the baseline delete flow itself.

**Independent Test**: With a repository row that has uncommitted changes (or
is unpushed / has no remote), click delete, confirm the first ("delete this?")
prompt, and verify a second prompt appears explicitly warning the action is
destructive and irreversible before any deletion happens.

**Acceptance Scenarios**:

1. **Given** a repository row has uncommitted changes, **When** the user
   confirms the first delete prompt, **Then** a second confirmation appears
   warning that uncommitted work will be lost and the action cannot be
   undone.
2. **Given** a repository row has no remote configured, or has commits not
   pushed to its remote, **When** the user confirms the first delete prompt,
   **Then** a second confirmation appears warning that the action is
   destructive and cannot be reversed.
3. **Given** the second confirmation is shown, **When** the user cancels it,
   **Then** nothing is deleted and the row remains unchanged.
4. **Given** a repository is both dirty and unsynced/remote-less, **When** the
   user confirms the first prompt, **Then** exactly one second confirmation
   appears (combining both warnings) — the user is never asked more than
   twice in total.

---

### User Story 3 - Deleting a worktree row cleanly removes the worktree (Priority: P2)

A user clicks delete on a row that represents a git worktree — either a linked
checkout nested under its primary repository's row, or an orphan worktree
whose primary repository isn't itself observed by the dashboard. Because a
worktree is registered against its family's repository regardless of which
kind it is, deleting it must properly deregister it rather than merely
deleting its folder, so that repository is left in a consistent state.

**Why this priority**: Worktrees are a first-class concept in this dashboard
(the app itself manages feature worktrees), so deletion must not corrupt the
parent repository's worktree bookkeeping. It is a refinement of US1/US2's flow
for one row type, not a separate feature, hence P2.

**Independent Test**: With a row that is a linked git worktree, click delete
and confirm, then verify the worktree is properly removed (not just its
folder deleted) and the parent repository no longer lists it as a worktree.

**Acceptance Scenarios**:

1. **Given** a row represents a linked git worktree, **When** the user
   confirms its deletion (after any required warnings from US2), **Then** the
   worktree is removed via a proper worktree-removal operation and the parent
   repository no longer references it.
2. **Given** a worktree row is dirty or unsynced, **When** deletion is
   confirmed, **Then** the same second-warning rule from US2 applies before
   the worktree is removed.

---

### Edge Cases

- **Trash unavailable**: If the platform or the directory's location does not
  support moving to the system trash, the system MUST fall back to permanent
  deletion rather than blocking the action or introducing a third prompt.
- **Live risk check cannot complete**: If the fresh check against the remote
  cannot complete (remote unreachable, network unavailable, authentication
  failure, timeout), the system MUST treat the repository as "at risk" and
  show the second, destructive-action confirmation rather than silently
  treating it as safe. The check MUST NOT block the UI indefinitely — it
  MUST resolve (success or failure) within a bounded time.
- **Directory already gone**: If the target directory no longer exists on disk
  when deletion is attempted (e.g., removed externally in the meantime), the
  system MUST treat this as a successful removal (clean up the row/state) and
  MUST NOT show a confusing failure.
- **Deletion fails mid-operation**: If the delete/trash/worktree-remove
  operation fails (e.g., permissions, file in use), the system MUST show an
  error and MUST leave the row in place rather than removing it from the
  dashboard while files still exist.
- **Row disappears during confirmation**: If the underlying directory changes
  or disappears while a confirmation dialog is open (e.g., a background
  refresh runs), the system MUST re-validate before deleting rather than
  acting on stale information.
- **Worktree is the main checkout**: A row that is a repository's primary
  checkout (not a linked worktree) MUST follow the plain-directory deletion
  path (US1/US2), not the worktree-removal path (US3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every repository row MUST display a delete icon (an "x") that is
  always visible on the right side of the row, independent of hover, focus, or
  selection state.
- **FR-002**: Clicking the delete icon MUST always show a confirmation prompt
  before any deletion occurs; deletion MUST NOT happen without at least one
  explicit confirmation.
- **FR-003**: The system MUST determine, before or immediately after the first
  confirmation, whether the repository is "at risk": it has uncommitted
  changes (staged, unstaged, or untracked), OR it has no remote configured,
  OR its current branch has no upstream / has commits not pushed to its
  remote. This determination MUST be freshly verified at the moment of
  deletion — including a live check against the remote — rather than reusing
  the row's last-scanned or last-refreshed state.
- **FR-004**: If the repository is "at risk" (per FR-003), the system MUST
  show a second confirmation, distinct from the first, that explicitly states
  the action is destructive and cannot be reversed, before proceeding.
- **FR-004a**: If the live check against the remote cannot complete (network
  unavailable, remote unreachable, authentication failure, or timeout), the
  system MUST treat the repository as "at risk" and show the second
  confirmation rather than assuming it is safe; the check MUST resolve
  within a bounded time rather than blocking the UI indefinitely.
- **FR-005**: The user MUST NEVER be shown more than two confirmation prompts
  for a single delete action, regardless of how many risk conditions apply
  (uncommitted changes and unsynced/no-remote together still yield exactly one
  second prompt).
- **FR-006**: If the user cancels or dismisses either confirmation prompt, the
  system MUST NOT delete anything and MUST leave the row and its directory
  unchanged.
- **FR-007**: When the confirmed row is a git worktree — whether a linked
  worktree (nested under its primary repository) or an orphan worktree (its
  primary repository is not itself observed by the dashboard) — the system
  MUST remove it via a worktree-removal operation that also updates its
  family's worktree records, rather than deleting the folder directly. Both
  are worktrees with the same `.git/worktrees` registration to clean up; only
  a repository's own primary checkout follows the plain-directory path.
- **FR-008**: When the confirmed row is not a linked worktree (a plain
  directory or a repository's primary checkout), the system MUST delete the
  directory using the operating system's trash/recycle bin when that
  capability is available.
- **FR-009**: When moving to the system trash is not available, the system
  MUST fall back to permanent deletion of the directory rather than failing
  the action or prompting a third time.
- **FR-010**: On successful deletion, the system MUST remove the row from the
  dashboard and stop tracking that directory without requiring further user
  action.
- **FR-011**: If deletion fails, the system MUST surface an error to the user
  and MUST keep the row visible on the dashboard.

### Key Entities

- **Delete risk assessment**: A per-row, point-in-time judgment made fresh
  each time delete is initiated (never reused from the last scan/refresh),
  combining three live checks — uncommitted changes present, no remote
  configured, unpushed commits present (including an inability to verify
  against the remote) — collapsed into a single boolean ("at risk" vs.
  "safe") that decides whether a second confirmation is shown. It is not
  persisted.
- **Row deletion path**: The two mutually exclusive ways a confirmed deletion
  is carried out — worktree removal (for linked worktree rows) or directory
  deletion via system trash with permanent-delete fallback (for all other
  rows).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every repository row shows a visible delete icon on its right
  side at all times, verifiable without hovering or interacting with the row.
- **SC-002**: 100% of delete actions on clean, fully-synced repositories
  complete after exactly one confirmation.
- **SC-003**: 100% of delete actions on a repository with uncommitted changes,
  no remote, or unpushed commits require exactly one additional confirmation
  (two total) before anything is deleted, and never more than two.
- **SC-004**: 100% of cancelled confirmations (first or second) result in zero
  filesystem changes and zero change to the dashboard.
- **SC-005**: 100% of deletions of linked worktree rows leave the parent
  repository's worktree list free of the deleted entry (no orphaned
  registration).
- **SC-006**: 100% of successful deletions result in the directory no longer
  present at its original path and the row no longer present on the
  dashboard.
- **SC-007**: When the system trash is available, 100% of non-worktree
  deletions are recoverable from it immediately after the action.

## Assumptions

- "Removed" in the source request refers to this new delete capability, and
  "edited" refers to the row's already-existing, separate ability to have its
  custom actions configured (see 002-custom-action-launchers) — editing is
  out of scope for this feature.
- The delete icon is additive to the existing per-row action affordances and
  does not replace or relocate them.
- "Dirty" means the repository has any uncommitted changes: staged, unstaged,
  or untracked files.
- "Not synchronised with remote" means either the current branch has no
  upstream or has commits that have not been pushed to it, or the repository
  has no remote configured at all (and therefore nothing to lose is
  inherently unrecoverable off-machine).
- The live remote check performed at delete-time is git itself contacting the
  repository's own already-configured remote (e.g., a fetch), which is
  explicit, user-triggered, read-only activity — consistent with the app's
  existing allowance for git to talk to configured remotes, not a new class
  of automatic network activity.
- Deletion targets the actual directory on disk, not merely the app's
  observed-directories list — this is a genuinely destructive, filesystem-
  level action, consistent with the request's emphasis on irreversibility and
  trash usage.
- "System trash" refers to the OS-level trash/recycle bin; availability may
  vary by platform and by whether the directory resides on a volume that
  supports it.
- The two-confirmation cap is a hard ceiling: the two risk conditions (dirty,
  unsynced/no-remote) are evaluated together and reported in a single second
  prompt, never as separate sequential prompts.
