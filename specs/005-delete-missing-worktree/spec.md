# Feature Specification: Delete a Worktree Whose Directory Is Already Missing

**Feature Branch**: `005-delete-missing-worktree`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "delete worktree should handle that case too" — referring to a worktree row whose directory no longer exists on disk (git still has it registered as a worktree of its family/primary repository, but the folder itself is gone), discovered while using the delete feature from 004-delete-repository-row.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deleting a worktree row with a missing directory actually cleans it up (Priority: P1)

A user sees a worktree row rendered as unavailable (its directory was deleted or moved outside the dashboard, but git's own bookkeeping still lists it as a worktree of its family repository). They click the row's delete icon expecting it to disappear for good. Today, the delete action reports success and the row vanishes momentarily, but git's worktree registration for it is never actually cleaned up, so the row silently comes back the next time the dashboard refreshes.

**Why this priority**: This is a correctness bug in already-shipped delete behavior, not a nice-to-have — the user is told an action succeeded when it did not fully complete, and the row's reappearance erodes trust in the delete feature entirely.

**Independent Test**: With a worktree registered against an observed repository whose directory has been deleted or moved outside the dashboard (so the row renders as unavailable), click its delete icon, confirm once, and verify that after a refresh the row does not reappear and the parent repository's worktree list no longer references it.

**Acceptance Scenarios**:

1. **Given** a worktree row whose directory does not exist on disk, **When** the user clicks delete and confirms once, **Then** the worktree is deregistered from its family repository (not merely reported as deleted), and it does not reappear on the next refresh.
2. **Given** a worktree row whose directory does not exist on disk, **When** the user confirms deletion, **Then** the system does not attempt to inspect the (nonexistent) directory for uncommitted changes or remote sync status, and does not show a second, "destructive action" confirmation on that basis — the directory already has nothing left to lose locally.
3. **Given** the worktree deregistration operation itself fails for a reason unrelated to the missing directory (e.g. the family repository's own git metadata is corrupted or unreadable), **When** deletion is attempted, **Then** the system surfaces an error and leaves the row in place rather than reporting success.

---

### Edge Cases

- **Directory vanishes before the click, not during confirmation**: This differs from 004's "Row disappears during confirmation" edge case, which covers a directory that exists at click-time and disappears mid-flow. Here the directory is already absent when the delete icon is clicked (the row was already rendering as unavailable) — the system MUST still complete the underlying worktree deregistration rather than short-circuiting to a reported success that leaves git's registration untouched.
- **Non-worktree row with a missing directory**: A plain repository/orphan-directory row whose path has already vanished has nothing to deregister — reporting success without further action (as already specified in 004) remains correct and is unaffected by this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the confirmed delete target is a worktree and its directory does not exist on disk, the system MUST still perform the worktree-removal/deregistration operation against the target's family repository, rather than reporting the deletion as successful without performing it.
- **FR-002**: When the confirmed delete target is a worktree and its directory does not exist on disk, the system MUST skip the live uncommitted-changes and remote-sync risk checks (they cannot be meaningfully performed against a nonexistent directory) and MUST proceed with exactly one confirmation, not two.
- **FR-003**: After a worktree row with a missing directory is deleted, the next refresh of the dashboard MUST NOT show that row again.
- **FR-004**: If the worktree-deregistration operation itself fails for a missing-directory target, the system MUST surface an error and MUST keep the row visible, consistent with 004's existing failure handling for non-missing targets.

### Key Entities

- **Missing-directory worktree target**: A delete target (per 004's `DeleteTarget`) that is a worktree whose path does not exist on disk at the moment deletion is confirmed. It follows the same worktree-removal path as any other worktree target, but bypasses the live risk-check step entirely rather than having that step fail and be silently swallowed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of deletions of a worktree row whose directory is already missing result in that worktree no longer being registered against its family repository.
- **SC-002**: 100% of such deletions require exactly one confirmation, never two.
- **SC-003**: 0% of deleted missing-directory worktree rows reappear on a subsequent refresh.

## Assumptions

- This feature amends the behavior of 004-delete-repository-row's delete flow for one specific target shape (a worktree whose directory is already missing); it does not change the flow for any other row type.
- "Family repository" refers to the primary repository whose `.git/worktrees` metadata registers the worktree, matching 004's existing terminology and its "own family's worktree records" wording in FR-007.
- Removing the registration for a worktree whose directory is already gone is not considered a "destructive, unrecoverable" action requiring a second confirmation, because there is no longer any local, on-disk work that this action could cause to be lost — the directory is already gone regardless of what this feature does.
