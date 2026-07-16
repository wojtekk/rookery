<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-repo-dashboard/plan.md`

Active feature: **Local Repository Dashboard** (`specs/001-repo-dashboard/`).
Stack: Electron + TypeScript (main / preload / renderer), system `git` (>= 2.15)
via `child_process` with `--no-optional-locks` (read-only, no bundled git). No UI
framework; settings as JSON in Electron `userData`. Tests via `node:test` over
pure logic (parse / identity / sort). See `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md` in the feature dir.
<!-- SPECKIT END -->
