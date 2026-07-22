import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePorcelainStatusV2, parseWorktreeList, parseRemoteUrl } from '../src/main/git/parse';

test('parsePorcelainStatusV2: tracked branch with ahead/behind and dirty files', () => {
  const raw = [
    '# branch.oid abc123',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -3',
    '1 .M N... 100644 100644 100644 aaa bbb tracked-modified.txt',
    '? untracked.txt',
  ].join('\n');
  const { head, local } = parsePorcelainStatusV2(raw);
  assert.deepEqual(head, {
    detached: false,
    branch: 'main',
    upstream: { tracking: 'tracked', ahead: 2, behind: 3 },
  });
  assert.equal(local, 2);
});

test('parsePorcelainStatusV2: local-only branch (no upstream) omits ahead/behind', () => {
  const raw = ['# branch.oid abc123', '# branch.head spike/cache-key'].join('\n');
  const { head, local } = parsePorcelainStatusV2(raw);
  assert.deepEqual(head, { detached: false, branch: 'spike/cache-key', upstream: { tracking: 'local-only' } });
  assert.equal(local, 0);
});

// A configured-but-unreachable upstream (its remote branch was deleted — commonly, the PR already
// merged) prints `branch.upstream` with NO `branch.ab` line, since git can't compute ahead/behind
// without the ref. That's the only porcelain-v2 signal for "gone" (confirmed against `git
// for-each-ref --format=%(upstream:track)`'s literal `[gone]` marker on a real repo).
test('parsePorcelainStatusV2: upstream configured but its remote ref is gone (no branch.ab line)', () => {
  const raw = ['# branch.oid abc123', '# branch.head jobs/pro-client', '# branch.upstream origin/jobs/pro-client'].join(
    '\n',
  );
  const { head } = parsePorcelainStatusV2(raw);
  assert.deepEqual(head, { detached: false, branch: 'jobs/pro-client', upstream: { tracking: 'gone' } });
});

// Regression guard for the above: a genuinely in-sync branch always prints `branch.ab +0 -0`
// explicitly, so it must never be misclassified as 'gone'.
test('parsePorcelainStatusV2: in-sync tracked branch (explicit +0 -0) is never misread as gone', () => {
  const raw = ['# branch.oid abc123', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +0 -0'].join(
    '\n',
  );
  const { head } = parsePorcelainStatusV2(raw);
  assert.deepEqual(head, { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 0 } });
});

test('parsePorcelainStatusV2: detached HEAD', () => {
  const raw = ['# branch.oid abc123', '# branch.head (detached)'].join('\n');
  const { head } = parsePorcelainStatusV2(raw);
  assert.deepEqual(head, { detached: true });
});

test('parsePorcelainStatusV2: clean tree has zero local changes', () => {
  const raw = ['# branch.oid abc123', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +0 -0'].join(
    '\n',
  );
  assert.equal(parsePorcelainStatusV2(raw).local, 0);
});

test('parseWorktreeList: primary + linked worktrees, incl. a detached one', () => {
  const raw = [
    'worktree /Users/me/proj',
    'HEAD abc123',
    'branch refs/heads/main',
    '',
    'worktree /Users/me/proj/.worktrees/fix',
    'HEAD def456',
    'branch refs/heads/fix',
    '',
    'worktree /Users/me/proj/.worktrees/detached',
    'HEAD abc123',
    'detached',
    '',
  ].join('\n');
  assert.deepEqual(parseWorktreeList(raw), [
    '/Users/me/proj',
    '/Users/me/proj/.worktrees/fix',
    '/Users/me/proj/.worktrees/detached',
  ]);
});

// 002 retains the verbatim origin as `rawUrl` (the `${2}` value); parsed cases still expose host/slug.
test('parseRemoteUrl: scp-like SSH', () => {
  assert.deepEqual(parseRemoteUrl('git@github.com:owner/repo.git'), {
    host: 'github.com',
    slug: 'owner/repo',
    rawUrl: 'git@github.com:owner/repo.git',
  });
});

test('parseRemoteUrl: ssh:// with user and port', () => {
  assert.deepEqual(parseRemoteUrl('ssh://git@github.schibsted.io:22/owner/repo.git'), {
    host: 'github.schibsted.io',
    slug: 'owner/repo',
    rawUrl: 'ssh://git@github.schibsted.io:22/owner/repo.git',
  });
});

test('parseRemoteUrl: git://', () => {
  assert.deepEqual(parseRemoteUrl('git://github.com/owner/repo.git'), {
    host: 'github.com',
    slug: 'owner/repo',
    rawUrl: 'git://github.com/owner/repo.git',
  });
});

test('parseRemoteUrl: https:// with userinfo and port', () => {
  assert.deepEqual(parseRemoteUrl('https://user@github.com:443/owner/repo.git'), {
    host: 'github.com',
    slug: 'owner/repo',
    rawUrl: 'https://user@github.com:443/owner/repo.git',
  });
});

test('parseRemoteUrl: nested group slug keeps full path', () => {
  assert.deepEqual(parseRemoteUrl('https://gitlab.com/group/subgroup/repo.git'), {
    host: 'gitlab.com',
    slug: 'group/subgroup/repo',
    rawUrl: 'https://gitlab.com/group/subgroup/repo.git',
  });
});

test('parseRemoteUrl: no remote configured', () => {
  assert.equal(parseRemoteUrl(null), null);
});

// A present-but-unparseable origin still carries a rawUrl, so `${2}` stays enabled for the row (FR-013, R3).
test('parseRemoteUrl: present-but-unparseable (local filesystem path remote) keeps rawUrl', () => {
  assert.deepEqual(parseRemoteUrl('/Volumes/backup/bare-repo.git'), {
    host: null,
    slug: null,
    rawUrl: '/Volumes/backup/bare-repo.git',
  });
});
