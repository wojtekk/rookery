// Pure decision-logic tests (mirrors update-eligibility.test.ts) + real-git-fixture tests for the
// rebase state machine (mirrors update.test.ts), covering contracts/rebase-engine.md and
// data-model.md §4. Fixture helpers are duplicated per test file, matching the project's existing
// convention (update.test.ts, cleanup.test.ts, delete-risk.test.ts each keep their own copies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  rebaseWorktrees,
  rebaseCandidates,
  worktreeSkipReason,
  resolveDefaultBranchName,
} from '../src/main/update';
import type { Row, WorkingTreeEntry } from '../src/shared/types';

// --- pure-test helpers (mirrors update-eligibility.test.ts) ---

function entry(fullPath: string, branch: string, tracking: 'tracked' | 'local-only' | 'gone' = 'tracked'): WorkingTreeEntry {
  const upstream =
    tracking === 'tracked'
      ? ({ tracking: 'tracked', ahead: 0, behind: 0 } as const)
      : tracking === 'local-only'
        ? ({ tracking: 'local-only' } as const)
        : ({ tracking: 'gone' } as const);
  return {
    availability: 'ok',
    head: { detached: false, branch, upstream },
    local: 0,
    lastChange: null,
    directoryName: path.basename(fullPath),
    fullPath,
    collisionFragment: null,
  };
}

function unavailableEntry(fullPath: string): WorkingTreeEntry {
  return {
    availability: 'unavailable' as const,
    directoryName: path.basename(fullPath),
    fullPath,
    collisionFragment: null,
  } as WorkingTreeEntry;
}

function detachedHeadEntry(fullPath: string): WorkingTreeEntry {
  return {
    availability: 'ok',
    head: { detached: true },
    local: 0,
    lastChange: null,
    directoryName: path.basename(fullPath),
    fullPath,
    collisionFragment: null,
  };
}

function repoRow(primaryPath: string, primaryBranch: string, worktrees: WorkingTreeEntry[]): Row {
  return { kind: 'repository', ...entry(primaryPath, primaryBranch), remote: null, worktrees };
}

function detachedRepoRow(primaryPath: string, worktrees: WorkingTreeEntry[]): Row {
  return { kind: 'repository', ...detachedHeadEntry(primaryPath), remote: null, worktrees };
}

function orphanRow(fullPath: string): Row {
  return { kind: 'orphan-worktree', ...entry(fullPath, 'x'), remote: null };
}

// --- pure tests: resolveDefaultBranchName ---

test('resolveDefaultBranchName: primary on a branch → that branch name', () => {
  assert.equal(resolveDefaultBranchName(entry('~/repo', 'main')), 'main');
});

test('resolveDefaultBranchName: primary detached → null (origin/HEAD fallback needs a git call)', () => {
  assert.equal(resolveDefaultBranchName(detachedHeadEntry('~/repo')), null);
});

test('resolveDefaultBranchName: primary unavailable → null', () => {
  assert.equal(resolveDefaultBranchName(unavailableEntry('~/repo')), null);
});

// --- pure tests: rebaseCandidates ---

test('rebaseCandidates: linked worktrees only — primaries and orphans excluded', () => {
  const primary = entry('~/repo', 'main');
  const wt1 = entry('~/repo-wt1', 'feature-1');
  const wt2 = entry('~/repo-wt2', 'feature-2', 'local-only');
  const orphan = entry('~/orphan', 'whatever');

  const rows: Row[] = [{ kind: 'repository', ...primary, remote: null, worktrees: [wt1, wt2] }, orphanRow(orphan.fullPath)];
  const candidates = rebaseCandidates(rows);

  assert.deepEqual(
    candidates.map((c) => c.path),
    ['~/repo-wt1', '~/repo-wt2'],
  );
});

// --- pure tests: worktreeSkipReason ---

test('worktreeSkipReason: unavailable working tree → { category: unavailable }', () => {
  const e = { availability: 'unavailable', directoryName: 'x', fullPath: '~/x', collisionFragment: null } as WorkingTreeEntry;
  const result = worktreeSkipReason(e, 'main');
  assert.deepEqual(result, { category: 'unavailable' });
});

test('worktreeSkipReason: detached HEAD → { category: detached }', () => {
  const result = worktreeSkipReason(detachedHeadEntry('~/wt'), 'main');
  assert.deepEqual(result, { category: 'detached' });
});

test('worktreeSkipReason: gone upstream (remote branch deleted) → { category: upstream-gone }', () => {
  const result = worktreeSkipReason(entry('~/wt', 'jobs/pro-client', 'gone'), 'main');
  assert.deepEqual(result, { category: 'upstream-gone' });
});

test('worktreeSkipReason: branch equals the default branch → noop (on-default, never warned)', () => {
  assert.equal(worktreeSkipReason(entry('~/wt', 'main'), 'main'), 'noop');
});

test('worktreeSkipReason: local-only branch different from default → run (FR-005: eligible, unlike updateAll)', () => {
  assert.equal(worktreeSkipReason(entry('~/wt', 'wip', 'local-only'), 'main'), 'run');
});

test('worktreeSkipReason: tracked branch different from default → run', () => {
  assert.equal(worktreeSkipReason(entry('~/wt', 'feature', 'tracked'), 'main'), 'run');
});

// --- fixture-test helpers (mirrors update.test.ts) ---

function git(root: string, args: string[]): void {
  execFileSync('git', ['-C', root, ...args]);
}

function headSha(dir: string): string {
  return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim();
}

function stashList(dir: string): string {
  return execFileSync('git', ['-C', dir, 'stash', 'list']).toString().trim();
}

/** Resolves a worktree's real (possibly linked) git-dir, needed since a linked worktree's own
 *  `.git` is a file, not a directory — its rebase-merge/rebase-apply admin dirs live under the
 *  common git dir's `worktrees/<name>/` instead. */
function gitDirOf(dir: string): string {
  const out = execFileSync('git', ['-C', dir, 'rev-parse', '--git-dir']).toString().trim();
  return path.isAbsolute(out) ? out : path.resolve(dir, out);
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

function initCleanClone(tmpRoot: string): { work: string; bare: string } {
  const bare = path.join(tmpRoot, 'bare.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  const work = path.join(tmpRoot, 'work');
  initRepo(work);
  git(work, ['remote', 'add', 'origin', bare]);
  git(work, ['push', '-q', '-u', 'origin', 'HEAD']);
  return { work, bare };
}

function advanceRemoteBranch(tmpRoot: string, bare: string, branch: string, fileName: string): string {
  const scratch = fs.mkdtempSync(path.join(tmpRoot, 'advance-'));
  execFileSync('git', ['clone', '-q', '-b', branch, bare, scratch]);
  git(scratch, ['config', 'user.email', 'test@example.com']);
  git(scratch, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(scratch, fileName), 'advanced\n');
  git(scratch, ['add', fileName]);
  git(scratch, ['commit', '-q', '-m', 'advance']);
  git(scratch, ['push', '-q']);
  return headSha(scratch);
}

function defaultBranch(bare: string): string {
  return execFileSync('git', ['-C', bare, 'symbolic-ref', '--short', 'HEAD']).toString().trim();
}

function advanceRemote(tmpRoot: string, bare: string): string {
  return advanceRemoteBranch(tmpRoot, bare, defaultBranch(bare), 'remote-advance.txt');
}

async function withTmp(fn: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-rebase-'));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// --- fixture tests: happy paths (US1, T010) ---

test('rebaseWorktrees: local-only worktree is rebased onto the freshly-fetched default branch (FR-005, SC-001)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-local');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']); // never pushed — local-only
    fs.writeFileSync(path.join(wtDir, 'wip.txt'), 'local work\n');
    git(wtDir, ['add', 'wip.txt']);
    git(wtDir, ['commit', '-q', '-m', 'local commit']);

    const remoteSha = advanceRemote(root, bare);

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip', 'local-only')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'updated');
    assert.equal(outcome?.reason, undefined);
    assert.equal(execFileSync('git', ['-C', wtDir, 'rev-parse', 'HEAD^']).toString().trim(), remoteSha);
    assert.equal(execFileSync('git', ['-C', wtDir, 'rev-list', '--merges', 'HEAD']).toString().trim(), '');
  });
});

test('rebaseWorktrees: tracked worktree is rebased onto the family default, not its own untouched upstream (US1 scenario 2)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-tracked');
    git(work, ['worktree', 'add', wtDir, '-b', 'feature']);
    git(wtDir, ['push', '-q', '-u', 'origin', 'feature']); // its own upstream, never advanced

    const remoteSha = advanceRemote(root, bare); // only the default branch advances

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'feature')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'updated');
    assert.equal(headSha(wtDir), remoteSha); // landed on the default, not merely its own unchanged upstream
  });
});

test('rebaseWorktrees: worktree already atop the default branch → already-current, no mutation', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-current');
    git(work, ['worktree', 'add', wtDir, '-b', 'feature']);
    const before = headSha(wtDir);

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'feature')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'already-current');
    assert.equal(outcome?.reason, undefined);
    assert.equal(headSha(wtDir), before);
  });
});

test('rebaseWorktrees: a worktree entry already on the default branch is skipped without any git call (Decision 5 step 3)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-ondefault');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']); // real checkout differs from the claimed branch
    const before = headSha(wtDir);

    // The entry claims to already be on the default branch — classification must trust this data
    // and never run a git command against the worktree to verify it.
    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, dflt)])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'skipped');
    assert.equal(outcome?.reason, undefined);
    assert.equal(headSha(wtDir), before); // untouched
  });
});

test('rebaseWorktrees: gone-upstream worktree is skipped without attempting a rebase (its remote branch was deleted)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-gone');
    git(work, ['worktree', 'add', wtDir, '-b', 'jobs/pro-client']);

    // A commit that WOULD conflict if a rebase were attempted — makes the "never even tried"
    // assertion below meaningful rather than true by coincidence.
    fs.writeFileSync(path.join(wtDir, 'tracked.txt'), 'would conflict if rebased\n');
    git(wtDir, ['add', 'tracked.txt']);
    git(wtDir, ['commit', '-q', '-m', 'local commit']);
    advanceRemoteBranch(root, bare, dflt, 'tracked.txt'); // remote edits the same file/line
    const before = headSha(wtDir);

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'jobs/pro-client', 'gone')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'skipped');
    assert.equal(outcome?.reason?.category, 'upstream-gone');
    assert.equal(headSha(wtDir), before); // never attempted — no rebase, no mutation, no conflict
  });
});

test('rebaseWorktrees: dirty (tracked+untracked) worktree behind default → updated, edits restored (FR-006, SC-004)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-dirty');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);
    const remoteSha = advanceRemote(root, bare);
    fs.writeFileSync(path.join(wtDir, 'tracked.txt'), 'dirty edit\n');
    fs.writeFileSync(path.join(wtDir, 'untracked.txt'), 'scratch\n');

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'updated');
    assert.equal(headSha(wtDir), remoteSha);
    assert.equal(fs.readFileSync(path.join(wtDir, 'tracked.txt'), 'utf8'), 'dirty edit\n');
    assert.equal(fs.readFileSync(path.join(wtDir, 'untracked.txt'), 'utf8'), 'scratch\n');
    assert.equal(stashList(wtDir), '');
  });
});

// --- fixture tests: failure paths (US2, T012) ---

test('rebaseWorktrees: conflicting worktree is left byte-for-byte untouched and reported failed/rebase-conflict (FR-007/008/009, SC-003)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    fs.writeFileSync(path.join(work, 'other.txt'), 'other original\n');
    git(work, ['add', 'other.txt']);
    git(work, ['commit', '-q', '-m', 'add other.txt']);
    git(work, ['push', '-q']);

    const wtDir = path.join(root, 'wt-conflict');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);

    advanceRemoteBranch(root, bare, dflt, 'tracked.txt'); // remote edits tracked.txt's only line

    fs.writeFileSync(path.join(wtDir, 'tracked.txt'), 'local conflicting edit\n');
    git(wtDir, ['add', 'tracked.txt']);
    git(wtDir, ['commit', '-q', '-m', 'local conflicting commit']);
    const beforeHead = headSha(wtDir);
    const beforeLog = execFileSync('git', ['-C', wtDir, 'log', '--format=%H']).toString().trim();

    fs.writeFileSync(path.join(wtDir, 'other.txt'), 'dirty edit\n');
    fs.writeFileSync(path.join(wtDir, 'untracked.txt'), 'scratch\n');

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'failed');
    assert.equal(outcome?.reason?.category, 'rebase-conflict');
    // git writes the actionable "CONFLICT (content): Merge conflict in <file>" line to stdout,
    // not stderr — the tooltip detail must include it, not just stderr's generic hint text.
    assert.match(outcome?.reason?.detail ?? '', /CONFLICT/);
    assert.match(outcome?.reason?.detail ?? '', /tracked\.txt/);
    assert.equal(headSha(wtDir), beforeHead); // HEAD restored exactly
    assert.equal(execFileSync('git', ['-C', wtDir, 'log', '--format=%H']).toString().trim(), beforeLog);
    assert.equal(fs.readFileSync(path.join(wtDir, 'tracked.txt'), 'utf8'), 'local conflicting edit\n');
    assert.equal(fs.readFileSync(path.join(wtDir, 'other.txt'), 'utf8'), 'dirty edit\n');
    assert.equal(fs.readFileSync(path.join(wtDir, 'untracked.txt'), 'utf8'), 'scratch\n');
    assert.ok(!fs.existsSync(path.join(gitDirOf(wtDir), 'rebase-merge')));
    assert.ok(!fs.existsSync(path.join(gitDirOf(wtDir), 'rebase-apply')));
    assert.equal(stashList(wtDir), '');
  });
});

test('rebaseWorktrees: clean rebase but stash-pop collides → failed/stash-failed, work preserved (FR-010)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);

    fs.writeFileSync(path.join(work, 'tracked.txt'), 'line1\nline2\nline3\n');
    git(work, ['add', 'tracked.txt']);
    git(work, ['commit', '-q', '-m', 'expand tracked.txt']);
    git(work, ['push', '-q']);

    const wtDir = path.join(root, 'wt-stashfail');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);

    const scratch = fs.mkdtempSync(path.join(root, 'advance-'));
    execFileSync('git', ['clone', '-q', bare, scratch]);
    git(scratch, ['config', 'user.email', 'test@example.com']);
    git(scratch, ['config', 'user.name', 'Test']);
    fs.writeFileSync(path.join(scratch, 'tracked.txt'), 'line1\nline2-remote\nline3\n');
    git(scratch, ['add', 'tracked.txt']);
    git(scratch, ['commit', '-q', '-m', 'remote edits line2']);
    git(scratch, ['push', '-q']);

    // Local diverges on a DIFFERENT file, so the rebase itself applies cleanly.
    fs.writeFileSync(path.join(wtDir, 'local-divergent.txt'), 'diverged\n');
    git(wtDir, ['add', 'local-divergent.txt']);
    git(wtDir, ['commit', '-q', '-m', 'local divergent commit']);

    // Uncommitted edit to the SAME line the remote changed, based on pre-rebase content — collides
    // once popped onto the post-rebase tree.
    fs.writeFileSync(path.join(wtDir, 'tracked.txt'), 'line1\nline2-dirty\nline3\n');

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'failed');
    assert.equal(outcome?.reason?.category, 'stash-failed');
    assert.ok(stashList(wtDir).length > 0); // never lost — recoverable from the stash
  });
});

test('rebaseWorktrees: family fetch fails → every worktree failed/fetch-failed, not rebased onto a stale ref', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt-unreachable');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);
    git(work, ['remote', 'set-url', 'origin', path.join(root, 'does-not-exist.git')]);
    const before = headSha(wtDir);

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'failed');
    assert.equal(outcome?.reason?.category, 'fetch-failed');
    assert.ok(outcome?.reason?.detail && outcome.reason.detail.length > 0);
    assert.equal(headSha(wtDir), before);
  });
});

test('rebaseWorktrees: unresolvable default branch (primary detached, no origin/HEAD) → failed/default-branch-unknown', async () => {
  await withTmp(async (root) => {
    const { work } = initCleanClone(root); // manual remote add + push never sets origin/HEAD
    const wtDir = path.join(root, 'wt-nodefault');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);
    const before = headSha(wtDir);

    const rows: Row[] = [detachedRepoRow(work, [entry(wtDir, 'wip')])];
    const outcomes = await rebaseWorktrees(rows);
    const outcome = outcomes.find((o) => o.path === wtDir);

    assert.equal(outcome?.result, 'failed');
    assert.equal(outcome?.reason?.category, 'default-branch-unknown');
    assert.equal(headSha(wtDir), before); // no git call attempted against it
  });
});

test('rebaseWorktrees: orphan worktree rows are skipped without any git call (Decision 5)', async () => {
  const rows: Row[] = [orphanRow('~/definitely/does/not/exist')];
  const outcomes = await rebaseWorktrees(rows);
  assert.deepEqual(outcomes, [
    { path: '~/definitely/does/not/exist', result: 'skipped', reason: { category: 'orphan-worktree' } },
  ]);
});

// --- fixture tests: never lose work, never touch the primary (US3, T013/T014) ---

test("rebaseWorktrees: the primary's working tree and local default branch are unchanged after a run (FR-004, SC-005)", async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);
    const wtDir = path.join(root, 'wt');
    git(work, ['worktree', 'add', wtDir, '-b', 'wip']);
    advanceRemote(root, bare);

    const primaryHeadBefore = headSha(work);
    const primaryFileBefore = fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8');

    const rows: Row[] = [repoRow(work, dflt, [entry(wtDir, 'wip')])];
    await rebaseWorktrees(rows);

    assert.equal(headSha(work), primaryHeadBefore); // local default branch unchanged — only origin/<default> moved
    assert.equal(fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8'), primaryFileBefore);
    assert.equal(execFileSync('git', ['-C', work, 'symbolic-ref', '--short', 'HEAD']).toString().trim(), dflt);
  });
});

test('rebaseWorktrees: no uncommitted work is lost across updated/already-current/conflict outcomes in one run (SC-004)', async () => {
  await withTmp(async (root) => {
    const { work, bare } = initCleanClone(root);
    const dflt = defaultBranch(bare);

    // second tracked file, pushed pre-divergence, dirtied later without being part of the conflict
    fs.writeFileSync(path.join(work, 'other.txt'), 'other original\n');
    git(work, ['add', 'other.txt']);
    git(work, ['commit', '-q', '-m', 'add other.txt']);
    git(work, ['push', '-q']);

    const wtUpdated = path.join(root, 'wt-updated');
    git(work, ['worktree', 'add', wtUpdated, '-b', 'wip-updated']);
    const wtConflict = path.join(root, 'wt-conflict');
    git(work, ['worktree', 'add', wtConflict, '-b', 'wip-conflict']);

    advanceRemoteBranch(root, bare, dflt, 'tracked.txt'); // remote edits tracked.txt's only line

    // wt-conflict: local commit on the same line as the remote edit
    fs.writeFileSync(path.join(wtConflict, 'tracked.txt'), 'local conflicting edit\n');
    git(wtConflict, ['add', 'tracked.txt']);
    git(wtConflict, ['commit', '-q', '-m', 'local conflicting commit']);

    // wt-current: branched AFTER fetching the advance, so it's already atop the default (no replay)
    git(work, ['fetch', 'origin']);
    const wtCurrent = path.join(root, 'wt-current');
    git(work, ['worktree', 'add', wtCurrent, '-b', 'wip-current', `origin/${dflt}`]);

    // dirty (uncommitted) edits on all three, to a file untouched by the conflict
    fs.writeFileSync(path.join(wtUpdated, 'other.txt'), 'updated-dirty\n');
    fs.writeFileSync(path.join(wtCurrent, 'other.txt'), 'current-dirty\n');
    fs.writeFileSync(path.join(wtConflict, 'other.txt'), 'conflict-dirty\n');

    const rows: Row[] = [
      repoRow(work, dflt, [entry(wtUpdated, 'wip-updated'), entry(wtCurrent, 'wip-current'), entry(wtConflict, 'wip-conflict')]),
    ];
    const outcomes = await rebaseWorktrees(rows);
    const byPath = new Map(outcomes.map((o) => [o.path, o]));

    assert.equal(byPath.get(wtUpdated)?.result, 'updated');
    assert.equal(fs.readFileSync(path.join(wtUpdated, 'other.txt'), 'utf8'), 'updated-dirty\n');

    assert.equal(byPath.get(wtCurrent)?.result, 'already-current');
    assert.equal(fs.readFileSync(path.join(wtCurrent, 'other.txt'), 'utf8'), 'current-dirty\n');

    assert.equal(byPath.get(wtConflict)?.result, 'failed');
    assert.equal(byPath.get(wtConflict)?.reason?.category, 'rebase-conflict');
    assert.equal(fs.readFileSync(path.join(wtConflict, 'other.txt'), 'utf8'), 'conflict-dirty\n');
    assert.equal(fs.readFileSync(path.join(wtConflict, 'tracked.txt'), 'utf8'), 'local conflicting edit\n');
  });
});
