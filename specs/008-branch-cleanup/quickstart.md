# Quickstart: Cleanup Gone Branches and Worktrees

Validation guide proving the feature works end-to-end. See `plan.md`,
`research.md`, `data-model.md`, and `contracts/ipc-cleanup.md` for design detail.

## Prerequisites

- Node 22 (`.nvmrc`), deps installed (`npm ci`).
- The engine script `~/local/git-cleanup-all.sh` (reference only; the app
  reimplements its detect/remove logic in `src/main/cleanup.ts`).

## Automated engine check (constitution-mandated runnable check)

```bash
npm test                       # runs node:test; includes tests/cleanup.test.ts
# or target just this feature:
node --test tests/cleanup.test.ts
```

**Expected**: all pass, covering (research D10): `[gone]` branch detected;
missing-dir worktree detected; merged-branch worktree detected; current branch &
main worktree never listed; dedupe/precedence correct; `executeCleanup` removes
only the passed selection; a **present worktree with an uncommitted file is kept**
(plain `git worktree remove` refuses) and reported `skipped`; a missing-dir
worktree is removed with `--force`; an unmerged `[gone]` branch is force-deleted.

## Manual fixture setup (real repo, for the UI flow)

```bash
tmp=$(mktemp -d); cd "$tmp"
git init -b main origin.git --bare
git clone origin.git work && cd work
git commit --allow-empty -m init && git push -u origin main

# a) a [gone] branch (remote branch deleted after tracking)
git checkout -b feature-gone && git commit --allow-empty -m wip
git push -u origin feature-gone && git push origin :feature-gone   # delete remote side
git checkout main && git fetch -p                                  # now feature-gone is [gone]

# b) a [gone] branch checked out in a linked worktree
git checkout -b wt-gone && git commit --allow-empty -m wt
git push -u origin wt-gone && git push origin :wt-gone && git fetch -p
git worktree add ../wt-gone-tree wt-gone && git checkout main

# c) a merged-branch worktree (branch merged into main, remote still exists or not)
git checkout -b merged-topic && git commit --allow-empty -m topic
git checkout main && git merge --no-ff merged-topic -m merge
git worktree add ../merged-tree merged-topic

# d) a worktree whose directory is deleted from disk
git worktree add ../missing-tree -b throwaway
rm -rf ../missing-tree

# e) a present worktree with uncommitted work (must be KEPT)
git checkout -b dirty-gone && git commit --allow-empty -m d
git push -u origin dirty-gone && git push origin :dirty-gone && git fetch -p
git worktree add ../dirty-tree dirty-gone
echo scratch > ../dirty-tree/uncommitted.txt
git checkout main
```

Add the parent temp dir as an observed directory in the app.

## UI validation steps

1. **Start**: `npm start` (or the project's launch command). The dashboard lists
   the fixture repo.
2. **Trigger scan**: click the header **Cleanup** button.
   - **Expected**: the button shows the busy/spin state (same as Pull all) while
     scanning; it cannot be re-triggered (FR-011/FR-012).
3. **Review overlay appears** (FR-008):
   - Lists candidates grouped by repo: `feature-gone` (branch), `wt-gone`
     (branch + **worktree indicator**), `merged-topic` worktree, `missing-tree`
     worktree, `dirty-gone` (branch + worktree indicator).
   - Every item is **checked by default**.
   - The current branch (`main`) and the main worktree are **absent**.
4. **Select**: uncheck `merged-topic`'s worktree. Footer count updates. Click
   **Remove N selected**.
5. **Result** (FR-013):
   - A counts toast appears (`Removed … · … skipped · … failed`), auto-dismissing.
   - After the automatic re-scan: `feature-gone` and `wt-gone` are gone;
     `missing-tree` is pruned; `merged-tree` **remains** (unselected);
     `dirty-tree` **remains and is reported skipped** (plain `worktree remove`
     refused to discard the uncommitted file — Principle III).
6. **Cancel path** (FR-009): click Cleanup again, then **Cancel** (or click the
   backdrop / ×) in the overlay. **Expected**: nothing is removed.
7. **Empty path** (FR-010): with nothing left to clean, click Cleanup.
   **Expected**: a "Nothing to clean up" toast, no overlay.

## Constitution spot-checks

- **III**: confirm the `dirty-tree` worktree survived with its uncommitted file
  intact (no `--force` on present worktrees).
- **II**: confirm no removal happened until the overlay was confirmed, and cancel
  removed nothing.
- **IV**: confirm the window stayed responsive during scan/removal and the list
  refreshed to honest state afterward.
