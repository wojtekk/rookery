# Phase 0 Research: Delete Repository Row

No `[NEEDS CLARIFICATION]` markers remain in the spec after `/speckit-clarify`.
This phase resolves the *technical* unknowns needed to design the implementation.

## R1: How to move a directory to the OS trash without a new dependency

**Decision**: Use Electron's built-in `shell.trashItem(path): Promise<void>`
(stable since Electron 16; present in the project's Electron 40.8.5).

**Rationale**: Electron is already the project's one heavyweight dependency;
`shell.trashItem` gives cross-platform (macOS/Windows/Linux) trash support for
free. It rejects on failure (permissions, unsupported volume/filesystem), which
is exactly the fallback signal FR-009 needs.

**Alternatives considered**: An npm `trash`/`trash-cli` package — rejected as an
unjustified new dependency per Constitution V/YAGNI when the platform (via
Electron) already provides this.

**Fallback (FR-009)**: If `shell.trashItem` rejects, fall back to
`fs.rm(path, { recursive: true, force: true })` (Node stdlib, already used
elsewhere in `main.ts` via `node:fs/promises`).

## R2: How to remove a linked or orphan worktree without knowing its "primary" path

**Decision**: Run `git -C <targetPath> worktree remove <targetPath> --force`,
with the Node `execFile` process's own `cwd` option set to
`path.dirname(targetPath)` (i.e., the target's *parent*, never the target
itself).

**Rationale**: Git's `-C <dir>` flag makes **git** operate as if invoked from
`<dir>`, independent of the child process's actual OS-level working directory.
Git resolves the common `.git` dir (and therefore the full worktree registry,
including the primary) from the target path alone — it does not need to be told
the primary's path separately. Keeping the *process's* `cwd` option outside the
directory being removed avoids any platform quirk around deleting a directory
that is a live process's working directory (a real constraint on Windows).
This means the IPC contract only ever needs `{ path, isWorktree }` — no
"primary path" field, for either linked or orphan worktrees.

**Alternatives considered**: Passing the parent repository's path from the
renderer (it already has it for linked worktrees via `Repository.fullPath`
during row grouping) — rejected as unnecessary complexity once R2's `-C` trick
is confirmed to work uniformly for both linked *and* orphan worktrees (an
orphan worktree's own directory is sufficient to resolve its family).

**Failure handling**: If git rejects the removal (e.g., a second `--force` is
needed for edge cases such as a worktree with a `.git` submodule lock, or the
worktree is administratively locked), the failure surfaces as-is through the
existing `runGit` rejection path into `{ outcome: 'failed', reason }` (FR-011)
— no special-casing needed; the user sees git's own message and the row stays.

## R3: How to freshly verify "at risk" (dirty + remote sync) at delete-time

**Decision**: Reuse the existing `probeStatus` + `parsePorcelainStatusV2`
(`git status --porcelain=v2 --branch`) exactly as scan.ts already does, plus one
new function `probeFetch(dir): Promise<boolean>` that runs `git -C dir fetch`
and returns whether it succeeded. Sequence when a remote is configured: fetch
first (updates the local remote-tracking ref), then a single fresh `probeStatus`
call yields both the current dirty count *and* the now-current ahead/behind in
one shell-out — no duplicate status calls needed.

**Rationale**: This is the same parser already trusted for the dashboard's own
state indicator (Constitution IV), so "at risk" reuses a single source of truth
for "dirty" instead of a second bespoke check. Fetching before the status call
is the only way to make ahead/behind live rather than last-known, per the
clarification session's chosen answer.

**Alternatives considered**: `git ls-remote` to compare without mutating local
refs — rejected as unnecessary; a plain `fetch` is the standard way to update
tracking refs and this app already treats "git talking to its configured
remote" as permitted (Principle V), so there is no benefit to avoiding it.

**Bounded time (FR-004a)**: `runGit`'s existing `execFile` call already sets
`timeout: SPAWN_TIMEOUT_MS` (5000ms, `git/probe.ts`) with `killSignal: 'SIGKILL'`
for every git invocation, so `probeFetch` inherits the same hard ceiling with
zero new timeout logic. A timeout (or any other fetch failure — offline,
unreachable remote, auth failure) is treated as "cannot verify" → at-risk.

## R4: Confirmation UI

**Decision**: Electron's native `dialog.showMessageBox(mainWindow, options)`,
called twice at most from the new `src/main/delete.ts` module — the same
pattern `main.ts` already uses for `pickDirectory()` (`dialog.showOpenDialog`).

**Rationale**: Zero new dependencies, zero new renderer-side modal/dialog
components or CSS, and — as a side benefit — native OS dialogs carry their own
platform accessibility support (keyboard navigation, screen readers) for free,
which is exactly the kind of consideration the spec's sibling feature
(003-startup-loading-indicator) explicitly deferred for its own, purely-visual
element. No accessibility work is needed *because* the mechanism is native.

**Alternatives considered**: An in-page custom modal (renderer-rendered) —
rejected: more code, new CSS, and reinvents dialog accessibility that the OS
already provides.

## R5: Where the whole flow is orchestrated

**Decision**: One new IPC method, `deleteRow`, whose main-process handler
(`src/main/delete.ts`) owns the entire sequence: show dialog 1 → (if confirmed)
run the live risk check → (if at risk) show dialog 2 → (if confirmed) perform
worktree-remove or trash-delete → return an outcome. The renderer's only
responsibility is calling `deleteRow` and then calling the existing `refresh()`
regardless of outcome (a no-op if nothing changed, since a cancelled/failed
delete leaves the directory in place and `refresh()` simply reports it again —
satisfying FR-006/FR-011 with no renderer-side branching).

**Rationale**: Mirrors the existing `runAction`/`pickDirectory` architecture
(main owns anything that touches dialogs, the filesystem, or git); keeps the
renderer a thin view layer with no new state machine for delete outcomes.

**Alternatives considered**: Splitting into two IPC calls (`checkDeleteRisk` +
`confirmDelete`) so the renderer renders its own dialogs — rejected per R4
(native dialogs are simpler and more accessible) and because it would require
the renderer to hold delete-in-progress state across two round trips for no
benefit.
