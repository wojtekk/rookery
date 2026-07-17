# Contract: Delete Orchestration (main process)

Defines exactly how `deleteRow` turns a `DeleteTarget` into at most two
dialogs, a live risk check, and one of two removal mechanisms. This is the
feature's one new trust-boundary-adjacent flow (it performs the app's
first-ever destructive filesystem/git-history mutation), so the sequencing is
normative.

**File split (discovered during implementation)**: `deleteRow` itself lives in
`src/main/main.ts`, alongside `pickDirectory`/`runAction` — every function
that touches Electron's `dialog`/`shell` lives there. `computeDeleteRisk`
lives in `src/main/delete.ts`, which deliberately has **no** `electron`
import (matching `actions/launch.ts`'s existing pattern), so it stays
unit-testable with plain `node:test` — requiring `electron` outside an actual
Electron runtime throws in this project's installed version, which would
otherwise break any test file that imports from the same module.

## Sequence

```
deleteRow(target):
  choice1 = dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 0, cancelId: 0,
    message: `Delete "${basename(target.path)}"?`,
    detail: target.isWorktree
      ? 'This removes the worktree and its files.'
      : 'This moves the directory to the trash (or deletes it permanently if trash is unavailable).',
  })
  if choice1.response !== 1: return { outcome: 'cancelled' }

  hasRemote = (await probeRemoteUrl(target.path)) !== null
  risk = await computeDeleteRisk(target.path, hasRemote)   // data-model.md

  if risk.atRisk:
    choice2 = dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['Cancel', 'Delete Anyway'], defaultId: 0, cancelId: 0,
      message: 'This action is destructive and cannot be reversed.',
      detail: risk.reasons.map(r => `• ${r}`).join('\n'),
    })
    if choice2.response !== 1: return { outcome: 'cancelled' }

  try:
    if target.isWorktree:
      await runGit(['-C', target.path, 'worktree', 'remove', target.path, '--force'],
                    /* cwd */ dirname(target.path))          // research R2
    else:
      try: await shell.trashItem(target.path)
      catch: await fs.rm(target.path, { recursive: true, force: true })   // research R1
    return { outcome: 'deleted' }
  catch (err):
    return { outcome: 'failed', reason: err.message }
```

## Normative rules

- **Confirmation ordering is fixed**: dialog 1 always comes before any git
  invocation; the risk check always comes before dialog 2; dialog 2 always
  comes before any removal call. No removal path may run ahead of its gating
  confirmation(s).
- **At most two `dialog.showMessageBox` calls** per `deleteRow` invocation
  (FR-005) — `risk.atRisk === false` short-circuits straight from dialog 1 to
  removal.
- **The risk check is never skipped and never cached**: `computeDeleteRisk` is
  called fresh on every confirmed first dialog, using the target's current
  on-disk/on-remote state, never a value read from the dashboard's last
  scan/refresh (Clarifications, Session 2026-07-17).
- **Removal path selection is solely `target.isWorktree`** — no path-shape
  sniffing, no re-deriving "is this actually a worktree" from git a second
  time; the renderer's existing `Row`/`WorkingTreeEntry` distinction (already
  used to render the `.wt` CSS class) is trusted as-is.
- **`git worktree remove` always passes `--force`.** Both dialogs having been
  shown (or the risk check having found nothing) means the user has already
  been given the chance to back out; `--force` only bypasses git's own
  "worktree is dirty" refusal, not the app's confirmation gate.
- **Errors are surfaced verbatim** (`err.message`) as `reason` — this mirrors
  `runAction`'s existing `{ok:false, reason}` shape (`contracts/launch.md`,
  002) rather than inventing a new error-classification scheme.

## Failure / edge cases (→ `quickstart.md` manual scenarios)

| Scenario | Behavior |
|---|---|
| Directory already gone before removal runs | `git worktree remove` / `shell.trashItem` both fail fast on a missing path; `delete.ts` MUST treat `ENOENT`-shaped failures as `{ outcome: 'deleted' }` (Edge Case: "Directory already gone" — already-absent is success, not failure) |
| Trash unavailable (unsupported volume) | `shell.trashItem` rejects → `fs.rm` fallback runs → `{ outcome: 'deleted' }`, no third prompt |
| Fetch fails (offline / auth / timeout) | `computeDeleteRisk` records `"sync status could not be verified"` and `atRisk: true` → dialog 2 shown |
| `git worktree remove` needs a second `--force` (git-version-specific edge case) | Surfaces as `{ outcome: 'failed', reason: <git stderr> }`; row stays (FR-011) |
| User closes the app / navigates away mid-dialog | Electron's `dialog.showMessageBox` is modal to `mainWindow`; the promise chain simply doesn't resolve further — no partial deletion is possible because every mutating step is strictly after its gating `await` |
| Target directory disappears between dialog 1 and dialog 2, or between dialog 2 and removal (Edge Case: "Row disappears during confirmation") | No caching exists to go stale: `computeDeleteRisk` always reads the filesystem/git state live at the moment it runs (never the dashboard's last scan), and the removal step itself falls into the "already gone" row above. The sequence never reads a snapshot taken before either `await` boundary, so there is nothing to re-validate separately — this row of the table exists to make that guarantee explicit, not to add new behavior. |

## Tests (`tests/delete-risk.test.ts`)

Pure logic only (no real git process — `computeDeleteRisk`'s risk-combination
rule is tested directly against fabricated `probeStatus`/`probeFetch`/
`probeRemoteUrl` results, following the project's existing pattern of testing
parse/combination logic without shelling out):

1. Clean + remote + fetch-ok + zero ahead → `{ atRisk: false, reasons: [] }`.
2. Each of {dirty, no-remote, fetch-fails, ahead > 0} alone → `atRisk: true`
   with exactly one reason.
3. Dirty **and** no-remote together → `atRisk: true` with **two** reasons, still
   a single result (proves FR-005's "one second prompt" at the data layer).
4. No-remote short-circuits the fetch attempt entirely (asserted via a spy/stub
   that `probeFetch` is never invoked when `hasRemote` is false).
