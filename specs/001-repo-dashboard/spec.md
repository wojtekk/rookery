# Feature Specification: Local Repository Dashboard

**Feature Branch**: `001-repo-dashboard`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "This local Electron-based desktop application manages cloned Git repositories by leveraging the host system’s native Git client and credentials. Users can configure parent directories for the app to monitor, which it scans at startup and auto-refreshes at defined intervals. The core interface features a clean repository list showing the home-relative path (using `~` formatting), remote repository slug and host server, current active branch, and sync status (ahead/behind local and remote change counts). Crucially, the UI and architecture must remain highly modular to easily accommodate advanced, per-repository options and actions in future updates."

## Clarifications

### Session 2026-07-16

- Q: Does periodic/manual refresh fetch from remotes? → A: Local-only refresh; remote counts reflect last-known remote-tracking refs. Fetching is a separate explicit action deferred to a later feature.
- Q: How deep does the app scan an observed directory for repositories? → A: Immediate children only — each observed directory's direct subfolders are checked for being a repository; no deeper recursion.
- Q: How is the repository list ordered by default? → A: Sort order is user-configurable; the app remembers the last chosen order across restarts; default is alphabetical by slug (owner/repository).
- Q: What exactly counts toward the "local changes" number? → A: The number of changed paths in the working tree including untracked files but excluding gitignored files (equivalent to the count of `git status --porcelain` entries) — matching common git apps.
- Q: What is the default refresh interval, and is there a minimum floor? → A: No automatic/periodic refresh. The list refreshes only at startup and on explicit user demand (manual refresh). The refresh-interval concept is removed from this feature.
- Q: Which dimensions can the user sort the repository list by? → A: Slug (owner/repository), directory name, last change time, and local change count — each ascending or descending. Default is slug ascending.
- Q: What does "last change" time mean for sorting? → A: The commit date of the latest commit on the currently checked-out branch (HEAD).
- Q: How do sorting and worktree grouping coexist? → A: Sorting reorders primary repositories only; each primary's worktrees always remain grouped directly beneath it (grouping is preserved regardless of sort).
- Q: When sorting by local change count, is the key the primary's count or a group sum? → A: The sum of the primary's local change count plus all its worktrees' local change counts. (The primary still displays its own count.)
- Q: What does the user see on first launch with no observed directories (or after removing all)? → A: A guided empty state explaining that no directories are observed, with a prominent action to add one.
- Q: Should the repository row show the remote host/server in addition to the owner/repository slug? → A: Yes — display the host/server alongside the slug so repositories on different hosts (e.g. github.com vs github.schibsted.io) are distinguishable.
- Q: What is each row's identity and column layout? → A: The slug (owner/repository, with host) is the primary display identifier and first column; the second column is the working-tree directory name (basename). The full path is not a column — it appears in a row tooltip (`~`-shortened, untruncated). When no remote is configured, the identifier falls back to the directory name.
- Q: How are two independent clones of the same slug shown, and how are same-slug/same-directory-name rows disambiguated? → A: Independent clones of the same slug appear as separate rows (they have different canonical identities and are not deduped), distinguished by directory name and tooltip path; when both slug and directory name collide, a distinguishing parent-path fragment is shown inline.
- Q: What change metrics does a row show? → A: Three — the local (dirty) working-tree change count, shown only when non-zero; and the commit divergence versus the branch's last-known upstream as an `x/y` pair, where x = commits ahead (not pushed) and y = commits behind (not pulled).
- Q: Is branch tracking status shown? → A: Yes — next to the branch name, the row indicates whether the branch tracks a remote upstream or is local-only (no upstream).
- Q: How are row background colors used? → A: Dirty repositories (uncommitted working-tree changes) get a blue background; repositories that are out of sync (something to push or pull — ahead > 0 or behind > 0) get a yellow background. This supersedes the constitution's original dirty=yellow scheme (amended accordingly).
- Q: Must repository state be distinguishable without relying on color alone? → A: Yes — background color MUST be accompanied by a redundant non-color cue (e.g., a small state icon or text/badge) so dirty / out-of-sync / clean states are distinguishable without color (accessibility, per the constitution).
- Q: How are sort ties (equal or absent sort keys) broken so ordering is deterministic? → A: Fall back to directory name, then full path, ascending — both always present — giving a stable, reproducible order across refreshes.
- Q: How is row state indicated visually (after design review)? → A: By a colored left-edge indicator on each row plus a status glyph, NOT a full-row background fill — clean/ok = green, dirty = blue, out-of-sync = amber, unavailable = grey; dirty wins over out-of-sync. (Supersedes the earlier full-row background scheme; the non-color cue is the glyph plus the numeric text.) See `design/README.md`.
- Q: Should the remote host always be shown? → A: No — show the host only when it differs from a configurable default host (default `github.com`); a repository on the default host shows no host line. This removes noise while keeping other hosts (e.g. `github.schibsted.io`) distinguishable.
- Q: Can the user filter the list by repository state? → A: Yes — the list can be filtered to All / clean / uncommitted (dirty) / out-of-sync / unavailable, alongside an at-a-glance composition summary of those counts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my repositories at a glance (Priority: P1)

As someone with many locally cloned repositories, I open the application and
immediately see a list of every repository found inside my observed
directories, each showing its remote slug (with host) as the primary identifier,
its directory name, its current branch, and its change counts — local
working-tree changes plus how many commits it is ahead (unpushed) and behind
(unpulled) — so I can judge the state of all my repos without visiting each one
in a terminal. The full path is available in a tooltip on hover. For any
repository that has additional git worktrees, those worktrees are shown visually
connected to their primary repository, each clearly marked as a worktree (versus
the primary) and carrying its own branch, local change count, and ahead/behind
commit counts.

**Why this priority**: This is the entire reason the tool exists. Without the
list and its core details there is no product; every later capability (pulling,
branch management, worktrees) hangs off this view. Implemented alone, it already
replaces manually running `git status` across many directories.

**Independent Test**: Point the app at a directory containing several cloned
repositories, launch it, and confirm each repository appears once with a correct
slug, directory name, branch, and change counts (local dirty count, and ahead/behind
commit counts).

**Acceptance Scenarios**:

1. **Given** an observed directory containing three git repositories, **When**
   the application starts, **Then** all three repositories are listed, each with
   its remote slug (with host), directory name, current branch, local dirty count,
   and ahead/behind commit counts.
2. **Given** a repository located under the user's home directory, **When** the
   user hovers its row, **Then** its full path is shown in a tooltip, shortened
   with a leading `~`; the path is not shown as its own column.
3. **Given** a repository with uncommitted working-tree changes, **When** it is
   listed, **Then** its local (dirty) change count reflects the number of changed
   files and is greater than zero; a clean repository shows no local count.
4. **Given** a repository with local commits not yet pushed and upstream commits
   not yet pulled (per the last-known remote state), **When** it is listed,
   **Then** its ahead/behind pair shows the unpushed count as x and the unpulled
   count as y.
5. **Given** an observed directory that also contains ordinary (non-git)
   subdirectories, **When** the application scans it, **Then** only git
   repositories appear in the list and non-repos are ignored without error.
6. **Given** a repository that has one or more linked worktrees, **When** it is
   listed, **Then** each worktree is displayed visually connected to that
   repository, clearly distinguished as a worktree from the primary, with its own
   directory name, branch (with tracking status), local change count, and ahead/behind
   commit counts (full path in tooltip).
7. **Given** the worktree filter is toggled off, **When** the list is shown,
   **Then** only primary repositories are displayed and worktrees are hidden;
   **and Given** it is toggled on (the default), **Then** worktrees are shown.
8. **Given** the same repository slug cloned into two different locations, **When**
   the list is shown, **Then** both appear as separate rows distinguished by
   directory name and full-path tooltip (and by a parent-path fragment inline if
   the directory names also match).

---

### User Story 2 - Manage which directories are observed (Priority: P2)

As a user whose repositories live in a few different parent folders, I can add
one or more directories for the application to observe and remove ones I no
longer care about, so the dashboard reflects exactly the set of repositories I
work with.

**Why this priority**: The dashboard is only useful once it points at the right
places. It is P2 rather than P1 because an initial configured directory can seed
the P1 view; in-app management makes the tool self-sufficient and long-lived.

**Independent Test**: Add a directory through the app, confirm its repositories
appear; remove it, confirm they disappear; restart the app and confirm the
observed-directory set persisted.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** the user adds a directory that
   contains repositories, **Then** those repositories appear in the list.
2. **Given** a directory is currently observed, **When** the user removes it,
   **Then** its repositories are removed from the list.
3. **Given** the user has configured a set of observed directories, **When** the
   application is closed and reopened, **Then** the same directories are still
   observed.
4. **Given** the user adds a path that does not exist or cannot be read, **When**
   they confirm, **Then** the application reports the problem and does not add an
   unusable directory.
5. **Given** no directories are observed (first launch or all removed), **When** the
   dashboard is shown, **Then** a guided empty state explains that nothing is being
   observed and offers a prominent action to add a directory.

---

### User Story 3 - Refresh the list on demand (Priority: P3)

As a user who has changed a repository's state (or acted on it outside the app)
while the dashboard is open, I want to trigger a refresh myself so the displayed
information becomes current, without restarting the application.

**Why this priority**: The startup scan (User Story 1) already gives a usable
snapshot; on-demand refresh lets the user bring that snapshot up to date when
they know something changed. There is no automatic/periodic refresh in this
feature.

**Independent Test**: Change a repository's state outside the app (e.g., create
an uncommitted change), trigger a manual refresh, and confirm the displayed
counts update; confirm the list does not change on its own without a refresh
action.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** the user triggers a manual
   refresh, **Then** the repository list re-reads local state and updates
   displayed values.
2. **Given** no refresh action is taken, **When** time passes, **Then** the
   displayed information does not change on its own (no automatic refresh).
3. **Given** a refresh is in progress, **When** the user interacts with the
   application, **Then** the interface remains responsive.
4. **Given** one observed repository whose git command hangs, **When** a refresh
   runs, **Then** the other repositories still update and the hung one is marked
   unavailable/stale without blocking the refresh.

---

### Edge Cases

- A repository is in a detached-HEAD state (no branch name): the current branch
  field shows the detached state clearly rather than blank.
- A repository has no configured remote or no upstream branch: the slug and/or
  ahead/behind counts are shown as unavailable rather than causing an error. When
  the slug (primary identifier) is unavailable, the row falls back to showing the
  directory name as its identifier, marked as having no remote.
- The same repository slug is cloned independently into two different observed
  locations (two separate clones, distinct canonical identities): both appear as
  separate rows and are NOT merged; they are distinguished by directory name and
  full-path tooltip. If the directory names also match, a parent-path fragment is
  shown inline to disambiguate them.
- An observed directory is very large or deeply nested: scanning tolerates it and
  does not block the interface.
- A repository disappears (deleted on disk) between refreshes: it is removed from
  the list on the next refresh without error.
- The same repository is reachable through two observed directories or symlinks:
  it appears only once.
- A repository nested deeper than the immediate children of an observed
  directory is not discovered (by design; scanning is one level deep). To list
  such a repository the user adds its parent folder as an observed directory.
- The system git client is missing or unusable: the application reports this
  clearly instead of showing empty or misleading data.
- A repository has no commits yet (unborn HEAD): its last change time is shown as
  unavailable and it sorts consistently (e.g., last) under last-change ordering.
- A repository has no linked worktrees: it is shown as a single primary entry with
  no worktree grouping.
- A worktree's directory is missing on disk or prunable (stale): it is shown as
  unavailable rather than causing an error.
- A worktree's directory happens to sit inside an observed directory's immediate
  children: it is shown once, connected to its primary repository, and not also as
  an independent primary repository.
- A discovered directory is a linked worktree whose primary (main working tree)
  lives outside every observed directory: the application does NOT discover, stat, or
  render the external primary's working tree — it is neither shown as a row nor
  traversed. The discovered worktree is shown in-scope, marked as having its primary
  outside the observed directories. (Probing the in-scope worktree still reads the
  repository's shared git metadata, which may physically reside outside the observed
  directory; that read is intrinsic to inspecting the worktree and is bounded by the
  per-inspection timeout.) To see the full family, the user adds the primary's parent
  as an observed directory.
- A repository's git command hangs or is extremely slow (e.g., stalled network
  filesystem or lock contention): its inspection times out, it is marked
  unavailable/stale, and the rest of the list refreshes and stays responsive.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST run entirely on the user's local machine.
- **FR-002**: Users MUST be able to designate one or more directories to be
  observed for git repositories.
- **FR-003**: The application MUST discover git repositories among the direct
  child directories of each observed directory at startup. It MUST NOT recurse
  below the immediate children (an observed directory is expected to be the
  parent folder of the repositories, e.g. an org folder).
- **FR-004**: The application MUST ignore non-repository directories within
  observed directories without producing errors.
- **FR-005**: For each discovered repository, the application MUST display the
  working-tree directory name (its basename) as a column, and MUST make the full
  path available on hover as a tooltip (shortened with a leading `~` when within
  the user's home directory, and not truncated). The full path MUST NOT occupy its
  own column. When two visible rows share both the same slug and the same directory
  name, the application MUST show a distinguishing parent-path fragment inline so
  the rows are unambiguous.
- **FR-006**: For each repository, the application MUST display its remote slug
  (the owner/repository identifier derived from its configured remote). It MUST also
  display the remote host/server (e.g. `github.schibsted.io`) **when that host differs
  from a configurable default host** (default `github.com`), so repositories on other
  hosts remain distinguishable; a repository on the default host MUST NOT show a
  redundant host line. The slug is the row's primary display identifier; when no
  remote is configured, the identifier falls back to the directory name, marked as
  having no remote.
- **FR-007**: For each repository, the application MUST display the name of the
  currently checked-out branch, and MUST clearly indicate when the repository is
  not on a branch (detached HEAD). Next to the branch name, the application MUST
  indicate whether the branch tracks a remote upstream or is local-only (has no
  configured upstream).
- **FR-008**: For each repository, the application MUST display a count of local
  (dirty) changes: the number of changed paths in the working tree, including
  untracked files and excluding gitignored files (equivalent to the number of
  entries git reports for the repository's status in machine-readable form). This
  count MUST be surfaced only when non-zero (a dirty working tree); a clean
  working tree shows no count.
- **FR-009**: For each repository, the application MUST display the commit
  divergence between the current branch and its upstream, based on the last-known
  remote-tracking state: the number of commits the local branch is ahead (unpushed)
  and the number it is behind (unpulled). These MUST be displayed together as an
  `x/y` pair where x is ahead (unpushed) and y is behind (unpulled). When the
  current branch has no upstream (or the repository is detached), both counts MUST
  be shown as unavailable.
- **FR-010**: The application MUST use the system-installed git client and the
  system's existing git credentials; it MUST NOT bundle its own git or store or
  prompt for credentials.
- **FR-011**: The startup scan and manual refresh MUST be read-only and MUST NOT
  modify any repository's working tree, branches, or history, and MUST use
  non-mutating git invocations that do not write repository metadata (including the
  git index/stat cache).
- **FR-012**: The application MUST refresh repository information at startup and
  only on explicit user action thereafter; it MUST NOT run any background,
  scheduled, or timer-based refresh.
- **FR-014**: Users MUST be able to trigger a refresh manually at any time, which
  re-reads local repository state and updates all displayed values.
- **FR-015**: The application MUST persist the set of observed directories across
  restarts.
- **FR-016**: Users MUST be able to remove a previously observed directory, after
  which its repositories no longer appear.
- **FR-017**: The application MUST remain responsive during scanning and
  refreshing.
- **FR-018**: The application MUST handle repositories with no remote, no
  upstream, or that have been deleted on disk without crashing, showing the
  affected values as unavailable.
- **FR-019**: The application MUST report clearly when the system git client is
  unavailable — or is present but lacks a capability required for read-only
  inspection (e.g., the non-mutating invocations in FR-011) — rather than presenting
  empty or misleading data or falling back to a mutating command path; affected
  repositories MUST be shown in a degraded/unavailable state (per FR-027).
- **FR-020**: The application MUST allow the user to sort the repository list by
  one of these dimensions — slug (owner/repository), directory name, last change
  time, or local change count — each in ascending or descending direction. It MUST
  default to slug ascending and MUST persist the chosen sort dimension and direction
  across restarts. Sorting MUST reorder primary repositories only; each primary's
  worktrees MUST remain grouped directly beneath it regardless of the chosen sort.
  When sorting by local change count, the sort key for a primary MUST be the sum of
  its own local change count and those of its linked worktrees (each row still
  displays its own count per FR-008 and FR-023). Ordering MUST be deterministic: when
  the chosen sort key is equal between two primaries, or absent (e.g., a repository
  with no remote has no slug to sort by), the application MUST break the tie by
  directory name, then by full path, ascending — both of which are always present and
  unique enough to guarantee a stable, reproducible order across refreshes.
- **FR-021**: For each discovered repository, the application MUST identify its
  linked git worktrees by querying git (not by directory scanning).
- **FR-022**: The application MUST display a repository's worktrees visually
  connected to that repository (e.g., grouped/nested with it) and MUST clearly
  distinguish the primary repository from its worktrees.
- **FR-023**: For each worktree, the application MUST display its own directory
  name (full path in tooltip), its checked-out branch (or detached state) with its
  branch tracking status (per FR-007), its own local (dirty) change count (per
  FR-008), and its own ahead/behind commit divergence against its own upstream (per
  FR-009); the remote slug is shared with the primary repository. A worktree's state
  is derived from its own counts, independently of the primary's (a worktree may be
  on a different branch than the primary).
- **FR-024**: The application MUST provide a filter to show or hide worktrees in
  the list, defaulting to showing worktrees. Hiding worktrees MUST leave primary
  repositories visible.
- **FR-025**: When no directories are observed (first launch or after all are
  removed), the application MUST show a guided empty state that explains nothing is
  being observed and offers a prominent action to add a directory.
- **FR-026**: The application MUST identify each working tree by a canonical
  identity that resolves symlinks and shared git metadata so that (a) a repository
  reachable through multiple observed directories or symlinks appears exactly once;
  (b) all working trees sharing the same underlying repository are grouped as one
  family; (c) when the family's main working tree is itself within an observed
  directory, it is shown as the primary with every linked worktree beneath it, never
  as an independent primary row; when the main working tree lies outside all observed
  directories, the application MUST NOT discover, stat, or render the external
  primary's working tree (no external row, no traversal of its files) — the in-scope
  worktree(s) are shown and marked as having their primary outside the observed
  directories. (Reading the repository's shared git metadata, which may reside outside
  the observed directory, is intrinsic to probing the in-scope worktree and is bounded
  by the per-inspection timeout of FR-027; it is not a working-tree inspection.)
  Deduplication and grouping MUST be deterministic regardless of discovery order.
- **FR-027**: Repository inspection during scan and refresh MUST be isolated per
  repository: a repository whose git commands hang, error, or exceed a bounded
  per-repository time budget MUST NOT block or delay inspection of other
  repositories. An unresponsive repository MUST be shown in a degraded state
  (unavailable/stale/timed-out) while all other repositories complete and render.
  Refresh MUST always terminate in bounded time regardless of any single
  repository's responsiveness.
- **FR-028**: The application MUST convey each listed row's state through a colored
  **left-edge state indicator** (a bar on the leading edge of the row), applied per
  row (primary repository or worktree) based on that row's own counts and
  availability: clean and in sync = green, dirty (local changes > 0) = blue, out of
  sync with upstream (ahead > 0 or behind > 0) = amber, unavailable = grey. When a row
  is both dirty and out of sync, the dirty (blue) indicator MUST take precedence. The
  state indicator MUST NOT be a full-row background fill (superseding the earlier
  background scheme). Color MUST NOT be the sole indicator of state: each state MUST
  also be conveyed by a redundant non-color cue — a per-state status glyph plus the
  row's numeric text (e.g. "clean" / "N changed" / ahead-behind counts / "—") — so the
  state is distinguishable without relying on color. See `design/README.md`.
- **FR-029**: The application MUST let the user filter the list by row state — All
  (default), clean, dirty (uncommitted), out-of-sync, or unavailable — and MUST show
  an at-a-glance composition summary of how many rows are in each state. The state
  filter combines with the worktree filter (FR-024).

### Key Entities *(include if feature involves data)*

- **Observed Directory**: A filesystem location the user has designated for the
  application to scan for repositories. Key attributes: path, and whether it is
  currently readable.
- **Repository**: A git repository (its primary working tree) discovered inside an
  observed directory. Key attributes: directory name (basename) and full path
  (shown via tooltip), remote slug (primary identifier), remote host/server, current
  branch (or detached state), branch tracking status (tracks a remote upstream or is
  local-only), local (dirty) change count, ahead (unpushed) count, behind (unpulled)
  count, last change time (commit date of the latest commit on the current branch),
  availability status, derived row state (clean / dirty / out-of-sync / unavailable,
  which drives the left-edge state indicator and status glyph), and its set of linked
  worktrees.
- **Worktree**: An additional git worktree linked to a primary repository. Key
  attributes: directory name (basename) and full path (tooltip), checked-out branch
  (or detached state), branch tracking status, local (dirty) change count, ahead
  (unpushed) count, behind (unpulled) count, and derived row state (clean / dirty /
  out-of-sync / unavailable, which drives its own left-edge state indicator and
  status glyph). It belongs to exactly one primary repository and shares that
  repository's remote slug.
- **Settings**: User configuration persisted across restarts. Key attributes:
  the set of observed directories, the repository list sort dimension (slug,
  directory name, last change time, or local change count), the sort direction
  (ascending or descending), the worktree show/hide filter (FR-024), and the default
  remote host used to decide when a row's host is shown (FR-006; default `github.com`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from launching the application to seeing the full
  list of their repositories with core details in under 10 seconds for a typical
  set (up to 50 repositories).
- **SC-002**: Every git repository located in the immediate child directories of
  an observed directory appears exactly once — with no false entries for
  non-repository folders and no duplicates for repositories reachable via multiple
  paths or symlinks (100% accuracy on a known test directory). Repositories nested
  deeper than one level are out of discovery scope per FR-003.
- **SC-003**: Displayed branch, branch tracking status, local (dirty) change
  count, and ahead/behind commit counts for each listed row (primary repository or
  worktree) match what the user would see running standard git commands in that
  working tree, for 100% of listed rows at the moment of the last refresh.
- **SC-004**: After a repository's local state changes, the displayed values
  reflect the change immediately following a manual refresh (or the next app
  startup).
- **SC-005**: The application never alters any repository's working tree, branches
  (refs), or commit history as a result of scanning or refreshing (0 unintended
  modifications across normal use); internal git housekeeping such as the
  index/stat-cache is avoided by using non-mutating git invocations.
- **SC-006**: The interface stays responsive (no perceptible freeze) while
  scanning a directory of at least 50 repositories.
- **SC-007**: A single unresponsive repository does not prevent the rest from
  refreshing; refresh completes for all responsive repositories within their normal
  time even when one repository is hung.
- **SC-008**: A user who cannot perceive the state colors (e.g., color-blind, or
  viewing a grayscale screenshot) can still correctly identify each listed row's state
  (clean, dirty, out-of-sync, or unavailable) from the redundant non-color cue (status
  glyph plus numeric text), for 100% of listed rows (primary repositories and
  worktrees).

## Assumptions

- **Single local user**: The application serves one user on their own machine;
  no multi-user, accounts, or remote access are in scope.
- **Change-count definitions**: A row shows three quantities. "Local (dirty)
  changes" is the number of changed paths in the working tree, including untracked
  files but excluding gitignored files (equivalent to the count of `git status
  --porcelain` entries), matching how common git apps report changes. "Ahead
  (unpushed)" is the number of commits the local branch has that its upstream does
  not; "behind (unpulled)" is the number of commits the upstream has that the local
  branch does not. Ahead/behind are computed against the last-known upstream and
  shown as an `x/y` pair (x = ahead, y = behind).
- **Refresh does not fetch from remotes**: Startup and on-demand (manual) refresh
  read local repository state only; ahead/behind counts are computed from the
  last-known remote-tracking state. Fetching/updating remote state is a separate
  explicit action deferred to a later feature. (This keeps refresh read-only and
  free of surprise network traffic, per the project constitution.)
- **Slug source**: The remote slug and host/server are derived from the
  repository's configured remote (the origin remote when present); the slug is the
  row's primary display identifier. When no remote is configured, both the slug and
  host are unavailable and the row falls back to the directory name as its
  identifier.
- **Display identity vs canonical identity**: The slug is the user-facing display
  identifier (what a row leads with); the canonical identity (see below) is the
  technical key used for dedup and worktree grouping. They are independent — two
  independent clones of the same slug have different canonical identities and are
  therefore shown as separate rows, never merged.
- **Scan depth**: Scanning is one level deep — only the direct child directories
  of an observed directory are inspected for being a repository. Repositories
  nested more deeply are not discovered; the user adds their parent folder as an
  observed directory to include them.
- **Canonical identity**: A working tree's identity is the pair (real path of its
  shared git directory, real path of its working-tree root) — obtained from git's
  reported common git directory and top-level path with symlinks resolved. Working
  trees that share a common git directory form one repository family; the family's
  main working tree (its git directory equals the common git directory) is the
  primary and all others are its worktrees. This is the concrete basis for the
  dedup and grouping required by FR-026.
- **Non-mutating reads**: Repository state is read with git invocations that avoid
  opportunistic metadata writes (e.g., `git --no-optional-locks status`), so even
  the git index is untouched during scan/refresh. Verified: plain `git status`
  rewrites `.git/index`; `--no-optional-locks` does not. This is the concrete basis
  for the read-only guarantee in FR-011 and SC-005.
- **Per-repository time budget**: Each repository's inspection has a default
  deadline of 5 seconds; a repository exceeding it is treated as unresponsive and
  rendered in a degraded state while others continue (FR-027). The value is a
  tunable default, not a hard contract, and may be revisited in planning.
- **Worktrees are display-only here**: This feature only discovers and displays
  worktrees connected to their primary repository and lets the user show/hide them
  via a filter. Creating or removing worktrees is out of scope and deferred to a
  later feature.
- **Worktree discovery**: Worktrees are enumerated by querying git for each
  repository, not by scanning directories, so a worktree is attributed to its
  primary repository regardless of where on disk it lives.
- **This feature's scope**: Per-repository actions (pull, change branch, delete
  branches, create/remove worktrees, fetch/pull all, external-tool launchers) are
  explicitly out of scope for this feature and will be specified separately.
- **Minimum git version**: The application assumes a system git recent enough to
  support the non-mutating read flags in FR-011 (`git --no-optional-locks`, available
  since git 2.15). If the system git is older or lacks a required capability, affected
  repositories are marked unavailable with a clear reason (FR-019) rather than falling
  back to a mutating command. The exact supported floor is a tunable default to be
  confirmed in planning.
- **Platform**: The application is a local desktop application. Specific platform
  and packaging choices are deferred to planning.
