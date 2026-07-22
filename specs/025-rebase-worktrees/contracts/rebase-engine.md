# Contract: Rebase-Worktrees Engine & IPC

## IPC surface (added to `RepoDashboardApi`, `preload.ts`, `main.ts`)

### `rebaseWorktrees(): Promise<RepoUpdateOutcome[]>`

- **Main handler**: `ipcMain.handle('rebaseWorktrees', () => rebaseWorktrees(lastSnapshot))` —
  mirrors `updateAll`, operating on the last scan snapshot held in `main.ts`.
- **Returns**: one `RepoUpdateOutcome` per *linked worktree* considered (plus one per orphan
  worktree). Primary/main worktrees produce no outcome. Ordering is not significant (keyed by `path`).
- **Never rejects for per-worktree failure**: individual failures are reported as `failed` outcomes;
  the promise rejects only on an unexpected top-level error (renderer's `finally` still releases the
  lock — FR-013).

### `confirmRebaseWorktrees(): Promise<{ proceed: boolean; suppress: boolean }>`

- **Main handler**: shows `dialog.showMessageBox(win, {...})` with:
  - `type: 'warning'`
  - `message`: rebasing rewrites history; do not run on branches shared with other people.
  - `buttons: ['Rebase worktrees', 'Cancel']`, `defaultId: 0`, `cancelId: 1`
  - `checkboxLabel: 'Do not remind me again'`, `checkboxChecked: false`
- **Returns**: `{ proceed: response === 0, suppress: checkboxChecked }`.
- **Side effects**: none — it does **not** persist the checkbox; the renderer decides and calls
  `setRebaseReminderSuppressed` (keeps the settings write in one place with the renderer's cached
  `Settings`).

### `setRebaseReminderSuppressed(value: boolean): Promise<void>`

- **Main handler**: load settings → `saveSettings({ ...settings, rebaseReminderSuppressed: value })`,
  mirroring `setShowWorktrees`/`setDefaultHost`.

## Engine: `rebaseWorktrees(rows: Row[]): Promise<RepoUpdateOutcome[]>` (`src/main/update.ts`)

Behaviour is fully specified by the state machine in `data-model.md §4`. Key contract points:

- **Target**: `origin/<default>` where `<default>` is resolved per `research.md` Decision 2
  (`primary.head.branch` if on a branch, else `symbolic-ref refs/remotes/origin/HEAD`, else unknown).
- **Fetch**: exactly one `git -C <primary> fetch origin <default>` per family, bounded by the update
  timeout; failure ⇒ all worktrees in the family `failed`/`fetch-failed`.
- **Serialization**: sequential within a family (shared `refs/stash`), parallel across families via
  `runPool` — reuse `groupIntoFamilies`.
- **Non-interactive**: all git runs use `NON_INTERACTIVE_ENV`.
- **Isolation from the primary**: the only command that runs against the primary path is the fetch
  (updates remote-tracking refs only); no checkout, no branch update, no working-tree change (FR-004).
- **Restore guarantee**: every non-success path aborts any in-progress rebase and restores the stash;
  a stash-pop conflict leaves work recoverable in the stash list and reports `stash-failed`.

### Suggested pure/exported helpers (for unit tests — Development Workflow runnable check)

```ts
// pure — no git:
export function rebaseCandidates(rows: Row[]): FlatEntry[]        // linked worktrees only, per family
export function worktreeSkipReason(entry, defaultBranch): UpdateReason | 'run' | 'noop'
export function resolveDefaultBranchName(primary: WorkingTreeEntry): string | null  // branch-or-null (origin/HEAD fallback is a git call, tested via fixture)
```

The rebase state transitions themselves are covered by real-git-fixture tests (see quickstart /
`tests/rebase-worktrees.test.ts`).

## Renderer contract (`renderer.ts`, `toolbar.ts`, `settings.ts`)

### Flow: `doRebaseWorktrees()`

```text
if (rebasing || updating || cleaning || refreshing) return;   // one long op at a time
if (!settings.rebaseReminderSuppressed):
    { proceed, suppress } = await api.confirmRebaseWorktrees()
    if (!proceed) return;                                      // FR-017: no fetch, no rebase, no state change
    if (suppress): await api.setRebaseReminderSuppressed(true); settings.rebaseReminderSuppressed = true
rebasing = true
failedPaths = new Set(); warnings = new Map()                  // FR-009a: rebuild shared surface
beginBusyLock('Rebasing…'); render()
try:
    outcomes = await api.rebaseWorktrees()
    failedPaths = new Set(outcomes.filter(o => o.result === 'failed').map(o => o.path))
    warnings   = new Map(outcomes.filter(o => o.reason).map(o => [o.path, o.reason!]))
    showNotice(`Rebased X · Y already current · Z skipped · W failed`)
finally:
    rebasing = false; endBusyLock(); render()
await doRefresh()                                              // reflect new local state
```

### Toolbar (`ToolbarState` / `ToolbarHandlers`)

- Add `rebasing: boolean` and `hasWorktrees: boolean` to `ToolbarState`; add `onRebaseWorktrees` to
  handlers.
- `busy = refreshing || updating || cleaning || rebasing`.
- Rebase button locked when `!rebasing && (refreshing || updating || cleaning || !hasWorktrees)`;
  the other three buttons' `busy`/lock expressions must include `rebasing`.

### Settings "Other" tab (`settings.ts`)

- `activeTab: 'directories' | 'actions' | 'other'`.
- Third tab button + tabpanel with one labelled checkbox reflecting `!rebaseReminderSuppressed`
  ("Warn before rebasing worktrees"), calling `setRebaseReminderSuppressed(!checked)` and reloading
  settings on change.

### Reason sentences (`table.ts` `REASON_SENTENCE`)

- `default-branch-unknown`: e.g. "Rebase skipped — couldn't determine the default branch".
- `orphan-worktree`: e.g. "Rebase skipped — worktree has no known parent repository".
- (`fetch-failed`, `rebase-conflict`, `stash-failed`, `timed-out`, `unavailable`, `detached`,
  `update-failed` already have sentences and are reused as-is.)
