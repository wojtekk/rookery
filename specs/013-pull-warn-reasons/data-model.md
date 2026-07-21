# Data Model: Explain Why a Repository Wasn't Updated by Pull All

This feature is renderer + reporting only; it adds no persisted store. The
"data" is one widened result type crossing the `updateAll` IPC boundary plus
transient in-memory renderer state.

## Entity: `UpdateReasonCategory` (new, `shared/types.ts`)

A closed set of causes a working tree was not brought current. Maps 1:1 onto the
existing control-flow branches (research Decision 1).

| Value | Meaning | Warned via |
|-------|---------|------------|
| `diverged` | Local and upstream both moved; fast-forward impossible (never auto-merged — Principle III) | failed attempt |
| `fetch-failed` | Remote unreachable / auth / offline — the fetch step errored | failed attempt |
| `stash-failed` | Dirty work could not be safely autostashed or restored | failed attempt |
| `timed-out` | The per-repo update exceeded the time bound (`UPDATE_TIMEOUT_MS`) | failed attempt |
| `update-failed` | Catch-all: an unexpected git error during the attempt (carries `detail`) | failed attempt |
| `unavailable` | Skipped: the working tree's directory is unavailable | stuck skip |
| `detached` | Skipped: detached HEAD — no branch to fast-forward | stuck skip |

No-tracked-upstream skips are **not** in this set (FR-005): they produce no
reason and never warn.

## Entity: `UpdateReason` (new, `shared/types.ts`)

```
interface UpdateReason {
  category: UpdateReasonCategory;
  detail?: string;   // trimmed, length-capped underlying git error (FR-003); absent for skips
}
```

- `detail` is populated from `runGit`'s captured stderr (research Decision 3),
  present chiefly for `fetch-failed` / `update-failed`; absent for the
  entry-derived skip reasons (`unavailable` / `detached`), which have no git
  invocation behind them.

## Entity: `RepoUpdateOutcome` (extended, `shared/types.ts`)

```
interface RepoUpdateOutcome {
  path: string;              // unchanged — tilde-shortened fullPath
  result: UpdateResult;      // unchanged — 'updated' | 'already-current' | 'skipped' | 'failed'
  reason?: UpdateReason;     // NEW — present iff the tree is in the warned set
}
```

**Invariant (the warned-set rule)**: `reason` is present **iff** the tree is
warned. Concretely: present for every `result === 'failed'`, and for
`result === 'skipped'` only when the skip is `unavailable` or `detached`; absent
for `updated`, `already-current`, and no-upstream skips. This makes
`outcome.reason !== undefined` the single warned-set predicate.

## Renderer state (transient, in-memory — FR-011)

Built fresh from each `updateAll()` return; never persisted; cleared on restart.

| State | Type | Purpose |
|-------|------|---------|
| `warnings` | `Map<string, UpdateReason>` | path → reason; drives the `.row-warn-ico` + tooltip (warned set) |
| `failedPaths` | `Set<string>` (existing) | path set where `result === 'failed'`; drives the `.fail` red tint + "Failed" filter (FR-012) — a subset of `warnings.keys()` |

Derivation after a run:
`warnings = new Map(outcomes.filter(o => o.reason).map(o => [o.path, o.reason]))`
and `failedPaths = new Set(outcomes.filter(o => o.result === 'failed').map(o => o.path))`.

## Presentation mapping (renderer)

- **Icon**: a row with a `warnings` entry renders `.row-warn-ico` (a `⚠`)
  **inline at the end of the branch name**, the first line of the
  branch-tracking cell (FR-014), with an `aria-label` naming the reason
  (FR-013). It is a `flex-shrink:0` sibling of the now-separate
  `.branch-text` (`.branch` is a flex row) — same pattern as `.name`'s
  `.dirname`/`.frag` — so a long branch name truncates before the icon rather
  than the icon ever clipping (research Decision 4, revised 2026-07-21 twice).
- **Category → sentence** (leads the tooltip, plain language; "blocked" =
  attempted and failed, "skipped" = never attempted because stuck):
  `diverged` → "Update blocked — diverged from upstream, fast-forward not possible";
  `fetch-failed` → "Update blocked — couldn't reach the remote";
  `stash-failed` → "Update blocked — local changes couldn't be safely stashed";
  `timed-out` → "Update blocked — timed out";
  `update-failed` → "Update blocked — failed unexpectedly";
  `unavailable` → "Update skipped — working tree unavailable";
  `detached` → "Update skipped — not on a branch (detached HEAD)".
- **Tooltip text**: `sentence` + (if `detail`) `"\n\n" + detail`, rendered with
  `white-space: pre-line` (research Decision 5).

## State transitions (a warning's lifecycle)

```
(no warning)
   │  updateAll() returns an outcome with reason for this path
   ▼
warned ──── next updateAll() brings it current / no longer warns ──▶ cleared
   │
   ├──────── manual Refresh finds cause locally resolved (FR-008):
   │           unavailable→availability ok, detached→on a branch,
   │           attempt-failure→row now clean (feature 007 rule)      ──▶ cleared
   │
   └──────── app restart (in-memory only, FR-011)                    ──▶ cleared
```

## Out of scope (no model here)

- Persistence of reasons across restart (FR-011 forbids it).
- Producers other than "Pull all" (the affordance is source-agnostic per
  FR-015, but only the Pull-all producer is built now).
- Widening the "Failed" filter to the warned set (FR-012 keeps it on `failed`).
