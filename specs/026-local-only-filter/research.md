# Research: Local-Only Branch Filter

No `NEEDS CLARIFICATION` markers remain in the spec (the one open question — the chip's label text — was resolved in `/speckit-clarify`: `local-only`, matching the existing branch tag verbatim). The three decisions below are small design choices dictated almost entirely by the existing "gone" filter, which this feature is a direct sibling of.

## Decision 1: `StateFilter` sibling, not a `RowState` member

**Decision**: Add `'local-only'` to `StateFilter` as a fourth non-`RowState` sibling (alongside `'all'`, `'failed'`, `'gone'`), not as a member of `RowState` itself.

**Rationale**: `RowState` drives the 5-colour leading-edge indicator and the `sumbar` composition segments (Principle IV). Whether a branch has no upstream is an orthogonal, already-visible fact (the branch tag in `table.ts`), exactly like "gone" — which established this precedent for tracking-derived facts that don't need a colour.

**Alternatives considered**: Folding it into `RowState` — rejected; it would force picking a 6th edge colour for a fact that already has its own non-colour surfacing, which the "gone" filter's own code comment already flags as deliberately avoided.

## Decision 2: Chip placement

**Decision**: Append the new chip after "gone", as the last chip in `summary.ts`'s fixed sequence (All → per-`RowState` chips → Failed → Gone → Local-only).

**Rationale**: Matches the existing insertion-order convention; no reordering of existing chips is needed or implied by the spec.

**Alternatives considered**: Inserting before "gone" — no functional difference, purely arbitrary; appending is the smaller diff.

## Decision 3: Predicate shape

**Decision**: `isLocalOnly(entry: WorkingTreeEntry): boolean`, mirroring `isGone`'s exact signature and guard shape (`availability === 'ok' && !head.detached && head.upstream.tracking === 'local-only'`).

**Rationale**: Lets `matches()` and the new `countLocalOnly` in `summary.ts` be copy-adapted from the proven `isGone`/`countGone` pair with minimal risk, and keeps the predicate independently testable/exported like `isGone` already is.

**Alternatives considered**: Inlining the check directly in `matches()` — rejected; `isGone` is already exported and unit-tested as a standalone predicate, and mirroring that shape keeps the two tracking-derived filters symmetric for anyone reading the file later.
