# Implementation Plan: Publish as a Public Open-Source Project on GitHub

**Branch**: `010-open-source-release` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-open-source-release/spec.md`

## Summary

Turn this from a local-only personal project into a publicly hosted, installable open-source-adjacent project: rename the repo `git-manager` → `rookery` on GitHub, add a `test.yml` GitHub Actions workflow that runs the existing `pnpm test` suite on every push/PR (Linux only — the suite is platform-agnostic), add a `release.yml` workflow that builds unsigned macOS/Windows/Linux artifacts with `electron-builder` on a `v*.*.*` tag and publishes all three to a single GitHub Release only if all three builds succeed, add a root `LICENSE` (MIT + Commons Clause 1.0), and extend the existing README with a purpose statement, download link, contribution process, and plain-language license summary. No application source code changes — this is entirely new configuration/documentation plus one new devDependency (`electron-builder`).

## Technical Context

**Language/Version**: TypeScript 5.5 / Node.js 24 (pinned in `.nvmrc`) — unchanged by this feature

**Primary Dependencies**: `electron-builder` (new devDependency, build-time only — packages the three OS artifacts). CI/release automation itself uses GitHub-hosted Actions: `actions/checkout`, `actions/setup-node` (`node-version-file: .nvmrc`), `pnpm/action-setup`, `actions/upload-artifact` / `actions/download-artifact`, `softprops/action-gh-release`

**Storage**: N/A

**Testing**: unchanged — `pnpm test` (`tsc` build + `node --test dist/tests/*.test.js`), now also run automatically in CI on `ubuntu-latest`

**Target Platform**: shipped app targets macOS / Windows / Linux desktop (unchanged); CI/release automation runs on GitHub-hosted `ubuntu-latest` (test + Linux build), `macos-latest` (mac build), `windows-latest` (Windows build)

**Project Type**: desktop-app (Electron) — this feature adds repository infrastructure (CI/CD workflows, licensing, docs) around it, no new application modules

**Performance Goals**: no hard SLA; each release build job is expected to complete in a few minutes (electron-builder's typical single-platform build time), well inside GitHub Actions' per-job limits

**Constraints**: no code-signing certificates or secrets (FR-013 — unsigned/unnotarized by design); no new *runtime* dependency added to the shipped app (`electron-builder` is devDependency-only); release MUST be all-three-or-nothing (FR-006)

**Scale/Scope**: one Electron app, three target OS builds, two new GitHub Actions workflow files, one LICENSE file, one README revision — no new source directories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| I. System-Native Delegation | No | This feature adds no git operations; it doesn't touch how the app shells out to system `git`. |
| II. Read-Only by Default, Destructive by Explicit Action | No | No new mutating operation is added to the *application*. (The one genuinely irreversible, "visible to others" action — creating/renaming the public GitHub repo and first push — is a manual, explicitly-confirmed operational step, not app behavior; flagged in research.md §10 and carried into tasks.md, not silently automated.) |
| III. Never Resolve Conflicts — Fail Loud, Hand Off | No | Not applicable — no merge/pull/push logic added to the app. |
| IV. Always-Observable State | No | No UI/state-surfacing change. |
| V. Local-Only, Minimal Footprint | Yes | `electron-builder` is a new dependency — justified in research.md §1 as build-time-only (never bundled into or executed by the shipped app), so it doesn't add to the running app's footprint, network surface, or attack surface. The constitution's local-only/no-telemetry mandate governs the *shipped app's runtime behavior*; running builds on GitHub's cloud infrastructure is this project's build/release process, not new app behavior (spec Assumptions, confirmed here). |

**Result**: PASS. No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-open-source-release/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── ci-workflow.md       # test.yml trigger/status contract
│   └── release-workflow.md  # release.yml trigger/artifact/publish contract
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── test.yml          # NEW — push/PR test check (ubuntu-latest)
    └── release.yml       # NEW — tag-triggered 3-OS build + gated publish

electron-builder.yml       # NEW — build targets (dmg/nsis/AppImage), CSC_IDENTITY_AUTO_DISCOVERY=false for mac
LICENSE                    # NEW — MIT + Commons Clause 1.0
README.md                  # MODIFIED — badges, purpose, download, license summary, updated "Releasing it"
package.json                # MODIFIED — add electron-builder devDependency + "build" script, and a "packageManager" field so pnpm/action-setup can resolve a version in CI; existing scripts unchanged
```

**Structure Decision**: this is a repository-infrastructure feature, not a new application module — there is no `src/` change and none of the plan template's app-layout options (single project / web / mobile) apply. All new files live at the repository root (`.github/workflows/`, `LICENSE`, `electron-builder.yml`) or extend an existing root file (`README.md`, `package.json`). Documentation for the feature itself follows the standard `specs/010-open-source-release/` layout above.

## Complexity Tracking

*No constitution violations — this section is intentionally empty.*
