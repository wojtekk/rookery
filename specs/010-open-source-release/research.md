# Phase 0 Research: Publish as a Public Open-Source Project on GitHub

No `[NEEDS CLARIFICATION]` markers remain in the spec (resolved via `/speckit-clarify`: license = MIT + Commons Clause 1.0; unsigned builds; repo renamed to `rookery`; single-OS test matrix). This document resolves the remaining *technical* choices needed to implement the spec's requirements — none of these are business-facing ambiguities, they're "how" decisions the spec deliberately left to planning.

## 1. Packaging tool for macOS/Windows/Linux builds (FR-004, FR-005)

- **Decision**: [`electron-builder`](https://www.electron.build/) as a new devDependency.
- **Rationale**: it is the de-facto standard for packaging Electron apps for all three desktop OSes from one config, and it has first-class GitHub Releases integration (`--publish` mode, or just build-only mode as used here — see §3). It works fine building fully unsigned artifacts (FR-013): macOS just needs `CSC_IDENTITY_AUTO_DISCOVERY=false` so it doesn't search the runner for a signing identity; Windows/Linux need no signing flags at all by default.
- **Alternatives considered**:
  - *Electron Forge* — comparable capability, more scaffolding-oriented (opinionated project templates, plugin system). Rejected: this is an existing, already-structured project; Forge's extra scaffolding buys nothing here, and electron-builder's single declarative `build` config is the smaller diff.
  - *Hand-rolled `@electron/packager` + manual zip* — more code to write and maintain (installer generation, per-OS packaging quirks) for no benefit over a maintained tool. Rejected per the constitution's Principle V (minimal footprint / YAGNI): a well-established, single build-only dependency beats reimplementing packaging.
- **Constitution fit**: Principle V requires new *runtime* dependencies to be justified; `electron-builder` is a build-time-only devDependency, never bundled into or run by the shipped app, so it does not add to the app's runtime footprint or attack surface.
- **Output directory — must not collide with the existing build** (found in `/speckit-analyze`, finding I1): electron-builder's own default `directories.output` is `dist/` — the same path `package.json`'s `build` script already uses for the compiled TypeScript output. Left unconfigured, a release build would have electron-builder writing packaged installers into (or trying to package) the same directory the `tsc` build just populated. `electron-builder.yml` MUST set `directories.output: release` (a new, distinct directory) to avoid this.
- **File inclusion scope — must not bundle the whole repo** (finding U1): electron-builder's default file selection, left unconfigured, packages the project root broadly rather than just the app's runtime output — for this repo that would include `specs/`, `tests/`, `.specify/`, and TypeScript sources into the shipped installer. `electron-builder.yml` MUST set an explicit `files` allowlist scoped to what the app actually needs at runtime: `dist/**/*` and `package.json` (this app has no `dependencies` to bundle — devDependencies like `electron`/`typescript` are never included by electron-builder regardless).

## 2. Per-platform artifact format (FR-004)

- **Decision**: one artifact per OS — macOS `.dmg`, Windows NSIS `.exe` installer, Linux `.AppImage`. Packaged output goes to `release/` (not `dist/` — see §1's output-directory note), sourced from `dist/**/*` (§1's `files` allowlist).
- **Rationale**: each is electron-builder's conventional default target for its OS, requires no extra config, and needs no installation step beyond "double-click" / "make executable and run" (AppImage) — matching FR-004's "distributable, installable build" in the simplest form per OS.
- **Alternatives considered**: additional Linux formats (`.deb`, `.rpm`), a Windows portable `.exe`, macOS `.zip` for auto-update feeds. Rejected for v1: the spec has no auto-update requirement (see spec Assumptions) and no request for distro-specific packages; one predictable file per OS is the smallest surface that satisfies FR-004. Can be added later without changing the workflow's shape.

## 3. Release atomicity — "all three or none" (FR-006)

- **Decision**: the release workflow has two job stages: a `build` matrix job (`macos-latest`, `windows-latest`, `ubuntu-latest`) that only builds and uploads each artifact as a *workflow artifact* (`actions/upload-artifact`), and a single downstream `publish` job with `needs: build`. GitHub Actions' own `needs` semantics skip a downstream job automatically if any job it depends on fails — so "publish only if all three succeeded" requires no custom orchestration logic, just this job dependency shape.
- **Rationale**: this is the smallest mechanism that satisfies FR-006 exactly — no partial release is ever visible because the Release object is only created in the one `publish` job, after all three builds are confirmed green.
- **Alternatives considered**: letting each matrix leg `--publish=always` directly to the same GitHub Release via electron-builder's built-in publishing. Rejected: a Release created by the first successful leg would already be public before the other two legs finish, so a subsequent failure would leave a real user staring at a partial release for however long the other jobs take — exactly what FR-006/SC-004 forbid.

## 4. Release creation + re-tag/re-run behavior (edge case: re-tagging replaces artifacts)

- **Decision**: the `publish` job downloads all matrix artifacts and creates/updates the release with [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release), a widely-used, actively maintained GitHub Action, with `generate_release_notes: true`.
- **Rationale**: given the same tag, this action updates an existing release's assets in place rather than failing or duplicating — which is exactly the required re-tag/re-run behavior, with zero custom scripting. `generate_release_notes: true` uses GitHub's own auto-generated notes (commit list since the last tag) so release notes are never blank (found underspecified in `/speckit-analyze`, finding U3) without hand-writing changelog text per release.
- **Alternatives considered**: shelling out to `gh release create --clobber` directly. Equivalent behavior, slightly more shell-scripting to hand-maintain for the same result; rejected in favor of the maintained action doing the same job in fewer lines of workflow YAML.

## 5. Release trigger pattern (spec Assumption: `v<semver>` tags)

- **Decision**: `on: push: tags: ['v*.*.*']` in `release.yml`.
- **Rationale**: matches the spec's documented assumption directly and is the standard GitHub Actions idiom for semver-tag-triggered releases.
- **Alternatives considered**: `workflow_dispatch` (manual trigger) as an addition. Not requested and not needed for "release on tag" — omitted per YAGNI; can be added later as a one-line `on:` addition if a manual re-run-without-retagging need ever comes up.

## 6. CI (test-on-push) runner and toolchain setup (FR-002, FR-003)

- **Decision**: `test.yml` runs on `ubuntu-latest` only (per the spec's Clarifications), triggered on `push: branches: ['**']` and `pull_request`, with the job explicitly named `test`. Steps: `actions/checkout`, `pnpm/action-setup` (pins the pnpm major version already implied by the committed `pnpm-lock.yaml`), `actions/setup-node` with `node-version-file: .nvmrc` (so CI always matches the pinned Node 24 — no version drift to maintain in two places), `pnpm install --frozen-lockfile`, then `pnpm test` (which itself runs `pnpm run build` + `node --test dist/tests/*.test.js`, unchanged).
- **Rationale**: reuses the exact commands already documented in the current README with no new scripts; `node-version-file` + `--frozen-lockfile` are the standard low-maintenance idioms for keeping CI's toolchain pinned to what's actually committed to the repo.
- **`branches: ['**']` instead of a bare `push:`** (found in `/speckit-analyze`, finding I2): GitHub Actions' unfiltered `on: push` also fires on tag pushes, not just branch pushes. Since `release.yml` (§5) already runs on `v*.*.*` tags, an unfiltered `test.yml` would double-trigger alongside it on every release. Scoping to `branches: ['**']` matches FR-002's stated "any branch" scope exactly and excludes tag pushes, so a release tag triggers only `release.yml`.
- **Explicit job name `test`** (finding U2): so the check that shows up on commits/PRs has a stable, predictable name — needed if branch protection ever requires this check by name later, and clearer than an auto-generated id in the meantime.
- **Alternatives considered**: none materially different — this is a direct translation of the existing local dev commands into CI steps.

## 7. LICENSE file content (FR-010, FR-011)

- **Decision**: a single `LICENSE` file containing the official Commons Clause License Condition v1.0 text (unmodified boilerplate, per its own recommended usage) prepended above the standard MIT License text it modifies, per the license's own documented convention at commonsclause.com.
- **Rationale**: this is the standard, recognized way to combine the two — using the unmodified official text of both (rather than a custom paraphrase) is what makes the license legible and enforceable; courts and license-compliance tooling (e.g. GitHub's own license detector, `licensee`) recognize this exact pairing pattern.
- **Alternatives considered**: paraphrasing a custom license. Rejected — legally weaker, unrecognized by tooling, and exactly the kind of thing a maintainer should not hand-roll (spec's Assumptions already flag this as a "be precise, don't call it something it isn't" concern).

## 8. README restructuring approach (FR-007–FR-009, FR-012, FR-013)

- **Decision**: extend the existing README in place (it already has strong "Top-level architecture," "Running it locally," and "Contributing" sections from prior features) rather than rewriting it from scratch. Add: a one-line status badges row (CI status, license, latest release) near the top, a short "What is this" opening paragraph, a "Download" section linking to the GitHub Releases page with the Gatekeeper/SmartScreen bypass instructions, and a "License" section summarizing MIT + Commons Clause in plain language with a link to `LICENSE`. Update the existing "Releasing it" section, which currently says "there's no packaged distribution yet," to describe the new automated release-on-tag flow instead.
- **Rationale**: matches the constitution's Development Workflow guidance ("changes MUST be surgical... no unrequested refactors") — the existing README content (architecture, contributing workflow, local run instructions) remains correct and useful; this feature only needs to *add* the public-facing pieces spec'd in FR-007–FR-013 and correct the now-stale "no packaged distribution yet" claim.
- **Alternatives considered**: a ground-up README rewrite. Rejected — most of the existing content (architecture diagram, contributing workflow, local dev commands) is accurate and still needed; rewriting it would be unrequested scope and risk losing detail that took multiple prior features to accumulate.

## 9. pnpm version pinning for `pnpm/action-setup` (found in `/speckit-analyze`, finding U1)

- **Decision**: add a `"packageManager": "pnpm@<major>.x.x"` field to `package.json`, matching the pnpm major version the maintainer standardizes on.
- **Rationale**: `pnpm/action-setup` (used in both `test.yml` and `release.yml`) resolves which pnpm version to install from either an explicit `version:` input or a `packageManager` field in `package.json` — it does **not** read `pnpm-lock.yaml`. `package.json` currently has no `packageManager` field and neither workflow was specified with an explicit `version:` input, so as originally planned, the first setup step of both workflows would fail immediately ("Unable to find pnpm version"), breaking FR-002/FR-003 and FR-005/FR-006 entirely. Adding the field is a one-line fix that also gives local `corepack` users the same pinned version, rather than duplicating a `version:` input in two separate workflow files with no single source of truth.
- **Alternatives considered**: passing `version:` explicitly to each `pnpm/action-setup` step. Rejected — duplicates the same version string across `test.yml` and `release.yml` with nothing keeping them in sync, whereas the `packageManager` field is read once by both and by any contributor's local `corepack`-enabled `pnpm`.

## 10. Manual, one-time prerequisite (not automatable by this feature's file changes)

- **Finding**: this repository currently has **no configured git remote** (confirmed: `git remote -v` returns nothing) and has never been pushed anywhere. Actually creating the public GitHub repository named `rookery`, pushing this history to it, and enabling Actions on it are one-time actions on GitHub itself — they cannot be accomplished by writing files in this worktree, and (per this environment's operating rules) creating a new public repository and performing the first push are actions "visible to others" that require the maintainer's explicit go-ahead, not something to automate silently.
- **Implication for tasks**: the task breakdown must include an explicit, clearly-flagged manual step ("create the public `rookery` repo on GitHub, push `main`") ahead of/alongside the file-based tasks (workflows, LICENSE, README), rather than assuming it already exists.
