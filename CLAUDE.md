<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/005-delete-missing-worktree/plan.md`

Active feature: **Delete a Worktree Whose Directory Is Already Missing**
(`specs/005-delete-missing-worktree/`) — fixes a bug in 004's delete flow:
deleting a nested worktree row whose directory has already vanished from
disk today reports success without ever running `git worktree remove`,
because the risk-check probes throw first (shelling out with the missing
path as `cwd`) and get swallowed by a catch-all that reports `deleted`. The
row then silently reappears on the next scan since git's own
`.git/worktrees/<name>` registration was never touched. Fix: detect the
missing directory before any risk-check probe runs, skip the risk check
entirely (nothing local remains to lose) and its second confirmation, and
run `git worktree remove --force` anchored at the worktree's *family*
repository (`-C familyPath`) instead of the (missing) target path.
`familyPath` is a new optional field on `DeleteTarget`, supplied by the
renderer (`table.ts`) — the only place that already knows a nested
worktree's primary path at render time. No new module, no new IPC method.
Out of scope: orphan-worktree rows (a separate, pre-existing
`isWorktree`-misclassification bug — see `research.md` R4). See
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md` in the
feature dir.

Prior features: **Delete Repository Row**
(`specs/004-delete-repository-row/plan.md`), **Startup Loading Indicator**
(`specs/003-startup-loading-indicator/plan.md`), **Custom Per-Repository
Action Launchers** (`specs/002-custom-action-launchers/plan.md`), and the
foundational **Repo Dashboard** (`specs/001-repo-dashboard/plan.md`).
<!-- SPECKIT END -->
