# Contract: Renderer ↔ Main IPC API (additions for custom action launchers)

Extends 001's `window.repoDashboard` bridge (see
[001 ipc-api.md](../../001-repo-dashboard/contracts/ipc-api.md)). Same rules: all
methods async, handled with `ipcMain.handle`, renderer has no git/fs/process
access. Types (`Action`, `Settings`, `Row`, `Remote`) are in
[data-model.md](../data-model.md). Only the **new and changed** surface is listed.

## New methods

### `getActions(): Promise<Action[]>`
Returns the persisted ordered actions list (seeded with five defaults on first run
— FR-012). Empty array is a valid result (user removed all — FR-009).

### `setActions(actions: Action[]): Promise<void>`
Persists the full ordered list atomically (reuses `config.ts`, FR-010). This single
setter backs add, edit, remove, and reorder — the renderer computes the next list
with the pure helpers in `shared/actions.ts` and sends the result, so ordering and
the limit have one authority. Main MUST reject (no-op + throw) a list longer than
`ACTION_LIMIT` or containing an invalid entry (empty name/command, unknown
`iconId`) as defense in depth (FR-002/FR-003) — the renderer already prevents these.

### `runAction(actionId: string, target: { path: string; remoteUrl: string | null }): Promise<{ ok: true } | { ok: false; reason: string }>`
Launches the action identified by `actionId`, substituting `target.path` for `${1}`
and `target.remoteUrl` for `${2}` **as shell positional parameters** (never spliced
into the command — see [launch.md](./launch.md)). The renderer passes the *row's own*
`path` and `remote?.rawUrl ?? null` (US1 scenario 4: each row uses its own path).

- Resolves `{ok:true}` once the command is considered launched (grace window
  elapsed with no early failure — research R2). Returns quickly so the UI never
  freezes (FR-006, SC-002).
- Resolves `{ok:false, reason}` if the launch failed fast (executable not found /
  not executable / shell spawn error); `reason` names the failure for the
  per-action, per-row error (FR-007, US3, SC-004).
- MUST reject if `target.remoteUrl` is `null` **and** the action's command contains
  `${2}` — this should never be reached because the renderer disables such entries
  per row (FR-013), but main enforces it as a guard rather than launching with an
  empty value (FR-005).

## Changed behavior (existing methods)

### `getSettings(): Promise<Settings>`
Now includes `actions` in the returned `Settings` (data-model.md). Otherwise
unchanged.

### `listRepositories()` / `refresh(): Promise<Row[]>`
Unchanged in signature. Each row's `remote` now carries `rawUrl` (data-model.md);
this is the value the renderer forwards as `runAction`'s `remoteUrl`. No new probe
(research R3).

## Guarantees (in addition to 001's)

- **No substitution into command text.** `runAction` MUST pass `path`/`remoteUrl`
  only as positional arguments to the shell; it MUST NOT build a command string that
  contains those values (Constitution V, FR-005). Enforced by the launch contract.
- **Launch is the only new capability that leaves the sandbox**, and it happens only
  in response to an explicit `runAction` call (a user menu selection) — never on a
  timer, never during scan/refresh (Constitution II/V, FR-006).
- The renderer still receives only plain serializable data; it never receives a
  child-process handle.
