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
  let hasAb = false;
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
      hasAb = true;
      const m = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ') || line.startsWith('? ')) {
      local += 1;
    }
  }

  // A configured-but-unreachable upstream (its remote branch was deleted, e.g. after a merged PR)
  // prints `branch.upstream` with NO `branch.ab` line — git can't compute ahead/behind without the
  // ref. That absence is the only porcelain-v2 signal for "gone" (confirmed against `for-each-ref
  // --format=%(upstream:track)`'s `[gone]` marker); a normal up-to-date branch always prints
  // `branch.ab +0 -0` explicitly, so this never misclassifies a genuinely in-sync branch.
  const upstream: Exclude<Head, { detached: true }>['upstream'] = !hasUpstream
    ? { tracking: 'local-only' }
    : hasAb
      ? { tracking: 'tracked', ahead, behind }
      : { tracking: 'gone' };

  const head: Head = detached ? { detached: true } : { detached: false, branch: branch ?? '', upstream };

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

function toRemote(host: string, rawPath: string, rawUrl: string): Remote {
  const slug = rawPath.replace(/\/+$/, '').replace(/\.git$/, '').replace(/^\/+/, '');
  return host && slug ? { host, slug, rawUrl } : { host: null, slug: null, rawUrl };
}

/**
 * Parses a `remote.origin.url` value into a `Remote` (P5). Returns the parsed `{host,slug,rawUrl}`
 * when recognisable; a present-but-unparseable origin still yields `{host:null,slug:null,rawUrl}` so
 * `${2}` has a verbatim value (FR-005, research R3). Only a missing origin yields `null` (FR-006/013/018).
 */
export function parseRemoteUrl(url: string | null): Remote {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('://')) {
    const scp = trimmed.match(SCP_LIKE);
    if (scp) return toRemote(scp[1]!, scp[2]!, trimmed);
    return { host: null, slug: null, rawUrl: trimmed };
  }

  const scheme = trimmed.match(SCHEME_URL);
  if (scheme) return toRemote(scheme[1]!, scheme[2]!, trimmed);

  return { host: null, slug: null, rawUrl: trimmed };
}
