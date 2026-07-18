# Phase 1 Data Model: Update All Repositories

No persisted storage changes. This feature adds transient, in-flight/return
shapes plus one ephemeral renderer state. All new types live in
`src/shared/types.ts` (they cross the IPC boundary) except the renderer-only
`failedPaths` set.

## New types (`src/shared/types.ts`)

```ts
// Per-working-tree result of an update run.
export type UpdateResult =
  | 'updated'          // fast-forwarded to upstream
  | 'already-current'  // nothing to pull (equal, or local ahead — push is out of scope)
  | 'skipped'          // ineligible: unavailable, detached, or no tracked upstream
  | 'failed';          // diverged, fetch/timeout/credential failure, or stash could not be restored

export interface RepoUpdateOutcome {
  path: string;        // tilde-shortened fullPath (matches Row.fullPath, for renderer overlay keying)
  result: UpdateResult;
}
```

`RepoDashboardApi` gains one method (see contracts/ipc-api.md):

```ts
updateAll(): Promise<RepoUpdateOutcome[]>;
```

### Why these shapes

- The renderer needs (a) counts for the summary line and (b) the set of failed
  paths for the light-red overlay. A flat `RepoUpdateOutcome[]` covering *all*
  rows (eligible + skipped) gives both: counts by `groupBy(result)`, failed set =
  `filter(result === 'failed').map(path)`. No separate summary object needed.
- `path` is the **tilde-shortened** `Row.fullPath` (what the renderer holds), so
  the overlay can key on it directly without re-expanding. The main process
  expands `~` only when handing a path to `git` (via the existing `expandTilde`).

## Eligibility predicate (main process)

Flatten `lastSnapshot` into working trees, then keep:

```
availability === 'ok'
  && head.detached === false
  && head.upstream.tracking === 'tracked'   // subsumes "has a remote" + "branch tracks upstream"
```

| Row source | Included in flatten? |
|------------|----------------------|
| `kind: 'repository'` primary entry | yes |
| each entry in `repository.worktrees` | yes |
| `kind: 'orphan-worktree'` | yes (it's a real working tree with its own head/remote) |
| timed-out / `availability: 'unavailable'` rows | flattened but filtered out → `skipped` |

Ineligible working trees are still emitted in the result as `result: 'skipped'`
(so the summary's skipped count is accurate), but never touched.

### Concurrency: parallel across families, serial within one

A primary and its linked worktrees share **one** `refs/stash` (it lives in the
common git dir, not per-worktree). `updateAll` therefore groups working trees
into families — one repository row (primary + its `worktrees`) per family, plus
all orphan worktrees pooled into one conservative shared family (no cheap way to
know from `Row` data alone whether two orphans share an excluded primary) — and
runs `runPool` over **families**, processing each family's members one at a time.
Running family members concurrently would let one working tree's `stash pop`
grab another's entry, swapping or losing uncommitted work (violates "never
discard uncommitted work", Principle III). Parallelism is preserved across
independent repositories, which is the common case.

## Per-repo update state machine (`updateRepo(absPath) → UpdateResult`)

```
                     ┌─────────────┐
  dirty? ──yes──▶ stash push --include-untracked ──fail──▶ failed
     │no                    │ ok
     └──────────────┬───────┘
                    ▼
              git fetch <remote> <branch>  ──fail/timeout/auth──▶ (restore stash) failed
                    ▼
        compare HEAD vs @{u}
          ├─ equal ─────────────▶ (restore stash) already-current
          ├─ @{u} ancestor of HEAD (local ahead) ▶ (restore stash) already-current
          ├─ HEAD ancestor of @{u} (behind) ─▶ merge --ff-only ─fail─▶ (restore) failed
          │                                          │ ok
          │                                          ▼
          │                                   restore stash ─pop-conflict─▶ failed (changes safe in stash)
          │                                          │ ok
          │                                          ▼
          │                                        updated
          └─ diverged (neither ancestor) ─▶ (restore stash) failed   // Principle III: no auto-merge
```

**Invariants**

- Uncommitted work is never discarded: on every `failed`/rollback path the stash
  is either popped back or left intact in the stash list (FR-003, SC-002).
- The whole sequence runs under a per-repo deadline; a breach ⇒ `failed` after a
  best-effort rollback (FR-013).
- Only `merge --ff-only` ever changes committed state; nothing auto-merges (FR-004).

## Ephemeral renderer state (`src/renderer/renderer.ts`)

```ts
let updating = false;              // re-entry guard + toolbar spinner (FR-009)
let failedPaths = new Set<string>(); // paths with result 'failed' from the last run (FR-014)
```

- `failedPaths` is populated from the `updateAll()` result and **cleared at the
  start of the next run**. It is not persisted and not part of `Row`.
- `table.ts` reads `failedPaths` (passed into `renderRows`) and, for any row
  whose `fullPath` is in the set, applies BOTH: (a) the `--fail-edge` (light red)
  class at highest precedence over clean/dirty/sync edges, and (b) a redundant
  **non-colour cue** — a failed status glyph (e.g. `⚠`) plus a tooltip such as
  "pull failed — open in your merge tool". The glyph/tooltip is required by
  Principle IV ("colour MUST NOT be the sole signal of state"): without it, a
  colour-blind user cannot tell a failed-pull row from an ordinary amber
  out-of-sync row. Both cues are driven by the same `failedPaths` membership, so
  they can never diverge.

## State colours (renderer/CSS) — closes a pre-existing gap

The constitution's colour set already names "failed autostash pull = light red",
but only `--ok-edge`/`--dirty-edge`/`--sync-edge` exist today. This feature adds
`--fail-edge` (light red) and the `.row.fail` edge rule. Precedence, extending
the existing "dirty (blue) wins over out-of-sync (amber)" rule:

```
fail (light red)  >  dirty (blue)  >  out-of-sync (amber)  >  ok (green) / unavailable (grey)
```

`--fail-edge` applies only via the transient `failedPaths` overlay; it is never
produced by the scan.
