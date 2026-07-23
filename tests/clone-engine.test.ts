// Pure gh-output parsers (main/clone-discovery.ts) + real-fixture cloneRepository outcomes
// (main/clone.ts), mirroring rebase-worktrees.test.ts's fixture style. No network is used — a
// local bare repo is the clone source (contracts/clone-engine.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseGhHosts, parseGhRepoList, filterExcludedOwners } from '../src/main/clone-discovery';
import type { RemoteRepoSummary, CloneableReposResult } from '../src/shared/types';
import { cloneRepository, isDestinationOccupied, cloneParentToObserve } from '../src/main/clone';

// --- pure tests: parseGhHosts ---

test('parseGhHosts: returns host keys with >=1 success account', () => {
  const json = JSON.stringify({
    hosts: {
      'github.com': [{ state: 'success', active: true, login: 'wojtekk', host: 'github.com' }],
      'github.schibsted.io': [{ state: 'success', active: true, login: 'wk', host: 'github.schibsted.io' }],
    },
  });
  assert.deepEqual(parseGhHosts(json).sort(), ['github.com', 'github.schibsted.io']);
});

test('parseGhHosts: a host with no success account is excluded', () => {
  const json = JSON.stringify({
    hosts: {
      'github.com': [{ state: 'success', active: true, login: 'wojtekk', host: 'github.com' }],
      'dead.example.com': [{ state: 'error', active: false, login: '', host: 'dead.example.com' }],
    },
  });
  assert.deepEqual(parseGhHosts(json), ['github.com']);
});

test('parseGhHosts: malformed JSON → []', () => {
  assert.deepEqual(parseGhHosts('not json'), []);
});

test('parseGhHosts: empty/missing hosts key → []', () => {
  assert.deepEqual(parseGhHosts('{}'), []);
});

// --- pure tests: parseGhRepoList ---

test('parseGhRepoList: parses JSONL, one repo per line, host stamped', () => {
  const jsonl = [
    JSON.stringify({ owner: 'finn', name: 'tori', sshUrl: 'git@github.com:finn/tori.git', httpsUrl: 'https://github.com/finn/tori.git' }),
    JSON.stringify({ owner: 'finn', name: 'blocket', sshUrl: 'git@github.com:finn/blocket.git', httpsUrl: 'https://github.com/finn/blocket.git' }),
  ].join('\n');
  const repos = parseGhRepoList(jsonl, 'github.com');
  assert.deepEqual(
    repos.map((r) => r.name),
    ['tori', 'blocket'],
  );
  assert.ok(repos.every((r) => r.host === 'github.com'));
});

test('parseGhRepoList: a malformed line is skipped, valid lines still parse', () => {
  const jsonl = ['not json', JSON.stringify({ owner: 'finn', name: 'tori', sshUrl: 'x', httpsUrl: 'y' })].join('\n');
  const repos = parseGhRepoList(jsonl, 'github.com');
  assert.deepEqual(repos.map((r) => r.name), ['tori']);
});

test('parseGhRepoList: a line missing a required field is skipped', () => {
  const jsonl = JSON.stringify({ owner: 'finn', name: 'tori' }); // no sshUrl/httpsUrl
  assert.deepEqual(parseGhRepoList(jsonl, 'github.com'), []);
});

test('parseGhRepoList: blank lines are ignored', () => {
  const jsonl = `\n${JSON.stringify({ owner: 'finn', name: 'tori', sshUrl: 'x', httpsUrl: 'y' })}\n\n`;
  assert.equal(parseGhRepoList(jsonl, 'github.com').length, 1);
});

// --- pure tests: filterExcludedOwners ---

function repo(owner: string, name: string): RemoteRepoSummary {
  return { host: 'github.com', owner, name, sshUrl: `git@github.com:${owner}/${name}.git`, httpsUrl: `https://github.com/${owner}/${name}.git` };
}

test('filterExcludedOwners: drops repos owned by an excluded owner, case-insensitively', () => {
  const result: CloneableReposResult = { searchAvailable: true, repos: [repo('m10s-archive', 'old'), repo('finn', 'tori')], unavailableHosts: [] };
  const filtered = filterExcludedOwners(result, ['M10S-Archive']);
  assert.ok(filtered.searchAvailable);
  if (filtered.searchAvailable) assert.deepEqual(filtered.repos.map((r) => r.owner), ['finn']);
});

test('filterExcludedOwners: empty exclusion list returns the same result unchanged', () => {
  const result: CloneableReposResult = { searchAvailable: true, repos: [repo('finn', 'tori')], unavailableHosts: [] };
  assert.deepEqual(filterExcludedOwners(result, []), result);
});

test('filterExcludedOwners: preserves unavailableHosts on a partial-success result', () => {
  const result: CloneableReposResult = { searchAvailable: true, repos: [repo('m10s-archive', 'old'), repo('finn', 'tori')], unavailableHosts: ['github.schibsted.io'] };
  const filtered = filterExcludedOwners(result, ['m10s-archive']);
  assert.ok(filtered.searchAvailable);
  if (filtered.searchAvailable) {
    assert.deepEqual(filtered.unavailableHosts, ['github.schibsted.io']);
    assert.deepEqual(filtered.repos.map((r) => r.owner), ['finn']);
  }
});

test('filterExcludedOwners: a searchAvailable:false result is returned unchanged (no repos to filter)', () => {
  const result: CloneableReposResult = { searchAvailable: false, reason: 'gh not found' };
  assert.deepEqual(filterExcludedOwners(result, ['m10s-archive']), result);
});

// --- fixture-test helpers (mirrors update.test.ts / rebase-worktrees.test.ts) ---

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

function initBareSource(tmpRoot: string): string {
  const bare = path.join(tmpRoot, 'source.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  const work = path.join(tmpRoot, 'seed-work');
  initRepo(work);
  git(work, ['remote', 'add', 'origin', bare]);
  git(work, ['push', '-q', '-u', 'origin', 'HEAD']);
  return bare;
}

async function withTmp(fn: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-clone-'));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// --- fixture tests: cloneRepository ---

test('cloneRepository: clones a real local repo into a fresh destination', async () => {
  await withTmp(async (root) => {
    const source = initBareSource(root);
    const dest = path.join(root, 'clone-dest');

    const outcome = await cloneRepository(source, dest);

    assert.deepEqual(outcome, { ok: true });
    assert.ok(fs.existsSync(path.join(dest, '.git')));
    assert.ok(fs.existsSync(path.join(dest, 'tracked.txt')));
  });
});

test('cloneRepository: existing non-empty destination → failure, no throw', async () => {
  await withTmp(async (root) => {
    const source = initBareSource(root);
    const dest = path.join(root, 'occupied');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'already-here.txt'), 'pre-existing\n');

    const outcome = await cloneRepository(source, dest);

    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.ok(outcome.reason.length > 0);
    // INV-1: a failed clone leaves no partial state the app treats as real — the pre-existing
    // file is exactly as it was, nothing added.
    assert.deepEqual(fs.readdirSync(dest), ['already-here.txt']);
  });
});

test('cloneRepository: invalid source URL → failure, no throw', async () => {
  await withTmp(async (root) => {
    const dest = path.join(root, 'wont-exist');

    const outcome = await cloneRepository(path.join(root, 'does-not-exist'), dest);

    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.ok(outcome.reason.length > 0);
    assert.equal(fs.existsSync(dest), false); // git cleans up its own aborted clone dir
  });
});

// --- fixture tests: isDestinationOccupied ---

test('isDestinationOccupied: path does not exist → false', async () => {
  await withTmp(async (root) => {
    assert.equal(await isDestinationOccupied(path.join(root, 'does-not-exist')), false);
  });
});

test('isDestinationOccupied: existing empty directory → false', async () => {
  await withTmp(async (root) => {
    const dir = path.join(root, 'empty');
    fs.mkdirSync(dir);
    assert.equal(await isDestinationOccupied(dir), false);
  });
});

test('isDestinationOccupied: existing non-empty directory → true', async () => {
  await withTmp(async (root) => {
    const dir = path.join(root, 'occupied');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'file.txt'), 'content\n');
    assert.equal(await isDestinationOccupied(dir), true);
  });
});

test('isDestinationOccupied: a file already sits at the exact path → true', async () => {
  await withTmp(async (root) => {
    const filePath = path.join(root, 'a-file');
    fs.writeFileSync(filePath, 'content\n');
    assert.equal(await isDestinationOccupied(filePath), true);
  });
});

// --- pure tests: cloneParentToObserve (contract MUST: observed-dir add on success / FR-010 / INV-1) ---

test('cloneParentToObserve: returns the destination parent when not already observed', () => {
  assert.equal(cloneParentToObserve('/Users/me/code/new-repo', ['/Users/me/other']), '/Users/me/code');
});

test('cloneParentToObserve: returns null when the parent is already observed (dedup)', () => {
  assert.equal(cloneParentToObserve('/Users/me/code/new-repo', ['/Users/me/code']), null);
});

test('cloneParentToObserve: expands a leading ~ before deriving and comparing the parent', () => {
  const home = os.homedir();
  assert.equal(cloneParentToObserve('~/code/new-repo', []), path.join(home, 'code'));
  assert.equal(cloneParentToObserve('~/code/new-repo', [path.join(home, 'code')]), null);
});
