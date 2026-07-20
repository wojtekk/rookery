<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/009-block-ui-during-operations/plan.md`

Active feature: **Block UI During Long Operations**
(`specs/009-block-ui-during-operations/plan.md`, Spec = **Revision
2026-07-19e**) — while one of Refresh, Pull all, or Cleanup runs, the system
blocks essentially every control that operates on repositories or
reconfigures the view: the other two of the three buttons, **Settings, the
Worktrees toggle, every filter chip, the sort-header row, and every row-level
action (delete, custom launch)**. Only the table rows and the sort-header row
visually dim to barely-visible (repository **and** nested worktree rows, plus
the header); every other blocked control (Settings, toggle, filter chips, row
actions, the two non-running buttons) **MUST NOT change colour/opacity** —
only the mouse cursor becomes `not-allowed`. A repository row's
directory-path tooltip is suppressed for the duration. Table rows are also
removed from the tab order (`tabIndex=-1`) on top of the dim. The loader still
shows over the table (150 ms show-delay / 400 ms min-visible, reused
unchanged). Pull all/Cleanup stay disabled when no repositories are discovered
(Refresh stays available), independent of the long-op lock. **Renderer-only**:
no new IPC, no main-process change, no dependency, no persisted setting. Lock
release lives in the existing `finally` blocks in `doRefresh`/`doUpdateAll`/
`doCleanup` so any settlement — success, failure result, or rejection —
clears every lock/dim (FR-013). Still **no whole-viewport dim and no native
`inert`** — every control is blocked individually by its own render logic
(native `<button disabled>` for filter chips/row actions; conditional
`wireActivate` + CSS override for the toolbar's `<div role="button">`
controls; a guarded callback for the sort header). The **constitution was
amended a second time, to v3.0.0** (Principle IV re-expanded after v2.0.0's
narrowing proved too narrow); `plan.md`, `research.md`, `data-model.md`,
`contracts/ui-lockout.md`, `quickstart.md`, and `tasks.md` are regenerated to
match. **Implementation is complete through T015** (T001–T009 = the
2.0.0-scoped per-row/per-button foundation; T010–T015 = the 3.0.0-scoped
extension) — build and all 102 tests pass. **T009 and T016 (manual
`quickstart.md` click-throughs) are still owed** before merge — an agent
cannot drive real mouse/keyboard/hover interaction against the Electron
window from this environment.

Prior features: **Cleanup Gone Branches and Worktrees**
(`specs/008-branch-cleanup/plan.md`) — a header "Cleanup" button that removes
`[gone]` branches and stale worktrees per repository after a review overlay,
via two IPC methods (`scanCleanup`, `executeCleanup`); `git worktree remove`
without `--force` (with `--force` only for missing-directory worktrees).
**Filter Repositories Needing Attention**
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

## Toolchain

Requires **Node.js 24** (pinned in `.nvmrc`). Before running any `pnpm`/`node`
command, switch with `nvm use` (reads `.nvmrc`).
