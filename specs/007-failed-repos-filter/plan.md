# Implementation Plan: Filter Repositories Needing Attention

**Branch**: `007-failed-repos-filter` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-failed-repos-filter/spec.md`

## Summary

Add a "Failed" option to the existing state-filter chip row (All / Clean /
Uncommitted / Out of sync / Unavailable) that narrows the repository list down
to exactly the working trees whose most recent "Pull all" attempt failed —
reusing the `failedPaths: Set<string>` transient renderer state feature 006
already introduced, with no change to how or when that state is computed or
cleared. Purely an internal renderer change: one type widened, one filter
function widened, one new chip rendered with a live count, two new CSS
classes. No new IPC method, no new persisted setting, no new dependency.

## Technical Context

**Language/Version**: TypeScript ~5.9 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`) — unchanged.

**Primary Dependencies**: None new. Extends `src/renderer/view/filter.ts`,
`src/renderer/view/summary.ts`, and `src/renderer/renderer.ts`; reuses the
`failedPaths` renderer state and `--fail` colour token feature 006 introduced.

**Storage**: N/A. The active filter selection remains ephemeral, in-memory
renderer state (`stateFilter`, already unpersisted today) — this feature adds
one more value to that variable's type, nothing more.

**Testing**: `node:test`, extending `tests/filter.test.ts` (the project's
existing pattern for `filterRows`/`deriveRowState` — pure-function tests, no
Electron or git subprocess needed).

**Target Platform**: Local desktop (Electron on the user's OS) — unchanged.

**Project Type**: Single-project desktop application — unchanged.

**Performance Goals**: Negligible. Filtering is a synchronous pass over an
already in-memory `Row[]` list on every render; no new I/O, no new git calls.

**Constraints**: The Failed filter MUST stay mutually exclusive with the
existing state filters (one active filter at a time, per spec FR-006). It MUST
NOT change the composition bar's (`sumbar`) meaning: "failed" is an orthogonal,
overlapping signal (a repo can be both dirty and failed at once), so including
it as a proportional segment there would double-count rows and make segments
sum to more than the total — it is therefore a filter chip only, not a sumbar
segment.

**Scale/Scope**: One widened type (`StateFilter`), one widened pure function
(`filterRows`, +1 optional parameter), one new chip in the filter bar with a
live count, two new CSS classes reusing an existing colour token, and
extended test coverage. No IPC, no new UI surface beyond the one chip.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

- **I. System-Native Delegation** — N/A. No git subprocess work; this feature
  only re-slices data the existing scan/pull-all machinery already produced.
- **II. Read-Only by Default, Destructive by Explicit Action** — ✅ Pass.
  Filtering is inherently non-mutating; nothing here writes to disk, git, or
  settings.
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — N/A. This feature
  does not touch the pull/push/merge logic; it only adds a lens over the
  `failed` outcome that logic already reports.
- **IV. Always-Observable State** — ✅ Pass, and directly in service of this
  principle: it makes the already-mandated "failed autostash pull = light red"
  state easier to find at scale. The new chip is a text label + live count
  (not colour-only), consistent with "colour MUST NOT be the sole signal."
- **V. Local-Only, Minimal Footprint** — ✅ Pass. No new dependency, no new
  network activity; reuses existing renderer state and an existing colour
  token (YAGNI).

**Result**: PASS. No deviations — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-failed-repos-filter/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

No `contracts/` directory: this feature adds no new IPC method and no new
type crossing the `RepoDashboardApi` boundary — it is purely internal
renderer-side filtering logic, so there is no external interface to contract.

### Source Code (repository root)

```text
src/
└── renderer/
    ├── renderer.ts             # `stateFilter` widens to include 'failed'; thread `failedPaths`
    │                           # (already held here since 006) into renderSummary() and filterRows()
    ├── styles.css              # + .sw-fail / .seg-fail swatch classes, reusing the --fail token (006)
    └── view/
        ├── filter.ts           # StateFilter gains 'failed'; filterRows gains an optional
        │                       # `failedPaths` param + a `matches()` helper factoring the
        │                       # RowState-vs-failedPaths branch out of the inline checks
        └── summary.ts          # renders one more chip ("failed", count = failedPaths.size),
                                # deliberately excluded from the `sumbar` composition segments

tests/
└── filter.test.ts              # + filterRows 'failed' cases: own match, family-surfaces-on-child-
                                 # match, orphan-worktree match, zero-count/empty-list
```

**Structure Decision**: Single-project Electron layout, unchanged. Everything
lives in the renderer's existing view layer (`filter.ts`/`summary.ts`) plus
the orchestration in `renderer.ts` that already owns `stateFilter` and
`failedPaths` — no new files, no new process boundary.

## Phase 0 — Research

See [research.md](./research.md). Resolves: why `failedPaths` membership
(not a new `RowState` value) drives the filter; why `failed` is excluded from
the `sumbar` composition segments; why `filterRows` takes `failedPaths` as an
optional, defaulted parameter rather than a required one.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the widened `StateFilter` type and the
  `matches()` predicate semantics (no new persisted or IPC-crossing entities).
- [quickstart.md](./quickstart.md) — runnable manual validation scenarios.
- No `contracts/` — see Project Structure above.
