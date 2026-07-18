# Feature Specification: Update All Repositories

**Feature Branch**: `006-update-all-repositories`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Add pull and fetch option - button in the header, not per repo. I want to refresh all repositories but I don't want to deal with conflicts. Use ready to use script to perform update for each repository: ./local/upgrade-repo.sh (move it to the app, change logs as you need but keep main logic unchanged) When script is working, icon should be animated. ignore local only repos. ignore repos without remote branch tracked."

## Clarifications

### Session 2026-07-18

- Q: How should the update handle a repo whose fetch needs credentials or whose remote is slow/unreachable (which can hang git with no TTY)? → A: Run git non-interactively (credential prompts fail immediately) AND apply a per-repo time limit; any repo exceeding it is abandoned, marked failed, and the run continues.
- Q: For repositories that fail, how much detail does the user get? → A: Counts only ("X updated, Y skipped, Z failed") plus failed rows staying visibly out-of-sync/dirty; no per-repository failure reason is captured or shown.
- Q: The reused script's `-Xours` auto-merge on divergence conflicts with the project constitution's Principle III (Never Resolve Conflicts). How to reconcile? → A: Adapt to the constitution — keep auto-stash + fast-forward + non-destructive rollback, but on a diverged branch STOP, leave the repo in its original inspectable state, and mark it failed (light red). Do NOT auto-merge, rebase, or auto-resolve; integration is fast-forward only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update every repository in one click, without touching conflicts (Priority: P1)

A user managing many repositories wants all of them brought up to date with their
remotes at once. They click a single control in the header. Every eligible
repository that can fast-forward is brought up to date automatically; a
repository that has diverged from its remote is left untouched and flagged
rather than auto-merged. The user is never asked to resolve a merge conflict,
and none of their uncommitted work is lost — anything that was in progress is
set aside before the update and put back afterward.

**Why this priority**: This is the core value. Without it, the feature does not
exist. A single one-click, conflict-free "bring everything up to date" is the
entire reason for the request.

**Independent Test**: With several eligible repositories (some clean, some with
uncommitted changes, some behind their remote), activate the control once and
confirm each behind repository advances to match its remote while every
uncommitted change is preserved and no conflict prompt appears.

**Acceptance Scenarios**:

1. **Given** a clean repository whose current branch is behind its tracked
   upstream, **When** the user activates the update control, **Then** the
   repository is fast-forwarded to the upstream and shows as up to date.
2. **Given** a repository with uncommitted local changes and a behind branch,
   **When** the update runs, **Then** the local changes are set aside, the
   remote changes are integrated, and the local changes are restored afterward
   with no conflict prompt.
3. **Given** a repository whose branch has diverged from its upstream (a
   fast-forward is not possible), **When** the update runs, **Then** the
   repository is left in its original inspectable state, is marked failed, and
   the user is not asked to resolve anything (they can open it in their own
   merge tool later).
4. **Given** a repository that is already up to date, **When** the update runs,
   **Then** it is left unchanged.

---

### User Story 2 - See that an update is running and know when it finishes (Priority: P2)

While the update is in progress, the user needs unambiguous feedback that work
is happening, must not be able to accidentally start a second run, and wants a
short summary of what happened when it finishes.

**Why this priority**: Updating many repositories takes time. Without a running
indicator and re-entry guard, the user cannot tell whether anything is
happening and may trigger overlapping runs. It builds directly on P1 but is not
required for the core update to work.

**Independent Test**: Activate the control and confirm its icon animates for the
full duration, the control cannot be re-triggered while busy, and a summary of
outcomes appears when it completes.

**Acceptance Scenarios**:

1. **Given** the update is running, **When** the user looks at the header
   control, **Then** its icon is animated for as long as the run continues.
2. **Given** the update is running, **When** the user activates the control
   again, **Then** no second run starts.
3. **Given** the update finishes, **When** the run completes, **Then** the
   dashboard reflects each repository's new state and a single summary line
   reports how many repositories were updated, were already current, were
   skipped, and failed.

---

### User Story 3 - Ineligible repositories are left alone (Priority: P3)

The user has repositories that are not connected to a remote, or are on branches
that do not track a remote branch. These must never be touched by the update.

**Why this priority**: Prevents surprising or meaningless actions (e.g., trying
to pull a purely local project). Refines the P1 behavior; the core update is
still useful without it, but this keeps the action safe and predictable.

**Independent Test**: Include a repository with no remote and a repository whose
branch has no tracked upstream, run the update, and confirm neither is modified
and both are reported as skipped.

**Acceptance Scenarios**:

1. **Given** a repository with no remote configured (local-only), **When** the
   update runs, **Then** it is skipped and left unchanged.
2. **Given** a repository whose current branch has no tracked upstream branch,
   **When** the update runs, **Then** it is skipped and left unchanged.
3. **Given** a repository whose working directory is unavailable or is in a
   detached-HEAD state, **When** the update runs, **Then** it is skipped and
   left unchanged.

---

### Edge Cases

- **Uncommitted changes cannot be cleanly restored after a fast-forward**: the
  update leaves the repository on the updated remote baseline and the user's
  changes remain safely recoverable (preserved in a stash, not lost); this
  repository is reported as failed (needing attention) rather than as a clean
  success.
- **Branch has diverged from its upstream** (both have new commits, so a
  fast-forward is impossible): the repository is left in its original inspectable
  state and reported as failed. The application never auto-merges, rebases, or
  auto-resolves — it hands off to the user's own merge tool (Principle III).
- **Fetch fails** (network or authentication problem): the repository is left
  untouched and reported as failed; other repositories continue.
- **A repository would require interactive credentials**: git is run
  non-interactively, so the attempt fails immediately rather than blocking on a
  hidden prompt; the repository is left untouched and reported as failed.
- **A repository's fetch/integration is slow or its remote is unreachable**: the
  attempt is abandoned once it exceeds a per-repository time limit, the
  repository is left untouched and reported as failed, and the run continues so
  it always terminates.
- **Local branch is ahead of remote**: the repository is left as-is (pushing is
  out of scope) and counts as up to date, not failed.
- **No eligible repositories exist**: the run completes immediately with a
  summary indicating nothing needed updating.
- **A single repository fails**: it does not abort the whole run; every other
  eligible repository is still processed.
- **Worktrees**: each worktree is treated as its own working tree using the same
  eligibility rule; a worktree on an un-pushed branch (no tracked upstream) is
  automatically skipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single control in the header (not
  per-row) that updates all eligible repositories, distinct from the existing
  Refresh control (which only re-scans and does not fetch or integrate).
- **FR-002**: When activated, the system MUST attempt to bring every eligible
  repository up to date with its tracked upstream by fetching and integrating
  remote changes, without requiring the user to resolve conflicts.
- **FR-003**: The system MUST preserve any uncommitted local changes across the
  update — set them aside before integrating and restore them afterward — and
  MUST never silently discard the user's work. If restoration cannot complete
  cleanly, the changes MUST remain recoverable.
- **FR-004**: Integration MUST be limited to fast-forward updates. On a diverged
  branch (local and remote have both advanced, so a fast-forward is impossible),
  the system MUST NOT auto-merge, rebase, or otherwise auto-resolve; it MUST stop
  for that repository, leave it in its original inspectable state, and mark it
  failed (Principle III — Never Resolve Conflicts).
- **FR-005**: The system MUST skip repositories that have no remote configured
  ("local-only" repositories).
- **FR-006**: The system MUST skip repositories whose current branch has no
  tracked upstream branch.
- **FR-007**: The system MUST skip repositories whose working directory is
  unavailable or whose HEAD is detached (no current branch to update).
- **FR-008**: The system MUST apply the update to each eligible working tree
  shown in the dashboard — primary repositories, their linked worktrees, and
  orphan worktrees — using the same eligibility rules (FR-005 through FR-007).
- **FR-009**: While the update is running, the control's icon MUST be animated,
  and the control MUST NOT start a second concurrent run when activated again.
- **FR-010**: A failure updating one repository MUST NOT stop the run; the
  system MUST continue processing all other eligible repositories.
- **FR-011**: When the run completes, the dashboard MUST reflect each
  repository's resulting state (e.g., recomputed ahead/behind), and the system
  MUST present a single summary of how many repositories were updated, were
  already current, were skipped, and failed. The summary reports counts only; no
  per-repository failure reason is captured or shown.
- **FR-012**: Repositories that are already up to date MUST be treated as a
  no-op success and left unchanged.
- **FR-013**: The system MUST NOT hang the run on any single repository. Git
  operations MUST run non-interactively (a repository requiring credentials
  fails immediately instead of prompting), and each repository's update MUST be
  bounded by a per-repository time limit after which it is abandoned, marked
  failed, and the run continues. Every run MUST terminate.
- **FR-014**: Repositories whose update failed (diverged, fetch failed,
  timed out, credentials required, or stash could not be restored) MUST be
  surfaced with the failed-pull state indicator (light red) defined by the
  always-observable-state requirement, until the next update run. Because colour
  MUST NOT be the sole signal of state, the failed row MUST also carry a
  redundant non-colour cue that distinguishes "pull failed" from an ordinary
  out-of-sync row — a status glyph plus an on-demand text explanation (e.g. a
  tooltip: "pull failed — open in your merge tool"). Handoff to a merge tool is
  available through the existing per-row launchers; no new merge UI is
  introduced.

### Key Entities *(include if feature involves data)*

- **Eligible repository**: a working tree the dashboard tracks that is
  available, is on a (non-detached) branch, and whose branch tracks a remote
  upstream. Both primary repositories and worktrees can be eligible. Only
  eligible working trees are updated.
- **Update outcome**: the per-repository result of the run — one of *updated*
  (fast-forwarded), *already current* (nothing to pull), *skipped* (ineligible,
  never attempted), or *failed* (diverged, fetch/timeout/credential failure, or
  stash could not be restored). Outcomes are aggregated into the completion
  summary; failed outcomes also drive the light-red row indicator (FR-014).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can bring all fast-forwardable repositories up to date with
  a single action, and is never required to resolve a merge conflict inline;
  diverged repositories are flagged, not modified.
- **SC-002**: No uncommitted local change is ever lost as a result of the
  update — in 100% of runs, any pre-existing local change is either restored or
  remains recoverable.
- **SC-003**: Repositories that are local-only, have no tracked upstream, are
  unavailable, or are in detached HEAD are never modified by the update.
- **SC-004**: After a run, the user can tell from the dashboard and the summary
  which repositories were updated, were already current, were skipped, and
  failed.
- **SC-005**: During a run the user always has a clear visual indication that it
  is in progress, and cannot accidentally start a second concurrent run.
- **SC-006**: A single failing repository never prevents the other eligible
  repositories in the same run from being updated.
- **SC-007**: Every run terminates on its own — no repository (credential
  prompt, unreachable remote, or slow network) can leave the run stuck or the
  progress indicator animating indefinitely.

## Assumptions

- The update reuses the *non-destructive* parts of the existing
  `upgrade-repo.sh` (`git-auto-sync.sh`): auto-stash of dirty/untracked work,
  fetch of the tracked upstream, fast-forward when possible, and rollback that
  restores the stash on failure. Per the project constitution (Principle III),
  the script's `-Xours` 3-way auto-merge on divergence is deliberately NOT
  carried over — a diverged repository is left untouched and marked failed
  instead. This is a conscious deviation from the request's "keep main logic
  unchanged", agreed during clarification, because the auto-merge branch
  violates a core safety principle.
- "Refresh all repositories" means updating local branches to their tracked
  upstreams (fetch + integrate). It does not push local commits; repositories
  that are ahead of their remote are left as-is.
- Eligibility is uniform across primary repositories and worktrees. A worktree
  is updated only when its own branch tracks a remote upstream, so worktrees on
  un-pushed feature branches are naturally skipped.
- The completion summary is a single lightweight line (counts of updated /
  already current / skipped / failed); detailed per-repository state is conveyed
  by the refreshed rows rather than a separate report. A richer per-repository
  activity view is out of scope for this feature.
- The existing header Refresh control (re-scan only) remains unchanged; this
  feature adds a separate update control alongside it.
- Whether repositories are updated one at a time or several at once is an
  implementation detail; the requirement is only that the run completes and the
  control stays animated until it does.
