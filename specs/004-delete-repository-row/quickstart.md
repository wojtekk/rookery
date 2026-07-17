# Quickstart: Delete Repository Row

Validation guide proving the feature end-to-end. See
[contracts/delete.md](./contracts/delete.md) and [data-model.md](./data-model.md)
for the logic being exercised. **This feature performs real, irreversible git
and filesystem operations** — every scenario below MUST be run against
disposable scratch repositories, never a real working repository.

## Prerequisites

- Node 22 (`.nvmrc`), `pnpm install` completed, system `git` available.
- A scratch observed directory containing several disposable git repositories in
  different states (see setup column below) — e.g. under `/tmp/delete-scratch/`.
- At least one scratch repo that is itself a git worktree family (a primary
  clone plus `git worktree add ../scratch-wt <branch>`), to exercise the
  worktree-removal path.

## Build & run

```sh
pnpm run build      # tsc (main + preload + renderer) + copy assets
pnpm start          # launches Electron
```

## Automated check (pure logic)

```sh
pnpm test           # builds, then node --test dist/tests/*.test.js
```

Expected: `tests/delete-risk.test.ts` passes — covering `computeDeleteRisk`'s
four individual risk conditions, their combination into a single `atRisk`
result, and the no-remote-skips-fetch short-circuit (data-model.md Invariants).

## Manual validation scenarios

| # | Setup | Action | Expected (maps to) |
|---|-------|--------|--------------------|
| 1 | Any row | Look at the row without hovering | Delete ("x") icon visible on the right side. (FR-001, SC-001) |
| 2 | Clean scratch repo, fully pushed to a real or local bare remote | Click delete, confirm | Exactly one dialog; repo deleted from disk and from trash (recoverable); row disappears after the automatic refresh. (US1, FR-002/008/010, SC-002/006/007) |
| 3 | Same as #2 | Click delete, then Cancel | Nothing deleted; row unchanged. (US1, FR-006, SC-004) |
| 4 | Scratch repo with an uncommitted edit | Click delete, confirm dialog 1 | Second dialog appears naming "uncommitted changes"; Cancel it → nothing deleted. Confirm it → repo deleted. (US2, FR-003/004, SC-003) |
| 5 | Scratch repo with **no remote** configured (`git init` only) | Click delete, confirm dialog 1 | Second dialog appears naming "no remote configured". (US2, FR-003/004) |
| 6 | Scratch repo with a remote but an unpushed local commit | Click delete, confirm dialog 1 | Second dialog appears naming unpushed commits. (US2, FR-003) |
| 7 | Scratch repo that is dirty **and** has no remote | Click delete, confirm dialog 1 | Exactly **one** second dialog, listing both reasons — never a third prompt. (FR-005, SC-003) |
| 8 | Repo with a remote; disconnect network (or point remote at an unreachable host) | Click delete, confirm dialog 1 | Second dialog appears (fetch failure treated as at-risk); action does not hang. (FR-004a, Edge: live check cannot complete) |
| 9 | A linked worktree row (nested under its primary) | Click its delete icon, confirm (+ second dialog if at risk) | Worktree is removed via `git worktree remove`; the parent repo's `git worktree list` no longer shows it — not just an emptied folder. (US3, FR-007, SC-005) |
| 10 | An orphan worktree row (parent directory not itself observed) | Click delete, confirm | Same as #9 — worktree-removal path applies regardless of orphan/linked. (US3) |
| 11 | Any scratch repo | Delete it, then immediately check the OS trash/recycle bin | Directory is present and restorable (non-worktree path only). (FR-008, SC-007) |
| 12 | A repo directory on a filesystem/volume without trash support (or simulate via a failing `shell.trashItem`) | Delete, confirm | Falls back to permanent deletion; no third prompt; deletion still succeeds. (FR-009, Edge: trash unavailable) |
| 13 | A repo row | Delete a **different** row's directory externally (e.g. `rm -rf` in a terminal) right before confirming | `deleteRow` treats the already-missing path as a successful removal, not an error. (Edge: directory already gone) |
| 14 | A repo directory with restrictive permissions preventing deletion | Click delete, confirm (+ second dialog if applicable) | `{outcome:'failed'}` surfaces an error; row remains visible on the dashboard. (FR-011, Edge: deletion fails mid-operation) |
| 15 | A scratch repo row | Delete its directory externally (e.g. `rm -rf` in a terminal) **between confirming dialog 1 and confirming dialog 2** (or between dialog 2 and removal) | The risk check / removal step re-observes the live filesystem/git state rather than acting on what dialog 1 saw; the already-missing path resolves as a successful removal, not an error or a stale-state crash. (Edge: row disappears during confirmation) |

## What "done" looks like

- Scenarios 1–14 pass by observation against disposable scratch repositories.
- `pnpm test` green (incl. new `delete-risk.test.ts`).
- No scenario ever produces more than two confirmation dialogs.
- `Settings.observedDirectories` (Settings screen) is unchanged after every
  scenario — deletion never touches the observed-directories list.
