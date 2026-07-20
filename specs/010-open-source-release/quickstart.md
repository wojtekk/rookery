# Quickstart: Validate "Publish as a Public Open-Source Project on GitHub"

These are manual validation scenarios — there's no automated UI/end-to-end suite for repository infrastructure. Run them in order once implementation is complete; each maps back to an acceptance scenario or success criterion in `spec.md`.

## Prerequisite (one-time, manual — see `research.md` §10)

The repository has no configured git remote today. Before any scenario below can run for real:

1. Create a **public** GitHub repository named `rookery` (FR-001).
2. Push this repository's history to it (`git remote add origin <url>` on the branch that will become the new `main`, then push).
3. Confirm GitHub Actions is enabled for the repository (default for public repos).

## Scenario 1 — Test-on-push visibility (User Story 1 / FR-002, FR-003)

1. On a throwaway branch, break an existing test (e.g. flip an `assert.equal` expectation in `tests/parse.test.ts`).
2. Push the branch and open a pull request.
3. **Expected**: within a few minutes, the PR shows a failing check for the test workflow, visible directly on GitHub — no local `pnpm test` run required to see it.
4. Revert the change, push again.
5. **Expected**: the check turns green on the same PR.

## Scenario 2 — Cross-platform release on tag (User Story 2 / FR-004–FR-006, SC-002, SC-004)

1. Bump `version` in `package.json` (e.g. to `0.2.0`), commit, push to `main`.
2. Tag the commit `v0.2.0` and push the tag.
3. **Expected**: the release workflow's `build` matrix runs for macOS, Windows, and Linux; once all three succeed, a `publish` job runs and a new GitHub Release `v0.2.0` appears with exactly three assets: `rookery-0.2.0.dmg`, `rookery-0.2.0-setup.exe`, `rookery-0.2.0.AppImage` (see `contracts/release-workflow.md`).
4. **Negative check**: temporarily break the Windows build only (e.g. an invalid electron-builder Windows-specific config), push a new tag, and confirm **no** release is created/updated for that tag once the Windows leg fails — macOS/Linux succeeding is not enough on its own.
5. **Re-tag check**: delete and re-push the same tag (`git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0 && git tag v0.2.0 && git push origin v0.2.0`) and confirm the existing `v0.2.0` release's assets are replaced, not duplicated.

## Scenario 3 — Unsigned build warnings documented (Edge Case / FR-013)

1. Download the `.dmg` on a real or virtual macOS machine that hasn't run this app before; open it.
2. **Expected**: macOS shows its standard "cannot verify developer" (Gatekeeper) warning; following the README's documented steps lets the user proceed and launch the app.
3. Repeat on Windows with the `.exe`: confirm SmartScreen's warning appears and the README's bypass steps work.

## Scenario 4 — README readability (User Story 3 / FR-007–FR-009, FR-012, SC-003)

Hand the published README to someone unfamiliar with the project (or read it cold yourself) and time it:

1. Can they state what the project is and who it's for, from the opening section alone? (≤ 60s)
2. Can they find the download link and land on GitHub Releases? (≤ 60s)
3. Can they describe the expected process for proposing a change, from the Contributing section? (≤ 60s)
4. Can they state what the license does and does not permit — including that it's source-available rather than OSI-approved open source? (≤ 60s)

## Scenario 5 — License content correctness (FR-010, FR-011)

1. Open `LICENSE` and confirm it contains the unmodified Commons Clause License Condition v1.0 text followed by the unmodified MIT License text (see `research.md` §7) — no paraphrasing, correct copyright line.
2. Confirm GitHub's own license badge/detector on the repository page recognizes it (it may show as a custom/other license, which is expected and correctly reflects the "source-available, not OSI-approved" status called out in the README).
