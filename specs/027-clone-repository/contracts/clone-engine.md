# Contract: Clone Engine, Discovery & IPC

Defines the two new IPC methods, the `gh`/`git` subprocess contracts behind them, and
the pure helpers. "MUST" statements are the runnable-check targets for `tasks.md`.

## IPC surface (preload → main)

### `listCloneableRepos(forceRefresh?: boolean): Promise<CloneableReposResult>`

Read-only discovery. Registered with `ipcMain.handle('listCloneableRepos', …)`.

- MUST return a cached result on the second+ call within an app session, UNLESS
  `forceRefresh === true`, which MUST re-run discovery and replace the cache.
- MUST enumerate hosts via `gh auth status --json hosts` and query each host with
  `state === "success"` (research §4).
- MUST set `searchAvailable: false` with a human `reason` when no host can be queried
  at all (e.g. `gh` ENOENT, or every host errors) — and MUST NOT throw in that case
  (FR-012: the modal still opens for manual-URL clone).
- MUST set `searchAvailable: true` and populate `unavailableHosts` when ≥1 host
  succeeds and ≥1 other fails (FR-013).
- MUST NOT read, log, or persist any token; it only invokes `gh` (Principle I/V).

### `cloneRepository(url: string, destination: string): Promise<CloneOutcome>`

The one mutating call. Registered with `ipcMain.handle('cloneRepository', …)`.

- MUST run `git clone -- <url> <destination>` passing `url` and `destination` as
  **separate argv entries**, never concatenated, with `--` terminating options
  (research §7). MUST use `NON_INTERACTIVE_ENV` so a credential prompt fails loud.
- MUST expand a leading `~` in `destination` before spawning (child_process treats
  `~` literally — same rule as `deleteRow`).
- On success MUST, before resolving `{ ok: true }`, add `dirname(destination)` to
  `observedDirectories` if absent (data-model §6), persisting via the settings path.
- On failure MUST resolve `{ ok: false, reason }` with trimmed git stderr/stdout
  (reuse `update.ts`'s `errorDetail` shape) — MUST NOT throw across IPC (FR-011).
- MUST NOT overwrite or merge into an existing non-empty destination — it relies on
  `git clone`'s own refusal, surfacing that stderr as `reason` (Edge Cases).

### `setLastCloneDirectory(dir: string): Promise<void>`

Persists `Settings.lastCloneDirectory`. Mirrors `setDefaultHost` exactly.

## Subprocess contracts

### Discovery (per host)

```
gh auth status --json hosts
gh api --hostname <host> --paginate \
   "user/repos?per_page=100&sort=full_name" \
   --jq '.[] | {host:"<host>", owner:.owner.login, name:.name, sshUrl:.ssh_url, httpsUrl:.clone_url}'
```

- Output is newline-delimited JSON objects (one per repo, streamed across pages).
- A non-zero exit for a host ⇒ that host is treated as unavailable (not fatal to the
  whole call) — its name goes to `unavailableHosts` if others succeed, or contributes
  to `searchAvailable: false` if all fail.

### Clone

```
git clone -- <url> <destination>     # env: NON_INTERACTIVE_ENV; generous timeout
```

## Pure helpers (unit-tested)

### `deriveRepoName(url: string): string | null`  (`view/clone-model.ts`)

| Input | Output |
|-------|--------|
| `git@github.com:finn/some-repo.git` | `some-repo` |
| `https://github.com/finn/some-repo.git` | `some-repo` |
| `https://github.com/finn/some-repo` | `some-repo` |
| `ssh://git@github.schibsted.io/spt/thing.git` | `thing` |
| `""` / `"   "` / no path segment | `null` |

- MUST strip a trailing `.git` and any trailing slash, then take the last `/`- or
  `:`-delimited segment. `null` ⇒ the Clone button is disabled.

### `rankCloneCandidates(repos, query, limit = 50): RemoteRepoSummary[]`  (`view/clone-model.ts`)

- MUST match case-insensitively as a substring of `"owner/name"`.
- MUST rank: repo-name **prefix** match > repo-name substring > owner-only match;
  stable within a tier (input order preserved).
- MUST return at most `limit` (50) results (spec Clarifications).
- Empty/whitespace `query` ⇒ MUST return the first `limit` repos (unfiltered head), so
  the dropdown is never blank on focus.

### `buildDestination(dir: string, repoName: string): string`  (`view/clone-model.ts`)

- MUST join with exactly one separator regardless of a trailing separator on `dir`
  (e.g. `~/IdeaProjects/finn` + `repo` → `~/IdeaProjects/finn/repo`; `…/finn/` + `repo`
  → same).

### `parseGhHosts(authStatusJson: string): string[]`  (`clone-discovery.ts`)

- Input shape (verified): `{ "hosts": { "<host>": [ { "state": "success", "active":
  true, "login": "…", "host": "…" }, … ] } }`.
- MUST return each host key whose account array contains ≥1 `state === "success"`.
- Malformed/empty JSON ⇒ MUST return `[]` (caller degrades to `searchAvailable:false`).

### `parseGhRepoList(jsonl: string, host: string): RemoteRepoSummary[]`  (`clone-discovery.ts`)

- MUST parse one `RemoteRepoSummary` per non-empty line; MUST skip a line that fails
  `JSON.parse` or lacks required fields (never throw on one bad line).
- MUST stamp `host` on each summary.

## Renderer flow (`renderer.ts` `doClone`)

- Opening the modal (`onClone`) MUST NOT set the long-op lock; it opens the overlay and
  kicks off `listCloneableRepos()` (in-modal spinner). Browsing/searching is unlocked,
  like the Settings modal.
- Confirming the clone MUST set `cloning = true`, run `beginBusyLock('Cloning…')`, call
  `cloneRepository`, and in a `finally` clear `cloning` + `endBusyLock()` (FR-008/
  release-on-any-settlement, mirroring `doUpdateAll`).
- On `{ ok: true }`: close the modal, reload `settings` via `getSettings` (to pick up
  the new observed dir + `lastCloneDirectory`), then `doRefresh()` so the repo appears.
- On `{ ok: false }`: keep the modal open, set `cloneError`, preserve all input (FR-011).
- The Clone toolbar button MUST be disabled while any of refreshing/updating/cleaning/
  rebasing/cloning is active, and MUST participate in `busy` so it locks the others
  while a clone runs (FR-008). It is enabled even when no repos exist (you can clone the
  first one) — unlike Pull all/Cleanup/Rebase.

## Invariants (runnable-check targets)

- **INV-1**: A failed clone leaves no observed-directory change and no partial repo the
  app treats as real (git cleans up its own aborted clone dir; the handler adds the
  parent dir only after `git clone` exits 0).
- **INV-2**: Discovery never mutates anything (read-only) and never throws to the
  renderer — worst case is `searchAvailable: false`.
- **INV-3**: `url`/`destination` are always separate argv entries after `--`; no code
  path builds a clone command by string concatenation (Principle V arg-safety).
