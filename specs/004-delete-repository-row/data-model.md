# Phase 1 Data Model: Delete Repository Row

Additive to `src/shared/types.ts`. Everything crosses the IPC boundary, so all
fields are plain serializable data. No existing type changes shape — `Row`,
`Repository`, `OrphanWorktree`, and `WorkingTreeEntry` (001/002) are untouched;
this feature only reads their existing `fullPath`/`kind` fields.

## DeleteTarget (new)

What the renderer sends to identify exactly which row to delete. Deliberately
minimal — research R2 established that neither a "primary path" nor any git
state needs to travel from renderer to main; main re-derives risk live.

```
type DeleteTarget = {
  path: string        // the row's own fullPath — a repository's primary checkout,
                       //   an orphan worktree, or a linked worktree, all alike
  isWorktree: boolean  // true for a linked OR orphan worktree row; false for a
                       //   repository's own (primary) row — selects the removal
                       //   path (git worktree remove vs. trash/permanent delete)
}
```

- The renderer already knows `isWorktree` for every row it builds: it is the
  same boolean `table.ts`'s `buildRow` already threads through as its
  `isWorktree` parameter (`false` for a top-level `Row`, `true` for each entry
  in `Repository.worktrees` and for `kind: 'orphan-worktree'` rows) — this
  reuses an existing distinction, it does not introduce a new one.

## DeleteRiskResult (new, main-process internal — not IPC-visible)

Not part of the public API surface; `deleteRow`'s internal risk assessment
before deciding whether to show the second dialog. Modeled here because it is
the direct implementation of the spec's "Delete risk assessment" entity.

```
type DeleteRiskResult = {
  atRisk: boolean       // true → show the second, destructive-action dialog
  reasons: string[]     // human-readable reasons feeding the dialog's body text
                          //   e.g. "has uncommitted changes", "has no remote configured",
                          //   "has unpushed commits", "sync status could not be verified"
}
```

Computed fresh on every delete attempt (never cached, never read from the
row's last-scanned/displayed state — Clarifications, Session 2026-07-17):

```
computeDeleteRisk(path, hasRemoteConfigured):
  reasons = []
  if !hasRemoteConfigured:
      reasons += "has no remote configured"
  else:
      fetchOk = probeFetch(path)             // git fetch; bounded by SPAWN_TIMEOUT_MS
      if !fetchOk:
          reasons += "sync status could not be verified"
  status = probeStatus(path)                  // git status --porcelain=v2 --branch
  parsed = parsePorcelainStatusV2(status)      // reused verbatim from 001
  if parsed.local > 0:
      reasons += "has uncommitted changes that will be lost"
  // Only meaningful when a remote exists — with no remote at all, every branch is trivially
  // local-only, and the "has no remote configured" reason above already fully captures that;
  // checking this unconditionally would double-count the same fact as two reasons.
  if hasRemoteConfigured:
      if parsed.head.upstream.tracking === 'local-only':
          reasons += "branch has no upstream / has never been pushed"
      else if parsed.head.upstream.tracking === 'tracked' and parsed.head.upstream.ahead > 0:
          reasons += "has commits that have not been pushed"
  return { atRisk: reasons.length > 0, reasons }
```

**FR-003 note**: "no upstream" and "unpushed commits" are two *distinct* branch
states in `shared/types.ts`'s `Head` type — `{tracking:'local-only'}` carries no
`ahead`/`behind` fields at all, so it cannot be caught by an `ahead > 0` check.
Both must be checked explicitly (`/speckit-analyze` finding C1); a branch that
was never pushed is the most extreme "unpushed" case there is, and is common
(e.g. a fresh local feature branch on a repo that otherwise has a remote).

`hasRemoteConfigured` is `probeRemoteUrl(path) !== null` — the same origin-only
check `scan.ts` already performs (001); this feature adds no new remote
discovery.

## DeleteOutcome (new, IPC return type)

```
type DeleteOutcome =
  | { outcome: 'deleted' }
  | { outcome: 'cancelled' }               // first or second dialog dismissed
  | { outcome: 'failed'; reason: string }  // git worktree remove / trash / fs error
```

The renderer does not branch on this beyond triggering a `refresh()` — a
cancelled or failed delete simply leaves the directory in place, so the next
scan reports it unchanged (satisfies FR-006/FR-011 with no renderer-side
state).

## `RepoDashboardApi` (changed)

One new method, additive to 001/002's bridge surface:

```
deleteRow(target: DeleteTarget): Promise<DeleteOutcome>
```

## Invariants (→ tests, `delete-risk.test.ts`)

1. `computeDeleteRisk` returns `atRisk: false` (and empty `reasons`) only when
   the repo has a remote, the fetch succeeds, there are zero uncommitted
   changes, and zero unpushed commits (SC-002's "exactly one confirmation"
   case).
2. Any single risk condition — dirty, no remote, **no upstream (local-only
   branch)**, ahead of upstream (unpushed commits on a tracked branch), or
   unverifiable fetch — alone yields `atRisk: true` with exactly the one
   matching reason (SC-003, FR-003).
3. Multiple simultaneous risk conditions still yield a single `atRisk: true`
   result with all matching reasons listed — never more than one destructive
   dialog is triggered regardless of how many `reasons` accumulate (FR-005).
4. `DeleteTarget.isWorktree` alone (not path shape/parent lookup) selects the
   removal path: `true` → worktree-remove; `false` → trash/permanent-delete.
5. A `local-only` branch and a `tracked` branch with `ahead > 0` are two
   *different* reasons, never conflated, and a `local-only` branch on a repo
   with a remote is still `atRisk: true` even though `ahead`/`behind` don't
   apply to it (the C1 gap this invariant exists to prevent regressing).
6. A repo with **no remote at all** yields exactly the single reason
   `"has no remote configured"` — it must NOT also report `"branch has no
   upstream"`, since every branch is trivially local-only when there is no
   remote to begin with; that would double-count one underlying fact as two
   reasons (discovered by `delete-risk.test.ts` during implementation).
