# Feature Specification: Fix Row Directory Tooltip Clipping

**Feature Branch**: `020-fix-row-tooltip-clip`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "tooltip with directory is hidden when last visible in table row is selected. Calculate position in similar way to duplication tooltip - it works well"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the directory tooltip on any visible row (Priority: P1)

A user hovers over a repository row's name area to see its full directory
path in a tooltip. Today, when that row sits at or near the bottom edge of
the visible table area (because the table is scrolled or the window is
short), the tooltip renders downward and is clipped/hidden by the table's
edge — the exact information the user was trying to read becomes
inaccessible.

**Why this priority**: This is the entire reported bug. Without this fix,
the directory tooltip is unusable for whichever row happens to be last
visible, which is a common, easily-hit state (any scrolled list or any
window shorter than the full repository list).

**Independent Test**: Scroll the repository table (or shrink the window)
until a row's bottom edge is close to the bottom of the visible list, hover
that row's name area, and confirm the directory-path tooltip is fully
visible instead of cut off.

**Acceptance Scenarios**:

1. **Given** the table is scrolled or the window is short enough that a
   row's bottom edge is near the bottom of the visible list, **When** the
   user hovers over that row's name area, **Then** the directory-path
   tooltip renders fully visible above the row instead of being clipped
   below it.
2. **Given** a row that has ample space below it in the visible list,
   **When** the user hovers over that row's name area, **Then** the
   directory-path tooltip continues to render below the row exactly as it
   does today (no regression to the common case).
3. **Given** a nested worktree row (not just a top-level repository row) at
   the bottom edge of the visible list, **When** the user hovers over its
   name area, **Then** its directory-path tooltip also flips above the row
   instead of clipping.

---

### Edge Cases

- What happens when the window is resized or the table is scrolled while a
  directory tooltip is already showing? The flip decision is recalculated
  the next time the row is hovered, matching how the existing row-icon
  tooltips (delete, custom action, warning, duplicate) already behave —
  this feature does not need to track a tooltip that's already open through
  a live resize/scroll.
- What happens for a row near the bottom-right corner of the table, where
  clipping could theoretically happen sideways as well as vertically?
  Out of scope — the reported bug and its screenshot show only vertical
  clipping, so this fix addresses the vertical (above/below) placement
  only, matching the scope of the existing duplicate-icon tooltip fix this
  feature is modeled on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST determine, at the time a row's directory-path
  tooltip is about to be shown, whether there is enough room below the row
  to render the tooltip fully within the currently visible table area.
- **FR-002**: When there is not enough room below, the system MUST render
  the directory-path tooltip above the row instead, fully within the
  visible table area.
- **FR-003**: When there is enough room below, the system MUST continue
  rendering the directory-path tooltip below the row, unchanged from
  current behavior.
- **FR-004**: This behavior MUST apply to both top-level repository rows
  and nested worktree rows, since both show a directory-path tooltip on
  hover.
- **FR-005**: The tooltip's above/below placement MUST be evaluated fresh
  each time the row is hovered, so it reflects the table's actual scroll
  position at that moment rather than a fixed, precomputed position.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hovering the directory-path tooltip on any row — including
  whichever row is currently last visible in a scrolled or short table —
  always shows the full tooltip text somewhere within the visible area,
  never clipped or hidden.
- **SC-002**: A user can read a row's full directory path without first
  needing to scroll the table or resize the window.
- **SC-003**: Rows that already had enough space below them show no visible
  change in tooltip placement compared to today.

## Assumptions

- The upward-flip mechanism already used for this app's row-icon tooltips
  (delete, custom launch actions, update warnings, and the duplicate-clone
  indicator) is the correct behavior to extend to the directory-path
  tooltip — the user has confirmed it "works well" for the duplicate
  tooltip and asked for the same approach here, rather than a new
  positioning design.
- This is a visual/positioning fix only: the directory-path tooltip's
  content (the full path) and the action that reveals it (hover) are
  unchanged.
