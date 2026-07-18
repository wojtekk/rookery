// Pure eligibility-filter tests (data-model.md eligibility predicate, US3). No real git needed —
// isEligible/flattenWorkingTrees are pure functions of Row data (mirrors filter.test.ts's style).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenWorkingTrees, isEligible } from '../src/main/update';
import type { Row, WorkingTreeEntry } from '../src/shared/types';

function entry(overrides: Partial<WorkingTreeEntry> & { fullPath: string }): WorkingTreeEntry {
  return {
    availability: 'ok',
    head: { detached: false, branch: 'main', upstream: { tracking: 'tracked', ahead: 0, behind: 0 } },
    local: 0,
    lastChange: null,
    directoryName: overrides.fullPath.split('/').pop()!,
    collisionFragment: null,
    ...overrides,
  } as WorkingTreeEntry;
}

function repoRow(primary: WorkingTreeEntry, worktrees: WorkingTreeEntry[] = []): Row {
  return { kind: 'repository', ...primary, remote: null, worktrees };
}

function orphanRow(primary: WorkingTreeEntry): Row {
  return { kind: 'orphan-worktree', ...primary, remote: null };
}

test('isEligible: tracked + available + non-detached → eligible', () => {
  assert.equal(isEligible(entry({ fullPath: '~/a' })), true);
});

test('isEligible: local-only branch (no remote branch tracked) → ineligible', () => {
  const e = entry({
    fullPath: '~/a',
    head: { detached: false, branch: 'main', upstream: { tracking: 'local-only' } },
  });
  assert.equal(isEligible(e), false);
});

test('isEligible: detached HEAD → ineligible', () => {
  const e = entry({ fullPath: '~/a', head: { detached: true } });
  assert.equal(isEligible(e), false);
});

test('isEligible: unavailable (timed-out probe) → ineligible', () => {
  const e = { availability: 'unavailable', directoryName: 'a', fullPath: '~/a', collisionFragment: null } as WorkingTreeEntry;
  assert.equal(isEligible(e), false);
});

test('flattenWorkingTrees: covers primary, its worktrees, and orphan worktrees; ineligible ones are never handed to the engine', () => {
  const trackedPrimary = entry({ fullPath: '~/repo' });
  const localOnlyWorktree = entry({
    fullPath: '~/repo-wt',
    head: { detached: false, branch: 'wip', upstream: { tracking: 'local-only' } },
  });
  const detachedOrphan = entry({ fullPath: '~/orphan', head: { detached: true } });

  const rows: Row[] = [repoRow(trackedPrimary, [localOnlyWorktree]), orphanRow(detachedOrphan)];
  const flat = flattenWorkingTrees(rows);

  assert.deepEqual(
    flat.map((f) => f.path),
    ['~/repo', '~/repo-wt', '~/orphan'],
  );

  const eligiblePaths = flat.filter((f) => isEligible(f.entry)).map((f) => f.path);
  assert.deepEqual(eligiblePaths, ['~/repo']);
});
