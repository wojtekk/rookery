# Feature Specification: Local-Only Branch Filter

**Feature Branch**: `026-local-only-filter`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Add missing filter: local only"

## Clarifications

### Session 2026-07-22

- Q: What exact label should the new filter chip display? → A: `local-only` — matches the existing branch-tag text verbatim (FR-001)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Isolate branches that were never pushed (Priority: P1)

As someone managing many repositories, I want to filter the fleet down to only the working trees whose current branch has never been pushed to a remote, so I can review them and decide whether to push, rename, or delete each one.

**Why this priority**: This is the entire feature — a single new filter option alongside the existing ones (All, Clean, Uncommitted, Out of sync, Unavailable, Failed, Gone).

**Independent Test**: With a fleet containing a mix of tracked branches and branches with no upstream configured, selecting the new "local-only" filter shows exactly the working trees in the latter group and hides everything else; selecting "All" (or any other filter) brings the rest back.

**Acceptance Scenarios**:

1. **Given** a repository whose current branch has no upstream configured, **When** the user selects the "local-only" filter, **Then** that repository's row is shown.
2. **Given** a repository whose current branch is tracking a remote branch (whether up to date, ahead/behind, or with the remote branch deleted), **When** the user selects the "local-only" filter, **Then** that repository's row is hidden.
3. **Given** the "local-only" filter is active, **When** the user switches to a different filter (e.g. "All"), **Then** the full, unfiltered set of rows matching the new filter reappears.
4. **Given** a linked worktree (not the primary checkout) whose own current branch has no upstream configured, **When** the user selects the "local-only" filter, **Then** that worktree's row is shown even if its primary repository's branch is tracked.

### Edge Cases

- A working tree in a detached-HEAD state has no current branch, so it never matches "local-only" (there is no branch to lack an upstream).
- An unavailable working tree (its directory is missing) has no readable branch state, so it never matches "local-only".
- A repository whose branch is tracked but whose remote branch was deleted ("gone") is a distinct, pre-existing case and must not match "local-only".
- The filter must combine with the existing search box and the worktree-visibility toggle exactly as every other filter chip already does: a family is shown if it or any visible member matches, and only matching worktrees are shown beneath it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer a new "local-only" filter option alongside the existing filter chips (All, Clean, Uncommitted, Out of sync, Unavailable, Failed, Gone).
- **FR-002**: Selecting the "local-only" filter MUST show only working trees (repositories and their worktrees) whose current branch has no upstream tracking configured, and hide all others.
- **FR-003**: The "local-only" filter chip MUST display a live count of matching working trees across the whole fleet, independent of which filter is currently active, matching the behavior of the existing chips.
- **FR-004**: The "local-only" filter MUST compose with the search box and the worktree-visibility toggle the same way every existing filter does.
- **FR-005**: The "local-only" filter chip MUST become non-interactive (without any color change) while a long-running operation (Refresh, Pull all, Cleanup, Rebase worktrees) is in progress, matching every other filter chip.
- **FR-006**: Working trees with a detached HEAD or an unavailable directory MUST NOT be counted or matched by the "local-only" filter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can isolate every branch in their fleet that has never been pushed to a remote in a single click, with zero false positives or omissions.
- **SC-002**: The "local-only" chip's count always equals the number of rows the filter would display, before and after applying it.

## Assumptions

- "local-only" means the current branch has no upstream/remote-tracking branch configured at all — distinct from "gone", which is a previously tracked branch whose remote counterpart has since been deleted.
- The filter is evaluated per working tree (repository or worktree), not per repository family, consistent with how "gone" already works.
- No new data needs to be collected: whether a branch has no upstream is already determined during the existing repository scan.
