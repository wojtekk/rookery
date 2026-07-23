// Pure-helper tests for view/clone-model.ts (contracts/clone-engine.md, data-model.md §8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRepoName, rankCloneCandidates, buildDestination, parseRemoteSlug } from '../src/renderer/view/clone-model';
import type { RemoteRepoSummary } from '../src/shared/types';

// --- deriveRepoName ---

test('deriveRepoName: ssh URL → last segment, .git stripped', () => {
  assert.equal(deriveRepoName('git@github.com:finn/some-repo.git'), 'some-repo');
});

test('deriveRepoName: https URL with .git → last segment, .git stripped', () => {
  assert.equal(deriveRepoName('https://github.com/finn/some-repo.git'), 'some-repo');
});

test('deriveRepoName: https URL without .git → last segment', () => {
  assert.equal(deriveRepoName('https://github.com/finn/some-repo'), 'some-repo');
});

test('deriveRepoName: ssh:// form on a non-github.com host → last segment', () => {
  assert.equal(deriveRepoName('ssh://git@github.schibsted.io/spt/thing.git'), 'thing');
});

test('deriveRepoName: trailing slash → trimmed before extraction', () => {
  assert.equal(deriveRepoName('https://github.com/finn/some-repo/'), 'some-repo');
});

test('deriveRepoName: empty string → null', () => {
  assert.equal(deriveRepoName(''), null);
});

test('deriveRepoName: whitespace-only string → null', () => {
  assert.equal(deriveRepoName('   '), null);
});

test('deriveRepoName: no path segment (no slash or colon) → null', () => {
  assert.equal(deriveRepoName('garbage'), null);
});

test('deriveRepoName: last segment is only ".git" → null (nothing left after stripping)', () => {
  // Guards the Clone-button-enabled gate: must be null (button disabled), never '' (button enabled
  // with an empty repo name → a bogus destination path).
  assert.equal(deriveRepoName('https://github.com/finn/.git'), null);
});

// --- rankCloneCandidates ---

function repo(owner: string, name: string): RemoteRepoSummary {
  return { host: 'github.com', owner, name, sshUrl: `git@github.com:${owner}/${name}.git`, httpsUrl: `https://github.com/${owner}/${name}.git` };
}

test('rankCloneCandidates: name-prefix ranks above name-substring above owner-only', () => {
  const repos = [repo('finn', 'my-dba-tool'), repo('finn', 'dba-service'), repo('dba', 'unrelated')];
  const ranked = rankCloneCandidates(repos, 'dba');
  assert.deepEqual(
    ranked.map((r) => `${r.owner}/${r.name}`),
    ['finn/dba-service', 'finn/my-dba-tool', 'dba/unrelated'],
  );
});

test('rankCloneCandidates: stable order within a tier (input order preserved)', () => {
  const repos = [repo('a', 'dba-one'), repo('b', 'dba-two')];
  const ranked = rankCloneCandidates(repos, 'dba');
  assert.deepEqual(ranked.map((r) => r.name), ['dba-one', 'dba-two']);
});

test('rankCloneCandidates: caps at limit', () => {
  const repos = Array.from({ length: 60 }, (_, i) => repo('org', `repo-${i}`));
  assert.equal(rankCloneCandidates(repos, 'repo').length, 50);
});

test('rankCloneCandidates: empty query → unfiltered head, capped at limit', () => {
  const repos = Array.from({ length: 5 }, (_, i) => repo('org', `repo-${i}`));
  const ranked = rankCloneCandidates(repos, '   ', 3);
  assert.deepEqual(ranked.map((r) => r.name), ['repo-0', 'repo-1', 'repo-2']);
});

test('rankCloneCandidates: no match excludes the repo entirely', () => {
  const repos = [repo('finn', 'tori'), repo('finn', 'blocket')];
  assert.deepEqual(rankCloneCandidates(repos, 'zzz'), []);
});

// --- buildDestination ---

test('buildDestination: single separator join, no trailing slash on dir', () => {
  assert.equal(buildDestination('~/IdeaProjects/finn', 'some-repo'), '~/IdeaProjects/finn/some-repo');
});

test('buildDestination: dir with a trailing slash → no double separator', () => {
  assert.equal(buildDestination('~/IdeaProjects/finn/', 'some-repo'), '~/IdeaProjects/finn/some-repo');
});

// --- parseRemoteSlug ---

test('parseRemoteSlug: ssh scp-like URL', () => {
  assert.deepEqual(parseRemoteSlug('git@github.com:finn/some-repo.git'), { host: 'github.com', slug: 'finn/some-repo' });
});

test('parseRemoteSlug: https URL with .git', () => {
  assert.deepEqual(parseRemoteSlug('https://github.com/finn/some-repo.git'), { host: 'github.com', slug: 'finn/some-repo' });
});

test('parseRemoteSlug: https URL without .git', () => {
  assert.deepEqual(parseRemoteSlug('https://github.com/finn/some-repo'), { host: 'github.com', slug: 'finn/some-repo' });
});

test('parseRemoteSlug: ssh:// scheme form on a non-github.com host', () => {
  assert.deepEqual(parseRemoteSlug('ssh://git@github.schibsted.io/spt/thing.git'), { host: 'github.schibsted.io', slug: 'spt/thing' });
});

test('parseRemoteSlug: empty/whitespace → null', () => {
  assert.equal(parseRemoteSlug(''), null);
  assert.equal(parseRemoteSlug('   '), null);
});

test('parseRemoteSlug: garbage with no host/path structure → null', () => {
  assert.equal(parseRemoteSlug('not-a-url'), null);
});

test('parseRemoteSlug: a URL with a scheme but an unsupported one → null', () => {
  // Contains "://" so it takes the SCHEME_URL branch, but ftp isn't in ssh|git|https? — exercises
  // the scheme-present-but-unparseable null path that feeds the duplicate-clone check.
  assert.equal(parseRemoteSlug('ftp://github.com/finn/repo'), null);
});
