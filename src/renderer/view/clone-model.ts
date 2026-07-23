// Pure decision logic for the Clone modal (027 data-model.md §8, contracts/clone-engine.md).
// Type-only import, no DOM access — unit-testable from tests/ (research §6 pure/DOM split).

import type { RemoteRepoSummary } from '../../shared/types';

/** Last path segment of an SSH/HTTPS clone URL, `.git` stripped. `null` disables the Clone button. */
export function deriveRepoName(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/\/+$/, '');
  if (!stripped) return null;
  const idx = Math.max(stripped.lastIndexOf('/'), stripped.lastIndexOf(':'));
  if (idx < 0) return null; // no path segment to extract
  let name = stripped.slice(idx + 1);
  if (name.endsWith('.git')) name = name.slice(0, -'.git'.length);
  return name.length > 0 ? name : null;
}

/** Case-insensitive substring match over "owner/name", ranked name-prefix > name-substring >
 *  owner-only, capped at `limit`. Empty/whitespace query returns the unfiltered head. */
export function rankCloneCandidates(
  repos: RemoteRepoSummary[],
  query: string,
  limit = 50,
): RemoteRepoSummary[] {
  const q = query.trim().toLowerCase();
  if (q === '') return repos.slice(0, limit);

  const prefix: RemoteRepoSummary[] = [];
  const substring: RemoteRepoSummary[] = [];
  const ownerOnly: RemoteRepoSummary[] = [];
  for (const repo of repos) {
    const combined = `${repo.owner}/${repo.name}`.toLowerCase();
    if (!combined.includes(q)) continue;
    const name = repo.name.toLowerCase();
    if (name.startsWith(q)) prefix.push(repo);
    else if (name.includes(q)) substring.push(repo);
    else ownerOnly.push(repo);
  }
  return [...prefix, ...substring, ...ownerOnly].slice(0, limit);
}

/** Joins with exactly one separator regardless of a trailing separator on `dir`. */
export function buildDestination(dir: string, repoName: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${repoName}`;
}

// Kept in sync with main/git/parse.ts's parseRemoteUrl host+slug derivation (same regexes, same
// trailing-slash/`.git` stripping) so a pasted clone URL matches existing rows' `Remote.slug`.
// Duplicated rather than imported because the renderer's ESM TS project doesn't compile src/main/;
// nothing (no shared code, no test) enforces the equality — keep these regexes in sync with parse.ts by hand.
const SCP_LIKE = /^(?:[^@/]+@)?([^:/]+):(.+)$/;
const SCHEME_URL = /^(?:ssh|git|https?):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/;

function toHostSlug(host: string, rawPath: string): { host: string; slug: string } | null {
  const slug = rawPath.replace(/\/+$/, '').replace(/\.git$/, '').replace(/^\/+/, '');
  return host && slug ? { host, slug } : null;
}

/** Parses a clone URL (SSH or HTTPS) into `{host, slug}` for matching against an existing row's
 *  `Remote`. `null` when unparseable — the duplicate check simply has nothing to compare. */
export function parseRemoteSlug(url: string): { host: string; slug: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('://')) {
    const scp = trimmed.match(SCP_LIKE);
    return scp ? toHostSlug(scp[1]!, scp[2]!) : null;
  }
  const scheme = trimmed.match(SCHEME_URL);
  return scheme ? toHostSlug(scheme[1]!, scheme[2]!) : null;
}
