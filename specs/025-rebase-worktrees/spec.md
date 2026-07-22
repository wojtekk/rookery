# Feature Specification: Rebase Worktrees onto the Default Branch

**Feature Branch**: `025-rebase-worktrees`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Add to the app a script that will update worktrees too — do a rebase on the source branch. When a rebase is not possible the worktree should stay untouched (not left in the middle of a dirty rebase). Failed worktrees should be marked as failed. Part of the update feature."

## Context *(informative)*

Today "Pull all" already visits every worktree, but it brings each one up to date against
its **own** tracked upstream (`@{u}`) — the same treatment a primary repository gets. That
misses the everyday worktree workflow: a feature branch checked out in a worktree, created
from the repository's default branch (`main`/`master`), that the user wants kept **rebased
onto the latest default branch** so it never drifts far behind. Two gaps follow from the
current behaviour:

- A feature-branch worktree that was **never pushed** has a local-only branch (no upstream),
  so "Pull all" reports it `skipped` and never advances it at all.
- A worktree that **does** track a remote branch is fast-forwarded/rebased onto *that*
  branch, never onto the default branch it was cut from — so it still falls behind `main`.

The user already does this by hand: fetch the default branch, then rebase the feature branch
onto it. This feature adds that as a first-class, one-click bulk action, reusing the proven,
non-destructive rebase machinery from feature 014 (autostash → rebase → restore; abort and
restore on the first conflict; mark failed).

The operation is deliberately a **separate action from "Pull all"**, because it expresses a
different intent with a different risk profile: "Pull all" fast-forwards each tree to its own
remote (cannot lose work), whereas "Rebase worktrees" replays feature branches onto a
*different* branch (can conflict). Keeping them as two buttons mirrors how the toolbar already
separates "Pull all" from "Cleanup".

> ⚠️ **Governance dependency** (UNRESOLVED): Two constitution principles are written around the
> three existing long operations and around "Pull all" specifically, and must be reconciled
> before merge:
> - **Principle III** currently grants the non-interactive-rebase latitude to *"Pull-all"* by
>   name ("Pull-all MAY bring a diverged repository up to date by a non-interactive rebase…").
>   This feature performs the same class of non-interactive, abort-on-conflict rebase from a
>   **new** action and onto the **default branch** rather than the tree's own upstream. The
>   core guarantees are unchanged (never resolve conflicts, never interactive, never a merge
>   commit, abort + restore to the exact prior state on the first conflict), so the amendment
>   is expected to be a narrow generalisation of the wording, not a change to the guarantees.
> - **Principle IV** enumerates the long operations as "Refresh, Pull all, Cleanup" for the
>   UI-lockout rule. "Rebase worktrees" is a fourth long operation and must be added to that
>   set (it blocks, and is blocked by, the others).
>
> The amendment(s) must be ratified before this feature merges (FR-014).

## Clarifications

### Session 2026-07-22

- Q: Which branch does a worktree rebase **onto**? → A: The repository's default branch
  (the branch checked out in the main worktree, falling back to `origin/HEAD`) — not the
  worktree's own tracked upstream.
- Q: Does the action update the default branch itself first, and does it rebase onto the local
  or the remote copy? → A: It fetches the default branch and rebases each worktree onto the
  freshly-fetched **remote-tracking** copy (`origin/<default>`); it never checks out or
  modifies the primary's local default branch.
- Q: Same button as "Pull all" or a separate one? → A: A separate header button, "Rebase
  worktrees".
- Q: How are worktrees with uncommitted changes handled? → A: Autostash (including untracked)
  → rebase → restore, mirroring "Pull all"; on a restore conflict the work stays recoverable
  in the stash.
- Q: Should the action warn before running? → A: Yes — show a one-time-dismissable confirmation
  reminding the user that rebasing rewrites history and must not be done on branches shared with
  other people. The dialog offers "do not remind me again"; once ticked, later runs skip the
  confirmation and start immediately. The choice persists across sessions.
- Q: Can the reminder be re-enabled after it's suppressed, and where? → A: Yes — via a toggle in a
  **new "Other" Settings tab** (added alongside the existing Directories/Actions tabs).
- Q: How do "Rebase worktrees" results interact with the failed/warning state from a prior "Pull
  all" (or vice-versa)? → A: Each mutating run **rebuilds** the shared failed/warning surface — the
  latest run's results replace the previous run's — pruned on Refresh, exactly as feature 013
  already behaves.
- Q: When is the "Rebase worktrees" button available? → A: Disabled whenever no linked worktrees
  exist anywhere in the fleet (enabled as soon as ≥1 exists), on top of the normal long-operation
  lockout — mirroring the "Pull all"/"Cleanup" empty-state precedent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep feature-branch worktrees current with the default branch (Priority: P1)

As the person managing many repositories with many feature-branch worktrees, when I press
"Rebase worktrees", every worktree that holds a feature branch is replayed on top of the
latest default branch of its repository — my uncommitted work is set aside first and restored
afterward — so my in-progress branches stay close to `main` without me visiting each one.

**Why this priority**: This is the core value and the reported gap. It turns a repetitive
per-worktree manual chore (fetch default branch, rebase, restore) into one action across the
whole fleet.

**Independent Test**: Take a repository with a worktree on a feature branch that was cut from
`main`, where `origin`'s `main` has since advanced with non-conflicting commits. Press "Rebase
worktrees". The worktree's branch ends up replayed on top of the latest `main`, any
uncommitted changes are restored, and it is reported as updated — matching a manual fetch +
`git rebase origin/main`.

**Acceptance Scenarios**:

1. **Given** a worktree on a **local-only** feature branch (never pushed) whose repository's
   default branch has advanced with non-conflicting commits, **When** I press "Rebase
   worktrees", **Then** the branch is replayed on top of the latest default branch and
   reported as updated (it is no longer silently skipped as it is under "Pull all").
2. **Given** a worktree on a feature branch that **does** track its own remote branch, **When**
   I press "Rebase worktrees", **Then** it is rebased onto the repository's **default** branch
   (not onto its own upstream), and reported as updated.
3. **Given** such a worktree that also has uncommitted changes, **When** I press "Rebase
   worktrees", **Then** the changes are set aside before the rebase and restored afterward, and
   the worktree is reported as updated.
4. **Given** a worktree whose branch is already on top of the latest default branch, **When** I
   press "Rebase worktrees", **Then** nothing changes and it is reported as already-current
   (not failed).

---

### User Story 2 - A conflicting worktree is left untouched and clearly reported (Priority: P1)

As the person managing many repositories, when a worktree's rebase onto the default branch
cannot complete without a conflict, the tool must not try to resolve it, must not leave it
half-rebased, and must leave it exactly as it was — so I can go resolve it myself.

**Why this priority**: This is the safety half of the same change and is non-negotiable under
the project's founding principle. Adding rebase is only acceptable if the failure path is
provably non-destructive. It ships together with User Story 1.

**Independent Test**: Take a worktree whose feature-branch commits conflict with the default
branch's commits (they touch the same lines). Press "Rebase worktrees". The worktree is left
with its original HEAD, its original commits, and its original uncommitted work intact; there
is no rebase in progress; and it is reported as failed with a reason identifying it as a
conflict needing manual resolution.

**Acceptance Scenarios**:

1. **Given** a worktree whose commits conflict with the default branch, **When** I press
   "Rebase worktrees", **Then** the worktree is restored to its exact pre-operation state
   (same HEAD, same commits, same working-tree contents) with **no** rebase left in progress.
2. **Given** that same conflicting worktree, **When** the run finishes, **Then** it is reported
   as failed with a reason distinguishing "conflict — needs manual resolution" from other
   failure causes (e.g. the default branch could not be fetched).
3. **Given** a worktree whose rebase succeeds but whose autostash restore then conflicts with
   the newly rebased content, **When** the run finishes, **Then** the uncommitted work is not
   lost (it stays recoverable in the stash) and the outcome is reported honestly rather than as
   a silent success.

---

### User Story 3 - Never lose uncommitted work, and never touch the primary or its default branch (Priority: P2)

As the person managing many repositories, I need confidence that pressing "Rebase worktrees"
can never destroy uncommitted changes in any worktree, and never disturbs the primary
repository's checkout or its local default branch.

**Why this priority**: It re-verifies an existing guarantee (autostash) under a new operation
that rewrites history, and adds the new guarantee that the primary is left alone. It refines
rather than adds user-visible behaviour, so P2.

**Independent Test**: For each outcome path (clean rebase, already-current, conflict-abort,
restore-conflict, timeout), start from a worktree with uncommitted changes and confirm the
changes are restored or preserved recoverably — never discarded — and confirm the primary
repository's working tree and its local default branch are byte-for-byte unchanged.

**Acceptance Scenarios**:

1. **Given** any worktree with uncommitted changes, **When** "Rebase worktrees" completes
   successfully for it, **Then** those changes are present in the working tree afterward.
2. **Given** any worktree with uncommitted changes, **When** "Rebase worktrees" fails for it
   (conflict, fetch failure, timeout, or any other reason), **Then** those changes are still
   present or preserved recoverably, never lost.
3. **Given** a repository whose primary checkout is dirty or whose local default branch is
   behind, **When** "Rebase worktrees" runs, **Then** the primary's working tree and its local
   default branch are unchanged (only remote-tracking refs are updated by the fetch).

---

### User Story 4 - Warn before rewriting history on shared branches (Priority: P2)

As the person managing many repositories, before "Rebase worktrees" rewrites any history I want
a reminder that rebasing must not be done on branches shared with other people — but once I've
acknowledged it, I don't want to be nagged on every run.

**Why this priority**: Rebasing rewrites commit history; doing it on a branch someone else has
based work on causes real pain for collaborators. A guardrail is worth having, but it must be
dismissable so it doesn't become friction for a solo user who knows the risk. It gates the
action rather than changing its git behaviour, so P2.

**Independent Test**: With the reminder not yet suppressed, press "Rebase worktrees" and confirm
a warning appears before anything runs; cancel it and confirm nothing was rebased. Then run
again, tick "do not remind me again", and confirm the run proceeds. Restart the app, press
"Rebase worktrees" again, and confirm the warning does **not** reappear and the run starts
immediately.

**Acceptance Scenarios**:

1. **Given** the reminder has not been suppressed, **When** I press "Rebase worktrees", **Then**
   a confirmation appears warning that rebasing rewrites history and must not be done on branches
   shared with others, and no worktree is rebased until I confirm.
2. **Given** that confirmation is showing, **When** I cancel it, **Then** nothing is rebased and
   everything is left exactly as it was.
3. **Given** that confirmation is showing, **When** I tick "do not remind me again" and confirm,
   **Then** the run proceeds and my choice to suppress the reminder is remembered.
4. **Given** I previously suppressed the reminder, **When** I press "Rebase worktrees" (including
   after restarting the app), **Then** no confirmation appears and the run starts immediately.
5. **Given** I previously suppressed the reminder, **When** I re-enable it from the "Other" tab in
   Settings, **Then** the next "Rebase worktrees" press shows the confirmation again.

---

### Edge Cases

- **Worktree already on the default branch**: skipped (there is nothing to rebase onto itself);
  it is not warned. Bringing the default branch itself up to date is the job of "Pull all".
- **The primary / main worktree**: never rebased by this action — only linked worktrees are
  candidates.
- **Orphan worktree (no known primary repository)**: skipped, because its repository's default
  branch cannot be determined from available data. It is reported with a reason.
- **Default branch cannot be determined** (no `origin/HEAD` and the main worktree's branch is
  unreadable): every worktree in that repository is reported failed/unresolved with a reason,
  and none are rebased.
- **The default branch cannot be fetched** (offline, unreachable, auth): the affected
  worktrees are reported failed (fetch failure) rather than silently rebased onto a stale
  remote-tracking ref.
- **Detached HEAD / unavailable working tree**: skipped and never rebased (same as "Pull all").
- **Rebase interrupted by the per-worktree time limit**: the worktree must not be left with a
  rebase in progress; it is aborted and restored, and reported as timed-out.
- **Multiple worktrees of one repository sharing a single stash**: uncommitted-work handling
  must stay correct when several worktrees of the same repository are processed (the existing
  per-family serialization already addresses this and must not regress).
- **A rebase that leaves the branch identical** (already replayed on top of the default
  branch): reported as already-current, not failed.
- **A worktree's feature branch that tracks its own remote**: it is still rebased onto the
  default branch (rewriting local history relative to its own remote); the action never pushes,
  so reconciling the feature branch with its own remote (e.g. a force-push) remains the user's
  choice.
- **Confirmation cancelled**: no worktree is rebased, no fetch is performed, and nothing changes;
  the reminder-suppression setting is left as it was (cancelling never suppresses).
- **Reminder previously suppressed**: no confirmation is shown; the run starts immediately.
- **No eligible worktrees to rebase**: unchanged from the base behaviour — the confirmation gates
  the action but does not manufacture work; if nothing is eligible the run simply reports nothing
  was rebased. (Whether the dialog is shown when nothing is eligible is left to the plan; the
  spec only requires that no rebase happens without confirmation.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a dedicated header action, "Rebase worktrees",
  distinct from "Pull all", "Refresh", and "Cleanup".
- **FR-002**: "Rebase worktrees" MUST, for each eligible linked worktree, rebase the worktree's
  branch onto its repository's **default branch** (the branch checked out in the main worktree,
  falling back to `origin/HEAD`), not onto the worktree's own tracked upstream.
- **FR-003**: "Rebase worktrees" MUST fetch the default branch and rebase onto the
  freshly-fetched **remote-tracking** copy of it, so worktrees are replayed onto the true
  latest default branch.
- **FR-004**: "Rebase worktrees" MUST NOT check out, modify, or fast-forward the primary
  repository's local default branch, and MUST NOT modify the primary repository's working tree;
  the only remote-side effect permitted is fetching (updating remote-tracking refs).
- **FR-005**: "Rebase worktrees" MUST include **local-only** feature-branch worktrees (no
  tracked upstream) as candidates — these are the primary target and MUST NOT be skipped the
  way "Pull all" skips them.
- **FR-006**: Before rebasing, "Rebase worktrees" MUST set aside any uncommitted changes in the
  worktree — **including untracked files** — and restore them after a successful rebase.
- **FR-007**: When a rebase cannot complete without a conflict, "Rebase worktrees" MUST abort
  the rebase and restore the worktree to its exact pre-operation state — original HEAD, original
  commits, original working-tree contents — leaving **no** rebase in progress.
- **FR-008**: "Rebase worktrees" MUST NOT attempt to resolve any conflict, MUST NOT perform any
  interactive resolution, and MUST NOT create a merge commit; on conflict it stops for that
  worktree and hands off to the user.
- **FR-009**: A worktree that failed because of a rebase conflict MUST be reported as **failed**
  (reusing the existing failed visual state and "Failed" filter and the feature-013 warning
  icon), with a **reason** that distinguishes "conflict — needs manual resolution" from other
  failure causes.
- **FR-009a**: "Rebase worktrees" MUST write its per-worktree failures/warnings into the **same**
  failed/warning surface used by "Pull all", **rebuilding** it on each run — a "Rebase worktrees"
  run replaces the failed/warning state from a previous "Pull all" run (and vice-versa), and both
  are pruned on manual Refresh, consistent with feature 013's existing behaviour. At most one such
  run's results are shown at a time.
- **FR-010**: "Rebase worktrees" MUST never discard uncommitted changes on any outcome path;
  changes are either restored to the working tree or left recoverable (e.g. in the stash). If
  restoring set-aside work conflicts with the rebased content, the work MUST stay recoverable
  and the outcome MUST be reported honestly rather than as a plain success.
- **FR-011**: "Rebase worktrees" MUST skip, without warning, worktrees that are already on the
  default branch, the primary/main worktree, detached-HEAD worktrees, and unavailable
  worktrees; and MUST report (with a reason) worktrees it cannot process because the default
  branch is unknown, the default branch could not be fetched, or the worktree is an orphan with
  no known primary repository.
- **FR-012**: A per-worktree time bound MUST apply; if it elapses during a rebase, the worktree
  MUST be left with no rebase in progress and reported as timed-out.
- **FR-013**: "Rebase worktrees" MUST participate in the existing long-operation UI lockout as a
  fourth long operation: while it runs it MUST block the other long-operation triggers and the
  same controls the other long operations block, and while any other long operation runs the
  "Rebase worktrees" trigger MUST be blocked. At most one long operation runs at a time.
- **FR-014**: The change MUST be reconciled with Constitution Principles III and IV via a
  recorded amendment before merge (governance dependency; see Context).
- **FR-015**: "Rebase worktrees" MUST process worktrees of the same repository without
  corrupting shared uncommitted-work storage (the shared stash), reusing the existing
  per-repository serialization.
- **FR-016**: Unless the reminder has been suppressed, "Rebase worktrees" MUST show a
  confirmation before it fetches or rebases anything, warning that rebasing rewrites history and
  must not be performed on branches shared with other people. No worktree may be rebased and no
  fetch may occur until the user confirms.
- **FR-017**: Cancelling the confirmation MUST perform no fetch and no rebase and leave
  everything (including the reminder-suppression setting) unchanged.
- **FR-018**: The confirmation MUST offer a "do not remind me again" option. When the user
  confirms with it ticked, the run proceeds and the reminder MUST be suppressed for future runs.
- **FR-019**: The reminder-suppression choice MUST persist across application restarts. When it is
  set, "Rebase worktrees" MUST skip the confirmation and start immediately.
- **FR-020**: Settings MUST provide a control to re-enable the reminder after it has been
  suppressed, located in a **new "Other" tab** added alongside the existing Directories and
  Actions tabs. Toggling it back on MUST cause the next "Rebase worktrees" run to show the
  confirmation again.
- **FR-021**: The "Rebase worktrees" trigger MUST be disabled whenever no linked worktrees exist
  anywhere in the discovered fleet, and enabled as soon as at least one linked worktree exists —
  independent of, and in addition to, the long-operation lockout (FR-013). This mirrors the
  existing empty-state disabling of "Pull all" and "Cleanup".

### Key Entities *(include if feature involves data)*

- **Worktree rebase outcome**: the per-worktree result of a "Rebase worktrees" run, keyed by the
  worktree's path. It reuses the existing update-outcome vocabulary — updated / already-current /
  skipped / failed — with no new result value; a rebase conflict maps to **failed**. The set of
  **reasons** covers, at minimum: conflict (needs manual resolution), default-branch-not-fetched,
  default-branch-unknown, orphan-worktree (no known primary), timed-out, restore-failed, and the
  existing skip reasons (detached, unavailable, on-default-branch/no-op).
- **Rebase-reminder suppression**: a single persisted true/false preference recording whether the
  user ticked "do not remind me again" on the confirmation. Defaults to "remind" (not suppressed);
  once set it stays suppressed across restarts, and is re-enableable from the new "Other" Settings
  tab. It is the only new persisted state this feature introduces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every feature-branch worktree the user could bring current with a single manual
  fetch + `git rebase origin/<default>` that completes without conflict is brought current by one
  "Rebase worktrees" run — including local-only worktrees that "Pull all" leaves untouched.
- **SC-002**: For each such worktree, the resulting local history is identical to running the
  manual fetch + rebase by hand (default-branch commits with the feature-branch commits replayed
  on top).
- **SC-003**: A worktree with a genuine rebase conflict is left byte-for-byte in its
  pre-operation state (identical HEAD, identical commits, identical working-tree contents) in
  100% of conflict cases, and never with a rebase in progress.
- **SC-004**: No uncommitted change is lost across a "Rebase worktrees" run on any outcome path
  (clean rebase, already-current, conflict-abort, restore-conflict, timeout) — 100%.
- **SC-005**: The primary repository's working tree and its local default branch are unchanged by
  a "Rebase worktrees" run in 100% of runs (only remote-tracking refs may change, via fetch).
- **SC-006**: For a failed worktree, the user can distinguish "conflict — needs manual
  resolution" from other failure causes (e.g. the default branch could not be fetched) at a
  glance, without opening a terminal.
- **SC-007**: No rebase ever runs without the user's acknowledgement while the reminder is active:
  in 100% of runs the confirmation is shown (until suppressed), and cancelling it results in zero
  worktrees rebased. Once suppressed, the confirmation is shown in 0% of subsequent runs, including
  after an app restart.

## Assumptions

- **"Source branch" means the repository's default branch.** Defined as the branch checked out
  in the main worktree, falling back to `origin/HEAD` — the same definition the "Cleanup" feature
  already uses. Per-worktree "fork point" tracking is explicitly out of scope (git does not record
  it reliably).
- **Rebase onto the remote-tracking copy after a fetch.** The action rebases onto
  `origin/<default>` after fetching it, so it never needs to check out or advance the primary's
  local default branch (which may be dirty or checked out). This is a deliberate choice for
  self-containment and to keep the primary untouched.
- **Always rebase, never merge.** Consistent with the founding principle, the action never creates
  a merge commit; a conflict aborts and restores.
- **Autostash includes untracked files.** Mirrors "Pull all"'s current, strictly-safer behaviour.
- **Feature branches that track their own remote are still rebased onto the default branch.** The
  action does not push and does not attempt to reconcile a rewritten feature branch with its own
  remote; that remains the user's manual step.
- **Existing machinery is reused, not redesigned.** Discovery/scan, per-family stash
  serialization, the per-worktree timeout, the failed visual state, the "Failed" filter, and the
  feature-013 warning-icon/tooltip mechanism carry over. This feature adds a new action, the
  rebase-onto-default-branch strategy, and the new failure/skip reasons.
- **Scope is the update engine, one new toolbar action, the failure-reason labelling, one
  confirmation dialog, and one new Settings tab.** The feature adds exactly **one** new persisted
  setting — the rebase-reminder suppression flag — reusing the app's existing settings storage and
  surfaced for re-enabling in a new "Other" Settings tab; there is no other new persisted state,
  and no new external network activity beyond git fetching from its configured remotes.
- **The confirmation is a batch-level guardrail, not per-worktree.** A single confirmation gates
  the whole run; the risk it warns about (rewriting a shared branch) is identical for every
  worktree, so one acknowledgement covers the batch.
