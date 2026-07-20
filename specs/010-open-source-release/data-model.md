# Phase 1 Data Model: Publish as a Public Open-Source Project on GitHub

This feature has no persisted application data — it configures repository infrastructure. The spec's Key Entities are concrete files/configuration below, not runtime data structures.

## package.json (modified — shared by CI and Release Workflows)

- **New field**: `"packageManager": "pnpm@<major>.x.x"` — the single source of truth both `test.yml` and `release.yml`'s `pnpm/action-setup` step read to resolve which pnpm version to install (research.md §9/finding U1). Without it, neither workflow's setup step can determine a pnpm version and both fail immediately.

## CI Workflow

- **File**: `.github/workflows/test.yml`
- **Trigger**: `push: branches: ['**']` (any branch, tags excluded — see research.md §6/finding I2), `pull_request` (opened/synchronize/reopened)
- **Runner**: `ubuntu-latest` only (spec Clarifications: single-OS, matches the platform-agnostic test suite)
- **Job name**: `test` (pinned explicitly — research.md §6/finding U2)
- **Steps**: checkout → setup Node (`node-version-file: .nvmrc`) → setup pnpm (version resolved from `package.json`'s `packageManager` field — see above) → `pnpm install --frozen-lockfile` → `pnpm test`
- **Exposed state**: one GitHub check (named `test`) on the commit/PR with pass/fail status — see `contracts/ci-workflow.md`

## Release Workflow

- **File**: `.github/workflows/release.yml`
- **Trigger**: `push` tags matching `v*.*.*`
- **Jobs**:
  - `build` (matrix: `macos-latest`, `windows-latest`, `ubuntu-latest`) — each: checkout → setup Node/pnpm (same `packageManager`-resolved version as the CI Workflow) → `pnpm install --frozen-lockfile` → `pnpm run build` → `electron-builder` (build-only, unsigned, output to `release/` per `directories.output`, packaging only `dist/**/*` + `package.json` per the `files` allowlist — research.md §1/findings I1, U1) → `actions/upload-artifact` (one artifact set per OS, sourced from `release/`)
  - `publish` (`needs: build`) — downloads all matrix artifacts → `softprops/action-gh-release` (with `generate_release_notes: true` — research.md §4/finding U3) creates/updates the GitHub Release for the pushed tag with all three files attached
- **Atomicity**: `needs: build` means `publish` only runs if every matrix leg succeeded (FR-006) — no custom gating logic required
- **Fields/attributes carried through**: tag name (becomes the Release's tag and version string embedded in artifact filenames), one artifact per OS — see `contracts/release-workflow.md` for the exact naming convention

## GitHub Release

- Created/updated by the `publish` job; not a file in this repo — a GitHub-hosted entity
- **Attributes**: tag (`vX.Y.Z`), release title, GitHub auto-generated release notes (`generate_release_notes: true`), three attached assets (mac/win/linux)
- **Lifecycle**: created on first successful tag push; re-pushing the same tag updates (replaces) its assets rather than creating a duplicate (edge case in spec.md)

## LICENSE

- **File**: `LICENSE` (repository root)
- **Content**: Commons Clause License Condition v1.0 (unmodified official text) prepended above the standard MIT License text it modifies (research.md §7)
- **No variable fields** beyond the standard copyright line (year + holder name) that both license texts require

## README

- **File**: `README.md` (repository root, existing file extended in place)
- **New/changed sections** (mapping to FRs):
  - Badges row + opening "what is this" paragraph (FR-007)
  - "Download" section linking to the GitHub Releases page, with the Gatekeeper/SmartScreen bypass instructions (FR-008, FR-013)
  - Existing "Contributing" section extended with the expected change-proposal process (FR-009)
  - New "License" section: plain-language summary + link to `LICENSE`, explicitly noting "source-available, not OSI-approved open source" (FR-012, spec Assumptions)
  - Existing "Releasing it" section rewritten to describe the new automated tag-triggered release flow, replacing its current "there's no packaged distribution yet" text
