# Feature Specification: Filter Repositories Needing Attention

**Feature Branch**: `007-failed-repos-filter`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Ad part of this feature, add a filter failed to filter out repositories that require attention"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Narrow the list to repositories that need attention (Priority: P1)

As someone who just ran "Pull all" across many repositories, I want to select a
single filter that shows only the repositories that failed to update, so I can
work through each one that needs manual attention without scanning past every
repository that already succeeded.

**Why this priority**: This is the direct payoff of the existing failed-pull
visibility (light-red edge + warning glyph): without a fast way to isolate
failures, a user with dozens or hundreds of repositories must manually hunt for
the flagged rows, which doesn't scale as the list grows.

**Independent Test**: Can be fully tested by running "Pull all" against a set of
repositories where at least one fails (e.g., a diverged repository), then
selecting the new "Failed" filter and confirming only the failed repository (and
any other failed ones) remain visible.

**Acceptance Scenarios**:

1. **Given** a "Pull all" run has just completed with 2 failed repositories out
   of 20, **When** the user selects the "Failed" filter, **Then** only those 2
   repositories are shown in the list.
2. **Given** the "Failed" filter is selected and showing 2 repositories, **When**
   the user resolves one of them and a later "Pull all" run updates it
   successfully, **Then** that repository no longer appears in the Failed filter
   view.
3. **Given** no "Pull all" run has been performed yet, **When** the user looks at
   the filter bar, **Then** the Failed filter shows a count of 0.

---

### User Story 2 - See at a glance whether anything needs attention (Priority: P2)

As someone monitoring many repositories, I want to see how many currently need
attention just by glancing at the filter bar, without having to select the
filter, so I can confirm everything is fine (or isn't) at a glance.

**Why this priority**: Supports quick health-check scanning, matching the
existing always-visible counts for clean/uncommitted/out-of-sync/unavailable —
useful on its own, but secondary to actually being able to narrow the list
(P1).

**Independent Test**: Can be tested by running "Pull all" with a mix of outcomes
and confirming the failed count shown in the filter bar matches the actual
number of failed repositories, without selecting the filter.

**Acceptance Scenarios**:

1. **Given** a "Pull all" run completes with 3 failures, **When** the user views
   the filter bar without clicking anything, **Then** it shows a count of 3 next
   to the Failed option.
2. **Given** the Failed count is showing 3, **When** the user runs "Pull all"
   again and nothing fails this time, **Then** the Failed count updates to 0.

---

### Edge Cases

- What happens when the Failed filter is selected and the user starts a new
  "Pull all" run? The list may briefly show as empty while the run is in
  progress, since attention-status is reset at the start of each run and
  repopulated once the new run's results are in.
- What happens when a repository that needed attention is deleted from the
  dashboard? It disappears from every filter view, including Failed, the same
  as any other removed row.
- What happens when the repository needing attention is a worktree, and
  worktrees are currently hidden? The parent repository still surfaces in the
  Failed filter view, consistent with how the other filters already surface a
  family when a nested worktree matches.
- What happens when the Failed filter is selected but zero repositories
  currently need attention? The list shows empty, consistent with how the
  other filters behave when their count is zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to select a "Failed" filter option from the
  same filter control used for the existing states (All, Clean, Uncommitted,
  Out of sync, Unavailable).
- **FR-002**: When the Failed filter is selected, the system MUST show only the
  repositories (and their surfaced parent rows, per existing worktree-
  visibility rules) whose most recently attempted "Pull all" run did not
  complete successfully.
- **FR-003**: The filter bar MUST always display a live count of repositories
  currently needing attention, regardless of which filter is currently
  selected.
- **FR-004**: The Failed count and filter results MUST reflect only the most
  recent "Pull all" run — starting a new run MUST NOT retain a failure from a
  prior run once that repository is no longer failing.
- **FR-005**: Before any "Pull all" run has occurred, the Failed count MUST show
  zero and selecting the filter MUST show an empty list.
- **FR-006**: Selecting the Failed filter MUST be mutually exclusive with the
  existing state filters (one filter view active at a time), matching current
  filter behavior.
- **FR-007**: The Failed filter MUST respect the existing worktree-visibility
  toggle and family-surfacing rules already applied to the other filters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can narrow a full repository list down to exactly the
  repositories needing attention in a single click, regardless of how many
  repositories are in the list.
- **SC-002**: The needing-attention count shown in the filter bar is 100%
  consistent with the outcome of the most recent "Pull all" run — no
  repository is miscounted as needing attention, and none that needs attention
  is missed.
- **SC-003**: A user can confirm "nothing needs attention" in under 2 seconds
  by glancing at the filter bar, with no need to open or scroll the repository
  list.
- **SC-004**: The needing-attention count and filter results update to reflect
  a new "Pull all" run's outcome as soon as that run completes, with no stale
  data from a previous run.

## Assumptions

- "Filter failed" means narrowing the list down to only the repositories
  needing attention (not hiding/excluding them) — the more immediately useful
  reading for a monitoring dashboard, and consistent with the existing
  failed-pull highlighting's purpose.
- "Repositories that require attention" refers specifically to repositories
  whose most recent "Pull all" attempt failed (the state already tracked and
  visually flagged today), not a broader notion of attention such as dirty or
  out-of-sync repositories, which already have their own dedicated filters.
- The Failed filter is a new option within the existing single-select state
  filter control, not an independent, combinable checkbox — consistent with
  how the current filter bar works.
- This feature exposes the existing "did the last Pull all attempt fail"
  signal through a new filter; it does not change how or when that signal is
  computed or cleared.
