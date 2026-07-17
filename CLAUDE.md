<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/004-delete-repository-row/plan.md`

Active feature: **Delete Repository Row**
(`specs/004-delete-repository-row/`) — adds an always-visible "x" delete icon
on the right side of every row (repository, orphan worktree, or linked
worktree). One click always shows a native confirmation; a fresh, live
(never cached) check for uncommitted changes / no remote / unpushed commits
gates a second, destructive-action confirmation — never more than two prompts
total. Confirmed deletion runs `git worktree remove --force` for worktree
rows, or moves the directory to the OS trash (permanent-delete fallback)
otherwise. Stack unchanged: Electron + TypeScript (main / preload /
renderer), system `git` via `child_process`, no UI framework, tests via
`node:test` over pure logic. No new runtime dependency: uses Electron's
built-in `dialog` and `shell.trashItem`. The entire flow (dialogs, live risk
check, removal) is orchestrated in one new main-process module,
`main/delete.ts`, behind one new IPC method, `deleteRow`; the renderer only
adds a button and calls the existing `refresh()` afterward. See `research.md`,
`data-model.md`, `contracts/`, and `quickstart.md` in the feature dir.

Prior features: **Startup Loading Indicator**
(`specs/003-startup-loading-indicator/plan.md`), **Custom Per-Repository
Action Launchers** (`specs/002-custom-action-launchers/plan.md`), and the
foundational **Repo Dashboard** (`specs/001-repo-dashboard/plan.md`).
<!-- SPECKIT END -->
