# Research: Rebase Diverged Repositories on Pull All

Phase 0 output. All spec `[NEEDS CLARIFICATION]` were resolved during `/speckit-clarify`
(see spec Clarifications, Session 2026-07-21); this document records the technical
decisions those answers imply.

## Root-cause evidence (why this feature exists)

Verified live against the reported repositories (`tf-auth0-pro`,
`mb-pro-customer-frontend-api`, `identity-web-bff`):

- The tool updates with `git merge --ff-only`; a diverged repo (local commits + advanced
  upstream) is refused → `failed`/`diverged`.
- The user's manual `git pull --autostash` succeeds because their **global
  `pull.rebase=true`** rebases local commits onto the upstream.
- The `fsmonitor_ipc__send_query … .git/fsmonitor--daemon.ipc` message is **stderr noise
  only** — every command in the update sequence (status, diff-files, diff-index, ls-files,
  fetch, stash push/pop, merge, merge-base) was observed to exit `0` despite it. Not a
  cause; explicitly out of scope.
- `git fetch <remote> <branch>` was confirmed to advance the remote-tracking ref
  (`@{u}`) via git's opportunistic update (tested by rewinding and restoring
  `refs/remotes/origin/main`), so the existing fetch/classify path is sound; only the
  update strategy for the diverged case needs to change.

## Decision 1 — Rebase inside the existing autostash wrapper, not `git rebase --autostash`

**Decision**: In `classifyAndMerge`, replace the diverged `return failed` with a plain
non-interactive `git rebase @{u}`. Do **not** use `git rebase --autostash`.

**Rationale**: `updateRepoInner` already runs `git stash push --include-untracked` before
`classifyAndMerge` and restores it after (feature 006). By the time the diverged branch is
reached the working tree is already clean, so the rebase needs no autostash of its own.
Crucially, our stash includes **untracked** files, whereas `git rebase --autostash` (and
`git pull --autostash`) stash tracked-only — reusing the existing wrapper is what satisfies
the "include untracked" clarification (spec Q2) for free, with zero new stash logic.

**Alternatives considered**:
- `git rebase --autostash` — would autostash tracked-only, contradicting Q2, and would
  duplicate stash handling the wrapper already does.
- `git pull --rebase --autostash` — re-introduces `pull.*` config dependence (Q1 says
  always rebase regardless of per-repo `pull.rebase`); calling `git rebase` directly is
  config-independent and more predictable.

## Decision 2 — Always `git rebase @{u}`, never merge (Q1)

**Decision**: The diverged branch always rebases; it never creates a merge commit, and it
ignores any per-repo `pull.rebase=false`.

**Rationale**: Calling `git rebase` directly (not `git pull`) is inherently independent of
`pull.rebase`, so Q1 is satisfied by construction. A tool-created merge commit is the
auto-merge Principle III's rationale exists to prevent; rebase-with-abort is the
non-destructive, predictable choice.

## Decision 3 — Conflict handling: abort and restore, new `rebase-conflict` reason

**Decision**: On a failed `git rebase @{u}`, run `git rebase --abort` (best-effort) to
restore the pre-rebase state, then return `{ result: 'failed', reason: { category:
'rebase-conflict', detail: errorDetail(err) } }`. The outer wrapper's `restoreStash` then
pops the autostash, returning the repo to its exact prior state (local commits + dirty
work intact).

**Rationale**: Satisfies FR-004 (exact restore, no rebase in progress), FR-005 (never
resolve), FR-006 (distinct reason), and Q3 (`failed` result reused). `errorDetail` already
captures git stderr (feature 013), so the tooltip can show the underlying conflict text.

**Edge**: if `git rebase --abort` itself were to fail (should not happen after a clean
conflict stop), we still return `failed`; the repo is not left silently "updated". A stray
`.git/rebase-merge` is the only residue and is visible/recoverable by the user.

## Decision 4 — Fast-forward path unchanged (FR-003)

**Decision**: Leave the pure-behind branch as `git merge --ff-only @{u}`. Only the
diverged branch changes.

**Rationale**: Smallest diff; no behavior change or new risk for the common fast-forward
case. (A plain `git rebase @{u}` would also fast-forward a pure-behind repo, but changing a
working path for no functional gain adds risk for nothing — YAGNI.)

## Decision 5 — Non-interactive rebase guard

**Decision**: Extend `NON_INTERACTIVE_ENV` with `GIT_EDITOR: 'true'` and
`GIT_SEQUENCE_EDITOR: 'true'` (alongside the existing `GIT_TERMINAL_PROMPT=0` /
`GIT_SSH_COMMAND`).

**Rationale**: A plain (non-`-i`) `git rebase` does not normally open an editor, but a repo
configured with `rebase.instructionFormat`, a `prepare-commit-msg`/rebase hook, or an
empty/duplicate-commit prompt could. `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` make
any such prompt a no-op instead of a hang, honoring Principle I ("never prompt") and the
existing 5 s spawn timeout as a backstop.

**Alternatives**: rely on the spawn timeout alone — rejected: a killed rebase mid-edit is a
worse state than a rebase that silently accepts defaults and either completes or conflicts.

## Decision 6 — Constitution Principle III amendment (governance, FR-012)

**Decision**: Principle III must be amended (via `/speckit-constitution`) before merge.
Proposed change, MAJOR (it relaxes a safety guarantee):

> Pull-all MUST use autostash and MUST NOT resolve conflicts or perform *interactive*
> merge/rebase resolution. It MAY bring a diverged repository up to date by a
> **non-interactive rebase of local commits onto the upstream**, but only when that rebase
> completes without conflict; on the first conflict it MUST abort the rebase, restore the
> repository to its exact prior state (no rebase left in progress, uncommitted work
> preserved), mark it `failed` (light red), and hand off to a dedicated merge tool. It MUST
> NOT create a merge commit on the user's behalf (no auto-merge).

**Rationale**: Preserves the principle's core (never resolve conflicts, fail loud, never
auto-merge) while permitting the specific, reversible-on-conflict rebase the user approved.
Version bump MAJOR because the prior guarantee "a diverged repo is left untouched" is
removed.

**Note**: `/speckit-plan` records this requirement but does not edit
`.specify/memory/constitution.md`. Run `/speckit-constitution` before merging (blocking per
FR-012).

## Decision 7 — Warning pruning needs no special case

**Decision**: `rebase-conflict` is an attempt-failure category; `renderer.ts`'s
`isWarningResolved` falls through to the feature-007 "row now looks clean" rule for it (no
new branch needed).

**Rationale**: After an abort+restore the repo is again diverged (out-of-sync, amber), so
`deriveRowState(entry) !== 'clean'` keeps the warning until the user resolves it — exactly
the existing `diverged` behavior. Only `unavailable`/`detached` need bespoke checks, and
they already have them.

## Testing approach

Real-git fixtures (existing `tests/update.test.ts` helpers), per the constitution's
mutating-operation runnable-check:

1. **Retarget** the existing `diverged … → failed` test: a diverged repo whose local and
   remote commits touch **different files** now expects `result: 'updated'` with local
   commits rebased on top and dirty/untracked work restored.
2. **Add** a diverged repo whose local and remote commits touch the **same lines** →
   `result: 'failed'`, `reason.category: 'rebase-conflict'`, HEAD and local commits and
   dirty work byte-for-byte unchanged, **no `.git/rebase-merge` left**, stash cleared.
3. Keep the fast-forward, already-current, local-ahead, fetch-failed, and shared-stash
   family tests unchanged (regression guard for FR-003 / no-regression).
