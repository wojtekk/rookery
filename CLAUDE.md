<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/003-startup-loading-indicator/plan.md`

Active feature: **Startup Loading Indicator**
(`specs/003-startup-loading-indicator/`) — shows a flat, indeterminate, centered
loader while the startup repository scan runs, and evaluates configuration state
*first* so the add-directory screen never flashes before the loader. Stack unchanged:
Electron + TypeScript (main / preload / renderer), system `git` via `child_process`,
no UI framework, settings as JSON in Electron `userData`, tests via `node:test` over
pure logic. This is a **renderer-only** change (no git/IPC/storage changes): the boot
flow gains a `loadState` that gates the first paint; anti-flicker uses a ~150 ms
show-delay + ~400 ms min-visible window. Pure decision + timing logic lives in
`renderer/view/loadstate.ts` (tested), DOM in `renderer/view/loader.ts`. See
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md` in the feature dir.

Prior features: **Custom Per-Repository Action Launchers**
(`specs/002-custom-action-launchers/plan.md`) and the foundational
**Repo Dashboard** (`specs/001-repo-dashboard/plan.md`).
<!-- SPECKIT END -->
