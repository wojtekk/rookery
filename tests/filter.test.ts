import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRowState, filterRows, isGone } from '../src/renderer/view/filter';
import type { Remote, Row, WorkingTreeEntry } from '../src/shared/types';

function entry(overrides: Partial<WorkingTreeEntry> = {}): WorkingTreeEntry {
  return {
    availability: 'ok',
    head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } },
    local: 0,
    lastChange: null,
    directoryName: 'repo',
    fullPath: '/repos/repo',
    collisionFragment: null,
    ...overrides,
  } as WorkingTreeEntry;
}

function repo(
  directoryName: string,
  primary: Partial<WorkingTreeEntry> = {},
  worktrees: WorkingTreeEntry[] = [],
  remote: Remote = null,
): Row {
  return { kind: 'repository', ...entry({ directoryName, fullPath: `/repos/${directoryName}`, ...primary }), remote, worktrees };
}

test('deriveRowState: unavailable takes precedence over everything else', () => {
  assert.equal(deriveRowState(entry({ availability: 'unavailable' })), 'unavailable');
});

test('deriveRowState: dirty wins over out-of-sync (FR-028)', () => {
  const state = deriveRowState(
    entry({ local: 3, head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 1, behind: 2 } } }),
  );
  assert.equal(state, 'dirty');
});

test('deriveRowState: out-of-sync when clean but ahead or behind', () => {
  const ahead = entry({ local: 0, head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 1, behind: 0 } } });
  const behind = entry({ local: 0, head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 1 } } });
  assert.equal(deriveRowState(ahead), 'out-of-sync');
  assert.equal(deriveRowState(behind), 'out-of-sync');
});

test('deriveRowState: clean when in sync with no local changes', () => {
  const inSync = entry({ local: 0, head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 0 } } });
  const localOnly = entry({ local: 0, head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } } });
  assert.equal(deriveRowState(inSync), 'clean');
  assert.equal(deriveRowState(localOnly), 'clean');
});

// 'gone' is deliberately NOT a RowState (filter.ts) — a gone-upstream branch keeps whatever
// clean/dirty/out-of-sync colour its other properties dictate; 'gone' surfaces only via the
// branch cell's tag and this sibling filter, never by hijacking the row edge colour.
test('deriveRowState: gone upstream, otherwise clean → still clean (gone is not a RowState)', () => {
  const goneButClean = entry({ local: 0, head: { detached: false, branch: 'wip', upstream: { tracking: 'gone' } } });
  assert.equal(deriveRowState(goneButClean), 'clean');
});

test('isGone: true only for an available, non-detached branch whose upstream tracking is gone', () => {
  assert.equal(isGone(entry({ head: { detached: false, branch: 'wip', upstream: { tracking: 'gone' } } })), true);
  assert.equal(isGone(entry({ head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 0 } } })), false);
  assert.equal(isGone(entry({ head: { detached: true } })), false);
  assert.equal(isGone(entry({ availability: 'unavailable' })), false);
});

test("filterRows: 'gone' matches by upstream tracking, independent of RowState", () => {
  const rows = [
    repo('a', { head: { detached: false, branch: 'wip', upstream: { tracking: 'gone' } } }),
    repo('b', { head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 0 } } }),
  ];
  assert.deepEqual(filterRows(rows, 'gone', true).map((r) => r.directoryName), ['a']);
});

test("filterRows: 'gone' surfaces a family when only a hidden worktree's branch is gone", () => {
  const rows = [
    repo('clean-primary', {}, [
      entry({ directoryName: 'gone-wt', fullPath: '/repos/gone-wt', head: { detached: false, branch: 'wip', upstream: { tracking: 'gone' } } }),
    ]),
  ];
  const result = filterRows(rows, 'gone', true) as Array<Row & { worktrees: WorkingTreeEntry[] }>;
  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0]!.worktrees.map((w) => w.directoryName),
    ['gone-wt'],
  );
});

test('filterRows: "all" keeps every row and every worktree when shown', () => {
  const rows = [repo('a', {}, [entry({ directoryName: 'a-wt' })])];
  const result = filterRows(rows, 'all', true);
  assert.equal(result.length, 1);
  assert.equal((result[0] as Row & { worktrees: WorkingTreeEntry[] }).worktrees.length, 1);
});

test('filterRows: hiding worktrees drops nested entries but keeps the primary (FR-024)', () => {
  const rows = [repo('a', {}, [entry({ directoryName: 'a-wt', local: 5 })])];
  const result = filterRows(rows, 'all', false);
  assert.equal(result.length, 1);
  assert.deepEqual((result[0] as Row & { worktrees: WorkingTreeEntry[] }).worktrees, []);
});

test('filterRows: a family surfaces when only a worktree matches the filter, showing just that worktree', () => {
  const rows = [
    repo(
      'clean-primary',
      { local: 0 },
      [entry({ directoryName: 'dirty-wt', local: 3 }), entry({ directoryName: 'clean-wt', local: 0 })],
    ),
  ];
  const result = filterRows(rows, 'dirty', true) as Array<Row & { worktrees: WorkingTreeEntry[] }>;
  assert.equal(result.length, 1); // primary itself is clean but surfaces because a child matches
  assert.deepEqual(
    result[0]!.worktrees.map((w) => w.directoryName),
    ['dirty-wt'],
  );
});

test('filterRows: a family with no matching primary or worktree is dropped entirely', () => {
  const rows = [repo('all-clean', { local: 0 }, [entry({ directoryName: 'also-clean', local: 0 })])];
  assert.deepEqual(filterRows(rows, 'dirty', true), []);
});

test('filterRows: unavailable rows are filtered by the "unavailable" state', () => {
  const rows: Row[] = [
    { kind: 'repository', ...entry({ directoryName: 'dead', availability: 'unavailable' }), remote: null, worktrees: [] },
    repo('alive', { local: 0 }),
  ];
  const result = filterRows(rows, 'unavailable', true);
  assert.deepEqual(result.map((r) => r.directoryName), ['dead']);
});

test('filterRows: orphan-worktree rows filter by their own state (no children to consider)', () => {
  const orphan: Row = { kind: 'orphan-worktree', ...entry({ directoryName: 'orphan', local: 2 }), remote: null };
  assert.deepEqual(filterRows([orphan], 'dirty', true).map((r) => r.directoryName), ['orphan']);
  assert.deepEqual(filterRows([orphan], 'clean', true), []);
});

test("filterRows: 'failed' matches by failedPaths membership, not RowState — others are excluded", () => {
  const rows = [repo('a'), repo('b')];
  const failedPaths = new Set(['/repos/a']);
  const result = filterRows(rows, 'failed', true, failedPaths);
  assert.deepEqual(result.map((r) => r.directoryName), ['a']);
});

test("filterRows: 'failed' surfaces a family when only a hidden worktree's path is in failedPaths", () => {
  const rows = [repo('clean-primary', { local: 0 }, [entry({ directoryName: 'failed-wt', fullPath: '/repos/failed-wt' })])];
  const failedPaths = new Set(['/repos/failed-wt']);
  const result = filterRows(rows, 'failed', true, failedPaths) as Array<Row & { worktrees: WorkingTreeEntry[] }>;
  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0]!.worktrees.map((w) => w.directoryName),
    ['failed-wt'],
  );
});

test("filterRows: 'failed' matches an orphan-worktree directly", () => {
  const orphan: Row = { kind: 'orphan-worktree', ...entry({ directoryName: 'orphan', fullPath: '/repos/orphan' }), remote: null };
  assert.deepEqual(filterRows([orphan], 'failed', true, new Set(['/repos/orphan'])).map((r) => r.directoryName), ['orphan']);
});

test("filterRows: 'failed' with an empty failedPaths set returns nothing", () => {
  const rows = [repo('a'), repo('b')];
  assert.deepEqual(filterRows(rows, 'failed', true, new Set()), []);
});

test('filterRows: omitting the failedPaths argument behaves exactly as before 007 (default-parameter regression guard)', () => {
  const rows = [repo('a', { local: 3 }), repo('b', { local: 0 })];
  assert.deepEqual(filterRows(rows, 'dirty', true).map((r) => r.directoryName), ['a']);
  assert.deepEqual(filterRows(rows, 'failed', true), []);
});

// --- 016: search ---

test('filterRows: search matches directoryName case-insensitively', () => {
  const rows = [repo('Frontend-App'), repo('backend-api')];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), 'FRONT').map((r) => r.directoryName), ['Frontend-App']);
});

test('filterRows: search matches the remote slug', () => {
  const rows = [
    repo('a', {}, [], { host: 'github.com', slug: 'org/widgets', rawUrl: 'git@github.com:org/widgets.git' }),
    repo('b'),
  ];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), 'widgets').map((r) => r.directoryName), ['a']);
});

test('filterRows: search matches the origin rawUrl even when the slug is unparseable', () => {
  const rows = [repo('a', {}, [], { host: null, slug: null, rawUrl: '/Users/me/bare-repo' }), repo('b')];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), 'bare-repo').map((r) => r.directoryName), ['a']);
});

test('filterRows: search matches the current branch', () => {
  const rows = [
    repo('a', { head: { detached: false, branch: 'feature/login', upstream: { tracking: 'local-only' } } }),
    repo('b'),
  ];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), 'login').map((r) => r.directoryName), ['a']);
});

test('filterRows: whitespace-only search is inactive (full list)', () => {
  const rows = [repo('a'), repo('b')];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), '   ').map((r) => r.directoryName), ['a', 'b']);
});

test('filterRows: omitting searchQuery matches passing an empty string (empty-query regression guard)', () => {
  const rows = [repo('a', { local: 3 }), repo('b', { local: 0 })];
  assert.deepEqual(filterRows(rows, 'dirty', true, new Set()), filterRows(rows, 'dirty', true, new Set(), ''));
});

test('filterRows: a repo-level search match surfaces ALL its worktrees', () => {
  const rows = [repo('matching-name', {}, [entry({ directoryName: 'wt-1' }), entry({ directoryName: 'wt-2' })])];
  const result = filterRows(rows, 'all', true, new Set(), 'matching') as Array<Row & { worktrees: WorkingTreeEntry[] }>;
  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0]!.worktrees.map((w) => w.directoryName),
    ['wt-1', 'wt-2'],
  );
});

test('filterRows: a worktree-only branch match surfaces the parent with just that worktree', () => {
  const rows = [
    repo('primary', {}, [
      entry({ directoryName: 'wt-a', head: { detached: false, branch: 'hotfix-9', upstream: { tracking: 'local-only' } } }),
      entry({ directoryName: 'wt-b' }),
    ]),
  ];
  const result = filterRows(rows, 'all', true, new Set(), 'hotfix-9') as Array<Row & { worktrees: WorkingTreeEntry[] }>;
  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0]!.worktrees.map((w) => w.directoryName),
    ['wt-a'],
  );
});

test('filterRows: search hides a family with no match in the repo or any worktree', () => {
  const rows = [repo('primary', {}, [entry({ directoryName: 'wt-a' })])];
  assert.deepEqual(filterRows(rows, 'all', true, new Set(), 'nonexistent'), []);
});

test('filterRows: search ANDs with the state filter', () => {
  const rows = [repo('dirty-match', { local: 3 }), repo('clean-match', { local: 0 })];
  assert.deepEqual(filterRows(rows, 'dirty', true, new Set(), 'match').map((r) => r.directoryName), ['dirty-match']);
});

test('filterRows: search ANDs with the failed filter', () => {
  const rows = [repo('alpha'), repo('beta')];
  const failedPaths = new Set(['/repos/alpha']);
  assert.deepEqual(filterRows(rows, 'failed', true, failedPaths, 'alpha').map((r) => r.directoryName), ['alpha']);
  assert.deepEqual(filterRows(rows, 'failed', true, failedPaths, 'beta'), []);
});

test('filterRows: search matches an orphan-worktree by its own name, branch, or remote', () => {
  const orphan: Row = {
    kind: 'orphan-worktree',
    ...entry({ directoryName: 'stray' }),
    remote: { host: 'github.com', slug: 'org/stray-repo', rawUrl: 'git@github.com:org/stray-repo.git' },
  };
  assert.deepEqual(filterRows([orphan], 'all', true, new Set(), 'stray-repo').map((r) => r.directoryName), ['stray']);
  assert.deepEqual(filterRows([orphan], 'all', true, new Set(), 'no-match'), []);
});
