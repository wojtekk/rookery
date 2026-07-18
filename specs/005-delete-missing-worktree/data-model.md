# Data Model: Delete a Worktree Whose Directory Is Already Missing

This feature amends one existing type (`DeleteTarget`, 004) and adds no new
persisted state.

## `DeleteTarget` (amended)

```ts
export interface DeleteTarget {
  path: string;
  isWorktree: boolean;
  familyPath?: string; // NEW
}
```

- **`familyPath`**: the absolute path of the worktree's family/primary
  repository — the directory whose `.git/worktrees/<name>` registers this
  worktree. Present **only** when the renderer is building a delete target
  for a *nested* worktree row (one rendered inside `row.worktrees` under an
  observed primary). `undefined` for a repository's own primary-checkout row
  and for a top-level orphan-worktree row (research R3/R4 — the renderer has
  no known family path to supply in either case; the orphan-worktree case is
  an existing, separate gap, not addressed here).
- Populated unconditionally for every nested worktree row (not only ones
  that currently render as unavailable) so a directory that vanishes *after*
  render but *before* the delete click still has a usable `familyPath` —
  consistent with 004's existing "never rely on a stale snapshot" posture
  for the risk check.

## `computeDeleteRisk` (unchanged)

No signature or behavior change. It is simply not invoked on the one new
branch this feature adds (missing-directory worktree target) — see
contracts/delete.md.

## Removal-path selection (amended decision table)

| `target.isWorktree` | target directory exists? | `familyPath` present? | Action |
|---|---|---|---|
| `false` | — | — | Unchanged (004): trash / permanent-delete fallback |
| `true` | yes | — | Unchanged (004): `git -C target.path worktree remove target.path --force` |
| `true` | no | yes | **NEW**: `git -C familyPath worktree remove target.path --force`, skip risk check, single confirmation |
| `true` | no | no | **NEW**: fail fast — `{ outcome: 'failed', reason: 'Cannot remove: worktree directory is missing and its family repository is unknown.' }` (should not occur in practice per R4, but must not silently report success) |
