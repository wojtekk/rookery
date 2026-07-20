# Feature Specification: Fix Delete Button Tooltip Clipping

**Feature Branch**: `012-fix-delete-tooltip`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "delete button - Tooltip is partially hiden, probably index is too low. White box show at the same time to in bottom right corner"

## Clarifications

### Session 2026-07-20

- Q: Should the fix also add general scrollbar-corner styling as defense-in-depth against any future cause of horizontal overflow, or only remove the specific overflow trigger caused by the delete tooltip? → A: Fix only the specific trigger (correctly align the delete tooltip so it no longer overflows the table). No general scrollbar-corner styling is added.
- Q (found during manual verification): The delete tooltip's vertical-clipping fix was initially scoped to "the last row," but manual testing showed the real condition is "the last row *visible* in a scrolled/short window" — should the fix also extend to configurable per-row action icons (`.menu`), which share the identical tooltip mechanism and are equally affected? → A: Yes — extend the same vertical-clipping protection to configurable row action icons (see FR-006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the full delete tooltip (Priority: P1)

A user hovers over a repository or worktree row's delete ("X") icon to confirm what the button does before clicking it. Today, the "Delete" tooltip text is cut off at the right edge of the table, so the user cannot fully read the confirmation label for a destructive action.

**Why this priority**: The tooltip is the user's pre-click confirmation for a destructive, hard-to-reverse action (row deletion). An unreadable tooltip undermines the safety net the tooltip is meant to provide and is the core complaint reported.

**Independent Test**: Hover the delete icon on any row (a top-level repository row and a nested worktree row) at various window widths and scroll positions, and confirm the full "Delete" text renders without being cut off.

**Acceptance Scenarios**:

1. **Given** the repository table is displayed with at least one row, **When** the user hovers over a row's delete icon, **Then** the full "Delete" tooltip text is visible and not clipped by the table's right edge.
2. **Given** the table window is narrowed to a smaller width, **When** the user hovers over a row's delete icon, **Then** the tooltip still renders fully within the visible table area (repositioning if necessary) rather than being cut off.
3. **Given** the table is scrolled partway down, **When** the user hovers over a delete icon on a visible row, **Then** the tooltip renders identically to the unscrolled state — fully visible, correctly positioned.

---

### User Story 2 - No stray artifact during hover (Priority: P2)

At the same time the tooltip is clipped, an unstyled white/light box appears in the bottom-right corner of the table. This is a visual artifact unrelated to any user action and undermines confidence in the UI's polish.

**Why this priority**: Cosmetic rather than functional, but it appears alongside the P1 issue and reinforces the impression that something is visually broken.

**Independent Test**: Hover a delete icon (or otherwise interact with the table in a way that could momentarily widen its scrollable content) and confirm no unstyled box appears in the table's bottom-right corner.

**Acceptance Scenarios**:

1. **Given** the repository table is displayed, **When** the user hovers over a row's delete icon, **Then** no unstyled white/light box appears in the bottom-right corner of the table.
2. **Given** the table is scrolled to its bottom, **When** the user hovers over a delete icon, **Then** the table's corner remains visually consistent with the rest of the table border/background.

---

### Edge Cases

- What happens when the delete icon (or a configurable row action icon) being hovered is on the last row *visible* in the current window — regardless of whether it is also the table's actual last row? The tooltip must still render fully on-screen rather than being clipped by the window bottom.
- What happens when the table's custom scrollbar is currently visible (mid-scroll, "revealed" state) at the same time the delete tooltip is shown? Both must remain visually correct simultaneously.
- What happens at minimum supported window width, where horizontal space to the right of the delete icon is smallest? The tooltip must still fully fit within the table area.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the full, unclipped "Delete" tooltip text when a user hovers over the delete icon on any repository or worktree row (see FR-002 for the width/scroll conditions this must hold under).
- **FR-002**: The delete tooltip MUST remain fully within the visible bounds of the table area regardless of window width or vertical scroll position.
- **FR-003**: The system MUST eliminate the horizontal overflow that the delete tooltip currently causes, so hovering the delete icon no longer triggers the browser's default unstyled scrollbar-corner box in the table's bottom-right corner. (Scoped to this specific trigger — general scrollbar-corner styling for other, currently-unobserved causes of horizontal overflow is out of scope.)
- **FR-004**: The delete icon's tooltip positioning behavior MUST be visually consistent with the tooltip behavior already used for other row-action icons, which do not exhibit this clipping problem.
- **FR-005**: These fixes MUST NOT change the delete button's existing click/confirmation behavior — only its hover presentation is in scope.
- **FR-006**: The vertical-clipping protection (FR-002) MUST also apply to configurable per-row action icons, not only the delete icon — they share the identical tooltip-positioning mechanism and are equally affected when hovered on the last row visible in a scrolled or short window.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can read the complete "Delete" tooltip text on 100% of hover attempts, on any row, at any supported window width, and at any scroll position.
- **SC-002**: No unstyled visual artifacts appear in the table during delete-icon hover, across all supported window sizes and scroll positions.
- **SC-003**: Deleting a repository or worktree continues to work exactly as before the fix — no regression in delete functionality.
- **SC-004**: Users can read the complete tooltip text of any configurable row action icon on 100% of hover attempts, including on whichever row is last visible in a scrolled or short window.

## Assumptions

- The cause is presentation-only (tooltip positioning and an unstyled default corner rendering); no change to delete functionality or confirmation logic is required.
- The fix should reuse the same right-edge tooltip alignment already applied to other row-action tooltips, since it already solves this exact clipping problem for icons in the same row.
- The fix applies uniformly to both repository rows and nested worktree rows, since both use the same delete icon.
- No new dependencies are needed; this is a small, renderer-only (styling/positioning) change consistent with the project's existing UI conventions.
- The fix targets the specific overflow trigger (the delete tooltip) rather than adding general-purpose scrollbar-corner styling; a stray corner artifact caused by a different, currently-unobserved source is out of scope for this fix.
- The vertical-clipping fix (FR-002/FR-006) is scoped to the delete icon and configurable row action icons — the two icon types at/near a row's right edge that already share the same right-edge horizontal fix. Other row tooltips (the full-path name tooltip, the failed-pull glyph tooltip) are not reported as broken and remain out of scope.
