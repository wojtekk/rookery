# Feature Specification: Relocate Search Icon Above the Table

**Feature Branch**: `018-relocate-search-header`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Relocate the search icon to the top-left area above the table, replacing the redundant repository count text ('Fleet — 123 repositories'), since the count is already tracked in the footer."

## Clarifications

### Session 2026-07-21

- Q: When the expanded search input and the filter chips don't both fit on the row above the table (narrow window), what should happen? → A: Filter chips wrap to a second line below the search row.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find search where the table starts (Priority: P1)

As a user scanning the app, I expect the search control to live at the top-left of the area directly above the repository table, next to the filter chips it works alongside — not buried in the top title bar, far from the content it filters.

**Why this priority**: This is the entire feature; every other requirement supports this relocation.

**Independent Test**: Open the app and confirm the search icon appears at the top-left of the row directly above the table (the row that also holds the state-filter chips), and no longer appears in the top title bar.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** the user looks at the row directly above the table, **Then** the search icon is the leftmost control in that row.
2. **Given** the app is loaded, **When** the user looks at the top title bar, **Then** no search icon is present there.
3. **Given** the search control is relocated, **When** the user clicks the icon, types a query, clears it, or triggers Esc, **Then** it behaves exactly as it did in its previous location (expand, debounced filtering, clear button, collapse) — this is a placement change only.
4. **Given** a long-running operation (Refresh/Pull all/Cleanup) is active, **When** the user looks at the relocated search control, **Then** it is locked out exactly as it was before (non-interactive, `not-allowed` cursor, no colour change).

---

### User Story 2 - Remove the redundant repository count (Priority: P2)

As a user, I no longer need to see "Fleet — 123 repositories" above the table, since the footer already states how many repositories are showing.

**Why this priority**: Decluttering depends on the relocation in User Story 1 to have somewhere useful to put the freed space, but delivers value (a cleaner header) on its own.

**Independent Test**: Open the app and confirm the text "Fleet — N repositories" no longer appears anywhere, while the footer's existing repository count text is unchanged.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** the user looks at the area above the table, **Then** no "Fleet — N repositories" text is present.
2. **Given** the repository count changed (e.g. after Refresh), **When** the user looks at the footer, **Then** it still reports the count exactly as before this feature.

### Edge Cases

- Narrow window width: when the expanded search input and the filter chips don't both fit on one row, the filter chips wrap to a second line below the search row — neither ever overlaps or clips the other.
- Zero repositories discovered: the row above the table shows only the search icon and filter chips (all reading zero) — no leftover blank space where the removed text used to be.
- Search already expanded with a query typed: relocating the control must not clear the in-progress query or collapse the input.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST move the search control (icon, expandable input, and clear button) from the top title bar to the top-left position of the row directly above the repository table.
- **FR-002**: System MUST remove the "Fleet — N repositories" text entirely, with no replacement text shown in its place.
- **FR-003**: The state-filter chips currently sharing that row MUST remain visible, in working order, and visually unaffected other than accommodating the search control's new position.
- **FR-004**: All existing search behavior (expand/collapse, 150ms debounce, immediate clear via × or Esc, long-operation lockout) MUST be preserved unchanged after relocation.
- **FR-005**: The table's own sortable header row MUST keep its current spacing and alignment — this change MUST NOT alter it.
- **FR-006**: The top title bar MUST reflow cleanly once the search control is removed from it, with no leftover empty gap.
- **FR-007**: When the row above the table is too narrow to fit both the expanded search input and every filter chip, the filter chips MUST wrap onto a second line below the search row — the search control MUST NOT shrink, clip, or hide any filter chip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate and open the search control from directly above the table without looking at the top title bar.
- **SC-002**: A repository count appears in exactly one place in the app (the footer) — zero occurrences of the old "Fleet — N repositories" phrasing remain.
- **SC-003**: Every previously-working search interaction (open, type, debounced narrow, clear, Esc, lockout during a long operation) still passes after relocation, with no regression in table filtering or the sort-header row.

## Assumptions

- This is a pure layout relocation: the search control's internal behavior, states, and lockout rules are unchanged — only its host container and position move.
- The state-filter chips keep their current row (previously shared with the "Fleet" title text); they now share it with the search control instead.
- No new visual redesign of the search icon/input themselves, no new persisted setting, and no change to what data is searched.
- The footer's existing "Showing X of Y" text is sufficient as the sole remaining repository count and needs no changes.
