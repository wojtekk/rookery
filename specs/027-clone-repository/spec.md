# Feature Specification: Clone a Repository

**Feature Branch**: `027-clone-repository`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Add clone feature. user could provide URL https or ssl. Autocompletion based on existing repos I have access too. There is around 1k+ repos - filter? Implement smart wy. User should be able to choose from one existing path or change it to his own. How the clone window could looks like?"

## Clarifications

### Session 2026-07-23

- Q: When a clone lands in a directory that isn't already watched, which path should the app start watching so the new repo shows up? → A: Watch the clone's **parent** directory (the repo appears as a child; future siblings placed there also appear).
- Q: What concrete cap on displayed search results applies when the accessible set is 1,000+ repos? → A: Top 50 ranked matches.
- Q: When `gh` is installed but the user is signed in on no host, what should the dialog show? → A: A distinct, actionable message naming the cause (e.g. "GitHub CLI is installed but you're not signed in — run `gh auth login`"), separate from the "gh not found" message; URL clone still works.
- Q: Does the app proactively verify git authentication before a clone? → A: No — rely on fail-loud; `git clone` runs with prompts disabled and any auth failure surfaces as a specific, shown reason (git auth can't be reliably checked without attempting a remote operation).
- Q: Where/when are `gh`/`git` availability verified? → A: Lazily, when the Clone dialog opens (session-cached); not at app startup (git is already a hard startup requirement of the existing dashboard).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and clone a repository by name (Priority: P1)

A user with access to 1,000+ repositories across their organizations wants to
clone one onto their machine. They open the clone dialog, type a partial
repository name, see a short ranked list of matching repositories they have
access to, pick the one they want, confirm (or adjust) where it should be
saved, and start the clone. Once it finishes, the repository appears in the
dashboard like any other.

**Why this priority**: This is the core value of the feature — turning "I
need repo X locally" into a few keystrokes instead of remembering/typing a
full URL and running a terminal command.

**Independent Test**: Can be fully tested by opening the clone dialog,
searching for a known accessible repository by partial name, selecting it,
accepting the default destination, and confirming the repository appears in
the dashboard afterward.

**Acceptance Scenarios**:

1. **Given** the clone dialog is open and repository search data has loaded,
   **When** the user types part of a repository's name, **Then** a ranked
   list of matching repositories they have access to appears, most relevant
   matches first, capped to at most 50 results.
2. **Given** a repository is selected from the search results, **When** the
   user confirms without changing anything, **Then** the clone starts using a
   pre-filled destination path derived from one of the user's existing
   watched directories and the repository's name.
3. **Given** a clone has just completed successfully, **When** the user
   returns to the dashboard, **Then** the newly cloned repository is visible
   without any manual "add directory" step, even if it was cloned into a
   location not previously watched.

---

### User Story 2 - Clone directly from a URL (Priority: P2)

A user already has a specific repository's URL (HTTPS or SSH) — perhaps for a
repository outside their searchable accounts, or one they simply prefer to
paste rather than search for. They paste it into the clone dialog, pick a
destination, and clone it, without ever needing the search/autocomplete list
to work.

**Why this priority**: Search convenience is the headline feature, but the
dialog must not become the *only* way to clone — a manually-known URL must
always work, independent of whether repository search succeeds.

**Independent Test**: Can be fully tested by opening the clone dialog,
pasting a repository URL directly into the URL field without touching search,
choosing a destination, and confirming a successful clone.

**Acceptance Scenarios**:

1. **Given** the clone dialog is open, **When** the user pastes a full
   repository URL (HTTPS or SSH form) into the URL field, **Then** the system
   accepts it for cloning without requiring a prior search selection.
2. **Given** repository search data failed to load entirely (e.g., no
   accessible search source configured), **When** the user opens the clone
   dialog, **Then** they can still clone by URL, and the dialog clearly shows
   that search is unavailable rather than presenting an empty, unexplained
   list.

---

### User Story 3 - Recover cleanly from a failed clone (Priority: P3)

A user attempts to clone into a destination that already has content, or
types a URL with a typo, or is offline. The clone fails. They see specifically
why, fix the one thing that was wrong (path or URL), and retry — without
having to re-enter everything else or reopen the dialog from scratch.

**Why this priority**: Clone failures are common (typos, existing folders,
transient network issues) but shouldn't be costly to recover from; this is a
refinement on top of the P1/P2 flows rather than a separate capability.

**Independent Test**: Can be fully tested by attempting to clone into a
destination path that already exists and is non-empty, observing a specific
failure reason, correcting the path, and successfully retrying without
re-entering the URL or search selection.

**Acceptance Scenarios**:

1. **Given** a clone attempt fails for any reason (existing destination,
   invalid URL, network/auth failure), **When** the failure is reported,
   **Then** the dialog stays open with the user's search/URL/destination
   input intact and a specific, actionable reason shown.
2. **Given** a clone is attempted while another long-running repository
   operation (refresh, pull all, cleanup, rebase worktrees) is already in
   progress, **When** the user tries to start it, **Then** the system
   prevents the conflicting start rather than running two mutating operations
   at once.

### Edge Cases

- What happens when the chosen destination directory already exists and is
  non-empty? The system MUST show a proactive, non-blocking warning as soon
  as it's detected — before the user clicks Clone — and if the user proceeds
  anyway, the clone MUST fail with a specific, shown reason rather than
  overwriting or silently merging into it (revised 2026-07-23: added the
  proactive warning so the doomed attempt is never a surprise).
- What happens when repository search data is available from some of the
  user's configured accounts/hosts but not others (e.g., one is unreachable)?
  The system MUST show the results that did load and indicate which source
  was unavailable, rather than failing the whole search.
- What happens when the user clones a repository they already have cloned
  elsewhere on disk? The system MUST show an informational warning naming the
  existing local path, but MUST still allow the clone to proceed if the user
  continues — this is a heads-up, not a block (revised 2026-07-23: originally
  specified as a silent allow with no warning; the dashboard's own duplicate
  indicator was judged too passive for the clone dialog itself).
- What happens if the user edits the destination path by hand after picking
  a repository? Further automatic path suggestions MUST stop overwriting
  their edit.
- What happens when the user has no search data available at all (not signed
  in anywhere searchable)? The URL-based clone flow (User Story 2) MUST
  remain fully usable, and — when the cause is that `gh` is installed but the
  user is signed in on no host — the dialog MUST show the distinct, actionable
  "not signed in" message (per FR-012), not the generic "gh not found" one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a way for users to open a dedicated
  clone dialog from the main dashboard.
- **FR-002**: The system MUST let users search across the repositories they
  have access to, matching on organization/owner and repository name as they
  type.
- **FR-003**: The system MUST rank search results so the closest name matches
  surface first, and MUST cap the number of results displayed at once to the
  top 50 ranked matches so the list stays usable when the accessible set is
  1,000+ repositories.
- **FR-004**: The system MUST let users bypass search entirely and directly
  enter a full repository URL, in either HTTPS or SSH form, to clone.
- **FR-005**: The system MUST let users choose a clone destination from their
  existing watched directories, or specify/browse to a different location
  entirely.
- **FR-006**: The system MUST pre-fill a destination path (based on the
  chosen directory and the repository's name) once a repository or directory
  is selected, and MUST let the user freely edit that path before cloning.
- **FR-007**: The system MUST only perform a clone as a result of an explicit
  user confirmation — never automatically or on a timer.
- **FR-008**: The system MUST NOT allow a clone to start while another
  long-running repository operation is in progress, and MUST NOT allow
  another such operation to start while a clone is in progress.
- **FR-009**: On a successful clone, the system MUST make the new repository
  visible in the dashboard without requiring a separate manual step beyond
  what other successful mutating actions already require.
- **FR-010**: If the clone's destination is not already contained within a
  watched directory, the system MUST begin watching the destination's
  **parent** directory (not the clone directory itself), so the new
  repository appears as a child of a watched directory and any future
  sibling repositories placed alongside it also become visible.
- **FR-011**: On a failed clone, the system MUST show a specific, actionable
  reason for the failure and MUST preserve the user's search/URL/destination
  input so they can correct and retry without starting over.
- **FR-012**: When repository search data cannot be retrieved at all, the
  system MUST still allow cloning via a manually entered URL, and MUST
  clearly communicate that search is unavailable rather than showing an
  empty, unexplained list. The message MUST name the cause and, where the
  cause is user-fixable, be actionable — in particular, "the GitHub CLI is
  installed but you are not signed in on any host" MUST be shown as a
  distinct, actionable message (e.g. pointing the user to `gh auth login`),
  **separate** from the "GitHub CLI not found" message, since the former is
  trivially fixable by the user and the latter is not.
- **FR-013**: When repository search data is available from only some of the
  user's configured accounts/hosts, the system MUST display the results that
  did load and indicate which source(s) were unavailable, rather than
  discarding all results.
- **FR-014**: The system MUST NOT store, manage, or prompt for the user's
  remote-hosting credentials itself; it MUST rely entirely on authentication
  already configured in the user's existing environment, consistent with how
  the dashboard's other git operations already work. The system MUST NOT
  proactively pre-check git authentication before a clone; instead it MUST
  run the clone with interactive credential prompts disabled so that a
  git-auth failure fails loud and is surfaced as a specific, shown reason
  (per FR-011) rather than hanging on a prompt. (Rationale: git auth is
  per-remote and cannot be reliably verified without attempting a remote
  operation, which the clone itself already is.)

### Key Entities

- **Cloneable Repository**: A remote repository the user has access to but
  may not have cloned locally yet. Identified by its hosting service, its
  owner/organization, and its name.
- **Clone Destination**: The local directory path where a new clone will be
  created — either derived from one of the user's existing watched
  directories plus the repository name, or a custom path the user supplies.
- **Clone Outcome**: The result of a single clone attempt — success, or
  failure with a specific, user-visible reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who knows part of a repository's name can locate and
  select it from 1,000+ accessible repositories using only a few keystrokes.
- **SC-002**: A user can go from opening the clone dialog to seeing the new
  repository in the dashboard without needing to leave the dialog for
  anything other than optionally browsing for a folder.
- **SC-003**: Every clone failure presents an actionable, specific reason —
  never a silent or generic failure — and never discards the user's
  in-progress input.
- **SC-004**: A user can successfully clone a known repository by URL even
  when no repository search data is available at all.

## Assumptions

- The user already has working authentication configured for the hosting
  platforms/accounts they use, sufficient both for existing git operations
  (pull, push, fetch) and for listing which repositories they can access.
- "Repositories I have access to" is scoped to hosting platforms/accounts
  already configured in the user's own environment — not an arbitrary,
  user-specified hosting service typed into the app.
- Repository search data may be fetched once per session rather than on
  every dialog open, since the accessible set changes infrequently during a
  single working session; a way to force a refresh of that data is in scope.
- `gh`/`git` availability and `gh` authentication are verified lazily — when
  the Clone dialog is opened (and the result is session-cached) — not at
  application startup. `git` itself remains a hard startup requirement of the
  existing dashboard; only the clone feature's `gh`-based discovery and its
  availability messaging are gated on opening the dialog, so a session that
  never clones incurs no startup cost or startup-time `gh` probe.
- Clone always targets a destination that doesn't yet exist or is empty;
  merging a clone into an existing populated directory is out of scope.
- When a repository can be cloned via more than one URL form, SSH is offered
  as the default, matching this environment's already-established remote
  convention; HTTPS remains available as an alternative.
