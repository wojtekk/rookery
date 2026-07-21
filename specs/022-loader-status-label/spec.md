# Feature Specification: Label the Loader With the Active Operation

**Feature Branch**: `022-loader-status-label`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "loader should contains information what operation is happening. Use simple text: Refreshin ... (informative, easy to understand, describe what is happening). Show it above blinking circles - similar size, blended a bit."

## Clarifications

### Session 2026-07-21

- Q: Should the new operation label be announced to screen-reader users (like the app's existing toast notices), or is it purely visual like the loader dots it sits above? → A: Announce via `role="status"` — a polite live-region announcement when the label appears/changes, consistent with the app's existing toast notices (`role="alert"`), just non-interruptive since this is routine status, not an error.
- Q: What should the loader label say while "Pull all" is running? → A: "Pulling…" — short, matches the terse present-tense style of the other three labels.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what the app is doing while it loads (Priority: P1)

While the app is busy (starting up, refreshing, pulling all repositories, or
cleaning up gone branches/worktrees), a user looking at the loading indicator
sees a short, plain-language label telling them which of those operations is
currently running, instead of just an unlabelled animation.

**Why this priority**: This is the entire feature — the loader today gives no
indication of *what* is happening, only *that* something is happening. Users
have reported not knowing whether the app is still starting up, refreshing,
or stuck.

**Independent Test**: Trigger each of the four operations (initial launch,
Refresh, Pull all, Cleanup) one at a time and confirm the loader shows a
distinct, correct label for each while it's visible, and no label once it
hides.

**Acceptance Scenarios**:

1. **Given** the app is starting up and has directories configured, **When**
   the initial loading indicator appears, **Then** it shows a label
   describing the app as loading (e.g. "Loading…").
2. **Given** the table is idle, **When** the user clicks Refresh and the
   loader becomes visible, **Then** the label reads "Refreshing…".
3. **Given** the table is idle, **When** the user clicks Pull all and the
   loader becomes visible, **Then** the label reads "Pulling…".
4. **Given** the table is idle, **When** the user clicks Cleanup and the
   loader becomes visible, **Then** the label reads "Cleaning up…".
5. **Given** the loader is visible with its label, **When** the operation
   finishes and the loader hides, **Then** the label disappears with it.

---

### User Story 2 - Label doesn't distract from the loading animation (Priority: P2)

The new label reads as part of the same quiet loading indicator the app
already has — not as a bold banner competing for attention.

**Why this priority**: The request explicitly asks for the label to be
"blended a bit" and similar in size to the existing dots; a label that
visually dominates the loader would look inconsistent with the app's existing
minimal, muted loading treatment (matching how the dots themselves are
already styled with the app's muted color).

**Independent Test**: Compare the label's font size and color against the
loader dots and confirm neither element visually overpowers the other.

**Acceptance Scenarios**:

1. **Given** the loader is visible, **When** a user looks at it, **Then**
   the label sits above the dots, uses a font size close to the dots'
   diameter, and uses the same muted color already used for the dots.

---

### Edge Cases

- What happens if the loader's 150ms show-delay elapses but the operation
  finishes before the label would otherwise be noticed? The label appears and
  disappears together with the dots — no separate timing for the label.
- What happens if an operation other than the four known ones runs? Not
  possible today — Refresh, Pull all, Cleanup, and the initial load are the
  only operations that ever show this loader, and the app already prevents
  more than one running at a time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The loader MUST display a short text label whenever it is
  visible.
- **FR-002**: The label MUST correctly identify which one of the four
  operations is running: initial load, Refresh, Pull all, or Cleanup.
- **FR-003**: The label MUST appear above the loader's animated dots, not
  beside or below them.
- **FR-004**: The label MUST use simple, plain-language wording that
  describes the operation in progress (e.g. "Refreshing…"), not a technical
  or internal term.
- **FR-005**: The label's visual weight MUST be subdued and close in scale to
  the loader dots, so it reads as one quiet loading indicator rather than a
  prominent banner.
- **FR-006**: The label MUST be shown and hidden together with the loader
  dots — never visible while the dots are hidden, and never absent while the
  dots are shown.
- **FR-007**: The label MUST be announced to assistive technology as a
  polite status update (not an interruptive alert) whenever it appears or
  its text changes, consistent with how the app already surfaces other
  transient status text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user watching the loader can correctly name which operation
  is running (load, refresh, pull all, or cleanup) 100% of the time, without
  needing to check button states elsewhere in the toolbar.
- **SC-002**: The loader's label and dots read as a single cohesive, low-key
  indicator — neither element visually dominates the other.

## Assumptions

- The four operations that ever show this loader today are: the app's
  initial load, Refresh, Pull all, and Cleanup — these are mutually
  exclusive (the app already allows only one at a time), so the loader never
  needs to show more than one label at once.
- Exact wording defaults: "Loading…" (initial load), "Refreshing…" (Refresh),
  "Cleaning up…" (Cleanup) — short, present-tense, ellipsis-suffixed,
  consistent with the "Refreshin…" example in the request. The Pull all
  wording ("Pulling…") is confirmed rather than assumed — see Clarifications.
- "Similar size" means the label's font size is comparable to the dots'
  existing size, not literally identical, since text and circles aren't
  directly comparable units.
- "Blended a bit" means the label reuses the loader's existing muted color
  rather than full-strength text color, matching the dots' current styling.
- No new setting is needed to turn this label on/off — it always accompanies
  the loader.
