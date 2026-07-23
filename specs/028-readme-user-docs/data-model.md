# Data Model: User-Facing README & Extracted Developer Docs

This feature has no runtime data model. Its "entities" are the three document artifacts
produced, each with a defined audience, required sections, and accuracy constraints. This
file records those so the tasks/validation phases have a concrete target.

## Artifact 1 — `README.md` (user-facing front door)

- **Audience**: prospective and current users.
- **Required sections** (from FR-001..FR-008, FR-010, FR-013):
  - Value proposition in the first screenful: what the app does, who it's for, ≥1 benefit
  - At least one screenshot of the actual interface
  - Plain-language explanation of each core workflow, each backed by an ASCII diagram:
    Pull all, Rebase worktrees, Cleanup, Clone, open-in-your-apps launchers, watching
    multiple directories
  - Prerequisites: system `git` required; `gh` CLI optional (Clone type-ahead; pasted-URL
    fallback)
  - Safety posture: app originates no network traffic of its own, read-only inspection,
    no telemetry
  - Download + first-launch bypass (macOS Gatekeeper, Windows SmartScreen)
  - License summary in plain language + link to full text
  - One-line pointer to `docs/development.md`
  - Brief mention of + link to `docs/workflow.md`
- **Accuracy constraints**: every diagram/claim matches current implementation (FR-004,
  SC-002); `gh` never described as required (FR-005); no inline developer detail (FR-009).

## Artifact 2 — `docs/development.md` (developer reference)

- **Audience**: developers / contributors.
- **Required sections** (from FR-011, FR-012):
  - Local build/run/test commands and prerequisites (Node version from `.nvmrc`, pnpm)
  - Architecture overview (three-context Electron: main / preload / renderer)
  - Contributing conventions
  - Release process
- **Accuracy constraints**: settings-file path matches `productName` (`Rookery`); no
  developer information lost in the extraction from the old README (FR-012, SC-005).

## Artifact 3 — `docs/workflow.md` (working-method guide)

- **Audience**: developers adopting the author's working style.
- **Required content** (from FR-013):
  - The domain-driven, worktree-isolated, layered-`CLAUDE.md` methodology
  - Concrete examples and copy-ready templates
- **Accuracy constraints**: linked (not inlined) from the README.

## Relationships

```text
README.md ──(one-line pointer)──▶ docs/development.md
README.md ──(brief mention + link)──▶ docs/workflow.md
```

Developer detail lives in exactly one place (`docs/development.md`), never duplicated in
the README (FR-009). The extraction is lossless (FR-012): every piece of developer
information present in the pre-rewrite README appears in `docs/development.md`.
