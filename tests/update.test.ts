// Real-git-fixture tests for updateRepo (data-model.md per-repo state machine), following the
// project's existing convention (delete-risk.test.ts) of exercising real git subprocesses against
// temp directories rather than mocking. Covers the full outcome taxonomy, including the
// constitution-mandated diverged→failed path (Principle III: never auto-merge).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { updateAll, updateRepo, skipReason } from '../src/main/update';
import type { Row, WorkingTreeEntry } from '../src/shared/types';

function git(root: string, args: string[]): void {
  execFileSync('git', ['-C', root, ...args]);
}

function headSha(dir: string): string {
  return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim();
}

function stashList(dir: string): string {
  return execFileSync('git', ['-C', dir, 'stash', 'list']).toString().trim();
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

/** A bare "remote" plus a clone that's fully pushed and clean — the baseline fixture. */
function initCleanClone(tmpRoot: string): { work: string; bare: string } {
  const bare = path.join(tmpRoot, 'bare.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  const work = path.join(tmpRoot, 'work');
  initRepo(work);
  git(work, ['remote', 'add', 'origin', bare]);
  git(work, ['push', '-q', '-u', 'origin', 'HEAD']);
  return { work, bare };
}

/**
 * Advances `branch` on `bare` by one commit from an independent scratch clone, writing to
 * `fileName` (a file the working tree under test never touches) — so a fast-forward + stash-pop
 * restore in the tests below never hits a real merge conflict (the tests are about outcome
 * classification, not git's 3-way merge behavior).
 */
function advanceRemoteBranch(tmpRoot: string, bare: string, branch: string, fileName: string): string {
  const scratch = fs.mkdtempSync(path.join(tmpRoot, 'advance-'));
  execFileSync('git', ['clone', '-q', '-b', branch, bare, scratch]);
  git(scratch, ['config', 'user.email', 'test@example.com']);
  git(scratch, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(scratch, fileName), 'advanced\n');
  git(scratch, ['add', fileName]);
  git(scratch, ['commit', '-q', '-m', 'advance']);
  git(scratch, ['push', '-q']);
  return headSha(scratch);
}

/** Whatever `init.defaultBranch` produced — never hardcode 'main'/'master' (matches delete-risk.test.ts's approach). */
function defaultBranch(bare: string): string {
  return execFileSync('git', ['-C', bare, 'symbolic-ref', '--short', 'HEAD']).toString().trim();
}

function advanceRemote(tmpRoot: string, bare: string): string {
  return advanceRemoteBranch(tmpRoot, bare, defaultBranch(bare), 'remote-advance.txt');
}

/** Minimal WorkingTreeEntry for a tracked, available, non-detached branch — enough for isEligible(). */
function trackedEntry(fullPath: string, branch: string): WorkingTreeEntry {
  return {
    availability: 'ok',
    head: { detached: false, branch, upstream: { tracking: 'tracked', ahead: 0, behind: 0 } },
    local: 0,
    lastChange: null,
    directoryName: path.basename(fullPath),
    fullPath,
    collisionFragment: null,
  };
}

async function withTmp(fn: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-update-'));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('updateRepo: clean, local behind upstream → updated (fast-forwarded, no stash left)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const remoteSha = advanceRemote(root, bare);
    const { result, reason } = await updateRepo(work);
    assert.equal(result, 'updated');
    assert.equal(reason, undefined); // FR-010: success paths carry no reason
    assert.equal(headSha(work), remoteSha);
    assert.equal(stashList(work), '');
  });
});

test('updateRepo: dirty (tracked+untracked) + behind → updated, working-tree edits restored (SC-002)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const remoteSha = advanceRemote(root, bare);
    fs.writeFileSync(path.join(work, 'tracked.txt'), 'my local edit\n');
    fs.writeFileSync(path.join(work, 'untracked.txt'), 'scratch\n');

    const { result, reason } = await updateRepo(work);

    assert.equal(result, 'updated');
    assert.equal(reason, undefined);
    assert.equal(headSha(work), remoteSha);
    assert.equal(fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8'), 'my local edit\n');
    assert.equal(fs.readFileSync(path.join(work, 'untracked.txt'), 'utf8'), 'scratch\n');
    assert.equal(stashList(work), '');
  });
});

test('updateRepo: local == upstream → already-current (no commits created)', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    const before = headSha(work);
    const { result, reason } = await updateRepo(work);
    assert.equal(result, 'already-current');
    assert.equal(reason, undefined);
    assert.equal(headSha(work), before);
  });
});

test('updateRepo: local ahead only → already-current (HEAD unchanged; push is out of scope)', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    fs.writeFileSync(path.join(work, 'local-ahead.txt'), 'unpushed\n');
    git(work, ['add', 'local-ahead.txt']);
    git(work, ['commit', '-q', '-m', 'ahead']);
    const before = headSha(work);

    const { result, reason } = await updateRepo(work);

    assert.equal(result, 'already-current');
    assert.equal(reason, undefined);
    assert.equal(headSha(work), before);
  });
});

test('updateRepo: diverged (both advanced) + dirty → failed (HEAD unchanged, no merge commit, stash restored)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    advanceRemote(root, bare); // remote advances independently

    fs.writeFileSync(path.join(work, 'local-divergent.txt'), 'diverged\n');
    git(work, ['add', 'local-divergent.txt']);
    git(work, ['commit', '-q', '-m', 'local divergent commit']); // local also advances, independently
    const beforeHead = headSha(work);

    fs.writeFileSync(path.join(work, 'tracked.txt'), 'dirty edit\n');
    fs.writeFileSync(path.join(work, 'untracked.txt'), 'scratch\n');

    const { result, reason } = await updateRepo(work);

    assert.equal(result, 'failed'); // Principle III: never auto-merge a divergence
    assert.equal(reason?.category, 'diverged'); // 013 FR-001/002
    assert.equal(headSha(work), beforeHead); // no merge commit; HEAD untouched
    assert.equal(fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8'), 'dirty edit\n'); // stash restored
    assert.equal(fs.readFileSync(path.join(work, 'untracked.txt'), 'utf8'), 'scratch\n');
    assert.equal(stashList(work), '');
  });
});

test('updateRepo: fetch fails (unreachable remote) → failed, HEAD unchanged, reason carries git detail (FR-003)', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root);
    git(work, ['remote', 'set-url', 'origin', path.join(root, 'does-not-exist.git')]);
    const before = headSha(work);

    const { result, reason } = await updateRepo(work);

    assert.equal(result, 'failed');
    assert.equal(reason?.category, 'fetch-failed');
    assert.ok(reason?.detail && reason.detail.length > 0);
    assert.equal(headSha(work), before);
  });
});

// Regression: a primary and its linked worktrees share ONE `refs/stash` (it lives in the common
// git dir, not per-worktree). Autostashing them concurrently can pop the wrong worktree's entry,
// swapping or losing uncommitted work — a real violation of "never discard uncommitted work"
// (data-model.md, Principle III). updateAll must serialize a family's members instead of running
// every working tree through the pool independently.
test('updateAll: primary + linked worktree (shared stash) update concurrently without swapping or losing dirty edits', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const wtDir = path.join(root, 'wt');
    git(work, ['worktree', 'add', wtDir, '-b', 'wt-branch']);
    git(wtDir, ['push', '-q', '-u', 'origin', 'wt-branch']);

    const primarySha = advanceRemote(root, bare);
    const wtSha = advanceRemoteBranch(root, bare, 'wt-branch', 'wt-remote-advance.txt');

    fs.writeFileSync(path.join(work, 'primary-dirty.txt'), 'primary edit\n');
    fs.writeFileSync(path.join(wtDir, 'worktree-dirty.txt'), 'worktree edit\n');

    const rows: Row[] = [
      {
        kind: 'repository',
        ...trackedEntry(work, 'main'),
        remote: null,
        worktrees: [trackedEntry(wtDir, 'wt-branch')],
      },
    ];

    const outcomes = await updateAll(rows);
    const byPath = new Map(outcomes.map((o) => [o.path, o.result]));

    assert.equal(byPath.get(work), 'updated');
    assert.equal(byPath.get(wtDir), 'updated');
    assert.equal(headSha(work), primarySha);
    assert.equal(headSha(wtDir), wtSha);
    assert.equal(fs.readFileSync(path.join(work, 'primary-dirty.txt'), 'utf8'), 'primary edit\n');
    assert.equal(fs.readFileSync(path.join(wtDir, 'worktree-dirty.txt'), 'utf8'), 'worktree edit\n');
    assert.equal(stashList(work), ''); // stash ref is shared across the family — checking it once suffices
  });
});

test('skipReason: unavailable → unavailable, detached → detached, tracked/no-upstream → undefined (FR-004/005)', () => {
  const unavailable: WorkingTreeEntry = {
    availability: 'unavailable',
    directoryName: 'x',
    fullPath: '~/x',
    collisionFragment: null,
  };
  assert.equal(skipReason(unavailable)?.category, 'unavailable');

  const detached: WorkingTreeEntry = {
    availability: 'ok',
    head: { detached: true },
    local: 0,
    lastChange: null,
    directoryName: 'y',
    fullPath: '~/y',
    collisionFragment: null,
  };
  assert.equal(skipReason(detached)?.category, 'detached');

  assert.equal(skipReason(trackedEntry('~/z', 'main')), undefined); // tracked → never warned when eligible

  const localOnly: WorkingTreeEntry = {
    availability: 'ok',
    head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } },
    local: 0,
    lastChange: null,
    directoryName: 'w',
    fullPath: '~/w',
    collisionFragment: null,
  };
  assert.equal(skipReason(localOnly), undefined); // no tracked upstream → never warned (FR-005)
});
