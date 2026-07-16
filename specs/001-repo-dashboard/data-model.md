# Phase 1 Data Model: Local Repository Dashboard

Entities are derived from the spec's Key Entities and requirements. Types below
describe the shapes that cross the IPC boundary (`src/shared/types.ts`). All
counts reflect the **last-known** local/remote-tracking state (no fetch).

The shapes use **discriminated unions** so that illegal states are unrepresentable
— the type is the invariant, not the prose. Each variant maps 1:1 to what the git
probe (P2) actually emits, so the parser fills exactly one variant and nothing has
to "assemble nullable fields then hope they agree."

## Head — branch / tracking / divergence

Mirrors porcelain v2: `# branch.head (detached)` → detached; `# branch.upstream`
absent → local-only; `# branch.ab` present → tracked with counts. This makes
"detached yet tracking", "local-only with ahead/behind", and "tracked with null
ahead/behind" all uncompilable (FR-007, FR-009).

```
type Head =
  | { detached: true }
  | { detached: false; branch: string; upstream:
        | { tracking: 'local-only' }                             // no ahead/behind
        | { tracking: 'tracked'; ahead: number; behind: number } // both always present
    }
```

## WorkingTree — the shared core (primary and worktree)

A worktree is a full working tree on its own branch, so primary and worktree share
one core (resolves the "worktree gets full state" review finding, spec.md:283-289).
`availability` gates everything else: a failed/timed-out probe carries no branch or
counts, so stale numbers on an unavailable row are unrepresentable (FR-027).

```
type WorkingTree =
  | { availability: 'unavailable' }                                          // nothing else known
  | { availability: 'ok'; head: Head; local: number; lastChange: string | null }

type WorkingTreeEntry = WorkingTree & {
  directoryName: string            // basename; shown as a column (FR-005, FR-023)
  fullPath: string                 // `~`-shortened untruncated; tooltip only, never a column (FR-005)
  collisionFragment: string | null // parent-path fragment shown inline when another VISIBLE row (primary
                                    // or worktree) shares slug+directoryName (FR-005)
}
```

- `local` (dirty paths incl. untracked, excl. gitignored) is displayed only when
  `> 0` (FR-008); a clean tree shows no count.
- `lastChange` is the ISO commit date of HEAD; `null` for unborn HEAD (sorts last).

## RowState (derived, never stored)

`RowState` drives the **left-edge state indicator** (a colored bar, not a full-row
background) plus the status glyph and the redundant non-color cue (FR-028). It is a
pure function of a row's `(availability, local, head)` — computed in the renderer
(`view/sort.ts`), **not stored** (a stored copy could disagree with the counts).

```
type RowState = 'clean' | 'dirty' | 'out-of-sync' | 'unavailable'
```

Derivation (per row, from its own core) → edge color + non-color cue:
- `unavailable`: `availability === 'unavailable'`      → grey edge + `?` glyph + dimmed text
- `dirty`      : `local > 0`                            → blue edge + solid dot glyph + "N changed"
- `out-of-sync`: `local === 0` and tracked with `ahead>0 || behind>0` → amber edge + `↑↓` glyph + counts
- `clean`      : otherwise                              → green edge + grey dot glyph + "clean"

Precedence: dirty (blue) wins over out-of-sync when both apply (FR-028). Colors:
ok=green, dirty=blue, out-of-sync=amber, unavailable=grey (see `design/README.md`).
The non-color cue is glyph + numeric text, so state survives grayscale (SC-008).

## Remote — repository identity

One nullable object, so "slug set but host null" (half an identity) is
unrepresentable (FR-006).

```
type Remote = { host: string; slug: string } | null   // null → no remote; row falls back to directoryName
```

The `host` is rendered **only when `host !== settings.defaultHost`** (default
`github.com`) — a row on the default host shows no host line (FR-006). `host` is
still always stored; the default-host comparison is a render-time decision.

## Rows — Repository vs orphan worktree

`listRepositories`/`refresh` return `Row[]`. The `orphan-worktree` kind (an in-scope
worktree whose primary lies outside all observed dirs — FR-026c) has **no
`worktrees` field at all**, so "external primary yet has worktrees" is unrepresentable
(replaces the earlier `primaryOutsideScope` boolean flag).

```
type Repository = WorkingTreeEntry & {
  remote: Remote                   // primary owns the identity
  worktrees: WorkingTreeEntry[]    // linked worktrees, grouped beneath (FR-022); each shares this remote
}

type OrphanWorktree = WorkingTreeEntry & {
  remote: Remote                   // still derivable — remote config lives in the shared common git dir,
                                   // which is readable without inspecting the external primary's working tree
}

type Row =
  | ({ kind: 'repository' }     & Repository)
  | ({ kind: 'orphan-worktree' } & OrphanWorktree)
```

A nested worktree (inside `Repository.worktrees`) is a `WorkingTreeEntry` — it
carries its own `head`/`local`/`lastChange` and its own `collisionFragment`, and
shares the primary's `remote` (not restated on the entry).

## ObservedDirectory

| Field | Type | Notes |
|-------|------|-------|
| `path` | string | Absolute path the user designated (FR-002). |
| `readable` | boolean | Transient scan-time flag; false if the (already-added) directory is missing/unreadable at scan time — degrade gracefully rather than error (FR-004; not the same as FR-018, which is about repositories). |

Validation: on add, path must exist and be readable, else rejected (US2 scenario 4,
FR-002).

## Settings (persisted)

| Field | Type | Notes |
|-------|------|-------|
| `observedDirectories` | string[] | Persisted across restarts (FR-015). |
| `sortDimension` | 'slug' \| 'directoryName' \| 'lastChange' \| 'localCount' | FR-020. |
| `sortDirection` | 'asc' \| 'desc' | FR-020; default `asc`. |
| `showWorktrees` | boolean | Filter toggle, default true (FR-024). |
| `defaultHost` | string | Host hidden on rows when it matches this; default `'github.com'` (FR-006). |

Default: `sortDimension='slug'`, `sortDirection='asc'` (FR-020).

Note: `showWorktrees` persistence is a deliberate extension beyond the spec's
enumerated Settings entity (spec.md:351-354, which lists only observed dirs + sort).
FR-024 requires the filter to exist; persisting it across restarts is covered by the
constitution's "and equivalent settings" allowance and matches the sort-persistence
pattern. Flag for spec reconciliation if strict enumeration is desired.

## Sort & grouping rules (FR-020)

1. Sort **primaries only** (top-level rows) by the chosen dimension; worktrees
   always stay grouped directly beneath their primary regardless of sort.
2. `localCount` sort key for a primary = its own `local` + sum of its worktrees'
   `local`.
3. **Unavailable working trees** (the `{availability:'unavailable'}` variant carry no
   `local`/`lastChange`) use well-defined fallbacks so degraded rows never crash or
   mis-sort (FR-027):
   - `localCount`: an unavailable working tree contributes **0** to the sum.
   - `lastChange`: an unavailable row is treated as **absent → sorts last** (same as
     unborn HEAD).
   - `slug` / `directoryName`: always present (identity/name fallback), no special
     case.
4. **Deterministic tie-break**: equal or absent primary sort key → order by
   `directoryName`, then `fullPath`, ascending (both always present).

Test coverage: `sort.test.ts` MUST cover a family mixing available and unavailable
working trees under both `localCount` and `lastChange`, asserting stable order.
