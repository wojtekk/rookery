// Pure parsers: porcelain v2 status, worktree list, and remote URL. No I/O. See contracts/git-probe.md.

import type { Head, Remote } from '../../shared/types';

export interface ParsedStatus {
  head: Head;
  local: number;
}

/** Parses `git status --porcelain=v2 --branch` output (P2). */
export function parsePorcelainStatusV2(raw: string): ParsedStatus {
  let branch: string | null = null;
  let detached = false;
  let hasUpstream = false;
  let ahead = 0;
  let behind = 0;
  let local = 0;

  for (const line of raw.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const value = line.slice('# branch.head '.length);
      if (value === '(detached)') detached = true;
      else branch = value;
    } else if (line.startsWith('# branch.upstream ')) {
      hasUpstream = true;
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ') || line.startsWith('? ')) {
      local += 1;
    }
  }

  const head: Head = detached
    ? { detached: true }
    : {
        detached: false,
        branch: branch ?? '',
        upstream: hasUpstream ? { tracking: 'tracked', ahead, behind } : { tracking: 'local-only' },
      };

  return { head, local };
}

/** Parses `git worktree list --porcelain` output (P4). Returns every `worktree <path>` line, incl. the primary's own. */
export function parseWorktreeList(raw: string): string[] {
  const paths: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) paths.push(line.slice('worktree '.length));
  }
  return paths;
}

const SCHEME_URL = /^(?:ssh|git|https?):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/;
const SCP_LIKE = /^(?:[^@/]+@)?([^:/]+):(.+)$/;

function toRemote(host: string, rawPath: string): Remote {
  const slug = rawPath.replace(/\/+$/, '').replace(/\.git$/, '').replace(/^\/+/, '');
  return host && slug ? { host, slug } : null;
}

/** Parses a `remote.origin.url` value into `{host, slug}` (P5). `null` for no remote or an unparseable form (FR-006/018). */
export function parseRemoteUrl(url: string | null): Remote {
  if (!url) return null;
  const trimmed = url.trim();

  if (!trimmed.includes('://')) {
    const scp = trimmed.match(SCP_LIKE);
    if (scp) return toRemote(scp[1]!, scp[2]!);
    return null;
  }

  const scheme = trimmed.match(SCHEME_URL);
  if (scheme) return toRemote(scheme[1]!, scheme[2]!);

  return null;
}
