# Feature Specification: Custom Modern Table Scrollbar

**Feature Branch**: `011-custom-table-scrollbar`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "I want to replace system scroll in table by a custome one, nice looking - if it is possible just style it, if not find a ready to use component. scroll should be a thin line, modern. make it invisible by default, should be shown when user scroll - modern ide aproach"

## Clarifications

### Session 2026-07-20

- Q: Should keyboard-driven scrolling also trigger the reveal, and should the fade animation respect the OS "reduce motion" preference? → A: Yes to both — keyboard scrolling (arrow/Page/Home/End keys while the table has focus) triggers reveal identically to mouse scroll, and when the OS "reduce motion" preference is on, the scrollbar shows/hides instantly instead of fading.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uncluttered table by default (Priority: P1)

While browsing the repository table without scrolling, a user sees a clean list with no visible scrollbar track or thumb taking up space or drawing attention, regardless of which desktop OS they're running.

**Why this priority**: This is the core visual goal — today's platform-default scrollbar (a persistent gray track/thumb on Windows/Linux) looks dated and clutters the table. Removing it when idle is the most visible part of the "modern" ask and delivers value on its own even before the reveal behavior is considered.

**Independent Test**: Open the app with enough repositories/worktrees to make the table scrollable, don't touch it, and confirm no scrollbar is visible.

**Acceptance Scenarios**:

1. **Given** the repository table has more rows than fit in the visible area, **When** the table is idle (no scrolling or hovering), **Then** no scrollbar track or thumb is visible anywhere along the table's edge.
2. **Given** the table content fits entirely within the visible area, **When** the view is idle, **Then** no scrollbar is rendered (nothing to indicate scrollability that doesn't exist).

---

### User Story 2 - Scrollbar appears while scrolling (Priority: P1)

When a user scrolls the table (wheel, trackpad, or dragging an already-visible thumb), a thin scrollbar fades in along the table's edge so they have a visual sense of position and total length, then fades back out shortly after they stop.

**Why this priority**: Equally essential to P1 above — a scrollbar that's always invisible would leave users with no positional feedback at all. This is the "modern IDE approach" (e.g. VS Code) the request calls out by name: reveal on interaction, hide on idle.

**Independent Test**: Scroll the table and confirm a thin indicator appears at the moment of scrolling and disappears a short, fixed delay after scrolling stops, without requiring any other action.

**Acceptance Scenarios**:

1. **Given** the table is idle with the scrollbar hidden, **When** the user scrolls the table, **Then** a thin scrollbar thumb fades in near-instantly, sized and positioned to reflect the visible fraction and current scroll offset.
2. **Given** the scrollbar is visible because the user was scrolling, **When** scrolling stops, **Then** the scrollbar fades out after a short delay of inactivity.
3. **Given** the scrollbar is visible, **When** the user resumes scrolling before it fully fades out, **Then** the fade-out timer resets and the scrollbar stays visible.

---

### User Story 3 - Scrollbar appears on hover (Priority: P2)

When a user moves the mouse over the scrollable table without scrolling, the thin scrollbar also fades in — matching the hover-reveal behavior of modern IDEs — so users can find and grab it to drag-scroll without having to scroll first.

**Why this priority**: A secondary convenience on top of P1's scroll-triggered reveal. It's the affordance modern editors use to let users discover and use the scrollbar as a drag handle, but the feature is already useful without it (P1 covers the core clean/reveal-on-scroll loop).

**Independent Test**: With the table idle and scrollbar hidden, hover the pointer over the table (without scrolling) and confirm the thin scrollbar fades in; move the pointer away and confirm it fades back out.

**Acceptance Scenarios**:

1. **Given** the scrollbar is hidden and the table is scrollable, **When** the pointer enters the table area, **Then** the scrollbar fades in.
2. **Given** the scrollbar is visible due to hover, **When** the pointer leaves the table area and the user isn't actively scrolling or dragging the thumb, **Then** the scrollbar fades out after the same short delay used for the scroll-triggered case.
3. **Given** the scrollbar is visible and the user presses down on the thumb to drag it, **When** they drag outside the table's horizontal bounds while still holding the mouse button, **Then** the scrollbar remains visible and scrolling continues to track the drag until the button is released.

---

### Edge Cases

- What happens on a system/browser that doesn't support the styling technique used (very old Chromium/Electron build)? The table MUST remain fully scrollable and usable even if it falls back to that platform's default scrollbar appearance.
- What happens when new rows are added or removed (e.g. after a refresh) while the scrollbar is visible? The thumb's size and position MUST update immediately to reflect the new content length, without requiring an extra scroll event to "wake up".
- What happens when a worktree row is expanded/collapsed under a repository, changing the table's scrollable height right as the scrollbar is visible? Same as above — the thumb reflects the new height immediately.
- What happens when the table is scrolled all the way to the top or bottom? The thumb MUST visibly sit flush against that end, not float away from it.
- What happens during the blocked/dimmed table state introduced by the "Block UI During Long Operations" feature (rows dimmed during Refresh/Pull all/Cleanup)? The scrollbar must continue to work for repositioning the dimmed list and must not itself appear enabled/interactive in a way that implies rows can be acted on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST replace the operating system's default scrollbar appearance on the repository table's scrollable region with a custom-styled thin scrollbar, consistent in appearance across Windows, macOS, and Linux builds.
- **FR-002**: The scrollbar MUST be a thin line-style indicator (not a wide, boxy platform-default bar) styled to match the table's existing visual design.
- **FR-003**: The scrollbar MUST be fully transparent/hidden when the table is idle (not being scrolled, hovered, or dragged).
- **FR-004**: The system MUST reveal the scrollbar (fade it in) when the user scrolls the table, whether by mouse wheel/trackpad or by keyboard (arrow keys, Page Up/Down, Home/End) while the table has focus.
- **FR-005**: The system MUST reveal the scrollbar when the pointer hovers over the table's scrollable area, even without scrolling.
- **FR-006**: The system MUST hide the scrollbar (fade it out) automatically after a short, fixed period of no scrolling, no hover, and no active thumb drag.
- **FR-007**: The scrollbar's visibility transitions (fade in/out) MUST be smooth/animated rather than an abrupt show/hide, consistent with a "modern" feel, EXCEPT when the operating system's "reduce motion" accessibility preference is enabled, in which case the scrollbar MUST show/hide instantly without a fade transition.
- **FR-008**: The scrollbar thumb MUST remain draggable with the mouse to scroll the table, matching standard scrollbar interaction.
- **FR-009**: The custom scrollbar MUST NOT change the table's layout, content width, or row heights when it appears or disappears (it overlays rather than reserving permanent space).
- **FR-010**: The custom scrollbar MUST preserve all existing scroll interactions the table already supports (mouse wheel, trackpad, keyboard scrolling; see FR-008 for the thumb-drag interaction specifically).
- **FR-011**: The scrollbar's thumb size and position MUST accurately reflect the visible proportion and current offset of the table's content at all times, updating immediately when content height changes (rows added/removed, worktrees expanded/collapsed).
- **FR-012**: If the styling technique isn't supported in a given build/environment, the table MUST fall back gracefully to a usable scrollbar (native default) rather than losing scroll functionality.

### Key Entities

- **Scrollbar visibility state**: Whether the custom scrollbar is currently shown or hidden for the table, driven by scroll activity, hover, and an inactivity timer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the table idle, zero pixels of scrollbar track or thumb are visible to the user, on every supported desktop platform.
- **SC-002**: The scrollbar becomes visible within one frame-perceptible moment (effectively instantly) of the user starting to scroll or hovering the table.
- **SC-003**: The scrollbar fades out within roughly 1 second of the last scroll/hover/drag activity, so it doesn't linger and distract during normal use.
- **SC-004**: Users can scroll and drag-reposition the table exactly as before this change, with no loss of scrolling functionality on any supported platform.
- **SC-005**: The table's visible appearance (row layout, column widths, dimming/blocked states) is unaffected by the scrollbar's presence or absence.

## Assumptions

- "The table" refers to the repository dashboard's scrollable row list (repositories and their nested worktree rows) — the single scrollable region in the current UI.
- "Modern IDE approach" means the overlay, auto-hiding scrollbar pattern popularized by editors like VS Code: invisible at rest, revealed on hover or scroll, faded out shortly after activity stops. A short fade-out delay (~1 second) is used as this is standard for that pattern; exact timing is a visual-polish detail to be tuned during implementation, not a product decision.
- Styling the scrollbar via CSS on the existing scrollable container is expected to be sufficient (Electron's Chromium renderer supports both the `::-webkit-scrollbar` pseudo-elements and the standard `scrollbar-width`/`scrollbar-color` properties); a JavaScript/component-based custom scrollbar is treated as a fallback only if pure styling proves visually insufficient.
- This feature is purely visual/interaction polish for the existing table — it does not change what content is shown, how rows are sorted/filtered, or add any new scrolling capability (e.g. no minimap, no horizontal scrollbar is in scope since the table does not currently scroll horizontally).
- No new user-facing setting is introduced to toggle this behavior; the auto-hiding thin scrollbar becomes the only style.
