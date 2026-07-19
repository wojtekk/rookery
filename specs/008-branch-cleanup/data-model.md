# Phase 1 Data Model: Cleanup Gone Branches and Worktrees

New types added to `src/shared/types.ts` (shared across main/preload/renderer).
These extend the existing shapes (`Row`, `RepoUpdateOutcome`, `DeleteOutcome`)
without modifying them.

## `CleanupReason`

```ts
type CleanupReason = 'gone-branch' | 'missing-worktree' | 'merged-worktree';
```

Why an item is a removal candidate (see research D2/D4 for detection &
precedence). Exactly one reason per candidate.

## `CleanupCandidate` (output of the scan phase)

```ts
interface CleanupCandidate {
  repoPath: string;        // primary repository path (tilde-shortened for display; used as `git -C` target after expand)
  repoSlug: string | null; // remote slug for the overlay group header (Row.remote.slug)
  reason: CleanupReason;
  branch: string | null;   // branch to delete (set for 'gone-branch'; null for merged/missing worktree-only)
  worktreePath: string | null;   // linked worktree to remove (set when a worktree is involved; null for branch-only)
  worktreeDirMissing: boolean;    // true ⇒ removal uses `--force` (research D3)
  id: string;              // stable key = `${repoPath}::${branch ?? worktreePath}` — overlay checkbox key & dedupe key
}
```

**Validation / invariants**
- At least one of `branch` / `worktreePath` is non-null.
- `gone-branch` always has `branch`; may also have `worktreePath` (checked out in
  a linked worktree).
- `merged-worktree` and `missing-worktree` always have `worktreePath`; `branch`
  is null (their branch is not `[gone]`, so it is not deleted).
- Never references the current branch or the main worktree (excluded in scan).
- `worktreeDirMissing` is only ever `true` when `worktreePath` is non-null.

**Relationships**: Candidates are grouped by `repoPath` for the overlay. One
`Row` (kind `'repository'`) produces zero or more candidates.

## `CleanupSelection` (input to the execute phase)

```ts
type CleanupSelection = CleanupCandidate; // the subset the user left checked
```

The renderer passes back the full candidate objects that remain selected — the
main process needs `reason` / `worktreeDirMissing` / paths to pick the correct
command matrix (research D3), so echoing the candidate is simpler and safer than
sending bare ids the main process would have to re-resolve.

## `CleanupResult` and `CleanupOutcome` (output of the execute phase)

```ts
type CleanupResult = 'removed' | 'skipped' | 'failed';

interface CleanupOutcome {
  id: string;              // matches CleanupCandidate.id
  result: CleanupResult;
}
```

- `removed` — branch and/or worktree removed as planned.
- `skipped` — precondition made it un-removable without force (e.g. present
  worktree with uncommitted work: plain `git worktree remove` failed → kept).
- `failed` — an unexpected git error or the per-repo deadline elapsed.

The renderer tallies these into the counts toast (research D9). No per-item
reason string is surfaced (matches the clarified "counts only" summary); failures
remain visible because the post-run re-scan re-lists anything not removed.

## State transitions (per candidate, execute phase)

```
selected ──(command matrix runs, success)──▶ removed
selected ──(plain `worktree remove` refuses: dirty/untracked)──▶ skipped   (worktree kept)
selected ──(git error / deadline)──▶ failed
unselected ─────────────────────────────────▶ (never sent to executeCleanup; untouched)
```

## Renderer-transient state (not persisted, not in types.ts)

- `cleaning: boolean` — re-entry guard + toolbar busy/spin, mirroring `updating`.
- The current `CleanupCandidate[]` plan and the per-id checked map, held by the
  `cleanup.ts` overlay module between scan and confirm; discarded on close.

## Existing types reused unchanged

- `Row`, `Repository`, `WorkingTreeEntry`, `Head`, `Remote` — scan inputs.
- `RepoDashboardApi` — extended with two methods (see `contracts/ipc-cleanup.md`).
- `showNotice` toast + `doRefresh()` — result surfacing & re-scan.
