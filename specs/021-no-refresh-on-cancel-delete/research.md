# Phase 0 Research: Skip Refresh When a Delete Is Cancelled

No `NEEDS CLARIFICATION` markers remained in the Technical Context — the bug
was already traced to a single line before planning began. This document
records the root cause and the two real decisions made while designing the
fix.

## Root cause

`renderer.ts:353`'s `onDelete` handler:

```ts
onDelete: (target) => {
  void api.deleteRow(target).then(() => doRefresh());
},
```

ignores the resolved `DeleteOutcome` (`shared/types.ts:85`,
`{ outcome: 'deleted' } | { outcome: 'cancelled' } | { outcome: 'failed'; reason: string }`)
entirely — `doRefresh()` runs regardless. `main.ts`'s `deleteRow` resolves
`{ outcome: 'cancelled' }` at two points (line 136, the initial "Delete X?"
dialog; line 169, the second risk-warning dialog for uncommitted/unpushed
work) — cancelling either one still triggers a full `api.refresh()` disk
rescan plus `doRefresh()`'s own `beginBusyLock()`/`endBusyLock()` dim cycle,
even though nothing on disk changed. The handler's own comment
acknowledges this as deliberate-but-wasteful: "the renderer just refreshes
afterward regardless of outcome; a cancelled/failed delete simply
re-reports the row unchanged" — true for the *result*, but not free to
produce.

## Decision 1: Where the outcome→refresh decision lives

**Decision**: Extract a pure function, `shouldRefreshAfterDelete(outcome:
DeleteOutcome): boolean`, into a new `src/shared/delete.ts`, and call it
from the existing `.then()` callback in `renderer.ts`.

**Rationale**:
- This is a real decision point (unlike the last several renderer fixes —
  017's trivial `??` fallback, 018/020's non-branching DOM edits) —
  `shouldRefreshAfterDelete` is exactly the sort of "guard/safety behavior"
  the constitution's Development Workflow requires a runnable check for.
- `renderer.ts` itself can't be unit-tested: it reads `document.getElementById`
  and `window.repoDashboard` at module load time, which throws under plain
  `node --test` (confirmed: no test file imports `renderer.ts`, unlike every
  `view/*.ts` module, which all avoid top-level DOM/IPC access).
- `src/shared/actions.ts` already establishes the exact pattern needed: pure,
  DOM-free logic operating on a `shared/types.ts` type, tested directly by
  `tests/actions.test.ts` without any Electron or DOM shim. `shared/delete.ts`
  follows it precisely for `DeleteOutcome`.

**Alternatives considered**:
- *Inline the `if` check directly in `renderer.ts` with no extraction* —
  rejected: leaves the one piece of new branching logic in a file no test
  can import, violating the Development Workflow's runnable-check mandate.
- *Add the function to `view/table.ts`* — rejected: `table.ts` owns row
  *rendering*, and doesn't otherwise import `DeleteOutcome` at all; bolting
  an outcome-decision function onto a rendering module is a worse fit than
  `shared/`, which already exists specifically for this kind of pure,
  cross-cutting decision logic.
- *Add it to `shared/types.ts`* — rejected: that file is types-only (no
  function currently lives there); mixing in a function would break an
  established, load-bearing convention for no benefit.

## Decision 2: Scope — which outcomes trigger a refresh

**Decision**: Only `cancelled` skips the refresh; `deleted` and `failed`
both continue to refresh exactly as today.

**Rationale**: The user's report names only the cancel case. `deleted`
obviously still needs a refresh (the row must disappear). `failed` is left
refreshing unchanged — the user didn't report it, and today's comment notes
a failed delete "re-reports the row unchanged," so refreshing on failure is
harmless waste rather than a bug; narrowing the fix to exactly what was
reported keeps the change minimal and avoids guessing at unstated intent
for the failure path (e.g., whether a transient failure might warrant a
retry-revealing rescan).

**Alternatives considered**:
- *Skip refresh for both `cancelled` and `failed`* — rejected as scope
  creep beyond the reported bug; can be a trivial follow-up
  (`shouldRefreshAfterDelete` already isolates the decision to one place)
  if ever reported.
