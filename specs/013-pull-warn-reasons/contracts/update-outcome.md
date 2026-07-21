# Contract: `updateAll` IPC result (extended)

The only interface change this feature makes. No new IPC method, no new channel.

## Channel

`window.repoDashboard.updateAll(): Promise<RepoUpdateOutcome[]>`
— unchanged signature; `main.ts:200` still resolves it as
`updateAll(lastSnapshot)`. The change is purely to the **element shape** of the
returned array, carried transparently by Electron's structured clone.

## Before

```ts
type UpdateResult = 'updated' | 'already-current' | 'skipped' | 'failed';
interface RepoUpdateOutcome { path: string; result: UpdateResult; }
```

## After

```ts
type UpdateResult = 'updated' | 'already-current' | 'skipped' | 'failed'; // unchanged

type UpdateReasonCategory =
  | 'diverged' | 'fetch-failed' | 'stash-failed' | 'timed-out' | 'update-failed'  // failed attempts
  | 'unavailable' | 'detached';                                                    // stuck skips

interface UpdateReason { category: UpdateReasonCategory; detail?: string; }

interface RepoUpdateOutcome {
  path: string;
  result: UpdateResult;
  reason?: UpdateReason;   // present IFF the tree is in the warned set
}
```

## Guarantees

1. **Backward-compatible**: `reason` is optional and additive; `path` and
   `result` are unchanged in name, type, and meaning. Any existing consumer that
   ignores `reason` behaves exactly as before (FR-010).
2. **Warned-set invariant**: `reason` is present **iff** the tree is warned —
   for every `result === 'failed'`, and for `result === 'skipped'` only when the
   skip cause is `unavailable` or `detached`. Absent for `updated`,
   `already-current`, and no-upstream skips (FR-004/FR-005). So
   `outcome.reason !== undefined` is the canonical warned-set test.
3. **`detail`** (FR-003): when git produced error output for a failed attempt,
   `reason.detail` carries that text (trimmed, length-capped). Skip reasons
   (`unavailable`/`detached`) are derived from the entry and carry no `detail`.
4. **No network on consumption** (FR-009): the renderer only reads these
   already-produced results; rendering/hovering the warning triggers no IPC and
   no git.
5. **Pull-all behavior unchanged** (FR-010, Principle III): the set of trees
   updated / skipped / left failed is identical to before; only the reason
   annotation is added.

## Consumer (renderer)

`renderer.ts` derives, after each run:
`warnings = new Map(outcomes.filter(o => o.reason).map(o => [o.path, o.reason!]))`
and keeps `failedPaths = outcomes.filter(o => o.result === 'failed')` for the
red tint and "Failed" filter (FR-012). See `data-model.md`.
