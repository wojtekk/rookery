// "Pull all" engine (contracts/update.md, data-model.md). Reuses the non-destructive spine of
// the user's upgrade-repo.sh (autostash -> fetch -> ff-only merge -> restore stash) but drops its
// -Xours auto-merge branch: a repo that can't fast-forward is left untouched and reported
// `failed` (Constitution Principle III). Electron-free (like delete.ts) so it stays unit-testable
// with plain `node:test`.

import * as os from 'node:os';
import * as path from 'node:path';
import { runGit } from './git/probe';
import { runPool } from './scan';
import type { Row, RepoUpdateOutcome, UpdateReason, UpdateResult, WorkingTreeEntry } from '../shared/types';

const UPDATE_TIMEOUT_MS = 60000;
const UPDATE_POOL_SIZE = 6;

// ponytail: 500 chars is plenty for a git one-liner error while keeping the tooltip readable;
// raise if a real-world detail turns out to be truncated mid-sentence.
const DETAIL_MAX_LEN = 500;

/** Trims and length-caps an error's underlying git text for `UpdateReason.detail` (FR-003).
 *  stdout comes first: on a rebase conflict, the actionable "CONFLICT (content): Merge conflict
 *  in <file>" line lands on stdout while stderr carries only the generic "could not apply"
 *  summary and --continue/--skip/--abort hints — stdout-first keeps the useful part from being
 *  cut off by the length cap. */
function errorDetail(err: unknown): string | undefined {
  const e = err as { stdout?: string; stderr?: string };
  const text =
    [e?.stdout, e?.stderr]
      .filter((s): s is string => !!s && s.trim() !== '')
      .join('\n')
      .trim() || (err instanceof Error ? err.message : undefined);
  if (!text) return undefined;
  return text.length > DETAIL_MAX_LEN ? text.slice(0, DETAIL_MAX_LEN) + '…' : text;
}

type UpdateOutcome = { result: UpdateResult; reason?: UpdateReason };

// Turns a credential prompt into an immediate error (Principle I: never prompt) for both HTTPS
// and SSH remotes; scan.ts's tildeShorten is duplicated per-module rather than shared, so this
// mirrors that existing convention instead of reaching across to main.ts (which pulls in electron).
export const NON_INTERACTIVE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oStrictHostKeyChecking=accept-new',
  // ponytail: a repo-configured rebase.instructionFormat/hook could otherwise pop an editor mid-rebase and hang.
  GIT_EDITOR: 'true',
  GIT_SEQUENCE_EDITOR: 'true',
};

function expandTilde(p: string): string {
  const home = os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

interface FlatEntry {
  path: string; // tilde-shortened; matches Row.fullPath (RepoUpdateOutcome key)
  entry: WorkingTreeEntry;
}

/** Flattens primaries + their worktrees + orphan worktrees into one list of working trees (FR-008). */
export function flattenWorkingTrees(rows: Row[]): FlatEntry[] {
  const flat: FlatEntry[] = [];
  for (const row of rows) {
    flat.push({ path: row.fullPath, entry: row });
    if (row.kind === 'repository') {
      for (const wt of row.worktrees) flat.push({ path: wt.fullPath, entry: wt });
    }
  }
  return flat;
}

/** available, non-detached, tracked upstream — subsumes "has a remote" and "branch is tracked". */
export function isEligible(entry: WorkingTreeEntry): boolean {
  return entry.availability === 'ok' && !entry.head.detached && entry.head.upstream.tracking === 'tracked';
}

/** Skip sub-reason for an ineligible entry, derived with no new git calls (research Decision 1).
 *  No-tracked-upstream/local-only entries fall through to `undefined` — never warned (FR-005). */
export function skipReason(entry: WorkingTreeEntry): UpdateReason | undefined {
  if (entry.availability !== 'ok') return { category: 'unavailable' };
  if (entry.head.detached) return { category: 'detached' };
  if (entry.head.upstream.tracking === 'gone') return { category: 'upstream-gone' };
  return undefined;
}

type RunOpts = { env: NodeJS.ProcessEnv; timeoutMs?: number };

async function isClean(dir: string, args: string[], opts: RunOpts): Promise<boolean> {
  try {
    await runGit(['-C', dir, ...args], dir, opts);
    return true;
  } catch {
    return false;
  }
}

async function isDirty(dir: string, opts: RunOpts): Promise<boolean> {
  if (!(await isClean(dir, ['diff-files', '--quiet'], opts))) return true;
  if (!(await isClean(dir, ['diff-index', '--cached', '--quiet', 'HEAD'], opts))) return true;
  const untracked = await runGit(['-C', dir, 'ls-files', '--others', '--exclude-standard'], dir, opts);
  return untracked.trim() !== '';
}

async function isAncestor(dir: string, ancestor: string, descendant: string, opts: RunOpts): Promise<boolean> {
  return isClean(dir, ['merge-base', '--is-ancestor', ancestor, descendant], opts);
}

/** Restores autostashed work. Never discards: a pop conflict leaves changes safe in the stash list. */
async function restoreStash(dir: string, stashed: boolean, opts: RunOpts): Promise<boolean> {
  if (!stashed) return true;
  try {
    await runGit(['-C', dir, 'stash', 'pop'], dir, opts);
    return true;
  } catch {
    try {
      await runGit(['-C', dir, 'stash', 'apply', '--index'], dir, opts);
      await runGit(['-C', dir, 'stash', 'drop'], dir, opts);
      return true;
    } catch {
      return false;
    }
  }
}

/** Rebases local commits onto @{u}; on conflict aborts and restores the exact prior state (Principle III). */
async function rebaseOntoUpstream(dir: string, opts: RunOpts): Promise<UpdateOutcome> {
  try {
    await runGit(['-C', dir, 'rebase', '@{u}'], dir, opts);
    return { result: 'updated' };
  } catch (err) {
    // ponytail: this catch also covers a spawn/family timeout killing the rebase mid-flight (FR-011) —
    // either way, aborting clears any in-progress rebase before the outcome is reported.
    try {
      await runGit(['-C', dir, 'rebase', '--abort'], dir, opts);
    } catch {
      // best-effort; nothing more we can do if the abort itself fails
    }
    return { result: 'failed', reason: { category: 'rebase-conflict', detail: errorDetail(err) } };
  }
}

/** fetch + classify (equal/ahead/behind/diverged) + ff-only merge or rebase. Never auto-merges (Principle III). */
async function classifyAndMerge(dir: string, opts: RunOpts): Promise<UpdateOutcome> {
  const upstreamRef = (
    await runGit(['-C', dir, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], dir, opts)
  ).trim();
  const slash = upstreamRef.indexOf('/');
  const remote = upstreamRef.slice(0, slash);
  const branch = upstreamRef.slice(slash + 1);

  try {
    await runGit(['-C', dir, 'fetch', remote, branch], dir, { ...opts, timeoutMs: UPDATE_TIMEOUT_MS });
  } catch (err) {
    return { result: 'failed', reason: { category: 'fetch-failed', detail: errorDetail(err) } };
  }

  const [head, upstream] = (await runGit(['-C', dir, 'rev-parse', 'HEAD', '@{u}'], dir, opts)).trim().split('\n');
  if (head === upstream) return { result: 'already-current' };
  if (await isAncestor(dir, upstream!, head!, opts)) return { result: 'already-current' }; // upstream is an ancestor -> local ahead
  if (!(await isAncestor(dir, head!, upstream!, opts))) return rebaseOntoUpstream(dir, opts); // neither is an ancestor -> diverged: rebase local commits onto upstream

  await runGit(['-C', dir, 'merge', '--ff-only', '@{u}'], dir, opts);
  return { result: 'updated' };
}

async function updateRepoInner(dir: string, opts: RunOpts): Promise<UpdateOutcome> {
  let stashed = false;
  if (await isDirty(dir, opts)) {
    try {
      await runGit(['-C', dir, 'stash', 'push', '--include-untracked', '-m', 'git-manager-update'], dir, opts);
      stashed = true;
    } catch (err) {
      return { result: 'failed', reason: { category: 'stash-failed', detail: errorDetail(err) } };
    }
  }

  let outcome: UpdateOutcome;
  try {
    outcome = await classifyAndMerge(dir, opts);
  } catch (err) {
    outcome = { result: 'failed', reason: { category: 'update-failed', detail: errorDetail(err) } };
  }

  if (await restoreStash(dir, stashed, opts)) return outcome;
  return { result: 'failed', reason: { category: 'stash-failed' } };
}

/** Bounds the whole per-repo sequence so one unreachable remote can never hang the run (FR-013/SC-007). */
export async function updateRepo(absPath: string): Promise<UpdateOutcome> {
  const opts: RunOpts = { env: NON_INTERACTIVE_ENV };
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<UpdateOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ result: 'failed', reason: { category: 'timed-out' } }), UPDATE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([updateRepoInner(absPath, opts), deadline]);
  } catch (err) {
    return { result: 'failed', reason: { category: 'update-failed', detail: errorDetail(err) } };
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Groups working trees that MUST run sequentially: a primary and its linked worktrees share one
 * `refs/stash` (it lives in the common git dir), so autostashing them concurrently can pop the
 * wrong worktree's entry and swap/lose uncommitted work. Each repository row is one such family.
 * Orphan worktrees carry no known common-dir link in `Row` data (no new probing — data-model.md
 * R4), so — conservatively, since it's cheap — every orphan worktree is serialized into one shared
 * family too, in case any of them turn out to share a primary excluded from the observed dirs.
 */
export function groupIntoFamilies(rows: Row[]): FlatEntry[][] {
  const families: FlatEntry[][] = [];
  const orphans: FlatEntry[] = [];
  for (const row of rows) {
    if (row.kind === 'repository') {
      families.push([{ path: row.fullPath, entry: row }, ...row.worktrees.map((wt) => ({ path: wt.fullPath, entry: wt }))]);
    } else {
      orphans.push({ path: row.fullPath, entry: row });
    }
  }
  if (orphans.length > 0) families.push(orphans);
  return families;
}

/**
 * Eligible working trees are pulled through a bounded pool of families (parallel across
 * families, sequential within one — see groupIntoFamilies); every ineligible one is `skipped`.
 */
export async function updateAll(rows: Row[]): Promise<RepoUpdateOutcome[]> {
  const flat = flattenWorkingTrees(rows);
  const eligiblePaths = new Set(flat.filter((f) => isEligible(f.entry)).map((f) => f.path));

  const families = groupIntoFamilies(rows)
    .map((family) => family.filter((f) => eligiblePaths.has(f.path)))
    .filter((family) => family.length > 0);

  const updated = (
    await runPool(families, UPDATE_POOL_SIZE, async (family): Promise<RepoUpdateOutcome[]> => {
      const outcomes: RepoUpdateOutcome[] = [];
      for (const f of family) {
        try {
          const { result, reason } = await updateRepo(expandTilde(f.path));
          outcomes.push({ path: f.path, result, reason });
        } catch (err) {
          outcomes.push({ path: f.path, result: 'failed', reason: { category: 'update-failed', detail: errorDetail(err) } });
        }
      }
      return outcomes;
    })
  ).flat();

  const skipped: RepoUpdateOutcome[] = flat
    .filter((f) => !eligiblePaths.has(f.path))
    .map((f) => ({ path: f.path, result: 'skipped', reason: skipReason(f.entry) }));

  return [...updated, ...skipped];
}

// "Rebase worktrees" engine (contracts/rebase-engine.md, data-model.md §4). Replays each linked
// worktree onto its family's freshly-fetched default branch (`origin/<default>`) — unlike
// updateAll, this targets the *default* branch, not each worktree's own upstream, and includes
// local-only branches (FR-005), so it reuses this module's spine (isDirty/restoreStash/
// NON_INTERACTIVE_ENV/runPool) rather than classifyAndMerge, which is upstream-specific.

/** Decision 2 step 1 (pure): the primary's own checked-out branch, or null when detached/unavailable
 *  (the origin/HEAD fallback needs a git call, so it lives in resolveFamilyDefaultBranch below). */
export function resolveDefaultBranchName(primary: WorkingTreeEntry): string | null {
  if (primary.availability !== 'ok' || primary.head.detached) return null;
  return primary.head.branch;
}

/** Decision 2: primary's branch, else `origin/HEAD`, else the family's default branch is unresolvable. */
async function resolveFamilyDefaultBranch(primaryPath: string, primary: WorkingTreeEntry, opts: RunOpts): Promise<string | null> {
  const fromHead = resolveDefaultBranchName(primary);
  if (fromHead) return fromHead;
  try {
    const ref = (
      await runGit(['-C', primaryPath, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], primaryPath, opts)
    ).trim();
    return ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref;
  } catch {
    return null;
  }
}

/** Linked worktrees only (primaries and orphans excluded) — data-model.md §4/5, for unit tests. */
export function rebaseCandidates(rows: Row[]): FlatEntry[] {
  const flat: FlatEntry[] = [];
  for (const row of rows) {
    if (row.kind === 'repository') {
      for (const wt of row.worktrees) flat.push({ path: wt.fullPath, entry: wt });
    }
  }
  return flat;
}

/** Decision 5 steps 1-3 (pure): unavailable/detached skip, or the on-default no-op skip, or 'run'
 *  (steps 4-5 need a git call — the ancestor check — so they live in the engine below). */
export function worktreeSkipReason(entry: WorkingTreeEntry, defaultBranch: string): UpdateReason | 'run' | 'noop' {
  if (entry.availability !== 'ok') return { category: 'unavailable' };
  if (entry.head.detached) return { category: 'detached' };
  if (entry.head.upstream.tracking === 'gone') return { category: 'upstream-gone' };
  if (entry.head.branch === defaultBranch) return 'noop';
  return 'run';
}

/** Rebases one eligible worktree onto `target` (data-model.md §4 "else" branch) — autostash,
 *  rebase, abort+report on conflict, always restore the stash (Principle III/FR-006/FR-007/FR-010). */
async function rebaseWorktreeOnto(dir: string, target: string, opts: RunOpts): Promise<UpdateOutcome> {
  let stashed = false;
  if (await isDirty(dir, opts)) {
    try {
      await runGit(['-C', dir, 'stash', 'push', '--include-untracked', '-m', 'git-manager-rebase'], dir, opts);
      stashed = true;
    } catch (err) {
      return { result: 'failed', reason: { category: 'stash-failed', detail: errorDetail(err) } };
    }
  }

  let outcome: UpdateOutcome;
  try {
    await runGit(['-C', dir, 'rebase', target], dir, opts);
    outcome = { result: 'updated' };
  } catch (err) {
    try {
      await runGit(['-C', dir, 'rebase', '--abort'], dir, opts);
    } catch {
      // best-effort; nothing more we can do if the abort itself fails
    }
    outcome = { result: 'failed', reason: { category: 'rebase-conflict', detail: errorDetail(err) } };
  }

  if (await restoreStash(dir, stashed, opts)) return outcome;
  return { result: 'failed', reason: { category: 'stash-failed' } };
}

/** Bounds one worktree's whole rebase sequence so one stuck worktree can't hang the run (FR-012),
 *  mirroring updateRepo's per-tree deadline. */
async function rebaseWorktreeBounded(absPath: string, target: string): Promise<UpdateOutcome> {
  const opts: RunOpts = { env: NON_INTERACTIVE_ENV };
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<UpdateOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ result: 'failed', reason: { category: 'timed-out' } }), UPDATE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([rebaseWorktreeOnto(absPath, target, opts), deadline]);
  } catch (err) {
    return { result: 'failed', reason: { category: 'update-failed', detail: errorDetail(err) } };
  } finally {
    clearTimeout(timer!);
  }
}

/** One repository family: resolve the default branch, fetch it once, then rebase each linked
 *  worktree onto it in sequence (Decision 4 — shared refs/stash forbids concurrent autostash). */
async function rebaseFamily(repo: Extract<Row, { kind: 'repository' }>): Promise<RepoUpdateOutcome[]> {
  const opts: RunOpts = { env: NON_INTERACTIVE_ENV };
  const primaryPath = expandTilde(repo.fullPath);
  const outcomes: RepoUpdateOutcome[] = [];

  const defaultBranch = await resolveFamilyDefaultBranch(primaryPath, repo, opts);
  if (!defaultBranch) {
    for (const wt of repo.worktrees) {
      outcomes.push({ path: wt.fullPath, result: 'failed', reason: { category: 'default-branch-unknown' } });
    }
    return outcomes;
  }

  try {
    await runGit(['-C', primaryPath, 'fetch', 'origin', defaultBranch], primaryPath, { ...opts, timeoutMs: UPDATE_TIMEOUT_MS });
  } catch (err) {
    const detail = errorDetail(err);
    for (const wt of repo.worktrees) {
      outcomes.push({ path: wt.fullPath, result: 'failed', reason: { category: 'fetch-failed', detail } });
    }
    return outcomes;
  }

  const target = `origin/${defaultBranch}`;
  for (const wt of repo.worktrees) {
    const classification = worktreeSkipReason(wt, defaultBranch);
    if (classification === 'noop') {
      outcomes.push({ path: wt.fullPath, result: 'skipped' });
      continue;
    }
    if (classification !== 'run') {
      outcomes.push({ path: wt.fullPath, result: 'skipped', reason: classification });
      continue;
    }
    const wtPath = expandTilde(wt.fullPath);
    if (await isAncestor(wtPath, target, 'HEAD', opts)) {
      outcomes.push({ path: wt.fullPath, result: 'already-current' }); // nothing to replay
      continue;
    }
    const { result, reason } = await rebaseWorktreeBounded(wtPath, target);
    outcomes.push({ path: wt.fullPath, result, reason });
  }
  return outcomes;
}

/**
 * Replays every linked worktree onto its family's default branch (contracts/rebase-engine.md).
 * The primary/main worktree is never touched beyond the fetch (FR-004); orphan worktrees have no
 * resolvable default branch and are reported skipped without any git call (Decision 5).
 */
export async function rebaseWorktrees(rows: Row[]): Promise<RepoUpdateOutcome[]> {
  const repoFamilies = rows.filter(
    (r): r is Extract<Row, { kind: 'repository' }> => r.kind === 'repository' && r.worktrees.length > 0,
  );
  const orphanOutcomes: RepoUpdateOutcome[] = rows
    .filter((r) => r.kind === 'orphan-worktree')
    .map((r) => ({ path: r.fullPath, result: 'skipped', reason: { category: 'orphan-worktree' } }));

  const results = await runPool(repoFamilies, UPDATE_POOL_SIZE, rebaseFamily);

  return [...results.flat(), ...orphanOutcomes];
}
