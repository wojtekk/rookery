# Phase 0 Research: Cleanup Gone Branches and Worktrees

All decisions are grounded in the existing codebase (`update.ts`, `delete.ts`,
`main.ts`, `probe.ts`, `scan.ts`, `types.ts`, `toolbar.ts`, `settings.ts`,
`renderer.ts`, `styles.css`) and the engine script `~/local/git-cleanup-all.sh`.

## D1. Detecting `[gone]` branches

**Decision**: Per repository, run `git fetch -p` then
`git for-each-ref --format='%(refname:short) %(upstream:track) %(worktreepath)' refs/heads/`
and treat a branch as a candidate when the `%(upstream:track)` field is exactly
`[gone]`. The `%(worktreepath)` field (empty or a path) tells us whether the
branch is checked out in a linked worktree.

**Rationale**: This is verbatim what the script does; it is a stable,
machine-readable format (allowed porcelain exception under Principle I). `fetch -p`
is what makes `[gone]` accurate — without it a branch whose remote was deleted
elsewhere may still look tracked.

**Alternatives considered**: Enrich the startup snapshot with gone-status
(rejected — adds a network `fetch` to the read-only startup/refresh hot path for
data only Cleanup uses; also `fetch` mutates remote-tracking refs, unwanted on
passive refresh). Parsing `git branch -vv` (rejected — human-formatted, less
stable than `for-each-ref` field selectors).

## D2. Detecting stale worktrees (the "extend the script" scope)

**Decision**: Use `git worktree list --porcelain` per repository. Classify each
linked (non-main) worktree:

- **missing-directory**: the porcelain entry is marked `prunable` (git's own
  reason: gitdir points to a non-existent location) **or** its `worktree` path
  does not exist on disk (`fs.existsSync`). Cross-checks feature 005's approach.
- **merged-branch**: the worktree's branch is fully contained in the repository's
  **default branch** — i.e. `git merge-base --is-ancestor <worktreeBranch>
  <defaultBranch>` succeeds — and the branch is not itself `[gone]` (a `[gone]`
  worktree is handled by D1, which also removes the branch).
- The **main worktree** (first line of `git worktree list`) is never a candidate.

**Default branch** = the branch checked out in the main worktree
(`git -C <mainWorktree> branch --show-current`), falling back to `origin/HEAD`'s
target if the main worktree is detached. Captured once per repo during scan.

**Rationale**: `--porcelain` exposes the `prunable` and `branch` fields the normal
snapshot throws away. "Merged into the default branch" is the least-surprising
reading of "branch is already merged" and matches how developers reason about
disposable worktrees. Excluding `[gone]` worktrees here avoids double-listing.

**Alternatives considered**: `git worktree prune` for missing dirs (rejected —
it deletes immediately, incompatible with the review-then-confirm requirement; we
must *enumerate* first). "Merged into upstream" instead of default branch
(rejected — a merged-to-main topic branch is the common disposable case; merged
-to-own-upstream is ambiguous and rarer).

## D3. Removal command matrix (what `executeCleanup` runs per selected item)

**Decision** — each selected candidate maps to exact commands via `runGit`,
always with `NON_INTERACTIVE_ENV` and the per-repo deadline:

| Candidate | Precondition | Commands (in order) |
|-----------|--------------|---------------------|
| `gone-branch`, no worktree | not current branch | `git -C <repo> branch -D <branch>` |
| `gone-branch`, worktree present (dir exists) | not main worktree | `git -C <repo> worktree remove <wpath>` (NO `--force`; fails ⇒ keep, report) → on success `git -C <repo> branch -D <branch>` |
| `gone-branch`, worktree dir missing | not main worktree | `git -C <repo> worktree remove <wpath> --force` → `git -C <repo> branch -D <branch>` |
| `missing-worktree` (branch not gone) | — | `git -C <repo> worktree remove <wpath> --force` |
| `merged-worktree` (dir exists) | not main worktree | `git -C <repo> worktree remove <wpath>` (NO `--force`; fails ⇒ keep, report) — branch left intact |

**Rationale**: `--force` is used **only** when the working directory is already
gone (nothing to lose), preserving the script's core safety (plain `remove` aborts
on uncommitted/untracked work). `git branch -D` (force) matches the script and the
clarified force-delete decision; the review overlay is the per-item consent that
makes force-delete safe. Merged-branch worktrees remove the worktree only — their
branch is not `[gone]`, so we do not delete a branch with a live upstream.

**Alternatives considered**: Always `--force` (rejected — silently discards
uncommitted work, violates Principle III). `git branch -d` for merged branches
(rejected — out of scope; the feature prunes *worktrees* of merged branches, and
`[gone]` branch deletion is already covered).

**All paths are tilde-expanded** before passing to `runGit` (the `expandTilde`
lesson from `main.ts:65` — `child_process` treats `~` literally and git exits
128 otherwise).

## D4. Candidate de-duplication & precedence

**Decision**: A worktree can satisfy more than one rule (e.g. a `[gone]` branch
whose dir is also missing). Emit **one** candidate per (repo, worktree/branch)
with precedence **gone-branch > missing-worktree > merged-worktree**, so the
branch is removed alongside its worktree exactly once.

**Rationale**: Prevents the overlay listing the same worktree twice and prevents
`executeCleanup` trying to remove an already-removed worktree.

## D5. Scope: repositories only, orphan worktrees excluded

**Decision**: Cleanup iterates `kind: 'repository'` rows only ("per repo, not per
worktree"). Each repository's own linked worktrees are candidates. `kind:
'orphan-worktree'` rows (a worktree whose primary repo is not in the observed set)
are **not** scanned as targets — there is no primary repo to run `git -C` from
safely, and they are surfaced/handled by the existing per-row delete + feature 005.

**Rationale**: Matches the user's explicit "run for each repo (not worktree)".
Keeps `git -C <repo>` well-defined for every operation.

## D6. Concurrency, families, and deadline

**Decision**: Reuse `update.ts`'s model verbatim: group into families (a primary
repo + its linked worktrees = one family that shares `refs/*`, so runs
sequentially), run families in parallel via `runPool(families, 6, …)`, and wrap
each repo's scan and each repo's removal batch in a `Promise.race` against a
~60s deadline (`UPDATE_TIMEOUT_MS`-equivalent; `fetch -p` is a real network op so
5s is too short). A repo that times out or errors is skipped/failed and never
aborts the run (FR-014).

**Rationale**: Branch/worktree ops within one repo touch shared refs and must
serialize; across repos they are independent. This is a solved problem in
`update.ts` — reuse, don't reinvent (Principle V / YAGNI).

## D7. Two-phase IPC shape

**Decision**: Two IPC methods rather than one:
`scanCleanup(): Promise<CleanupCandidate[]>` (read-only detect) and
`executeCleanup(selection: CleanupSelection[]): Promise<CleanupOutcome[]>`
(remove selected). The renderer holds the plan between the two and drives the
overlay. See `contracts/ipc-cleanup.md`.

**Rationale**: The read-only scan must be observable (spinner) and its result
must reach the renderer to populate the overlay *before* any deletion; a single
call cannot both return a plan and act on a user selection that doesn't exist yet.

**Alternatives considered**: One `cleanupAll()` that deletes everything
(rejected — no review, fails the whole feature). A stateful main-process session
handle (rejected — unnecessary; passing the selection back is stateless and
simpler).

## D8. Review overlay UI

**Decision**: New `src/renderer/view/cleanup.ts` mirroring `settings.ts`:
module-level `isOpen` + `openCleanupOverlay(candidates)` + `renderCleanupOverlay()`,
built on the existing `.scrim`/`.modal`/`.modal-head`/`.modal-body`/`.modal-foot`/
`.btn` CSS. Candidates grouped by repository; each is a list row with a checkbox
(**checked by default**) and, when a worktree is removed, a worktree indicator
glyph. Footer: "Cancel" (ghost) and "Remove N selected" (primary, count updates
live). Backdrop-click / × / Cancel close without removing; ARIA `role="dialog"`,
`aria-modal="true"`. Mounted from `render()` via a new `<div id="cleanupOverlay">`.

**Rationale**: The settings modal proves this pattern works and its CSS is
generic. Checkbox styling does not exist yet and is the only new CSS of substance.

**Alternatives considered**: Native `dialog.showMessageBox` with a checkbox list
(rejected — Electron's message box has a single `checkboxLabel`, cannot render a
grouped multi-item selectable list).

## D9. Result summary & post-run refresh

**Decision**: After `executeCleanup` resolves, build counts and call the existing
`showNotice(...)` toast (verbatim as Pull all: `Removed X · Y skipped · Z failed`
style), then `await doRefresh()` so the list reflects removals. Empty scan →
`showNotice('Nothing to clean up')` and no overlay (FR-010).

**Rationale**: Matches the clarified "summary like for pull all" and reuses code
already in `renderer.ts`.

## D10. Testing approach

**Decision**: `tests/cleanup.test.ts` with `node:test` + temp-git-repo fixtures
(established pattern). Fixtures create a repo with: a `[gone]` branch (create a
branch, set its upstream to a remote branch, delete the remote branch, `fetch -p`);
a linked worktree on a `[gone]` branch; a linked worktree whose dir is `rm`-ed;
a merged-branch worktree; the current branch also `[gone]`; a worktree with an
uncommitted file. Assert: scan detects the right candidates with the right
reasons and precedence; current branch and main worktree never appear; execute
removes only the passed selection; plain `remove` fails (keeps) the dirty
worktree; `--force` removes the missing-dir worktree; `branch -D` removes an
unmerged `[gone]` branch. This is the constitution's mandated runnable check for a
mutating operation.
