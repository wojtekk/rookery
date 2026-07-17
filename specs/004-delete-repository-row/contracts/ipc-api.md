# Contract: Renderer ↔ Main IPC API (additions for delete repository row)

Extends 001/002's `window.repoDashboard` bridge (see
[001 ipc-api.md](../../001-repo-dashboard/contracts/ipc-api.md) and
[002 ipc-api.md](../../002-custom-action-launchers/contracts/ipc-api.md)). Same
rules: all methods async, handled with `ipcMain.handle`, renderer has no
git/fs/process/dialog access of its own. Types (`DeleteTarget`, `DeleteOutcome`)
are in [data-model.md](../data-model.md). Only the **new** surface is listed —
no existing method's signature changes.

## New method

### `deleteRow(target: DeleteTarget): Promise<DeleteOutcome>`

Deletes the row identified by `target` — a repository's primary checkout, an
orphan worktree, or a linked worktree (`target.isWorktree` selects the
removal path; see [delete.md](./delete.md)). Owns the **entire** user-facing
flow itself, main-side:

1. Shows a native confirmation dialog. If dismissed/cancelled, resolves
   `{ outcome: 'cancelled' }` immediately — nothing on disk changes (FR-002,
   FR-006).
2. If confirmed, freshly (never cached) determines whether the repository is
   "at risk" (dirty, no remote, unpushed, or unverifiable — FR-003, FR-004a).
3. If at risk, shows a second native dialog naming the specific reasons and
   stating the action is destructive and irreversible (FR-004). If
   dismissed/cancelled here, resolves `{ outcome: 'cancelled' }` — still
   nothing on disk changes.
4. Performs the removal: `git worktree remove --force` for
   `isWorktree: true`, or OS-trash-then-permanent-delete-fallback otherwise
   (FR-007/FR-008/FR-009).
5. Resolves `{ outcome: 'deleted' }` on success, or
   `{ outcome: 'failed', reason }` if the removal itself errors (FR-011) —
   the row is left in place (still exists on disk) for this outcome.

**Renderer contract**: call `deleteRow`, then call the existing `refresh()`
regardless of the returned outcome. No other client-side bookkeeping is
required — `refresh()` is the single source of truth for whether the row is
still there (FR-010; Constitution IV).

**Never mutates `Settings.observedDirectories`.** Repository/worktree rows are
directories *discovered inside* an observed directory, not observed-directory
entries themselves (`scan.ts`), so this method never calls
`removeObservedDirectory` or otherwise touches persisted settings.

## Guarantees (in addition to 001/002's)

- **At most two dialogs, ever**, for a single `deleteRow` call, regardless of
  how many risk conditions apply (FR-005).
- **No git mutation before the first confirmation**, and **no destructive git
  mutation before the second confirmation when one is required** (Constitution
  II).
- **The live risk check cannot hang the UI**: every git invocation it makes
  (`fetch`, `status`) inherits the existing 5s `SPAWN_TIMEOUT_MS` ceiling
  (`git/probe.ts`); a timeout is treated as "at risk," never as "safe."
- The renderer still receives only plain serializable data — never a
  child-process handle, and never triggers `dialog`/`shell` itself.
