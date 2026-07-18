# Implementation Plan: Delete a Worktree Whose Directory Is Already Missing

**Branch**: `005-delete-missing-worktree` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-delete-missing-worktree/spec.md`

## Summary

Fixes a correctness bug in 004's delete flow: deleting a nested (linked)
worktree row whose directory has already vanished from disk currently
reports success without ever running `git worktree remove` — the risk-check
probes throw first (they shell out with the missing path as `cwd`), and
`deleteRow`'s catch-all short-circuits to `{ outcome: 'deleted' }` on
`pathExists === false` before ever reaching the worktree-removal branch. The
row silently reappears on the next scan because git's own
`.git/worktrees/<name>` registration on the family repository was never
touched. The fix: detect a missing directory up front (before any risk-check
probe runs), skip the risk check entirely (nothing local remains to lose),
require exactly one confirmation, and run `git worktree remove --force`
anchored at the worktree's *family* repository (`-C familyPath`, since `-C`
on the missing target path itself would fail) instead of the target path.
`familyPath` is threaded through as a new optional field on 004's
`DeleteTarget`, supplied by the renderer — the only place that already knows
a nested worktree's primary path at render time.

## Technical Context

**Language/Version**: TypeScript ~5.9 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`) — unchanged

**Primary Dependencies**: None new. Reuses 004's Electron `dialog`, the
existing `runGit`/`pathExists` helpers in `src/main/main.ts` and
`src/main/git/probe.ts`.

**Storage**: N/A — unchanged from 004.

**Testing**: `node:test` extending `tests/delete-risk.test.ts` (or a new
sibling test file) with real temp-git-repo fixtures (the project's
established pattern) proving `git worktree remove -C familyPath ...`
succeeds against a since-removed target path; manual quickstart validation
for the full dialog-skip + removal flow, per the constitution's mandate that
mutating-operation changes be manually exercised.

**Target Platform**: Local desktop (Electron on the user's OS) — unchanged.

**Project Type**: Single-project desktop application — unchanged.

**Performance Goals**: No new git call is added to the hot path — this
feature *removes* two probe calls (`probeRemoteUrl`, `computeDeleteRisk`'s
fetch/status) for the one case it targets, so it can only be faster than
today's (broken) behavior, never slower.

**Constraints**: Exactly one confirmation for a missing-directory worktree
target (spec FR-002); a missing `familyPath` on that branch MUST fail loudly
rather than silently report success (data-model.md decision table).

**Scale/Scope**: One field added to an existing type (`DeleteTarget.
familyPath`), one new early-branch in `deleteRow` (`src/main/main.ts`), one
small addition to `table.ts` to populate the new field for nested worktree
rows, ~1 new/extended test file. No new module, no new IPC method.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

- **I. System-Native Delegation** — ✅ Pass. The new branch still shells out
  to system `git` via the existing `runGit` helper; no bundled git, no new
  plumbing reimplementation (just a different `-C` anchor).
- **II. Read-Only by Default, Destructive by Explicit Action** — ✅ Pass.
  Worktree removal remains a deliberate, per-item, explicitly-confirmed user
  action (unchanged from 004); this feature only fixes *which* git
  invocation the confirmed action actually performs. No new mutating
  operation is introduced.
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — ✅ N/A. No
  merge/rebase logic is touched.
- **IV. Always-Observable State** — ✅ Pass. This feature exists precisely
  *because* the current behavior violates honest state (a row that reports
  itself deleted but reappears). The fix makes the dashboard's post-refresh
  state match reality again.
- **V. Local-Only, Minimal Footprint** — ✅ Pass. No new dependency, no new
  network activity; strictly fewer git subprocess calls than today for the
  case in scope.

**Result**: PASS. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-delete-missing-worktree/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── delete.md          # Amends 004's contracts/delete.md sequence
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/
│   └── main.ts                 # deleteRow: + missing-directory-worktree branch (before risk check)
├── shared/
│   └── types.ts                 # DeleteTarget: + optional familyPath
└── renderer/
    └── view/
        └── table.ts              # buildDeleteCell (nested worktree case): + familyPath from parent row

tests/
├── delete-risk.test.ts          # extended (or a sibling file): real-git-fixture proof that
│                                 #   `git -C familyPath worktree remove <goneTargetPath> --force`
│                                 #   succeeds and deregisters the entry
```

**Structure Decision**: No new modules or processes. This is a targeted
amendment inside 004's existing single-project Electron layout: one new
field on an existing shared type, one new early branch inside the existing
`deleteRow` orchestration function, and one small renderer-side addition to
populate that field where the information is already in scope.

## Complexity Tracking

*No violations — table intentionally omitted.*
