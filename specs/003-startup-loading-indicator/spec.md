# Feature Specification: Startup Loading Indicator

**Feature Branch**: `003-startup-loading-indicator`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "When App is run, directories are already configured, loader should be shown to express that data are loaded. Use flat loader, something like on image - well fitting to the design, flat"

## Clarifications

### Session 2026-07-17

- Q: How should the loader avoid flicker on very fast scans? → A: Delay before showing (~150ms) plus a minimum visible duration (~400ms) once shown.
- Q: What form should the flat loader take, and how does startup decide what to show? → A: A flat, indeterminate indicator centered in the content area. On launch the app first evaluates configuration state, then shows EITHER the add-directory screen (no directories configured) OR the loader (directories configured, scan running) — the add-directory screen MUST NOT be shown, even momentarily, before the loader.
- Q: How should the loader handle accessibility (reduced-motion / screen-reader)? → A: No special accessibility handling in this iteration (purely visual loader).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See that data is loading at startup (Priority: P1)

A user who already has one or more directories configured opens the app. The
repository data (git state for every discovered repo) is not instant to gather,
so instead of a blank or empty-looking screen, the user sees a flat loading
indicator that clearly communicates "your repositories are being loaded." When
the scan completes, the indicator disappears and the repository list appears in
its place.

**Why this priority**: This is the entire feature. Without it, the user is left
staring at an empty or ambiguous screen during the startup scan and cannot tell
whether the app is working, stuck, or genuinely empty. It directly serves the
constitution's "always-observable state" and "must not freeze the UI" mandates.

**Independent Test**: Launch the app with at least one configured directory
containing repositories and confirm a loading indicator is visible from launch
until the repository list renders, with no interaction required.

**Acceptance Scenarios**:

1. **Given** the app has configured directories and is launched, **When** the
   startup scan is still in progress, **Then** a flat loading indicator is
   visible and communicates that data is being loaded.
2. **Given** the startup scan is in progress and its indicator is shown, **When**
   the scan completes, **Then** the indicator is removed and the repository list
   is displayed in its place.
3. **Given** the loading indicator is displayed, **When** the user observes the
   window, **Then** the interface remains responsive (the window can be moved,
   resized, and closed) and is not frozen.

---

### User Story 2 - See that data is refreshing on demand (Priority: P2)

A user who is already looking at the repository list triggers an explicit
refresh (re-scan). Because a re-scan takes the same kind of time as the startup
scan, the same loading affordance communicates that the data is being refreshed,
so the user knows their action was registered and results are coming.

**Why this priority**: Refresh is the other moment the app gathers the same data
and could otherwise appear unresponsive. Reusing the startup affordance is
low-cost and keeps behavior consistent, but the feature delivers its core value
(US1) even if refresh feedback is deferred.

**Independent Test**: With the list already displayed, trigger a refresh and
confirm a loading affordance appears until the refreshed list renders.

**Acceptance Scenarios**:

1. **Given** the repository list is displayed, **When** the user triggers an
   explicit refresh, **Then** a loading affordance indicates the data is being
   refreshed until the updated list renders.

---

### Edge Cases

- **Very fast scan**: When data loads faster than the eye can comfortably follow,
  the indicator MUST NOT produce a jarring flash/flicker — the loader appears only
  after a ~150ms delay and, once shown, stays visible for a ~400ms minimum.
- **No directories configured**: On launch the app first evaluates configuration
  state; when no directories are configured it shows its add-directory /
  configuration screen — NOT the loading indicator (the loader means "data is
  coming," and no data is coming). The add-directory screen MUST NOT flash before
  the loader when directories ARE configured.
- **Scan fails or times out**: The loading indicator MUST resolve to an error or
  empty state rather than spinning forever, so the user is never trapped behind a
  permanent loader.
- **Some directories slow, some fast**: The startup indicator communicates the
  overall load in progress; it is not required to report per-directory progress.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On app startup, while the repository scan is in progress AND at
  least one directory is configured, the system MUST display a loading indicator
  that communicates data is being loaded.
- **FR-002**: The loading indicator MUST be a flat, indeterminate indicator
  centered in the content area (where the repository list will appear), consistent
  with the app's existing design (minimal, non-skeuomorphic, no heavy chrome).
- **FR-003**: When the scan completes successfully, the system MUST remove the
  loading indicator and display the repository list in its place.
- **FR-004**: The user MUST NOT be required to take any action for the loading
  indicator to appear or to be replaced by the loaded results.
- **FR-005**: While the loading indicator is shown, the interface MUST remain
  responsive and MUST NOT freeze.
- **FR-006**: On launch the system MUST first evaluate whether any directories are
  configured, then choose the initial screen from that result: no directories →
  the add-directory screen (and never the loader); directories configured → the
  loader, until results are ready. (The no-transient-flash guarantee this enables
  is stated separately in FR-010.)
- **FR-007**: If the scan fails or cannot complete, the system MUST resolve the
  loading indicator to an error or empty state and MUST NOT leave it displayed
  indefinitely.
- **FR-008**: The loading indicator MUST avoid a jarring flash for very fast loads
  by delaying its appearance by approximately 150ms and, once shown, keeping it
  visible for a minimum of approximately 400ms.
- **FR-009**: An explicit user-triggered refresh (re-scan) MUST surface a loading
  affordance until the refreshed list renders.
- **FR-010**: The add-directory / configuration screen MUST NOT be shown, even
  transiently, when directories are configured; the first meaningful paint is
  deferred until the configuration state is known (see FR-006).

### Key Entities

- **Load state**: The transient status of the startup/refresh data gathering —
  conceptually one of "loading in progress," "loaded (results ready)," or
  "failed / nothing to show." It governs whether the loading indicator or the
  results/empty state is presented. (Design note: "failed" is not a separate
  screen this iteration — a failed/timed-out scan resolves to the same empty
  state as a zero-result scan, per FR-007/SC-005 which accept "error OR empty.")

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On every startup where directories are configured and the scan runs
  longer than ~150ms, a loading indicator is visible until the repository list
  renders.
- **SC-002**: While startup data is loading, the content area always shows either
  the loader or the add-directory screen — never an empty/unexplained blank region.
- **SC-003**: The repository list appears automatically when loading finishes,
  with zero user interaction required.
- **SC-004**: The interface remains interactive throughout loading (window can be
  moved/resized/closed while the indicator is shown).
- **SC-005**: A failed or timed-out scan resolves to a visible error/empty state
  rather than an indefinitely displayed loader in 100% of failure cases.
- **SC-006**: The add-directory screen is never shown (not even as a transient
  flash) when directories are configured, in 100% of startups. Verified at two
  levels: the decision-logic invariant (the screen-selection logic never yields
  "add-directory" while directories are configured) is covered by an automated
  test; the paint-timing property (no transient flash) is verified manually
  (slow-motion capture per quickstart), as no automated test can assert it.

## Assumptions

- The loader is a flat, minimal, indeterminate indicator centered in the content
  area; the exact glyph/animation will be matched to the app's existing design in
  the design/plan phase. The referenced image is treated as visual direction, not
  a binding pixel spec.
- The indicator is app-level (a single loading state for the initial scan), not a
  per-repository-row spinner; per-row/per-directory progress is out of scope.
- Accessibility affordances specific to the loader (reduced-motion handling,
  screen-reader "loading" announcements) are explicitly OUT OF SCOPE for this
  iteration per clarification; the loader is a purely visual element. (Note:
  Constitution Principle IV's redundant, non-colour-cue mandate governs per-row
  *state* indicators, not a transient loader, so this is not a strict Principle IV
  breach; it is tracked conservatively in plan.md Complexity Tracking regardless.)
- The loading indicator is indeterminate (communicates "in progress" without a
  precise percentage), since scan duration and total work are not known up front.
- The startup scan and explicit refresh reuse the same data-gathering path, so the
  same affordance applies to both (US1 startup is the priority; US2 refresh reuses
  it).
- This feature builds on the existing startup-scan behavior established by
  001-repo-dashboard; it adds a loading affordance around that scan and does not
  change what is scanned or how git state is derived.
