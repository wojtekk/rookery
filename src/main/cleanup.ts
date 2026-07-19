// "Cleanup" engine (contracts/ipc-cleanup.md, data-model.md, research.md D1-D6). Detect-only scan
// (`scanCleanup`) mirrors the user's ~/local/git-cleanup-all.sh's `git fetch -p` + `for-each-ref`
// [gone] detection, extended (per spec.md clarification) to also flag missing-directory and
// merged-branch worktrees via `git worktree list --porcelain`. Removal (`executeCleanup`) acts only
// on the caller's selection, never force-removing a present worktree with local work (Principle III).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGit } from './git/probe';
import { runPool } from './scan';
import { groupIntoFamilies, NON_INTERACTIVE_ENV } from './update';
import type { CleanupCandidate, CleanupOutcome, CleanupResult, CleanupSelection, Row } from '../shared/types';

const CLEANUP_TIMEOUT_MS = 60000;
const CLEANUP_POOL_SIZE = 6;

type RunOpts = { env: NodeJS.ProcessEnv; timeoutMs?: number };
const GIT_OPTS: RunOpts = { env: NON_INTERACTIVE_ENV };

function expandTilde(p: string): string {
  const home = os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

function norm(p: string): string {
  return path.resolve(p);
}

interface WorktreeInfo {
  path: string;
  branch: string | null;
  prunable: boolean;
}

/** Parses `git worktree list --porcelain` (research D2). Blocks are separated by a blank line. */
function parseWorktreeListPorcelain(raw: string): WorktreeInfo[] {
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      let wtPath = '';
      let branch: string | null = null;
      let prunable = false;
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) wtPath = line.slice('worktree '.length).trim();
        else if (line.startsWith('branch ')) {
          const ref = line.slice('branch '.length).trim();
          branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
        } else if (line === 'prunable' || line.startsWith('prunable ')) prunable = true;
      }
      return { path: wtPath, branch, prunable };
    })
    .filter((w) => w.path !== '');
}

/** Default branch = the branch checked out in the main worktree, falling back to origin/HEAD (research D2). */
async function getDefaultBranch(repoPath: string, mainBranch: string | null, opts: RunOpts): Promise<string | null> {
  if (mainBranch) return mainBranch;
  try {
    const ref = (
      await runGit(['-C', repoPath, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repoPath, opts)
    ).trim();
    return ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref;
  } catch {
    return null;
  }
}

async function isMerged(repoPath: string, branch: string, defaultBranch: string, opts: RunOpts): Promise<boolean> {
  try {
    await runGit(['-C', repoPath, 'merge-base', '--is-ancestor', branch, defaultBranch], repoPath, opts);
    return true;
  } catch {
    return false;
  }
}

// A branch that never diverged (e.g. just created, or fully committed nowhere yet) is trivially
// "merged" by `--is-ancestor` even though nothing was ever actually merged — the real risk lives
// in the working tree, not the branch's commit history. Never label an active worktree "merged".
async function isWorktreeDirty(worktreePath: string, opts: RunOpts): Promise<boolean> {
  try {
    const out = await runGit(['-C', worktreePath, 'status', '--porcelain'], worktreePath, opts);
    return out.trim() !== '';
  } catch {
    return true; // can't verify cleanliness — never offer it as safe "merged" cleanup fodder
  }
}

/**
 * Per-repo detection (research D1/D2/D4). Never mutates except the `fetch -p` refresh of
 * remote-tracking refs (Principle II-compliant explicit action). Dedupe precedence:
 * gone-branch > missing-worktree > merged-worktree — a worktree is claimed by at most one reason.
 */
export async function scanRepoCleanup(repoPath: string, repoSlug: string | null = null): Promise<CleanupCandidate[]> {
  await runGit(['-C', repoPath, 'fetch', '-p'], repoPath, { ...GIT_OPTS, timeoutMs: CLEANUP_TIMEOUT_MS });

  const [refsRaw, worktreeRaw] = await Promise.all([
    runGit(
      ['-C', repoPath, 'for-each-ref', '--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)', 'refs/heads/'],
      repoPath,
      GIT_OPTS,
    ),
    runGit(['-C', repoPath, 'worktree', 'list', '--porcelain'], repoPath, GIT_OPTS),
  ]);

  const worktrees = parseWorktreeListPorcelain(worktreeRaw);
  const mainEntry = worktrees[0];
  const linkedWorktrees = worktrees.slice(1);
  const defaultBranch = await getDefaultBranch(repoPath, mainEntry?.branch ?? null, GIT_OPTS);

  const claimed = new Set<string>();
  const candidates: CleanupCandidate[] = [];

  for (const line of refsRaw.split('\n')) {
    if (!line.trim()) continue;
    const [branch, track, worktreepathRaw] = line.split('\t');
    if (track !== '[gone]' || !branch) continue;
    const worktreepath = worktreepathRaw?.trim() || '';
    if (worktreepath && norm(worktreepath) === norm(repoPath)) continue; // main worktree's own branch — never remove

    const wt = worktreepath || null;
    candidates.push({
      repoPath,
      repoSlug,
      reason: 'gone-branch',
      branch,
      worktreePath: wt,
      worktreeDirMissing: wt ? !fs.existsSync(wt) : false,
      id: `${repoPath}::${branch}`,
    });
    if (wt) claimed.add(norm(wt));
  }

  for (const wt of linkedWorktrees) {
    if (claimed.has(norm(wt.path))) continue;

    if (wt.prunable || !fs.existsSync(wt.path)) {
      candidates.push({
        repoPath,
        repoSlug,
        reason: 'missing-worktree',
        branch: null,
        worktreePath: wt.path,
        worktreeDirMissing: true,
        id: `${repoPath}::${wt.path}`,
      });
      continue;
    }

    if (
      defaultBranch &&
      wt.branch &&
      (await isMerged(repoPath, wt.branch, defaultBranch, GIT_OPTS)) &&
      !(await isWorktreeDirty(wt.path, GIT_OPTS))
    ) {
      candidates.push({
        repoPath,
        repoSlug,
        reason: 'merged-worktree',
        branch: null,
        worktreePath: wt.path,
        worktreeDirMissing: false,
        id: `${repoPath}::${wt.path}`,
      });
    }
  }

  return candidates;
}

/** Bounds the whole per-repo scan so one unreachable remote can never hang the run (FR-014). */
async function scanRepoCleanupBounded(repoPath: string, repoSlug: string | null): Promise<CleanupCandidate[]> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<CleanupCandidate[]>((resolve) => {
    timer = setTimeout(() => resolve([]), CLEANUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([scanRepoCleanup(repoPath, repoSlug), deadline]);
  } catch {
    return [];
  } finally {
    clearTimeout(timer!);
  }
}

/** Read-only orchestrator (contracts/ipc-cleanup.md). A repo that errors/times out contributes none. */
export async function scanCleanup(rows: Row[]): Promise<CleanupCandidate[]> {
  const repoRows = rows.filter((r) => r.kind === 'repository');
  const slugByPath = new Map(repoRows.map((r) => [r.fullPath, r.remote && r.remote.slug]));

  const families = groupIntoFamilies(repoRows);
  const results = await runPool(families, CLEANUP_POOL_SIZE, (family) => {
    const primaryPath = family[0]?.path;
    if (!primaryPath) return Promise.resolve<CleanupCandidate[]>([]);
    return scanRepoCleanupBounded(expandTilde(primaryPath), slugByPath.get(primaryPath) ?? null);
  });

  return results.flat();
}

/** Removal command matrix (research D3). `--force` only when the worktree directory is already gone. */
export async function removeCandidate(candidate: CleanupCandidate): Promise<CleanupResult> {
  const repo = expandTilde(candidate.repoPath);
  try {
    if (candidate.worktreePath) {
      const wt = expandTilde(candidate.worktreePath);
      const removeArgs = candidate.worktreeDirMissing
        ? ['-C', repo, 'worktree', 'remove', wt, '--force']
        : ['-C', repo, 'worktree', 'remove', wt];
      try {
        await runGit(removeArgs, repo, GIT_OPTS);
      } catch (err) {
        if (!candidate.worktreeDirMissing) return 'skipped'; // plain remove refused — uncommitted/untracked work
        throw err;
      }
    }

    if (candidate.branch) {
      await runGit(['-C', repo, 'branch', '-D', candidate.branch], repo, GIT_OPTS);
    }
    return 'removed';
  } catch {
    return 'failed';
  }
}

async function removeCandidateBounded(candidate: CleanupCandidate): Promise<CleanupResult> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<CleanupResult>((resolve) => {
    timer = setTimeout(() => resolve('failed'), CLEANUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([removeCandidate(candidate), deadline]);
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer!);
  }
}

function groupSelectionByRepo(selection: CleanupSelection[]): CleanupSelection[][] {
  const byRepo = new Map<string, CleanupSelection[]>();
  for (const item of selection) {
    const group = byRepo.get(item.repoPath);
    if (group) group.push(item);
    else byRepo.set(item.repoPath, [item]);
  }
  return [...byRepo.values()];
}

/** Mutating orchestrator (contracts/ipc-cleanup.md). Acts only on `selection`; empty input is a no-op. */
export async function executeCleanup(selection: CleanupSelection[]): Promise<CleanupOutcome[]> {
  const families = groupSelectionByRepo(selection);
  const results = await runPool(families, CLEANUP_POOL_SIZE, async (family) => {
    const outcomes: CleanupOutcome[] = [];
    for (const candidate of family) {
      outcomes.push({ id: candidate.id, result: await removeCandidateBounded(candidate) });
    }
    return outcomes;
  });
  return results.flat();
}
