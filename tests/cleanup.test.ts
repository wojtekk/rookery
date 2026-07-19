// Real-git-fixture tests for the Cleanup engine (data-model.md, research.md D1-D4), following the
// project's existing convention (delete-risk.test.ts, update.test.ts) of exercising real git
// subprocesses against temp directories rather than mocking. This is the constitution-mandated
// runnable check for a mutating operation (branch/worktree removal).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanRepoCleanup, executeCleanup } from '../src/main/cleanup';
import type { CleanupCandidate } from '../src/shared/types';

function git(root: string, args: string[]): void {
  execFileSync('git', ['-C', root, ...args]);
}

function initRepo(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'content\n');
  git(root, ['add', 'tracked.txt']);
  git(root, ['commit', '-q', '-m', 'initial']);
}

/** A bare "remote" plus a clone pushed to it — the baseline fixture (mirrors update.test.ts). */
function initCleanClone(tmpRoot: string): { work: string; bare: string } {
  const bare = path.join(tmpRoot, 'bare.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  const work = path.join(tmpRoot, 'work');
  initRepo(work);
  git(work, ['remote', 'add', 'origin', bare]);
  git(work, ['push', '-q', '-u', 'origin', 'HEAD']);
  return { work, bare };
}

function defaultBranch(bare: string): string {
  return execFileSync('git', ['-C', bare, 'symbolic-ref', '--short', 'HEAD']).toString().trim();
}

/** Pushes `branch` (from `work`, already checked out) then deletes it on the remote — the [gone] recipe. */
function makeGone(work: string, branch: string): void {
  git(work, ['push', '-q', '-u', 'origin', branch]);
  git(work, ['push', '-q', 'origin', `:${branch}`]);
}

function branchExists(work: string, branch: string): boolean {
  return execFileSync('git', ['-C', work, 'branch', '--list', branch]).toString().trim() !== '';
}

function worktreeListedPaths(work: string): string[] {
  const out = execFileSync('git', ['-C', work, 'worktree', 'list', '--porcelain']).toString();
  return out
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim());
}

// mkdtemp under macOS TMPDIR resolves through a `/tmp -> /private/tmp` symlink; git reports the
// resolved (real) path in its own output, so paths built from an un-resolved root would never
// string-compare equal to what for-each-ref/worktree-list echoes back. Resolve once, up front.
async function withTmp(fn: (root: string) => Promise<void>): Promise<void> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-cleanup-')));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function byId(candidates: CleanupCandidate[], id: string): CleanupCandidate | undefined {
  return candidates.find((c) => c.id === id);
}

test('scanRepoCleanup: detects a [gone] branch with no worktree; current branch never appears', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'feature-gone']);
    makeGone(work, 'feature-gone');
    git(work, ['checkout', '-q', main]);

    const candidates = await scanRepoCleanup(work);

    const found = byId(candidates, `${work}::feature-gone`);
    assert.ok(found, 'feature-gone should be a candidate');
    assert.equal(found!.reason, 'gone-branch');
    assert.equal(found!.worktreePath, null);
    assert.equal(found!.worktreeDirMissing, false);
    assert.ok(!candidates.some((c) => c.branch === main), 'current branch must never be a candidate');
  });
});

test('scanRepoCleanup: currently checked-out branch is excluded even when its own upstream is gone', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    git(work, ['checkout', '-q', '-b', 'active-gone']);
    makeGone(work, 'active-gone');
    // Stay checked out on active-gone (do NOT switch back) — this is the edge case.

    const candidates = await scanRepoCleanup(work);

    assert.ok(!candidates.some((c) => c.branch === 'active-gone'), 'checked-out branch must be excluded');
  });
});

test('scanRepoCleanup: detects a [gone] branch checked out in a linked worktree', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'wt-gone']);
    makeGone(work, 'wt-gone');
    git(work, ['checkout', '-q', main]);
    const wtDir = path.join(root, 'wt-gone-tree');
    git(work, ['worktree', 'add', wtDir, 'wt-gone']);

    const candidates = await scanRepoCleanup(work);

    const found = byId(candidates, `${work}::wt-gone`);
    assert.ok(found, 'wt-gone should be a candidate');
    assert.equal(found!.reason, 'gone-branch');
    assert.equal(found!.worktreePath, wtDir);
    assert.equal(found!.worktreeDirMissing, false);
  });
});

test('scanRepoCleanup: detects a missing-directory worktree (branch not gone)', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const missingDir = path.join(root, 'missing-tree');
    git(work, ['worktree', 'add', missingDir, '-b', 'throwaway']);
    fs.rmSync(missingDir, { recursive: true, force: true });

    const candidates = await scanRepoCleanup(work);

    const found = byId(candidates, `${work}::${missingDir}`);
    assert.ok(found, 'missing-tree should be a candidate');
    assert.equal(found!.reason, 'missing-worktree');
    assert.equal(found!.branch, null);
    assert.equal(found!.worktreeDirMissing, true);
  });
});

test('scanRepoCleanup: detects a merged-branch worktree', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'merged-topic']);
    fs.writeFileSync(path.join(work, 'topic.txt'), 'topic\n');
    git(work, ['add', 'topic.txt']);
    git(work, ['commit', '-q', '-m', 'topic']);
    git(work, ['checkout', '-q', main]);
    git(work, ['merge', '--no-ff', 'merged-topic', '-m', 'merge']);
    const mergedDir = path.join(root, 'merged-tree');
    git(work, ['worktree', 'add', mergedDir, 'merged-topic']);

    const candidates = await scanRepoCleanup(work);

    const found = byId(candidates, `${work}::${mergedDir}`);
    assert.ok(found, 'merged-tree should be a candidate');
    assert.equal(found!.reason, 'merged-worktree');
    assert.equal(found!.branch, null);
    assert.equal(found!.worktreeDirMissing, false);
  });
});

test('scanRepoCleanup: a merged-branch worktree with uncommitted changes is never labeled merged', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'merged-dirty']);
    fs.writeFileSync(path.join(work, 'topic.txt'), 'topic\n');
    git(work, ['add', 'topic.txt']);
    git(work, ['commit', '-q', '-m', 'topic']);
    git(work, ['checkout', '-q', main]);
    git(work, ['merge', '--no-ff', 'merged-dirty', '-m', 'merge']);
    const mergedDir = path.join(root, 'merged-dirty-tree');
    git(work, ['worktree', 'add', mergedDir, 'merged-dirty']);
    fs.writeFileSync(path.join(mergedDir, 'uncommitted.txt'), 'scratch\n');

    const candidates = await scanRepoCleanup(work);

    assert.ok(!candidates.some((c) => c.worktreePath === mergedDir), 'a dirty worktree must never be offered as merged');
  });
});

// Regression: a branch that never diverged from the default branch (e.g. just created, or all its
// work still uncommitted) has zero unique commits, so `merge-base --is-ancestor` trivially reports
// it as "merged" even though nothing was ever actually merged. This is exactly the real-world case
// of an in-progress feature worktree whose branch hasn't been committed to yet.
test('scanRepoCleanup: a worktree on a branch identical to the default branch is never labeled merged while dirty', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    git(work, ['branch', 'never-diverged']); // tip == default branch's tip
    const sameDir = path.join(root, 'never-diverged-tree');
    git(work, ['worktree', 'add', sameDir, 'never-diverged']);
    fs.writeFileSync(path.join(sameDir, 'wip.txt'), 'work in progress\n');

    const candidates = await scanRepoCleanup(work);

    assert.ok(!candidates.some((c) => c.worktreePath === sameDir), 'an active worktree must never be labeled merged');
  });
});

test('scanRepoCleanup: dedupe/precedence — a worktree that is both gone and merged is listed once, as gone-branch', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'dup-branch']);
    fs.writeFileSync(path.join(work, 'dup.txt'), 'dup\n');
    git(work, ['add', 'dup.txt']);
    git(work, ['commit', '-q', '-m', 'dup']);
    git(work, ['push', '-q', '-u', 'origin', 'dup-branch']);
    git(work, ['checkout', '-q', main]);
    git(work, ['merge', '--no-ff', 'dup-branch', '-m', 'merge dup']); // now merged into main
    const dupDir = path.join(root, 'dup-tree');
    git(work, ['worktree', 'add', dupDir, 'dup-branch']);
    git(work, ['push', '-q', 'origin', ':dup-branch']); // now also gone

    const candidates = await scanRepoCleanup(work);

    const matches = candidates.filter((c) => c.worktreePath === dupDir);
    assert.equal(matches.length, 1, 'must appear exactly once');
    assert.equal(matches[0]!.reason, 'gone-branch');
  });
});

test('executeCleanup: a present worktree with an uncommitted file is kept and reported skipped', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'dirty-gone']);
    makeGone(work, 'dirty-gone');
    git(work, ['checkout', '-q', main]);
    const dirtyDir = path.join(root, 'dirty-tree');
    git(work, ['worktree', 'add', dirtyDir, 'dirty-gone']);
    fs.writeFileSync(path.join(dirtyDir, 'uncommitted.txt'), 'scratch\n');

    const candidates = await scanRepoCleanup(work);
    const candidate = byId(candidates, `${work}::dirty-gone`)!;
    assert.ok(candidate, 'dirty-gone should be a candidate');

    const outcomes = await executeCleanup([candidate]);

    assert.deepEqual(outcomes, [{ id: candidate.id, result: 'skipped' }]);
    assert.ok(fs.existsSync(dirtyDir), 'worktree directory must survive');
    assert.ok(fs.existsSync(path.join(dirtyDir, 'uncommitted.txt')), 'uncommitted file must survive');
    assert.ok(branchExists(work, 'dirty-gone'), 'branch must survive (worktree removal blocked branch -D)');
  });
});

test('executeCleanup: a missing-directory worktree is removed with --force', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const missingDir = path.join(root, 'missing-tree');
    git(work, ['worktree', 'add', missingDir, '-b', 'throwaway']);
    fs.rmSync(missingDir, { recursive: true, force: true });

    const candidates = await scanRepoCleanup(work);
    const candidate = byId(candidates, `${work}::${missingDir}`)!;

    const outcomes = await executeCleanup([candidate]);

    assert.deepEqual(outcomes, [{ id: candidate.id, result: 'removed' }]);
    assert.ok(!worktreeListedPaths(work).includes(missingDir));
  });
});

test('executeCleanup: an unmerged [gone] branch is force-deleted via branch -D', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'unmerged-gone']);
    fs.writeFileSync(path.join(work, 'unmerged.txt'), 'never merged\n');
    git(work, ['add', 'unmerged.txt']);
    git(work, ['commit', '-q', '-m', 'unmerged commit']);
    makeGone(work, 'unmerged-gone');
    git(work, ['checkout', '-q', main]);

    const candidates = await scanRepoCleanup(work);
    const candidate = byId(candidates, `${work}::unmerged-gone`)!;
    assert.ok(candidate, 'unmerged-gone should be a candidate despite holding unmerged commits');

    const outcomes = await executeCleanup([candidate]);

    assert.deepEqual(outcomes, [{ id: candidate.id, result: 'removed' }]);
    assert.equal(branchExists(work, 'unmerged-gone'), false);
  });
});

test('executeCleanup: acts only on the passed selection, leaving unselected candidates untouched', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const main = defaultBranch(work);
    git(work, ['checkout', '-q', '-b', 'branch-a']);
    makeGone(work, 'branch-a');
    git(work, ['checkout', '-q', '-b', 'branch-b']);
    makeGone(work, 'branch-b');
    git(work, ['checkout', '-q', main]);

    const candidates = await scanRepoCleanup(work);
    const a = byId(candidates, `${work}::branch-a`)!;
    const b = byId(candidates, `${work}::branch-b`)!;
    assert.ok(a && b);

    const outcomes = await executeCleanup([a]);

    assert.deepEqual(outcomes, [{ id: a.id, result: 'removed' }]);
    assert.equal(branchExists(work, 'branch-a'), false);
    assert.equal(branchExists(work, 'branch-b'), true, 'unselected branch must survive');
  });
});

test('executeCleanup: empty selection is a no-op returning []', async () => {
  const outcomes = await executeCleanup([]);
  assert.deepEqual(outcomes, []);
});
