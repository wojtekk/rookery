# Contract: Update Engine (`src/main/update.ts`)

The "Pull all" engine's observable contract. This feature changes **one branch** of the
per-repository classifier; the module's public surface (`updateAll`, `updateRepo`,
`skipReason`, `isEligible`, …) keeps its existing signatures. Electron-free, real-git
testable.

## Behavioral contract for a diverged, eligible working tree

Given an eligible working tree (`availability === 'ok'`, not detached, upstream tracked)
that, after `git fetch <remote> <branch>`, is **diverged** (neither `HEAD` nor `@{u}` is an
ancestor of the other):

1. Uncommitted work (tracked **and** untracked) has already been autostashed by the caller
   (`updateRepoInner`) before classification.
2. The engine attempts a **non-interactive** `git rebase @{u}`.
3. **Clean rebase** → return `{ result: 'updated' }` (no `reason`). Local commits are
   replayed on top of `@{u}`; no merge commit exists (INV-1).
4. **Conflicting rebase** → run `git rebase --abort` (best-effort), then return
   `{ result: 'failed', reason: { category: 'rebase-conflict', detail?: <git stderr> } }`.
   The repo is byte-for-byte restored (INV-2); the caller then pops the autostash.

Never: resolve a conflict, run interactive rebase, create a merge commit, or leave a rebase
in progress on the returned outcome.

## Unchanged branches (regression contract)

- `HEAD == @{u}` → `already-current`.
- `@{u}` ancestor of `HEAD` (local ahead) → `already-current`.
- `HEAD` ancestor of `@{u}` (pure behind) → `updated` via `git merge --ff-only @{u}`.
- fetch failure → `failed` / `fetch-failed` (with detail).
- autostash push failure → `failed` / `stash-failed`.
- autostash restore failure (pop + apply both fail) → `failed` / `stash-failed`, stash
  **preserved** (work recoverable).
- per-repo deadline elapsed → `failed` / `timed-out`.
- uncaught error → `failed` / `update-failed` (with detail).
- ineligible → `skipped` (+`unavailable`/`detached` reason, or none for no-upstream).

## Environment contract

`NON_INTERACTIVE_ENV` gains `GIT_EDITOR='true'` and `GIT_SEQUENCE_EDITOR='true'` so no git
invocation (rebase included) can block on an editor. `GIT_TERMINAL_PROMPT='0'` and the
`GIT_SSH_COMMAND` batch-mode setting are retained.

## Timeout contract

The rebase runs under the same `SPAWN_TIMEOUT_MS` (5 s) per-spawn bound and the 60 s family
deadline. If the spawn is killed, the catch path runs `git rebase --abort`, so a
`timed-out` (or killed-rebase) outcome still leaves no rebase in progress (FR-011).

## Runnable checks (constitution mutating-op requirement)

`tests/update.test.ts` (real git fixtures) MUST cover:

- diverged + non-conflicting (different files/lines) + dirty(tracked+untracked) →
  `updated`; local commit present atop remote; no merge commit; work restored; stash empty.
- diverged + conflicting (same lines) → `failed` / `rebase-conflict`; HEAD, local commits,
  and working tree unchanged; no `.git/rebase-merge`; stash empty.
- existing ff / already-current / local-ahead / fetch-failed / shared-stash family tests
  remain green.
