# Feature Specification: Cleanup Gone Branches and Worktrees

**Feature Branch**: `008-branch-cleanup`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Add branches cleanup feature. new button. When clicked run for each repo (not worktree) Script to use: ~/local/git-cleanup-all.sh it should remove gone branches and worktrees. After run summary like for pull all. Name: Cleanup"

## Clarifications

### Session 2026-07-18

- Q: Cleanup is a bulk, irreversible (branch/worktree deleting) action that Constitution Principle II says needs per-item confirmation. What confirmation model? → A: A single entry point that first shows a **review overlay** listing, per repository, the branches to be removed (with an indicator when a worktree would also be removed). Every item is **selected by default**; the user may unselect individual items. Only the still-selected items are removed after the user confirms; cancelling removes nothing.
- Q: When a "gone" branch still holds commits merged nowhere (force-delete would lose them), skip or force-delete? → A: **Force-delete all gone branches** (merged or not). Data-loss safety comes from the review overlay: every branch is visible and can be unselected before anything runs, so each deletion is explicitly confirmed.
- Q: What counts as a removable worktree? → A: **Both** worktrees whose directory is already missing (prune) **and** worktrees whose branch is already merged or gone. Worktrees with uncommitted changes MUST NOT be removed.
- Q: The engine script `~/local/git-cleanup-all.sh` exists and only removes worktrees attached to a `[gone]` branch — narrower than the worktree scope above. Match the script or extend it? → A: **Extend the script.** Its `[gone]`-branch branch/worktree removal is the core engine (confirmed: `git fetch -p` first, `git branch -D` force-delete, protects the current branch and the main worktree, and `git worktree remove` fails safely on uncommitted work). On top of that, Cleanup MUST also prune worktrees whose directory is already missing and worktrees whose branch is already merged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean up stale branches and worktrees across all repositories in one action (Priority: P1)

A user managing many repositories accumulates local branches whose upstream has
been deleted ("gone" branches, typically left over after a pull request is
merged and its remote branch removed) and worktrees that are no longer needed.
Rather than visiting each repository and pruning by hand, the user activates a
single "Cleanup" control in the header. The app scans every repository
(operating on each repository as a whole, not on individual worktree rows) and
presents a review overlay of everything it proposes to remove. Once the user
confirms, the selected stale branches and stale worktrees are removed, leaving
each repository tidy.

**Why this priority**: This is the entire feature. A one-action "tidy every
repo" is the reason for the request; without it nothing else matters.

**Independent Test**: With several repositories that each contain at least one
branch whose upstream is gone (and at least one repository with a removable
worktree), activate the control, confirm the review overlay lists them, accept,
and confirm the stale branches and stale worktrees are gone from each repository
while everything still in active use is left intact.

**Acceptance Scenarios**:

1. **Given** a repository with a local branch whose tracked upstream is gone,
   **When** the user activates Cleanup and confirms the overlay with that branch
   still selected, **Then** that branch is removed from the repository.
2. **Given** a repository with a worktree eligible for removal, **When** Cleanup
   is confirmed with that worktree's entry selected, **Then** that worktree is
   removed.
3. **Given** a repository with only branches that still have live upstreams (or
   are the checked-out branch), **When** Cleanup scans, **Then** that repository
   contributes nothing to the review overlay and nothing is removed from it.
4. **Given** the dashboard shows both repository rows and worktree rows, **When**
   the user activates Cleanup, **Then** the scan and removal are performed once
   per repository and worktree rows do not each trigger their own separate run.

---

### User Story 2 - Review and choose what gets deleted before anything is removed (Priority: P1)

Because Cleanup deletes branches and worktrees (including branches whose commits
were never merged), the user must see exactly what will be removed and be able to
opt out of individual items before any deletion happens.

**Why this priority**: This is a co-critical safety half of the feature. Without
the review-and-select step, a one-click bulk delete could destroy unmerged work
and would violate the project's destructive-action safeguards. It is P1 because
the P1 removal flow depends on it.

**Independent Test**: Trigger Cleanup with several removable branches across
repositories, unselect a subset in the overlay, confirm, and verify that exactly
the still-selected items were removed and the unselected ones remain.

**Acceptance Scenarios**:

1. **Given** the scan found removable items, **When** the overlay appears, **Then**
   it lists them grouped by repository, every item is selected by default, and an
   entry that also removes a worktree is visibly indicated as such.
2. **Given** the overlay is shown, **When** the user unselects some items and
   confirms, **Then** only the still-selected items are removed and the unselected
   items are left intact.
3. **Given** the overlay is shown, **When** the user cancels, **Then** nothing is
   removed from any repository.
4. **Given** the scan found nothing removable, **When** Cleanup is triggered,
   **Then** the user is told there is nothing to clean up and no destructive
   action is offered.

---

### User Story 3 - See that cleanup is running and get a summary when it finishes (Priority: P2)

While cleanup runs across many repositories, the user needs unambiguous feedback
that work is happening, must not be able to start a second overlapping run, and
wants a short summary of what happened when it finishes — consistent with the
existing "Pull all" experience.

**Why this priority**: Cleanup across many repositories takes time. Without a
running indicator, a re-entry guard, and a closing summary, the user cannot tell
whether anything happened. It builds on P1 but is not required for the core
cleanup to work.

**Independent Test**: Activate the control and confirm its icon animates for the
full duration, the control cannot be re-triggered while busy, and a counts-based
summary appears when it completes.

**Acceptance Scenarios**:

1. **Given** cleanup is running, **When** the user looks at the header control,
   **Then** its icon is animated for as long as the run continues.
2. **Given** cleanup is running, **When** the user activates the control again,
   **Then** no second run starts.
3. **Given** cleanup finishes, **When** the run completes, **Then** a summary of
   outcomes (counts) is shown, in the same form as the "Pull all" summary.

---

### Edge Cases

- **Gone branch with unmerged commits**: a branch whose upstream is gone may
  still hold commits that were never merged anywhere. It is listed in the review
  overlay (selected by default) and force-deleted only if the user leaves it
  selected and confirms — the overlay is the explicit per-item confirmation that
  prevents silent loss.
- **Currently checked-out branch is "gone"**: it cannot be deleted while checked
  out; it MUST be skipped rather than causing the repository's cleanup to fail.
- **A worktree has uncommitted changes**: removing it would discard that work;
  such a worktree MUST NOT be silently removed (skip and report).
- **Repository is unavailable / times out**: during removal it is counted as
  failed; during the scan it is skipped and contributes no candidates (surfaced by
  its existing unavailable/stale state). Either way the run continues to the next
  repository (mirrors Pull all). See FR-014.
- **A repository has nothing to clean up**: it is left unchanged and contributes
  nothing to the removed counts.
- **Cleanup and another bulk operation (e.g. Pull all) overlap**: only one bulk
  operation runs at a time; the control is disabled while another is in flight.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single header control labeled "Cleanup"
  that triggers cleanup across all discovered repositories (distinct from the
  per-repository row actions and from the "Pull all" control).
- **FR-002**: The system MUST perform cleanup once per repository, not once per
  worktree row; worktree rows MUST NOT each initiate an independent cleanup run.
- **FR-003**: For each repository, the scan MUST first prune stale remote-tracking
  refs (equivalent to `git fetch -p`) so that "gone" status is fresh, then
  identify local branches whose tracked upstream is gone as candidates for
  removal.
- **FR-004**: The system MUST force-delete a selected gone branch even when its
  commits are merged nowhere (i.e. removal MUST NOT be blocked merely because the
  branch is unmerged; this matches the engine's `git branch -D`). The system MUST
  NOT delete any branch that was not both presented in the review overlay and left
  selected by the user.
- **FR-005**: For each repository, the system MUST identify as removable
  worktrees: (a) worktrees attached to a gone branch (the engine's core case),
  (b) worktrees whose directory is already missing, and (c) worktrees whose branch
  is already merged into the repository's default branch (the branch checked out in
  the main worktree). The system MUST NOT remove a worktree that has uncommitted or
  untracked changes, and MUST NOT remove the main worktree.
- **FR-006**: The system MUST NOT remove the currently checked-out branch of a
  repository, even if its upstream is gone (it MUST NOT appear as a removable
  candidate).
- **FR-007**: Cleanup MUST be a deliberate, explicit user action and MUST NEVER
  run automatically or on a timer.
- **FR-008**: Before removing anything, the system MUST scan (read-only) and
  present a review overlay listing the removal candidates grouped by repository.
  Every candidate MUST be selected by default; an entry that also removes a
  worktree MUST be visibly indicated. The user MUST be able to unselect
  individual candidates. Removal MUST act only on the still-selected candidates.
- **FR-009**: If the user cancels or dismisses the review overlay, the system
  MUST NOT remove anything.
- **FR-010**: If the scan finds no removal candidates, the system MUST inform the
  user there is nothing to clean up and MUST NOT present a destructive
  confirmation.
- **FR-011**: While a cleanup scan or removal is running, the control's icon MUST
  be animated for the full duration of the run.
- **FR-012**: While a cleanup scan or removal is in progress, the system MUST
  prevent a second concurrent cleanup run (re-entry guard) and MUST NOT run
  concurrently with another bulk operation such as "Pull all".
- **FR-013**: When removal finishes, the system MUST show a counts-only summary
  in the same form as the "Pull all" summary (e.g. how many branches/worktrees
  removed, how many skipped, how many failed); per-repository failure reasons are
  not required.
- **FR-014**: During **removal**, a selected item whose repository errors or
  times out MUST be counted as `failed` and MUST NOT abort cleanup of the
  remaining repositories. During the **scan**, a repository that is unavailable or
  times out MUST be skipped and contributes no removal candidates (it is never
  silently "cleaned"); its pre-existing dashboard state (unavailable/stale)
  remains the signal that it was not processed.
- **FR-015**: After a run, the dashboard's repository/worktree state MUST reflect
  the removals (removed branches and worktrees no longer appear) without
  requiring an app restart.

### Key Entities *(include if feature involves data)*

- **Repository**: a discovered git repository that Cleanup iterates over; the
  unit of work (not the worktree). Has zero or more local branches and zero or
  more worktrees.
- **Gone branch**: a local branch whose configured upstream no longer exists on
  the remote; the primary candidate for removal.
- **Stale worktree**: a worktree eligible for removal — its branch is gone (the
  engine's core case), its directory is already missing, or its branch is already
  merged — and which is not the main worktree and has no uncommitted/untracked
  changes.
- **Removal candidate / removal plan**: the read-only result of the scan — the
  set of branches and worktrees, grouped by repository, that Cleanup proposes to
  remove. Each candidate is selectable; the plan is what the review overlay
  displays and what the user edits before confirming.
- **Cleanup run summary**: the counts-only outcome of a run (removed, skipped,
  failed), presented in the same shape as the Pull all summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can trigger cleanup of every repository from a single
  header control, without opening any individual repository.
- **SC-002**: After a run, 100% of the branches and worktrees the user left
  selected in the review overlay are removed, and no branch/worktree still in
  active use (checked-out branch, live-upstream branch, worktree with uncommitted
  changes) is ever offered or removed.
- **SC-003**: No branch or worktree is ever removed unless it was shown in the
  review overlay and left selected — so no unmerged commit is lost without the
  user having seen and explicitly confirmed its removal.
- **SC-004**: When a run finishes, the user sees a summary of what happened
  (counts of removed and skipped/failed items) without inspecting any repository
  manually.
- **SC-005**: A single unavailable or failing repository never prevents the
  remaining repositories from being cleaned up in the same run.

## Assumptions

- The cleanup engine is the existing script `~/local/git-cleanup-all.sh` (present
  on disk), which per repository: runs `git fetch -p`; iterates local branches via
  `git for-each-ref`; for each `[gone]` branch (skipping the current branch and the
  main worktree) removes its worktree with `git worktree remove` (which fails
  safely on uncommitted/untracked work) and then `git branch -D`; and deletes
  idle `[gone]` branches directly. As with "Pull all"'s `upgrade-repo.sh`, this
  logic is the intended engine and would be moved into the app, with logs adapted
  as needed but the core removal behavior preserved.
- Cleanup **extends** the script (per clarification): beyond `[gone]`-branch
  worktrees, it also prunes missing-directory worktrees and merged-branch
  worktrees. This is additional logic layered on the script's core, not a change
  to the script's existing safety behavior.
- The review-and-select model (FR-008) makes Cleanup **two-phase**: a read-only
  scan that computes the removal plan, then a removal step acting only on the
  user-selected subset. The script as written deletes in a single pass, so its
  logic is split for the app: the enumeration part (`fetch -p` + `for-each-ref`
  detection) drives the scan/overlay, and the removal commands (`git worktree
  remove`, `git branch -D`) are invoked per selected item on confirm.
- "Summary like for pull all" means a **counts-only** summary (removed / skipped
  / failed), consistent with the clarified decision for feature 006 — not a
  detailed per-repository report.
- Eligibility mirrors Pull all's "per repository" scope: the operation iterates
  over repositories, and repositories the app cannot read are skipped and counted
  as failed rather than aborting the run.
- The "Cleanup" control lives in the header alongside "Pull all", and reuses the
  same running/animation and re-entry-guard patterns already established there.

## Dependencies

- **Constitution Principle II** ("Read-Only by Default, Destructive by Explicit
  Action") — explicitly names *branch cleanup* as a bulk, irreversible action
  requiring one-item-at-a-time presentation or explicit per-item confirmation.
  FR-008's confirmation model must be reconciled with this principle.
- **Constitution Principle III** ("Never Resolve Conflicts — Fail Loud, Hand
  Off") — a repository that cannot be cleaned safely is skipped and reported, not
  forced.
- **Feature 006 (Update All Repositories / "Pull all")** — provides the header
  control pattern, running-animation, re-entry guard, and counts-only summary
  format this feature mirrors.
- **Feature 005 (Delete a Worktree Whose Directory Is Already Missing)** —
  related prior art for worktree removal semantics.
- The existing script `~/local/git-cleanup-all.sh` supplying the gone-branch and
  worktree removal logic (present on disk; its core behavior is preserved and
  extended, not rewritten).
