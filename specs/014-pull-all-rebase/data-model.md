# Data Model: Rebase Diverged Repositories on Pull All

Phase 1 output. This feature adds **one enum value** and changes the *meaning* of the
diverged update path. No new entities, no new persisted data, no new IPC shape.

## Changed type: `UpdateReasonCategory` (`src/shared/types.ts`)

Add one member:

```
'diverged' | 'fetch-failed' | 'stash-failed' | 'timed-out' | 'update-failed'
  | 'rebase-conflict'   // NEW
  | 'unavailable' | 'detached'
```

- **`rebase-conflict`** — the repository was diverged, a rebase of local commits onto the
  upstream was attempted, and it stopped on a merge conflict. The rebase was aborted and
  the repository restored to its exact prior state. Carries `detail` (git stderr, via
  `errorDetail`) like the other attempt-failure categories.

`UpdateReason` and `RepoUpdateOutcome` are structurally unchanged.

## Update-outcome state machine (per working tree)

Only the **diverged** transition changes; everything else is as feature 006/013 shipped.

| Precondition (after fetch) | Old outcome | New outcome |
|----------------------------|-------------|-------------|
| `HEAD == @{u}` | `already-current` | `already-current` (unchanged) |
| `@{u}` is ancestor of `HEAD` (local ahead only) | `already-current` | `already-current` (unchanged) |
| `HEAD` is ancestor of `@{u}` (pure behind) | `updated` (ff-only) | `updated` (ff-only, unchanged) |
| **neither is ancestor (diverged), rebase applies cleanly** | `failed` / `diverged` | **`updated`** (rebased) |
| **neither is ancestor (diverged), rebase conflicts** | `failed` / `diverged` | **`failed`** / **`rebase-conflict`** |
| fetch/stash/timeout/other failures | `failed` / (respective reason) | unchanged |
| ineligible (unavailable/detached/no-upstream) | `skipped` (+reason or none) | unchanged |

### Invariants (test targets)

- **INV-1 (no merge commit)**: a successful diverged update never introduces a merge
  commit — the local commits are replayed linearly on top of `@{u}` (FR-009).
- **INV-2 (exact restore on conflict)**: after a `rebase-conflict`, `HEAD`, the set of
  local commits, and the working-tree contents (tracked + untracked) equal their
  pre-operation values; no `.git/rebase-merge`/`rebase-apply` remains (FR-004).
- **INV-3 (never lose work)**: on every path, uncommitted work is restored to the working
  tree or preserved recoverably in the stash (FR-007/FR-008). Untracked files are included
  in the autostash (spec Q2).
- **INV-4 (result reuse)**: a `rebase-conflict` sets `result === 'failed'`, so it flows
  into `failedPaths`, the "Failed" filter (007), the light-red row (Principle IV), and the
  013 warn icon with no renderer changes beyond the tooltip string (spec Q3).

## Renderer presentation (`src/renderer/view/table.ts`)

Add one entry to `REASON_SENTENCE`:

```
'rebase-conflict': 'Update blocked — rebase hit a conflict; resolve it in your merge tool'
```

- Uses the existing "Update blocked —" lead (attempt-failure family) so the
  attempted-vs-skipped distinction (013 FR-004) stays consistent.
- No change to `warnTooltip`, the icon element, CSS, or `positionRowIconTooltip`.
- `renderer.ts` `isWarningResolved` needs **no** new branch: `rebase-conflict` falls
  through to `deriveRowState(entry) === 'clean'` (research Decision 7).
