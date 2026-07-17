<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/002-custom-action-launchers/plan.md`

Active feature: **Custom Per-Repository Action Launchers**
(`specs/002-custom-action-launchers/`) — extends 001-repo-dashboard's reserved ⋮
kebab into a user-configurable launcher. Stack unchanged: Electron + TypeScript
(main / preload / renderer), system `git` via `child_process`, no UI framework,
settings as JSON in Electron `userData`, tests via `node:test` over pure logic. New
mechanism: launch a user command template through the login shell with the row's
path (`${1}`) and raw remote URL (`${2}`) bound as **shell positional parameters**
(never spliced into command text — Constitution v1.4.0 argument-safe mandate). Pure
logic (action list ops, limit, `${2}`-enablement) lives in `shared/actions.ts`. See
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md` in the feature dir.

Foundational context (the app being extended) remains in
`specs/001-repo-dashboard/plan.md`.
<!-- SPECKIT END -->
