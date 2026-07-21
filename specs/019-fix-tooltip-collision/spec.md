# Feature Specification: Fix Duplicate-Indicator Tooltip Collision

**Feature Branch**: `019-fix-tooltip-collision`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "fix the discussed issue - tooltips collision"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See only the duplicate notice when hovering the duplicate icon (Priority: P1)

Today, hovering the duplicate-clone icon on a repository row shows two tooltips stacked on top of each other at once: the row's own directory-path tooltip and the duplicate icon's own "also cloned elsewhere" notice. The overlapping text is unreadable. A user hovering the duplicate icon should see exactly one tooltip — the duplicate notice — with no other tooltip competing for the same space.

**Why this priority**: This is the entire defect being fixed. Without it, the duplicate indicator added in a prior feature is unusable — its message can't be read.

**Independent Test**: On a row with the duplicate-clone icon visible (a row whose repository is cloned in more than one local directory), hover directly over the icon and confirm only the duplicate-notice tooltip renders — no second tooltip appears behind or alongside it.

**Acceptance Scenarios**:

1. **Given** a repository row that shows the duplicate-clone icon, **When** the user hovers directly over that icon, **Then** only the duplicate-clone notice tooltip is visible; the row's directory-path tooltip does not also appear.
2. **Given** the same row, **When** the user moves the pointer off the icon but stays over the row's name text, **Then** only the row's directory-path tooltip is visible, unchanged from today's behavior.

---

### User Story 2 - No regression for rows without a duplicate icon (Priority: P2)

Rows that aren't detected duplicates never had this problem — they only ever have the one directory-path tooltip. The fix must not touch that.

**Why this priority**: Confirms the fix is scoped precisely to the colliding pair and doesn't regress the far more common non-duplicate row.

**Independent Test**: Hover the name text of a row with no duplicate-clone icon and confirm the directory-path tooltip appears exactly as it does today, with no change in wording, timing, or position.

**Acceptance Scenarios**:

1. **Given** a repository row with no duplicate-clone icon, **When** the user hovers the row's name text, **Then** the directory-path tooltip appears exactly as before this fix.

---

### Edge Cases

- What happens when the pointer moves from directly over the duplicate icon to the surrounding name text without leaving the row? The duplicate notice disappears and the directory-path tooltip takes its place — tooltip visibility follows the pointer's exact position, it is never "sticky" to a previously hovered element.
- What happens to the other existing row icons (delete, update-warning, custom action launchers)? Unaffected — none of them are nested inside another tooltip-bearing element, so they never had this collision and this fix does not change their behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show at most one tooltip at a time anywhere within a repository row's name area (the directory-path text plus the duplicate-clone icon it contains).
- **FR-002**: When the user hovers the duplicate-clone icon specifically, the system MUST show the duplicate-clone notice and MUST NOT simultaneously show the row's directory-path tooltip.
- **FR-003**: When the user hovers the row's name text outside the duplicate-clone icon, the system MUST continue showing the row's directory-path tooltip exactly as it does today.
- **FR-004**: This fix MUST NOT change the wording, content, positioning direction, or styling of either tooltip — it only changes which one is visible at a given hover position.
- **FR-005**: This fix MUST NOT alter the tooltip behavior of any other row icon (delete, update-warning, custom action launchers).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hovering the duplicate-clone icon shows exactly one tooltip, with no overlapping or double-rendered text, on 100% of duplicate rows.
- **SC-002**: Hovering a row's name text away from the icon continues to show the directory-path tooltip with zero observable change from current behavior.
- **SC-003**: A manual visual check across every row type (plain, duplicate, worktree) shows no instance of two tooltips rendering at once anywhere in the table.

## Assumptions

- Only one colliding tooltip pair exists in the app today — the row's directory-path tooltip and the duplicate-clone icon's notice — confirmed by inspecting the row-rendering code during discussion of this fix. No other row icon is nested inside another tooltip-bearing element.
- "The duplicate notice takes priority" (user-confirmed) means: whenever the pointer is over the duplicate-clone icon itself, its tooltip is the one shown, even though the icon sits inside the name element that owns the path tooltip.
- This is a presentation-only fix: no tooltip content, no new user-facing control, and no change to duplicate detection itself is in scope.
