import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRowState, filterRows } from '../src/renderer/view/filter';
import type { Row, WorkingTreeEntry } from '../src/shared/types';

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

function repo(directoryName: string, primary: Partial<WorkingTreeEntry> = {}, worktrees: WorkingTreeEntry[] = []): Row {
  return { kind: 'repository', ...entry({ directoryName, fullPath: `/repos/${directoryName}`, ...primary }), remote: null, worktrees };
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
