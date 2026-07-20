# Contract: Release Workflow

Who relies on this: anyone downloading the app from GitHub Releases (README links here directly); the maintainer tagging a new version.

## Trigger

- A pushed tag matching `v*.*.*` (e.g. `v1.2.0`). Any other tag is ignored — no workflow run at all.

## Jobs and ordering

1. **`build`** — a 3-way matrix (`macos-latest`, `windows-latest`, `ubuntu-latest`), each leg independent:
   - Installs the pinned Node/pnpm toolchain, runs `pnpm run build`, then runs `electron-builder` in build-only mode (no publishing from this job) to produce that OS's single artifact. Packaged output goes to `release/` (electron-builder's `directories.output`, explicitly set — **not** the default `dist/`, which is already used by the TypeScript build and would otherwise collide with it), built only from `dist/**/*` + `package.json` (an explicit `files` allowlist, so the packaged app doesn't pick up `specs/`, `tests/`, or other repo content it doesn't need at runtime).
   - Uploads the artifact as a workflow artifact (`actions/upload-artifact`), not as a release asset yet.
2. **`publish`** — `needs: build` (all three matrix legs):
   - Only starts if **all three** `build` legs succeeded. If any leg fails, `publish` does not run, and **no GitHub Release is created or modified** for that tag (FR-006).
   - Downloads all three uploaded artifacts and creates (or updates, if the tag already has a release — see Re-tagging below) a GitHub Release tagged with the pushed tag name, attaching all three files, with GitHub's auto-generated release notes (`generate_release_notes: true`) as the release body.

## Artifact naming convention (what a downloader sees)

One file per OS, named with the product and version so the right download is obvious without opening each one:

- macOS: `rookery-<version>.dmg`
- Windows: `rookery-<version>-setup.exe` (NSIS installer)
- Linux: `rookery-<version>.AppImage`

`<version>` is the tag with its `v` prefix stripped (e.g. tag `v1.2.0` → `rookery-1.2.0.dmg`).

## Re-tagging / re-running (edge case)

Pushing the same tag again (after deleting and recreating it, or re-running the workflow) re-runs both jobs and **replaces** the existing release's three assets in place — it does not create a duplicate release and does not silently fail.

## Guarantees (FR-005, FR-006, SC-002, SC-004)

- A successful tag push always results in a Release with **exactly three** assets, or **zero** assets/no release at all — never one or two.
- No manual build or upload step by the maintainer is ever required for a normal release.

## Non-guarantees (explicitly out of scope)

- No code-signing / notarization (FR-013) — downloaders will see their OS's standard "unidentified developer" warning; the README documents how to proceed past it.
- No auto-update feed — this contract only covers how a release is *created*, not how a running app discovers it (spec Assumptions: no auto-update in scope).
