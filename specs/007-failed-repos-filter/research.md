# Phase 0 Research: Filter Repositories Needing Attention

No unknowns from Technical Context needed research in the usual sense — this
feature has strong precedent (the existing filter chips, and 006's already-
implemented `failedPaths` tracking). The decisions below record *why* the
obvious-looking approach is correct, not clarifications of open unknowns.

## R1 — Drive the filter from `failedPaths` membership, not a new `RowState`

**Decision**: The "Failed" filter matches a working tree by
`failedPaths.has(entry.fullPath)`, exactly the same set `table.ts` already
reads to paint the light-red edge. It is **not** implemented as a fifth
`RowState` value.

**Rationale**: `RowState` (`clean`/`dirty`/`out-of-sync`/`unavailable`) is a
pure function of git-derived data (`deriveRowState`, data-model.md of 001) —
it is always re-derivable from a scan. "Failed" is not: it is the outcome of
an *event* (the last "Pull all" attempt), orthogonal to current git state — a
repository can be simultaneously `dirty` (current state) and `failed` (last
pull outcome), as the diverged+dirty test fixture in 006 proves. Folding it
into `RowState` would force `deriveRowState` to depend on transient renderer
state it has no business knowing about, and would make "failed" mutually
exclusive with the real git state, which is factually wrong per that fixture.

**Alternatives considered**: adding `'failed'` to the `RowState` union —
rejected for the reason above. Persisting a `pullFailed` flag on the `Row`/
`Head` type — rejected (already rejected once in 006 research R5; still
correct here: it isn't git-derived state and doesn't belong in the scan
model).

## R2 — Exclude "failed" from the `sumbar` composition bar

**Decision**: The new chip's count is shown only in the filter row; the
proportional composition bar (`sumbar`, the thin coloured strip under the
fleet title) continues to segment by `RowState` only.

**Rationale**: `sumbar`'s segments are meant to sum to the total repository
count (each repo contributes to exactly one segment, per `deriveRowState`'s
precedence rules). "Failed" overlaps with existing states (a failed repo is
usually also `dirty` or `out-of-sync`), so adding it as a segment would double
-count rows and break that invariant, misrepresenting the fleet's makeup.

**Alternatives considered**: adding a 5th segment anyway and accepting the
sum could exceed 100% — rejected, actively misleading. Replacing failed rows'
existing segment with a "failed" segment (i.e., let failed override the
state-derived colour in the bar) — rejected as a bigger, unrequested change to
an existing, working visualization for a small filter feature.

## R3 — `filterRows` takes `failedPaths` as an optional, defaulted parameter

**Decision**: `filterRows(rows, stateFilter, showWorktrees, failedPaths: Set<string> = new Set())`.

**Rationale**: All 6 existing `filterRows` tests exercise `RowState`/`'all'`
filtering and have no reason to know about `failedPaths`. Making the new
parameter required-with-no-default would force every existing call site and
test to pass an unused empty set, which is pure churn unrelated to what those
tests verify. A defaulted parameter keeps the diff surgical
(matches the project's "surgical changes only" convention) while the one new
test that exercises `'failed'` passes a real set explicitly.

**Alternatives considered**: a required parameter — rejected per above
(unnecessary test churn). A second function (`filterFailedRows`) — rejected;
`filterRows` already owns all filter-dimension logic (state, worktree
visibility) and splitting "failed" into a parallel function would duplicate
the family-surfacing logic (a primary surfaces when its child worktree
matches) that this feature needs to reuse, not reimplement.
