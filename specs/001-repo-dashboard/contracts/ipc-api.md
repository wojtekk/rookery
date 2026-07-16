# Contract: Renderer ↔ Main IPC API

The renderer's only channel to the system. Exposed via `contextBridge` in
`preload.ts` as `window.repoDashboard`. All methods are async (return Promises).
Main handles them with `ipcMain.handle`. No git or filesystem access exists in the
renderer.

Types referenced (`Row`, `Repository`, `WorkingTreeEntry`, `Settings`, `RowState`)
are defined in [data-model.md](../data-model.md). `Row` is the tagged union of a
`repository` (with grouped `worktrees`) and an `orphan-worktree`.

## Methods

### `listRepositories(): Promise<Row[]>`
Returns the current in-memory snapshot (top-level rows: repositories with grouped
worktrees, plus any orphan-worktree rows). Does NOT trigger a scan — returns the
last computed result. Empty array when no observed directories.

### `refresh(): Promise<Row[]>`
Re-scans all observed directories (one level deep) and re-probes every working
tree, then returns the new snapshot. Read-only. Always resolves in bounded time
even if some repos hang (FR-027): hung families come back with
`availability: 'unavailable'`. Startup performs an implicit refresh.

### `addObservedDirectory(path: string): Promise<{ ok: true } | { ok: false; reason: string }>`
Validates the path exists and is readable; persists it (FR-002/FR-015). Returns
`{ok:false, reason}` for a missing/unreadable path (US2 scenario 4) — the
directory is not added.

### `removeObservedDirectory(path: string): Promise<void>`
Removes the directory and persists (FR-016). Its repositories drop from the next
`listRepositories`/`refresh`.

### `getSettings(): Promise<Settings>`
Returns persisted settings (observed dirs, sort dimension/direction, worktree
filter, default host).

### `setSort(dimension: Settings['sortDimension'], direction: Settings['sortDirection']): Promise<void>`
Persists the sort choice (FR-020). Sorting itself is applied in the renderer over
the snapshot (pure `view/sort.ts`), so no re-probe is needed.

### `setShowWorktrees(show: boolean): Promise<void>`
Persists the worktree filter (FR-024). Applied in the renderer.

### `setDefaultHost(host: string): Promise<void>`
Persists the default remote host (FR-006). A row shows its host only when it differs
from this value. Applied in the renderer (render-time comparison, no re-probe).

### `getGitStatus(): Promise<{ available: true; version: string } | { available: false; version: null; reason: string }>`
Reports whether a usable system git (>= 2.15) is present (FR-019, R7). The result
union makes the nonsense combinations (`available:true` with no version, or
`available:false` with a version and no reason) unrepresentable. The renderer shows
a clear error state instead of empty/misleading data when `available` is false.

## Events (main → renderer)

### `onScanProgress(cb: (done: number, total: number) => void): void`
Optional progress signal during a long scan so the UI can show activity while
staying responsive (FR-017, SC-006). Non-authoritative — `refresh`'s resolved
value is the source of truth.

## Guarantees

- Every method is **read-only** with respect to repositories (no method mutates a
  working tree, refs, or history) — enforced by the git-probe contract.
- The renderer receives only plain serializable data (the types above); it never
  receives handles to child processes or filesystem objects.
