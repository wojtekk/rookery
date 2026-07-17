// Non-mutating system-git invocations for one working tree. See contracts/git-probe.md.
// Parsing lives in parse.ts (pure); this module only shells out and returns raw text.

import { execFile } from 'node:child_process';
import type { GitStatus } from '../../shared/types';

// Per-process backstop (contract R3). The family-level deadline (scan.ts) is the
// authoritative bound; this just guarantees no single spawn can outlive it.
export const SPAWN_TIMEOUT_MS = 5000;

export interface RawIdentity {
  ownGitDir: string;
  commonGitDir: string;
  topLevel: string;
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout: SPAWN_TIMEOUT_MS, killSignal: 'SIGKILL' }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function isTimeoutError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { killed?: boolean }).killed === true;
}

/**
 * P1 — validity + identity. `null` when `dir` is not a git working tree (FR-004, fast/expected).
 * `'timeout'` when the call itself hangs (e.g. a stalled network mount) — distinct from `null` so
 * the caller can still surface the directory as unavailable rather than silently dropping it (FR-027).
 */
export async function probeIdentity(dir: string): Promise<RawIdentity | null | 'timeout'> {
  let out: string;
  try {
    out = await runGit(
      ['-C', dir, 'rev-parse', '--is-inside-work-tree', '--absolute-git-dir', '--git-common-dir', '--show-toplevel'],
      dir,
    );
  } catch (err) {
    return isTimeoutError(err) ? 'timeout' : null;
  }
  const [isWorkTree, ownGitDir, commonGitDir, topLevel] = out.split('\n');
  if (isWorkTree !== 'true' || !ownGitDir || !commonGitDir || !topLevel) return null;
  return { ownGitDir, commonGitDir, topLevel };
}

/** P2 — branch, tracking, ahead/behind, dirty count (the linchpin). */
export function probeStatus(dir: string): Promise<string> {
  return runGit(['-C', dir, '--no-optional-locks', 'status', '--porcelain=v2', '--branch'], dir);
}

/** P3 — last change time. `null` on error or unborn HEAD. */
export async function probeLastChange(dir: string): Promise<string | null> {
  try {
    const out = (await runGit(['-C', dir, '--no-optional-locks', 'log', '-1', '--format=%cI'], dir)).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}

/** P4 — linked worktrees (primary only). Raw `worktree <path>` lines, incl. the primary's own. */
export async function probeWorktreeList(dir: string): Promise<string> {
  try {
    return await runGit(['-C', dir, 'worktree', 'list', '--porcelain'], dir);
  } catch {
    return '';
  }
}

/** P5 — remote URL (raw, unparsed). `null` when no `remote.origin.url` is configured. */
export async function probeRemoteUrl(dir: string): Promise<string | null> {
  try {
    const out = (await runGit(['-C', dir, 'config', '--get', 'remote.origin.url'], dir)).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}

const MIN_GIT_MAJOR = 2;
const MIN_GIT_MINOR = 15;

/** Git availability + version floor check (FR-019, research R7). Never falls back to a mutating path. */
export async function getGitVersion(): Promise<GitStatus> {
  let out: string;
  try {
    out = await runGit(['--version'], process.cwd());
  } catch {
    return { available: false, version: null, reason: 'System git was not found on PATH.' };
  }
  const match = out.match(/git version (\d+)\.(\d+)/);
  if (!match) {
    return { available: false, version: null, reason: `Could not parse git version from: ${out.trim()}` };
  }
  const [, majorStr, minorStr] = match;
  const version = `${majorStr}.${minorStr}`;
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (major < MIN_GIT_MAJOR || (major === MIN_GIT_MAJOR && minor < MIN_GIT_MINOR)) {
    return {
      available: false,
      version: null,
      reason: `System git ${version} is older than the required ${MIN_GIT_MAJOR}.${MIN_GIT_MINOR}.`,
    };
  }
  return { available: true, version };
}
