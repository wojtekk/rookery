# IPC Contract: Cleanup

Two new methods on `RepoDashboardApi` (`src/shared/types.ts`), forwarded through
`preload.ts` (contextBridge → `ipcRenderer.invoke`) and handled in `main.ts`
(`ipcMain.handle`). Mirrors the existing `updateAll` / `deleteRow` wiring exactly.

## `scanCleanup(): Promise<CleanupCandidate[]>` — read-only

- **Channel**: `'scanCleanup'`.
- **Renderer → main**: no args.
- **Main behavior**: over `lastSnapshot` filtered to `kind === 'repository'`,
  group into families and run `runPool(families, 6, …)`. Per repo, under
  `NON_INTERACTIVE_ENV` + a ~60s deadline: `git fetch -p`, then detect `[gone]`
  branches (`for-each-ref`) and stale worktrees (`worktree list --porcelain`),
  applying dedupe/precedence (research D1/D2/D4). **Removes nothing.**
- **Returns**: flat `CleanupCandidate[]` (renderer groups by `repoPath`). A repo
  that errors/times out contributes no candidates (it is simply not represented);
  it does not throw.
- **Guarantees**: idempotent, side-effect-free except the `fetch -p` refresh of
  remote-tracking refs (explicit user action, Principle II-compliant). Never
  mutates working trees, local branches, or the filesystem.

## `executeCleanup(selection: CleanupSelection[]): Promise<CleanupOutcome[]>` — mutating

- **Channel**: `'executeCleanup'`.
- **Renderer → main**: `selection` = the candidates the user left checked.
- **Main behavior**: group `selection` by `repoPath` into families; run families
  via `runPool`, sequential within a family. Per candidate apply the command
  matrix (research D3) via `runGit` with tilde-expanded paths,
  `NON_INTERACTIVE_ENV`, and the per-repo deadline. Present worktrees use plain
  `git worktree remove` (no `--force`); missing-dir worktrees use `--force`;
  `[gone]` branches use `git branch -D` after any worktree is gone.
- **Returns**: one `CleanupOutcome` per input selection item (`removed` /
  `skipped` / `failed`), order-independent (keyed by `id`).
- **Guarantees**: acts **only** on items present in `selection`; an empty array is
  a valid no-op returning `[]`. A single failing/timed-out repo never aborts the
  rest (FR-014). Never force-removes a present worktree with local work.

## Preload (exact forwarders to add)

```ts
scanCleanup: () => ipcRenderer.invoke('scanCleanup'),
executeCleanup: (selection: CleanupSelection[]) =>
  ipcRenderer.invoke('executeCleanup', selection),
```

## Main handlers (exact registrations to add in `registerIpc()`)

```ts
ipcMain.handle('scanCleanup', () => scanCleanup(lastSnapshot));
ipcMain.handle('executeCleanup', (_e, selection: CleanupSelection[]) =>
  executeCleanup(selection));
```

## Renderer flow contract (`doCleanup()` in `renderer.ts`)

```
if (cleaning) return;              // re-entry guard (FR-012)
cleaning = true; render();         // toolbar busy/spin
const plan = await api.scanCleanup();
if (plan.length === 0) { showNotice('Nothing to clean up'); cleaning = false; render(); return; }   // FR-010
openCleanupOverlay(plan);          // all checked by default (FR-008)
// ── overlay resolves with the user's decision ──
//   cancel  → cleaning = false; render(); return               (FR-009: nothing removed)
//   confirm → const outcomes = await api.executeCleanup(selected);
//             tally → showNotice('Removed X · Y skipped · Z failed');
//             cleaning = false; await doRefresh();              (FR-013)
```

The overlay owns selection state; `doCleanup` owns the busy flag, the summary
toast, and the post-run refresh — the same division of responsibility Pull all
uses between `doUpdateAll` and the engine.
