# Contract: Update All (pull-all)

Extends the 001 IPC surface. One new IPC method; no changes to existing methods.

## IPC method

```ts
updateAll(): Promise<RepoUpdateOutcome[]>
```

- **Trigger**: the renderer's new header "Pull all" control (explicit user
  action only — Principle II).
- **Input**: none. The main process derives targets from its own `lastSnapshot`
  (see data-model.md eligibility predicate). No target list crosses IPC.
- **Output**: one `RepoUpdateOutcome` per working tree in `lastSnapshot`
  (repositories + worktrees + orphan worktrees), including `skipped` ones, so the
  caller can compute accurate summary counts and the failed-path overlay.
- **Ordering / batching**: outcomes may be returned in any order. Eligible
  repos are processed through a bounded concurrency pool (`runPool`, ~4–8).
- **Never rejects for a single-repo failure**: a repo that errors resolves to
  `{ result: 'failed' }`; the promise only rejects on a catastrophic internal
  error (e.g. no window), matching how `deleteRow` handles the no-window case.

### Guarantees

| # | Guarantee | Source |
|---|-----------|--------|
| G1 | Runs only on explicit click, never on a timer | Principle II; FR-001 |
| G2 | Read-only for ineligible repos; only `merge --ff-only` mutates | FR-004/005/006/007 |
| G3 | Uncommitted work is stashed before and restored after; never discarded | FR-003; SC-002 |
| G4 | Diverged repo ⇒ `failed`, left in original inspectable state; never auto-merged | Principle III; FR-004 |
| G5 | Git runs non-interactively; never prompts for credentials | Principle I; FR-013 |
| G6 | Every repo bounded by a deadline; the run always terminates | FR-013; SC-007 |
| G7 | One failing repo never aborts the run | FR-010; SC-006 |

## Per-repo update state machine

The authoritative sequence is in [../data-model.md](../data-model.md#per-repo-update-state-machine-updaterepoabspath--updateresult).
Git command sequence for one eligible repo at absolute `dir` (all invocations
carry the non-interactive env and the update `timeoutMs`):

```
# dirty detection (plumbing; no scraping)
git -C dir diff-files --quiet
git -C dir diff-index --cached --quiet HEAD
git -C dir ls-files --others --exclude-standard        # non-empty ⇒ dirty

# if dirty
git -C dir stash push --include-untracked -m git-manager-update-<n>

# fetch the tracked upstream (longer timeout)
git -C dir fetch <remote> <branch>

# classify
git -C dir rev-parse HEAD @{u}
git -C dir merge-base --is-ancestor <a> <b>            # to distinguish behind / ahead / diverged

# behind only:
git -C dir merge --ff-only @{u}

# restore (if stashed): pop; on conflict, leave in stash and report failed
git -C dir stash pop        # or: stash apply --index && stash drop
```

`<remote>`/`<branch>` come from the tracked upstream (`@{u}` → `remote` +
`branch`), mirroring the script's derivation.

## Non-interactive environment (every engine git call)

```
GIT_TERMINAL_PROMPT=0
GIT_SSH_COMMAND=ssh -oBatchMode=yes -oStrictHostKeyChecking=accept-new
```

## Renderer contract

1. On click: if `updating` → ignore (G-reentry, FR-009). Else set `updating =
   true`, clear `failedPaths`, re-render (spinner starts), call `updateAll()`.
2. On resolve: `failedPaths = new Set(outcomes.filter(o => o.result ===
   'failed').map(o => o.path))`; show one-line summary via `showNotice`; set
   `updating = false`; then `await doRefresh()` (re-scan → honest ahead/behind).
3. `table.ts` paints `--fail-edge` for rows in `failedPaths` (highest edge
   precedence).

## Out of scope

- Push (Principle III's push rules are unrelated to this pull-only feature).
- Per-repo failure reasons / a console/output panel (clarified: counts only).
- Per-repo progress streaming (only an animated icon + final summary).
