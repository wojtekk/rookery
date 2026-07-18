# Phase 0 Research: Delete a Worktree Whose Directory Is Already Missing

## R1: Why `git worktree remove` never runs today for a missing-directory target

**Decision**: The bug is in sequencing, not in the removal call itself.
`main.ts`'s `deleteRow` (004) runs `probeRemoteUrl(target.path)` and
`computeDeleteRisk(target.path, hasRemote)` *before* branching on
`target.isWorktree`. Both ultimately shell out via `execFile('git', args, {
cwd: target.path })` (`git/probe.ts`), but they don't fail the same way:
`probeRemoteUrl` wraps its own call in a try/catch and resolves `null` on any
failure, so it never throws even when `target.path` is missing. The actual
propagating failure is inside `computeDeleteRisk` (`delete.ts`), which calls
`probeStatus(target.path)` — the one probe with **no try/catch of its own**.
When `target.path` does not exist, `execFile` rejects immediately (spawn
fails: no such working directory), and that rejection propagates uncaught
out of `probeStatus`, through `computeDeleteRisk`, into `deleteRow`'s outer
`try`. The `catch` block only checks `pathExists(target.path)`; finding it
`false`, it returns `{ outcome: 'deleted' }` — **without ever reaching the
`if (target.isWorktree)` branch**, so `git worktree remove` is never invoked
and git's own `.git/worktrees/<name>` registration on the family repository
is never cleaned up. The row reappears on the next scan because
`probeWorktreeList` (run against the still-present, still-observed family
repository) still lists it.

**Rationale**: Confirmed by manually reproducing the exact scenario against
two real repositories (`identity/bank-verification-service`,
`identity/build-poc`) with a worktree registered at a path removed by an
unrelated cleanup. `git worktree remove --force <path>` run from the primary
repository's own directory succeeded (exit 0) even though `<path>` did not
exist — proving the removal call itself works fine against a missing
directory; the only problem is that today's code path never reaches it.

**Alternatives considered**: Wrapping every risk-check probe in its own
try/catch and letting `deleteRow` fall through to the existing
`if (target.isWorktree)` branch unchanged — rejected because the existing
branch calls `git -C target.path worktree remove target.path --force`
(research R2 from 004), and `-C <path>` itself requires `<path>` to exist
(git chdir's into it before running the subcommand). Suppressing the probe
failures alone would just move the failure to the removal call itself.

## R2: How to run `worktree remove` when the target directory doesn't exist

**Decision**: Anchor the git invocation at the **family repository's own
directory** instead of the (missing) target path: `git -C <familyPath>
worktree remove <target.path> --force`, run with `cwd: familyPath`. Git
resolves `<target.path>` against its own worktree registry (stored under
the family's `.git/worktrees/`), so the target path itself never needs to
exist on disk for this to succeed — only `familyPath` does.

**Rationale**: This is exactly the manual recovery already verified working
in R1. It requires knowing `familyPath`, which 004 deliberately avoided
needing (research R2: "no primary path needed") by relying on `-C
target.path` — a shortcut that only works when the target directory exists.
For the one case this feature fixes, that shortcut no longer applies, so
`familyPath` must be supplied by whoever already knows it.

**Alternatives considered**:
- *Run `git worktree prune` on the family repository instead of a targeted
  `remove`.* Rejected: `prune` sweeps *all* stale worktrees on that family,
  not just the one the user asked to delete — a blast radius mismatch with
  the per-row, per-item confirmation the constitution requires (Principle
  II).
- *Derive `familyPath` in the main process by reading the target's own
  `.git` file.* Rejected: impossible by construction — the target directory
  (and its `.git` file) is exactly what's missing.

## R3: Where `familyPath` comes from

**Decision**: The renderer already knows it. `renderRows` (`table.ts`)
iterates `row.worktrees` for each primary `Row` — the primary's own
`fullPath` is in scope at exactly the point a nested worktree's delete
button is built. The renderer passes it through as a new, optional
`familyPath` field on `DeleteTarget`, populated only for nested worktree
rows (never for a repository's own primary-checkout row, and never for a
top-level orphan-worktree row — see R4).

**Rationale**: This is the only place in the system that has this
information at the moment it's needed; main.ts has no way to reconstruct it
once the target directory is gone (R2). Keeping it on `DeleteTarget` matches
004's existing shape (the renderer already tells main.ts `isWorktree`
because main.ts can't safely re-derive it either).

**Alternatives considered**: Caching every observed worktree's family path
in main-process state as rows are scanned, keyed by path, so `deleteRow`
could look it up independently of what the renderer sends. Rejected as
unnecessary indirection (YAGNI) — the renderer already has the exact value
in hand at render/click time; introducing a second, main-process-owned copy
of the same fact is a new cache to keep in sync for no behavioral gain.

## R4: Scope boundary — orphan worktrees are unaffected by this fix

**Decision**: This feature does not touch orphan-worktree rows
(`Row.kind === 'orphan-worktree'`, whose primary repository is not itself
observed by the dashboard). `familyPath` is left `undefined` for them, same
as today.

**Rationale**: Confirmed by tracing `scan.ts`: a worktree can only ever
appear as a *row* in one of two ways — discovered by walking an observed
directory's filesystem (requires the directory to exist), or discovered by
parsing `git worktree list --porcelain` against an *observed* primary
repository (requires the primary to be observed). A worktree that is both
an orphan (primary unobserved) *and* missing its own directory satisfies
neither path, so it can never surface as a row in the first place — there
is no real-world case this feature needs to cover for orphan worktrees.
Separately, today's renderer also always computes `isWorktree: false` for
every top-level row (`table.ts`, `renderRows`), including orphan-worktree
rows whose directory *does* still exist — meaning those are currently
deleted via the trash/permanent-delete path rather than `git worktree
remove`. That is a real, pre-existing gap, but it is a distinct bug
(row-kind misclassification, unrelated to whether a directory exists) and
is out of scope for this feature, per spec.md's Assumptions.

**Alternatives considered**: Fixing the orphan-worktree `isWorktree`
misclassification in the same change, since it was discovered during this
investigation. Rejected — it's an unrelated root cause (classification vs.
missing-directory handling) with its own risk surface (changing removal
behavior for rows that currently work, just via the wrong mechanism); bundling
it here would widen this fix's blast radius beyond what was asked for.

## R5: Skipping the risk check is safe

**Decision**: When the target is a worktree and its directory does not
exist, skip `probeRemoteUrl`/`computeDeleteRisk` entirely and proceed
straight from the first confirmation to removal — no second ("destructive
action") confirmation.

**Rationale**: The two-confirmation cap exists to warn about local,
on-disk work that deletion would destroy (spec 004, Clarifications). A
directory that already does not exist has no local on-disk state left to
lose by this action; whatever happened to it happened already, outside this
app's control. Treating this as "cannot verify, therefore at-risk" (as 004's
FR-004a already does for a live fetch failure) would be the wrong
generalization — that rule exists for a directory that's *present* but
unverifiable *over the network*, not one that's absent altogether.
