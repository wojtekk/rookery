import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortRows } from '../src/renderer/view/sort';
import type { Row, WorkingTreeEntry } from '../src/shared/types';

function repo(overrides: Partial<Row> & { directoryName: string }): Row {
  return {
    kind: 'repository',
    availability: 'ok',
    head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } },
    local: 0,
    lastChange: '2026-01-01T00:00:00Z',
    fullPath: `/repos/${overrides.directoryName}`,
    collisionFragment: null,
    remote: null,
    worktrees: [],
    ...overrides,
  } as Row;
}

function worktree(directoryName: string, local: number, availability: 'ok' | 'unavailable' = 'ok'): WorkingTreeEntry {
  const base = { directoryName, fullPath: `/repos/wt/${directoryName}`, collisionFragment: null };
  return availability === 'unavailable'
    ? { ...base, availability: 'unavailable' }
    : {
        ...base,
        availability: 'ok',
        head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } },
        local,
        lastChange: null,
      };
}

test('sortRows: slug ascending, no-remote rows fall back to directoryName tie-break', () => {
  const rows = [
    repo({ directoryName: 'zzz', remote: { host: 'github.com', slug: 'org/zzz' } }),
    repo({ directoryName: 'aaa', remote: { host: 'github.com', slug: 'org/aaa' } }),
    repo({ directoryName: 'no-remote', remote: null }),
  ];
  const sorted = sortRows(rows, 'slug', 'asc').map((r) => r.directoryName);
  assert.deepEqual(sorted, ['no-remote', 'aaa', 'zzz']);
});

test('sortRows: slug ignores owner/organisation, sorts by repository name only', () => {
  const rows = [
    repo({ directoryName: 'banana-repo', remote: { host: 'github.com', slug: 'aaa-org/banana' } }),
    repo({ directoryName: 'apple-repo', remote: { host: 'github.com', slug: 'zzz-org/apple' } }),
  ];
  // Full-slug order would be aaa-org/banana, zzz-org/apple; repo-name order is apple, banana.
  const sorted = sortRows(rows, 'slug', 'asc').map((r) => r.directoryName);
  assert.deepEqual(sorted, ['apple-repo', 'banana-repo']);
});

test('sortRows: slug descending reverses order', () => {
  const rows = [
    repo({ directoryName: 'aaa', remote: { host: 'github.com', slug: 'org/aaa' } }),
    repo({ directoryName: 'zzz', remote: { host: 'github.com', slug: 'org/zzz' } }),
  ];
  const sorted = sortRows(rows, 'slug', 'desc').map((r) => r.directoryName);
  assert.deepEqual(sorted, ['zzz', 'aaa']);
});

test('sortRows: directoryName ascending', () => {
  const rows = [repo({ directoryName: 'beta' }), repo({ directoryName: 'alpha' })];
  const sorted = sortRows(rows, 'directoryName', 'asc').map((r) => r.directoryName);
  assert.deepEqual(sorted, ['alpha', 'beta']);
});

test('sortRows: localCount sums primary + worktrees, unavailable worktrees contribute 0', () => {
  const heavy = repo({
    directoryName: 'heavy',
    local: 1,
    worktrees: [worktree('wt-a', 4), worktree('wt-b', 0, 'unavailable')],
  });
  const light = repo({ directoryName: 'light', local: 2, worktrees: [] });
  const sorted = sortRows([light, heavy], 'localCount', 'desc').map((r) => r.directoryName);
  assert.deepEqual(sorted, ['heavy', 'light']); // heavy = 1 + 4 + 0 = 5 > light = 2
});

test('sortRows: lastChange — unavailable/unborn rows sort last in BOTH directions', () => {
  const withDate = repo({ directoryName: 'has-date', lastChange: '2026-01-01T00:00:00Z' });
  const unbornHead = repo({ directoryName: 'unborn', lastChange: null });
  const timedOut = repo({ directoryName: 'timed-out', availability: 'unavailable' } as Partial<Row> & {
    directoryName: string;
  });

  const asc = sortRows([timedOut, unbornHead, withDate], 'lastChange', 'asc').map((r) => r.directoryName);
  const desc = sortRows([timedOut, unbornHead, withDate], 'lastChange', 'desc').map((r) => r.directoryName);

  assert.equal(asc[asc.length - 1] === 'unborn' || asc[asc.length - 1] === 'timed-out', true);
  assert.deepEqual(asc.slice(-2).sort(), ['timed-out', 'unborn']);
  assert.equal(asc[0], 'has-date');
  assert.deepEqual(desc.slice(-2).sort(), ['timed-out', 'unborn']);
  assert.equal(desc[0], 'has-date');
});

test('sortRows: equal/absent keys break ties by directoryName then fullPath, ascending', () => {
  const a = repo({ directoryName: 'same', fullPath: '/a/same', remote: null });
  const b = repo({ directoryName: 'same', fullPath: '/b/same', remote: null });
  const sorted = sortRows([b, a], 'slug', 'desc'); // even under desc, tie-break stays ascending
  assert.deepEqual(
    sorted.map((r) => r.fullPath),
    ['/a/same', '/b/same'],
  );
});
