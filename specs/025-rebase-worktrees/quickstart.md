# Quickstart: Rebase Worktrees onto the Default Branch

Validation guide for feature 025. Automated coverage lives in `tests/rebase-worktrees.test.ts`
(pure eligibility/default-branch/reason + real-git-fixture rebase state machine). The scenarios
below are the manual end-to-end walkthrough against the live Electron app — the mutating-operation
manual check the constitution's Development Workflow requires (must include at least one
conflict/failure path before "done").

## Prerequisites

```bash
nvm use            # Node 24 per .nvmrc
pnpm install
pnpm test          # unit + fixture tests green (incl. new rebase-worktrees.test.ts)
pnpm start         # launch the Electron app
```

Set up a fixture repo under an observed directory with:
- a primary on `main` tracking `origin/main`,
- a **local-only** feature-branch worktree cut from `main` (never pushed),
- a **tracked** feature-branch worktree (pushed, has its own upstream),
- optionally a worktree already on `main`, and one with a detached HEAD.
Advance `origin/main` with a non-conflicting commit, and separately prepare a worktree whose commits
conflict with `origin/main` (touch the same lines).

## Scenarios

- **A — Button availability**: With ≥1 linked worktree present, the **Rebase worktrees** button is
  enabled. Remove/hide all worktrees (or point at a fleet with none) → button is disabled (FR-021).

- **B — Confirmation shown (not suppressed)**: Press **Rebase worktrees**. A warning appears about
  rewriting history / shared branches, with a "Do not remind me again" checkbox and Rebase / Cancel
  buttons. Nothing has been fetched or rebased yet (FR-016).

- **C — Cancel is a no-op**: In the confirmation, click Cancel. No worktree changed, no fetch ran,
  the reminder is still active on the next press (FR-017).

- **D — Local-only worktree rebased**: Confirm (leave checkbox unticked). The local-only feature
  worktree is replayed on top of the latest `origin/main` and reported updated — it is **not** the
  silent skip "Pull all" gives it (FR-005, SC-001, US1 scenario 1).

- **E — Tracked worktree rebased onto default, not its own upstream**: The tracked feature worktree
  is rebased onto `origin/main`, not onto its own upstream (US1 scenario 2). No push happens.

- **F — Dirty worktree**: A worktree with uncommitted (and untracked) changes is autostashed, rebased,
  and its changes restored afterward (FR-006, SC-004).

- **G — Already current**: A worktree already atop `origin/main` reports already-current, unchanged
  (US1 scenario 4). A worktree checked out on `main` itself is skipped with no warning.

- **H — Conflict is left untouched & failed**: The prepared conflicting worktree ends with its
  original HEAD, original commits, original working-tree contents, **no** rebase in progress, and is
  reported `failed`; its warn-icon tooltip reads as a conflict needing manual resolution
  (FR-007/FR-008/FR-009, SC-003). Confirm no `rebase-merge`/`rebase-apply` dir remains and
  `git stash list` is clean (or work is recoverable).

- **I — Primary untouched**: After any run, the primary repo's working tree and its local `main`
  are byte-for-byte unchanged; only remote-tracking refs moved (from the fetch) (FR-004, SC-005).

- **J — Fetch failure**: With the remote unreachable, the family's worktrees report `failed` /
  fetch-failed rather than rebasing onto a stale ref.

- **K — Shared failed surface (latest run wins)**: Run "Pull all" so some repos fail; then run
  "Rebase worktrees". The "Failed" filter / warn icons now reflect the rebase run's results, not the
  prior Pull all's (FR-009a). A manual Refresh prunes resolved entries.

- **L — Long-op lockout**: While "Rebase worktrees" runs, the other toolbar buttons, Settings, the
  Worktrees toggle, filter chips, sort header, and row actions are all inert (only the table + sort
  header dim; everything else shows a not-allowed cursor with no colour change). While Refresh/Pull
  all/Cleanup run, the Rebase worktrees button is inert (FR-013).

- **M — Suppress the reminder**: Press Rebase worktrees, tick "Do not remind me again", confirm. The
  run proceeds. Press again (and after an app restart) → no confirmation, runs immediately
  (FR-018/FR-019, SC-007).

- **N — Re-enable from Settings**: Open Settings → **Other** tab → turn the "Warn before rebasing
  worktrees" toggle back on. Next Rebase worktrees press shows the confirmation again (FR-020, US4
  scenario 5).

## Expected result

Every eligible feature-branch worktree (including local-only ones) is rebased onto the latest default
branch in one action; conflicts and fetch failures are reported without touching the worktree or the
primary; the reminder can be dismissed and re-enabled; and the constitution v4.1.0 amendment
(Principles III & IV) is ratified before merge.
