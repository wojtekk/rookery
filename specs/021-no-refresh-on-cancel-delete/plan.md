# Implementation Plan: Skip Refresh When a Delete Is Cancelled

**Branch**: `021-no-refresh-on-cancel-delete` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-no-refresh-on-cancel-delete/spec.md`

## Summary

A row's delete icon's `onDelete` handler (`renderer.ts:353`) calls
`void api.deleteRow(target).then(() => doRefresh())` unconditionally —
`doRefresh()` runs (full disk rescan + busy-lock/dim cycle) no matter which
of `deleted` / `cancelled` / `failed` the main process's `deleteRow` IPC
resolves with (`DeleteOutcome`, `shared/types.ts`). Cancelling either of the
two native confirmation dialogs in `main.ts`'s `deleteRow` (the initial
"Delete X?" prompt or the second risk-warning prompt) changes nothing on
disk, so that rescan and lock/dim cycle are pure waste.

Technical approach: gate the existing `.then()` callback on the outcome.
Because this introduces a real decision point (not present in the last few
one-line renderer fixes), the decision itself is extracted into a tiny pure
function, `shouldRefreshAfterDelete(outcome: DeleteOutcome): boolean`, in a
new `src/shared/delete.ts` — mirroring the codebase's existing pattern
(`src/shared/actions.ts`) for pure, DOM-free logic that both the renderer
imports and a dedicated unit test exercises directly, satisfying the
constitution's Development Workflow mandate that guard/safety behavior
touching a mutating operation leave a runnable check. No change to
`main.ts`'s `deleteRow`, its dialogs, or the `DeleteOutcome` type itself —
this is a renderer-only consumption fix.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict); `src/shared/` compiles under
both `tsconfig.json` (main) and `tsconfig.renderer.json` (renderer) as it
already does for `shared/actions.ts`

**Primary Dependencies**: Electron 40 (renderer process); no new runtime
dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`. Unlike the
last several renderer-only fixes (017/018/020), this change adds a real
branch (refresh vs. no-refresh keyed on outcome), so it gets a new
`tests/delete-refresh.test.ts` exercising the extracted pure predicate
directly — no DOM, no mocked IPC, matching `actions.test.ts`'s pattern for
`shared/actions.ts`.

**Target Platform**: Desktop (Electron) on the user's local OS

**Project Type**: Single-project desktop app (Electron main + renderer);
this fix adds one shared pure-logic file and edits one renderer call site

**Performance Goals**: N/A — the fix *removes* an unnecessary full
`api.refresh()` disk rescan and busy-lock/dim cycle on cancel; no new cost
in the paths that still refresh

**Constraints**: No new dependency (Principle V); MUST NOT change
`main.ts`'s dialogs, `DeleteOutcome`'s shape, or the refresh behavior for
`deleted`/`failed` outcomes — only the `cancelled` path changes

**Scale/Scope**: One new file (`src/shared/delete.ts`, one function), one
edit to `renderer.ts`'s `onDelete` handler, one new test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. System-Native Delegation** — Unaffected; no git interaction changes.
- **II. Read-Only by Default, Destructive by Explicit Action** — Reinforced,
  not weakened: `main.ts`'s confirmation dialogs still own all cancel/
  destructive semantics unchanged; this fix only stops the renderer from
  performing an undemanded read-only rescan after the user explicitly
  declined the destructive action.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Reinforced: the constitution requires
  state to be "re-derivable on explicit user demand," not on a no-op. A
  cancelled delete is not a demand for a refresh; today's unconditional
  refresh actually drifts from this principle by rescanning and dimming the
  table (via `doRefresh`'s own `beginBusyLock`/`endBusyLock`) for no reason.
  Verified: no other code path ties a busy-lock to the delete flow outside
  `doRefresh` itself (the only other `beginBusyLock` call site is the
  startup load sequence), so skipping `doRefresh()` on cancel cannot leave
  any lock stuck.
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry; the new file is a few lines of pure logic, matching the
  existing `shared/actions.ts` precedent for this kind of helper.

**Development Workflow** — This change touches the renderer's response to a
mutating operation's outcome (delete), so per "any code that mutates
repository state ... MUST leave at least one runnable check that fails if
the guard or safety behavior breaks," the new `shouldRefreshAfterDelete`
predicate gets a dedicated unit test (`tests/delete-refresh.test.ts`)
covering all three `DeleteOutcome` variants. The actual mutating operation
(`main.ts`'s `deleteRow`) is unchanged and already covered by
`delete-risk.test.ts`. Manual verification: cancelling a delete against a
real observed directory, confirming no rescan/lock/dim occurs, per
`quickstart.md`.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/021-no-refresh-on-cancel-delete/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── spec.md
```

No `contracts/` directory: `DeleteOutcome` and the `deleteRow` IPC method
are unchanged (same request shape, same three-variant response) — this fix
only changes which variants the renderer reacts to, not the interface
itself.

### Source Code (repository root)

```text
src/shared/
└── delete.ts          # NEW: shouldRefreshAfterDelete(outcome: DeleteOutcome): boolean
                        #   — pure, DOM-free, mirrors shared/actions.ts's pattern

src/renderer/
└── renderer.ts         # onDelete handler (line 353): gate doRefresh() on
                         #   shouldRefreshAfterDelete(outcome) instead of
                         #   calling it unconditionally in .then(() => ...)

tests/
└── delete-refresh.test.ts   # NEW: covers all three DeleteOutcome variants
                              #   against shouldRefreshAfterDelete
```

**Structure Decision**: Single-project Electron layout (already
established). The decision logic lives in `src/shared/` (not
`src/renderer/view/`) because it needs to be importable by a plain
`node --test` unit test without pulling in `renderer.ts`'s module-level
`document`/`window.repoDashboard` access, which throws outside a DOM —
exactly why `shared/actions.ts` already lives there rather than in
`view/table.ts`, and why no prior renderer.ts logic is tested directly.

## Complexity Tracking

*No violations — this section is not needed.*
