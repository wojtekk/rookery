<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/008-branch-cleanup/plan.md`

Active feature: **Cleanup Gone Branches and Worktrees**
(`specs/008-branch-cleanup/`) — a header **"Cleanup"** button (sibling of
"Pull all") that, per repository (not per worktree), removes `[gone]`
branches and stale worktrees after a **review overlay** where the user
unselects anything to keep. Two-phase, because the scan snapshot lacks
gone/worktree data: a new read-only scan (`git fetch -p` + `for-each-ref` +
`worktree list --porcelain`) in a new `src/main/cleanup.ts` builds a removal
plan; a second call removes only the selected items. Reuses `update.ts`'s
families/`runPool`/`NON_INTERACTIVE_ENV`/deadline pattern and the settings
modal's `.scrim`/`.modal` CSS; reuses `showNotice` for the counts summary.
Removal command matrix: `git branch -D` for `[gone]` branches (force-delete,
consented via the overlay); `git worktree remove` **without** `--force` for
present worktrees (fails safely on uncommitted work — Principle III),
**with** `--force` only for missing-directory worktrees. Extends the engine
script beyond `[gone]`-branch worktrees to also prune missing-directory and
merged-branch worktrees. Two new IPC methods (`scanCleanup`,
`executeCleanup`), one new overlay module (`src/renderer/view/cleanup.ts`),
new checkbox CSS. No new dependency, no new persisted setting. See
`research.md`, `data-model.md`, `contracts/ipc-cleanup.md`, `quickstart.md`.

Prior features: **Filter Repositories Needing Attention**
(`specs/007-failed-repos-filter/plan.md`) — a "Failed" state-filter chip
narrowing the list to working trees whose most recent "Pull all" failed.
**Update All Repositories**
(`specs/006-update-all-repositories/plan.md`) — a header "Pull all" button
that fast-forwards every eligible repository/worktree to its tracked
upstream, autostashing dirty work and never auto-merging a diverged repo
(left `failed`, light red). **Delete a Worktree Whose Directory Is Already
Missing** (`specs/005-delete-missing-worktree/plan.md`), **Delete
Repository Row** (`specs/004-delete-repository-row/plan.md`), **Startup
Loading Indicator** (`specs/003-startup-loading-indicator/plan.md`),
**Custom Per-Repository Action Launchers**
(`specs/002-custom-action-launchers/plan.md`), and the foundational **Repo
Dashboard** (`specs/001-repo-dashboard/plan.md`).
<!-- SPECKIT END -->
