// Real-git-fixture tests for computeDeleteRisk (data-model.md Invariants), following the
// project's existing convention (readonly.test.ts, identity.test.ts) of exercising real git
// subprocesses against temp directories rather than mocking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { computeDeleteRisk } from '../src/main/delete';
import { probeRemoteUrl } from '../src/main/git/probe';

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

/** A bare "remote" plus a clone that's fully pushed and clean — the baseline "safe" fixture. */
function initCleanClone(tmpRoot: string): string {
  const bare = path.join(tmpRoot, 'bare.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  const work = path.join(tmpRoot, 'work');
  initRepo(work);
  git(work, ['remote', 'add', 'origin', bare]);
  git(work, ['push', '-q', '-u', 'origin', 'HEAD']);
  return work;
}

async function withTmp(fn: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-delete-risk-'));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('computeDeleteRisk: clean + remote + fetch-ok + zero-ahead → not at risk', async () => {
  await withTmp(async (root) => {
    const work = initCleanClone(root);
    const result = await computeDeleteRisk(work, true);
    assert.deepEqual(result, { atRisk: false, reasons: [] });
  });
});

test('computeDeleteRisk: dirty alone → at risk with exactly one reason', async () => {
  await withTmp(async (root) => {
    const work = initCleanClone(root);
    fs.writeFileSync(path.join(work, 'tracked.txt'), 'changed\n');
    const result = await computeDeleteRisk(work, true);
    assert.equal(result.atRisk, true);
    assert.deepEqual(result.reasons, ['has uncommitted changes that will be lost']);
  });
});

test('computeDeleteRisk: no remote alone → at risk, and the fetch attempt is skipped (single reason)', async () => {
  await withTmp(async (root) => {
    const work = path.join(root, 'work');
    initRepo(work);
    assert.equal(await probeRemoteUrl(work), null);
    const result = await computeDeleteRisk(work, false);
    // If probeFetch had run despite hasRemote=false it would also fail (no remote to fetch from),
    // adding a second reason — exactly one reason here proves the fetch was never attempted.
    assert.deepEqual(result, { atRisk: true, reasons: ['has no remote configured'] });
  });
});

test('computeDeleteRisk: unreachable remote (fetch fails) alone → at risk with exactly one reason', async () => {
  await withTmp(async (root) => {
    const work = initCleanClone(root);
    git(work, ['remote', 'set-url', 'origin', path.join(root, 'does-not-exist.git')]);
    const result = await computeDeleteRisk(work, true);
    assert.deepEqual(result, { atRisk: true, reasons: ['sync status could not be verified'] });
  });
});

test('computeDeleteRisk: unpushed commits on a tracked branch alone → at risk with exactly one reason', async () => {
  await withTmp(async (root) => {
    const work = initCleanClone(root);
    fs.writeFileSync(path.join(work, 'tracked.txt'), 'more\n');
    git(work, ['commit', '-q', '-am', 'unpushed']);
    const result = await computeDeleteRisk(work, true);
    assert.deepEqual(result, { atRisk: true, reasons: ['has commits that have not been pushed'] });
  });
});

test('computeDeleteRisk: local-only branch (no upstream) on a repo WITH a remote → at risk with exactly one reason', async () => {
  await withTmp(async (root) => {
    const work = initCleanClone(root);
    git(work, ['checkout', '-q', '-b', 'never-pushed']);
    const result = await computeDeleteRisk(work, true);
    // C1 regression guard: a local-only branch has no ahead/behind fields at all and must not be
    // skipped just because it isn't "tracked" — see data-model.md Invariant 5.
    assert.deepEqual(result, { atRisk: true, reasons: ['branch has no upstream / has never been pushed'] });
  });
});

test('computeDeleteRisk: dirty AND no-remote together → at risk with both reasons in one result', async () => {
  await withTmp(async (root) => {
    const work = path.join(root, 'work');
    initRepo(work);
    fs.writeFileSync(path.join(work, 'tracked.txt'), 'changed\n');
    const result = await computeDeleteRisk(work, false);
    assert.equal(result.atRisk, true);
    assert.deepEqual(result.reasons, ['has no remote configured', 'has uncommitted changes that will be lost']);
  });
});
