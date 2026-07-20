# Contract: CI (test-on-push) Workflow

Who relies on this: the maintainer and any contributor watching a commit/PR's status; anyone who later wants to configure a GitHub branch-protection "required status check" against it.

## Trigger

- Any `push` to any branch (`branches: ['**']` — deliberately excludes tag pushes, so pushing a release tag triggers only the release workflow, not this one, avoiding a redundant double-run).
- Any `pull_request` event (opened, synchronized, reopened) targeting this repository.

## What runs

Exactly the commands documented in the README for local development, unchanged, in a job named `test`:

1. Check out the commit.
2. Install Node.js at the version pinned in `.nvmrc` (24).
3. Install pnpm at the version pinned in `package.json`'s `packageManager` field, then dependencies from the committed `pnpm-lock.yaml` (`--frozen-lockfile` — a lockfile drift fails the job instead of silently installing different versions).
4. Run `pnpm test` (builds via `tsc`, then runs `node --test dist/tests/*.test.js`).

Runs on `ubuntu-latest` only (spec Clarifications — the suite is platform-agnostic). The check shown on a commit/PR is named `test` — a stable name to reference if a required status check is configured later.

## Guarantee (FR-002, FR-003)

- Every push and every PR gets exactly one check run for this workflow.
- The check's pass/fail state is visible directly on the commit and on the PR's checks list in the GitHub UI — no local action required to see it.
- A failing check does **not** block the push or the PR from being merged by itself (spec Assumptions — no branch protection is configured by this feature); it is a visibility guarantee, not an enforcement guarantee. Enabling "require this check to pass before merging" is a separate, later repository-settings decision.

## Non-guarantees (explicitly out of scope)

- No guarantee about *how fast* the check completes.
- No macOS/Windows-specific test coverage — see spec Assumptions on revisiting this if platform-specific behavior ever needs testing.
