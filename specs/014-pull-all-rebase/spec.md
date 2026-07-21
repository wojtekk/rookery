# Feature Specification: Rebase Diverged Repositories on Pull All (match `git pull --autostash`)

**Feature Branch**: `014-pull-all-rebase`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Update all is failing for some repos that I can easly update using \"git pull --autostash\" command. Analyse, research, improve"

## Context & Root Cause *(informative)*

Investigation (against the live repositories that exhibit the bug — `tf-auth0-pro`,
`mb-pro-customer-frontend-api`, `identity-web-bff`) established the following, so the
requirements below are grounded rather than guessed:

- "Pull all" only ever **fast-forwards** (`git merge --ff-only`). Any repository that
  is not a pure fast-forward — i.e. it has **local commits that are not on the
  upstream while the upstream has also moved on** (a *diverged* repository) — is
  refused and reported `failed` (reason `diverged`, from feature 013).
- The user updates those same repositories by hand with `git pull --autostash`. Their
  global git configuration sets `pull.rebase = true`, so that command autostashes any
  uncommitted work, fetches, and **rebases the local commits onto the upstream**, then
  restores the stash. When the rebase has no conflicts (the everyday case) the
  repository updates cleanly.
- The `fsmonitor_ipc__send_query: unspecified error on '.git/fsmonitor--daemon.ipc'`
  message seen on these repositories is **stderr noise only**: every git command in
  the update sequence (status, diff, ls-files, fetch, stash push/pop, merge) was
  verified to exit `0` despite it. It is **not** a cause of the failures.

The gap is therefore behavioral: the tool's update strategy (fast-forward only) is
narrower than the user's proven, everyday manual strategy (autostash + rebase). This
feature closes that gap for the cleanly-rebasable case while preserving the project's
"never resolve conflicts, fail loud" guarantee for the case that genuinely conflicts.

> ⚠️ **Governance dependency** (RESOLVED): Constitution Principle III previously guaranteed
> that a diverged repository is left **untouched** and marked `failed`, and forbade
> "interactive merge/rebase resolution." This feature changes that guarantee — a
> diverged repository may now be **rebased** (history rewritten on the local side)
> when the rebase applies without conflict. That required a formal amendment to
> Principle III (redefining "complete cleanly" to include a conflict-free rebase, and
> distinguishing a *non-interactive, abort-on-conflict* rebase from the forbidden
> *interactive conflict resolution*). The amendment is **ratified as constitution v4.0.0**
> (2026-07-21); Principle III now permits the non-interactive, conflict-free rebase while
> keeping the no-conflict-resolution / no-interactive / no-merge-commit core (FR-012,
> verified by tasks T011).

## Clarifications

### Session 2026-07-21

- Q: For a repository locally configured `pull.rebase=false`, how should "Pull all" update it when diverged? → A: Always rebase, never merge — ignore per-repo `pull.rebase=false`; "Pull all" never creates a merge commit (conflict → abort/fail).
- Q: Should the autostash before rebasing include untracked files (current tool's `--include-untracked`) or only tracked changes (as `git pull --autostash` does)? → A: Include untracked (keep the tool's current behavior; strictly safer, no regression).
- Q: How should a genuinely-conflicting repository be represented in the existing UI? → A: Reuse the `failed` outcome (light-red row, appears in the "Failed" filter, shows the feature-013 warn icon); only the tooltip reason distinguishes "conflict — needs manual resolution".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pull all updates a diverged repository by rebasing, like the manual command (Priority: P1)

As the person managing many repositories, when I press "Pull all", a repository where I
have local commits and the upstream has also advanced (diverged) should be brought up to
date the same way my own `git pull --autostash` brings it up to date: my uncommitted work
is set aside, my local commits are replayed on top of the latest upstream, and my
uncommitted work is restored — provided none of that produces a conflict.

**Why this priority**: This is the reported bug. Today these repositories are the ones
that show as `failed` even though a single manual command updates them trivially. Fixing
it restores the tool's core promise — that "Pull all" actually updates everything that
can be updated without my intervention.

**Independent Test**: Take a repository with one or more un-pushed local commits whose
upstream has moved ahead with non-conflicting commits (optionally with uncommitted
changes in the working tree). Run "Pull all". The repository ends up with the upstream
commits plus the local commits rebased on top, the working-tree changes restored, and it
is reported as updated — matching the outcome of `git pull --autostash` run by hand.

**Acceptance Scenarios**:

1. **Given** a repository with local un-pushed commits and an upstream that has advanced
   with non-conflicting commits, **When** I run "Pull all", **Then** the repository is
   updated (upstream commits present, local commits replayed on top) and reported as
   updated, not failed.
2. **Given** such a diverged repository that *also* has uncommitted changes in the
   working tree, **When** I run "Pull all", **Then** the uncommitted changes are set
   aside before the rebase and restored afterward, and the repository is reported as
   updated.
3. **Given** a repository that is simply behind its upstream (no local commits),
   **When** I run "Pull all", **Then** it still updates exactly as before (no regression
   for the fast-forward case).
4. **Given** a repository that only has local commits and whose upstream has not moved,
   **When** I run "Pull all", **Then** nothing is changed and it is reported as
   up-to-date (not failed).

---

### User Story 2 - A genuinely conflicting repository is left untouched and clearly reported (Priority: P1)

As the person managing many repositories, when "Pull all" encounters a repository whose
rebase *cannot* complete without a merge conflict, the tool must not try to resolve it,
must not leave it half-done, and must leave it exactly as it was — so I can go resolve it
myself with a real merge tool.

**Why this priority**: This is the safety half of the same change and is non-negotiable
per the project's founding principle. Adding rebase is only acceptable if the failure
path is provably non-destructive. It ships together with User Story 1.

**Independent Test**: Take a repository whose local commits conflict with the upstream
commits (they touch the same lines). Run "Pull all". The repository is left with its
original HEAD, its original local commits, and its original uncommitted work intact; there
is no rebase in progress; and it is reported as failed with a reason that identifies it as
a conflict needing manual resolution.

**Acceptance Scenarios**:

1. **Given** a repository whose local commits conflict with upstream commits, **When** I
   run "Pull all", **Then** the repository is restored to its exact pre-operation state
   (same HEAD, same local commits, same working-tree contents), with **no** rebase left
   in progress.
2. **Given** that same conflicting repository, **When** the run finishes, **Then** it is
   reported as failed with a reason distinguishing "conflict — needs manual resolution"
   from unrelated failures (e.g. unreachable remote), and the user is directed to resolve
   it with their merge tool.
3. **Given** a repository whose rebase succeeds but whose autostash restore then
   conflicts with the newly rebased content, **When** the run finishes, **Then** the
   uncommitted work is not lost (it remains safely recoverable), and the outcome is
   reported honestly rather than as a silent success.

---

### User Story 3 - Never lose uncommitted work across a Pull all run (Priority: P2)

As the person managing many repositories, I need absolute confidence that pressing "Pull
all" can never destroy uncommitted changes in any repository, whatever the outcome.

**Why this priority**: It is an existing guarantee (autostash) that must be explicitly
re-verified because this feature introduces history rewriting (rebase), which raises the
stakes of the stash/restore dance. It refines rather than adds user-visible behavior, so
P2.

**Independent Test**: For each outcome path (clean rebase, fast-forward, conflict-abort,
restore-conflict), start from a working tree with uncommitted changes and confirm the
changes are either restored to the working tree or preserved recoverably — never
discarded.

**Acceptance Scenarios**:

1. **Given** any repository with uncommitted changes, **When** "Pull all" completes
   successfully for it, **Then** those changes are present in the working tree afterward.
2. **Given** any repository with uncommitted changes, **When** "Pull all" fails for it
   (conflict, unreachable remote, timeout, or any other reason), **Then** those changes
   are still present or preserved recoverably, never lost.

---

### Edge Cases

- **Detached HEAD / no upstream / unavailable working tree**: unchanged from today —
  these are skipped and never rebased (a no-upstream repository is never even a candidate
  and is never warned).
- **Rebase interrupted by the per-repository time limit**: the repository must not be
  left with a rebase in progress; it is aborted and restored, and reported as timed-out.
- **Repository configured to merge rather than rebase** (`pull.rebase=false` locally):
  the tool still **rebases** (it never creates a merge commit) — see Assumptions.
- **Multiple worktrees of one repository sharing a single stash**: uncommitted-work
  handling must remain correct when several working trees of the same repository are
  processed (the existing per-family serialization already addresses this and must not
  regress).
- **A rebase that would succeed but leaves the branch identical** (upstream already
  contained the local commits): reported as up-to-date, not failed.
- **An incoming commit adds a file that already exists locally as an untracked file**:
  because autostash includes untracked files, the untracked file is set aside first, so
  the update proceeds and the file is restored afterward (rather than the update being
  blocked by an "untracked working tree files would be overwritten" abort).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: "Pull all" MUST update a diverged repository (local commits present and
  upstream advanced) by rebasing the local commits onto the upstream, matching the result
  of `git pull --autostash` for a repository configured to rebase on pull.
- **FR-002**: Before rebasing, "Pull all" MUST set aside any uncommitted changes —
  **including untracked files** (preserving the tool's current autostash behavior, which
  is broader than `git pull --autostash`'s tracked-only stash) — and, after a successful
  rebase, restore them.
- **FR-003**: "Pull all" MUST continue to update a purely-behind repository (fast-forward
  case) with no change in behavior from before this feature.
- **FR-004**: When a rebase cannot complete without a merge conflict, "Pull all" MUST
  abort the rebase and restore the repository to its exact pre-operation state — original
  HEAD, original local commits, original working-tree contents — leaving **no** rebase in
  progress.
- **FR-005**: "Pull all" MUST NOT attempt to resolve any merge/rebase conflict and MUST
  NOT perform any interactive resolution; on conflict it stops for that repository and
  hands off to the user (consistent with the project's fail-loud principle).
- **FR-006**: A repository that failed because of a rebase conflict MUST keep the existing
  `failed` outcome (light-red row, included in the "Failed" filter, showing the
  feature-013 warning icon) — it is a genuine failure, not a new visual state. Only its
  **reason** MUST distinguish it from other failure categories, communicating "conflict —
  needs manual resolution" and directing the user toward their merge tool.
- **FR-007**: "Pull all" MUST never discard uncommitted changes on any outcome path;
  changes are either restored to the working tree or preserved recoverably (e.g. left in
  the stash) so the user can retrieve them.
- **FR-008**: If restoring set-aside uncommitted work conflicts with the newly rebased
  content, "Pull all" MUST keep that work recoverable and report the outcome honestly
  rather than as a plain success.
- **FR-009**: "Pull all" MUST NOT create a merge commit on the user's behalf for a
  diverged repository (no auto-merge); the only history change it may perform is a
  conflict-free rebase of local commits onto the upstream.
- **FR-010**: Repositories that are ineligible today (detached HEAD, no tracked upstream,
  unavailable working tree) MUST remain ineligible and MUST NOT be rebased.
- **FR-011**: The per-repository time bound MUST continue to apply; if it elapses during
  a rebase, the repository MUST be left with no rebase in progress and reported as
  timed-out.
- **FR-012**: The change MUST be reconciled with Constitution Principle III via a recorded
  amendment before merge (governance dependency; see Context).

### Key Entities *(include if feature involves data)*

- **Repository update outcome**: the per-repository result of a "Pull all" run. Gains no
  new result value — updated / up-to-date / skipped / **failed** are all unchanged, and a
  rebase conflict maps to the existing `failed` result (light-red, in the "Failed"
  filter). Only the set of failure **reasons** grows: it must express a rebase conflict
  distinctly from the pre-existing non-fast-forward "diverged" refusal and from unrelated
  failures (unreachable remote, timeout, etc.).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every repository the user can bring up to date with a single
  `git pull --autostash` that completes without conflict is brought up to date by one
  "Pull all" run — zero such repositories are left reported as failed.
- **SC-002**: The specific repositories from the original report update in a single "Pull
  all" run, with the resulting local history identical to running `git pull --autostash`
  by hand (upstream commits plus local commits rebased on top).
- **SC-003**: A repository that has a genuine rebase conflict is left byte-for-byte in its
  pre-operation state (identical HEAD, identical local commits, identical working-tree
  contents) in 100% of conflict cases, and never with a rebase in progress.
- **SC-004**: No uncommitted change is lost across a "Pull all" run on any outcome path
  (clean rebase, fast-forward, conflict-abort, restore-conflict, timeout) — 100%.
- **SC-005**: For a failed repository, the user can distinguish "conflict — needs manual
  resolution" from other failure causes (e.g. unreachable remote) at a glance, without
  opening a terminal.

## Assumptions

- **The user's manual command resolves to rebase.** The reference behavior is
  `git pull --autostash` under `pull.rebase=true` (verified in the user's global git
  configuration). "Match the manual command" therefore means autostash + rebase.
- **Always rebase, never merge, for diverged repositories.** Even if an individual
  repository is configured to merge on pull (`pull.rebase=false`), "Pull all" rebases
  rather than creating a merge commit. A tool-created merge commit is exactly the
  auto-merge the project's founding principle exists to prevent, and a conflict-free
  rebase-with-abort is the more predictable, non-destructive choice. This is a
  deliberate, documented divergence from strictly mirroring per-repository pull config.
- **Conflict handling is abort-and-restore, never resolve.** The rebase is
  non-interactive; the first conflict aborts it and restores the original state. This
  preserves the "never resolve conflicts, fail loud, hand off" principle; the amendment to
  Principle III narrows only the "never rewrite a diverged repo" guarantee, not the
  no-conflict-resolution guarantee.
- **Existing eligibility, family-serialization, timeout, and warn-reason surfacing carry
  over.** This feature changes only how an *eligible, diverged* repository is updated and
  how a rebase-conflict failure is labeled; discovery, the eligibility rules, the
  per-family stash serialization, the per-repository timeout, and the feature-013 warning
  icon/tooltip mechanism are reused, not redesigned.
- **The fsmonitor stderr message is out of scope.** It is confirmed harmless (all
  commands exit 0); this feature does not attempt to silence or fix the daemon.
- **Scope is the update engine and the failure-reason labeling.** No new persisted
  setting, no new external network activity beyond git talking to its configured remotes,
  and no change to the "Pull all" trigger, the loader, or the UI-lockout behavior.
