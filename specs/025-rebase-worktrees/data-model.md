# Phase 1 Data Model: Rebase Worktrees onto the Default Branch

This feature adds no new cross-cutting entity — it extends three existing shapes in
`src/shared/types.ts` and reuses `RepoUpdateOutcome` verbatim for its results.

## 1. `Settings` (extended)

```ts
export interface Settings {
  observedDirectories: string[];
  sortDimension: 'slug' | 'directoryName' | 'lastChange' | 'localCount';
  sortDirection: 'asc' | 'desc';
  showWorktrees: boolean;
  defaultHost: string;
  actions: Action[];
  rebaseReminderSuppressed: boolean; // NEW — "do not remind me again" for the rebase confirmation
}
```

- **Default**: `false` (remind). Added to `DEFAULT_SETTINGS` in `config.ts`; loaded via the existing
  `{ ...DEFAULT_SETTINGS, ...parsed }` spread, so pre-existing settings files without the key default
  to `false` on read.
- **Persistence**: existing atomic temp-file + rename in `userData/settings.json`.
- **Mutation**: new IPC `setRebaseReminderSuppressed(value)`; set to `true` when the user ticks the
  confirmation checkbox, toggled back to `false` from the "Other" Settings tab.

## 2. `UpdateReasonCategory` (extended)

```ts
export type UpdateReasonCategory =
  | 'diverged'
  | 'fetch-failed'          // reused: family-level fetch of the default branch failed
  | 'stash-failed'          // reused: autostash push or restore failed
  | 'timed-out'             // reused: per-worktree deadline elapsed (rebase aborted)
  | 'update-failed'         // reused: catch-all
  | 'rebase-conflict'       // reused: rebase onto the default branch hit a conflict (aborted+restored)
  | 'unavailable'           // reused: skip — working tree unavailable
  | 'detached'              // reused: skip — detached HEAD
  | 'default-branch-unknown' // NEW: family's default branch could not be determined
  | 'orphan-worktree';       // NEW: orphan worktree — no known primary, default branch undeterminable
```

- `default-branch-unknown` and `orphan-worktree` are **warned** reason categories (they accompany a
  non-success outcome the user should see). Both need a sentence in `table.ts`'s `REASON_SENTENCE`
  map.
- The "already on the default branch" skip carries **no** reason (a benign no-op, never warned —
  same convention as the no-tracked-upstream skip in "Pull all").

## 3. `RepoUpdateOutcome` (reused unchanged)

```ts
export interface RepoUpdateOutcome {
  path: string;              // tilde-shortened worktree fullPath (matches Row.fullPath)
  result: UpdateResult;      // 'updated' | 'already-current' | 'skipped' | 'failed'
  reason?: UpdateReason;     // present iff warned (all 'failed'; 'skipped' only for unavailable/detached/orphan)
}
```

No new `UpdateResult` value: a rebase conflict maps to `failed`; a worktree already atop the default
branch maps to `already-current`; ineligible worktrees map to `skipped`. This lets the renderer's
`failedPaths`/`warnings`, the "Failed" filter, and the feature-013 warn icon work with zero change.

## 4. Per-worktree outcome state machine (behavioral, not a stored type)

Input: one repository family = `{ primary, worktrees[] }`, processed sequentially within the family.

```text
family:
  default = resolveDefaultBranch(primary)         # Decision 2
  if default is null:      -> every worktree: failed / default-branch-unknown ; STOP family
  fetch origin <default> from primary
  if fetch fails:          -> every worktree: failed / fetch-failed ; STOP family
  for each worktree (skip the primary):
    availability != ok      -> skipped / unavailable
    head.detached           -> skipped / detached
    branch == default       -> skipped / (no reason)      # on-default no-op
    origin/<default> ancestor of HEAD -> already-current   # nothing to replay
    else:
      dirty? -> stash push --include-untracked (fail -> failed / stash-failed)
      git rebase origin/<default>
        success -> restore stash -> updated  (restore conflict -> failed / stash-failed, work kept)
        conflict -> git rebase --abort -> restore stash -> failed / rebase-conflict
      (whole sequence bounded by per-worktree timeout -> failed / timed-out, rebase aborted)

orphan-worktree rows: skipped / orphan-worktree
```

**Invariants** (map to spec FRs / SCs):
- The primary/main worktree is never rebased (FR-002 targets *worktrees*; SC-005 primary unchanged).
- No path other than fetch mutates the primary; worktrees are addressed by `-C <path>` only (FR-004).
- On any failure path the worktree is restored to its exact prior state, no rebase in progress
  (FR-007, SC-003), and uncommitted work is never discarded (FR-010, SC-004).
- Local-only-branch worktrees are eligible (step "else" is reached regardless of upstream) — FR-005.

## 5. Renderer state (in-memory, not persisted)

- `rebasing: boolean` — re-entry guard + toolbar spinner for the new op; participates in
  `busy = refreshing || updating || cleaning || rebasing` (FR-013).
- `failedPaths` / `warnings` — **reused**, rebuilt at the start of each rebase run exactly as
  "Pull all" does (FR-009a). No new renderer state beyond `rebasing`.
- `hasWorktrees` — derived per render from `rows`, gates the button (FR-021). Not stored.
