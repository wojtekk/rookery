<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/007-failed-repos-filter/plan.md`

Active feature: **Filter Repositories Needing Attention**
(`specs/007-failed-repos-filter/`) — adds a "Failed" option to the existing
state-filter chip row (All / Clean / Uncommitted / Out of sync /
Unavailable) that narrows the list to exactly the working trees whose most
recent "Pull all" attempt failed. Reuses 006's `failedPaths: Set<string>`
renderer state as-is (no change to when it's populated or cleared) via a new
`matches()` predicate in `filter.ts`; `filterRows` gains a defaulted
`failedPaths` parameter. The chip is deliberately excluded from the
`sumbar` composition bar (failed overlaps with existing states, so counting
it there would double-count rows). No new IPC, no new persisted setting, no
new dependency — purely an internal renderer change. Builds directly on
006, which is implemented but not yet merged to `main`. See `research.md`,
`data-model.md`, and `quickstart.md`.

Prior features: **Update All Repositories**
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
