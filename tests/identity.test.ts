import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  computeCanonicalIdentity,
  dedupeByIdentity,
  groupFamilies,
  type CanonicalIdentity,
  type IdentifiedEntry,
} from '../src/main/git/identity';

function ident(commonDirReal: string, topLevelReal: string, isPrimary: boolean): CanonicalIdentity {
  return { commonDirReal, topLevelReal, isPrimary };
}

function entry(dir: string, identity: CanonicalIdentity): IdentifiedEntry {
  return { dir, identity };
}

test('computeCanonicalIdentity: resolves a symlinked path to the same identity as the real one (dedup basis)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-identity-'));
  try {
    const realRepo = path.join(root, 'real-repo');
    fs.mkdirSync(path.join(realRepo, '.git'), { recursive: true });
    const linkedRepo = path.join(root, 'linked-repo');
    fs.symlinkSync(realRepo, linkedRepo, 'dir');

    const identity = computeCanonicalIdentity(linkedRepo, {
      ownGitDir: path.join(linkedRepo, '.git'),
      commonGitDir: '.git',
      topLevel: linkedRepo,
    });

    assert.ok(identity);
    assert.equal(identity!.commonDirReal, fs.realpathSync(path.join(realRepo, '.git')));
    assert.equal(identity!.topLevelReal, fs.realpathSync(realRepo));
    assert.equal(identity!.isPrimary, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('computeCanonicalIdentity: a linked worktree (own git-dir != common git-dir) is not primary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-identity-'));
  try {
    const commonGitDir = path.join(root, 'main', '.git');
    fs.mkdirSync(commonGitDir, { recursive: true });
    const ownGitDir = path.join(commonGitDir, 'worktrees', 'fix');
    fs.mkdirSync(ownGitDir, { recursive: true });
    const worktreeDir = path.join(root, 'fix-worktree');
    fs.mkdirSync(worktreeDir, { recursive: true });

    const identity = computeCanonicalIdentity(worktreeDir, { ownGitDir, commonGitDir, topLevel: worktreeDir });

    assert.ok(identity);
    assert.equal(identity!.isPrimary, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('computeCanonicalIdentity: unresolvable paths (deleted on disk) return null', () => {
  const identity = computeCanonicalIdentity('/nonexistent/dir', {
    ownGitDir: '/nonexistent/dir/.git',
    commonGitDir: '.git',
    topLevel: '/nonexistent/dir',
  });
  assert.equal(identity, null);
});

test('dedupeByIdentity: same identity reached via two scan paths dedups to one, deterministic by dir', () => {
  const entries = [
    entry('/obs2/repo-symlink', ident('/real/repo/.git', '/real/repo', true)),
    entry('/obs1/repo', ident('/real/repo/.git', '/real/repo', true)),
  ];
  const result = dedupeByIdentity(entries);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.dir, '/obs1/repo');
});

test('groupFamilies: an in-scope primary + worktree form one family', () => {
  const primary = entry('/obs/repo', ident('/real/repo/.git', '/real/repo', true));
  const wt = entry('/obs/repo/.worktrees/fix', ident('/real/repo/.git', '/real/repo/.worktrees/fix', false));
  const { families, orphanWorktrees } = groupFamilies([wt, primary]);
  assert.equal(families.length, 1);
  assert.equal(families[0]!.primary.dir, '/obs/repo');
  assert.deepEqual(
    families[0]!.worktrees.map((w) => w.dir),
    ['/obs/repo/.worktrees/fix'],
  );
  assert.equal(orphanWorktrees.length, 0);
});

test('groupFamilies: a worktree whose primary is outside observed dirs is an orphan worktree, not grouped (FR-026c)', () => {
  const wt = entry('/obs/only-worktree', ident('/external/repo/.git', '/obs/only-worktree', false));
  const { families, orphanWorktrees } = groupFamilies([wt]);
  assert.equal(families.length, 0);
  assert.equal(orphanWorktrees.length, 1);
  assert.equal(orphanWorktrees[0]!.dir, '/obs/only-worktree');
});

test('groupFamilies: family/orphan ordering is deterministic regardless of discovery order', () => {
  const a = entry('/obs/aaa', ident('/real/a/.git', '/real/a', true));
  const b = entry('/obs/bbb', ident('/real/b/.git', '/real/b', true));
  const forward = groupFamilies([a, b]).families.map((f) => f.primary.dir);
  const reversed = groupFamilies([b, a]).families.map((f) => f.primary.dir);
  assert.deepEqual(forward, ['/obs/aaa', '/obs/bbb']);
  assert.deepEqual(reversed, forward);
});
