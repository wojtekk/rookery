// Contract test (contracts/git-probe.md): the full probe sequence MUST NOT rewrite .git/index,
// even under the "racy stat" condition where git would otherwise opportunistically flush it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { probeIdentity, probeStatus, probeLastChange, probeWorktreeList, probeRemoteUrl } from '../src/main/git/probe';

function initFixture(root: string): void {
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'content\n');
  execFileSync('git', ['-C', root, 'add', 'tracked.txt']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'initial']);
}

/** Rewrites the tracked file with identical content but a new mtime — diff is empty, but the
 * index's cached stat info for it is now stale, which is exactly what triggers git's opportunistic
 * index rewrite that `--no-optional-locks` is meant to suppress. */
function staleStatCache(root: string): void {
  const file = path.join(root, 'tracked.txt');
  fs.writeFileSync(file, fs.readFileSync(file));
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(file, future, future);
}

function indexStat(root: string): { mtimeMs: number; size: number } {
  const stat = fs.statSync(path.join(root, '.git', 'index'));
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

test('read-only guarantee: the full probe sequence leaves .git/index untouched (SC-005)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-readonly-'));
  try {
    initFixture(root);
    staleStatCache(root);
    const before = indexStat(root);

    await probeIdentity(root);
    await probeStatus(root);
    await probeLastChange(root);
    await probeWorktreeList(root);
    await probeRemoteUrl(root);

    assert.deepEqual(indexStat(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('control: plain `git status` DOES rewrite .git/index on the same racy-stat fixture', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-readonly-control-'));
  try {
    initFixture(root);
    staleStatCache(root);
    const before = indexStat(root);

    execFileSync('git', ['-C', root, 'status']);

    assert.notDeepEqual(indexStat(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
