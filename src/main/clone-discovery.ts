// Repository discovery via the system `gh` CLI (research §1/§3/§4, contracts/clone-engine.md).
// Read-only: never mutates anything, never throws — worst case is searchAvailable:false so the
// modal still opens for a manual-URL clone (FR-012).

import { execFile } from 'node:child_process';
import type { CloneableReposResult, RemoteRepoSummary } from '../shared/types';

const GH_TIMEOUT_MS = 30000;

function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { timeout: GH_TIMEOUT_MS, killSignal: 'SIGKILL', env: process.env }, (err, stdout, stderr) => {
      if (err) {
        (err as Error & { stderr?: string }).stderr = stderr;
        reject(err);
      } else resolve(stdout);
    });
  });
}

/** Host keys with >=1 account at `state === "success"` (research §4). Malformed/empty JSON → []. */
export function parseGhHosts(authStatusJson: string): string[] {
  try {
    const parsed = JSON.parse(authStatusJson) as { hosts?: Record<string, Array<{ state?: string }>> };
    if (!parsed.hosts || typeof parsed.hosts !== 'object') return [];
    return Object.keys(parsed.hosts).filter((host) => (parsed.hosts![host] ?? []).some((acct) => acct?.state === 'success'));
  } catch {
    return [];
  }
}

/** One RemoteRepoSummary per non-empty JSONL line, `host` stamped; a malformed/incomplete line is skipped. */
export function parseGhRepoList(jsonl: string, host: string): RemoteRepoSummary[] {
  const repos: RemoteRepoSummary[] = [];
  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Partial<Record<'owner' | 'name' | 'sshUrl' | 'httpsUrl', string>>;
      if (!obj.owner || !obj.name || !obj.sshUrl || !obj.httpsUrl) continue;
      repos.push({ host, owner: obj.owner, name: obj.name, sshUrl: obj.sshUrl, httpsUrl: obj.httpsUrl });
    } catch {
      // skip malformed line — one bad line never fails the whole parse
    }
  }
  return repos;
}

const REPO_LIST_JQ = '.[] | {owner:.owner.login, name:.name, sshUrl:.ssh_url, httpsUrl:.clone_url}';

async function listReposForHost(host: string): Promise<RemoteRepoSummary[]> {
  const jsonl = await runGh([
    'api',
    '--hostname',
    host,
    '--paginate',
    'user/repos?per_page=100&sort=full_name',
    '--jq',
    REPO_LIST_JQ,
  ]);
  return parseGhRepoList(jsonl, host);
}

/** Drops repos owned by an excluded owner/org (case-insensitive), applied at read time so
 *  editing the exclusion list in Settings takes effect without a fresh `gh` call. */
export function filterExcludedOwners(result: CloneableReposResult, excludedOwners: string[]): CloneableReposResult {
  if (excludedOwners.length === 0 || !result.searchAvailable) return result; // nothing to filter (or no repos at all)
  const excluded = new Set(excludedOwners.map((o) => o.toLowerCase()));
  return { ...result, repos: result.repos.filter((r) => !excluded.has(r.owner.toLowerCase())) };
}

let cached: CloneableReposResult | null = null;

/** Discovers repos across every gh-authenticated host (research §1/§4), cached for the app
 *  session (research §5) until `forceRefresh` bypasses and replaces the cache. */
export async function listCloneableRepos(forceRefresh = false): Promise<CloneableReposResult> {
  if (cached && !forceRefresh) return cached;

  let hosts: string[];
  try {
    hosts = parseGhHosts(await runGh(['auth', 'status', '--json', 'hosts']));
  } catch (err) {
    const notFound = (err as { code?: string }).code === 'ENOENT';
    cached = {
      searchAvailable: false,
      reason: notFound ? 'GitHub CLI (gh) not found on PATH.' : 'Could not run "gh auth status".',
    };
    return cached;
  }

  if (hosts.length === 0) {
    cached = {
      searchAvailable: false,
      reason: 'GitHub CLI is installed but not signed in — run "gh auth login" to enable repository search.',
    };
    return cached;
  }

  const repos: RemoteRepoSummary[] = [];
  const unavailableHosts: string[] = [];
  let anySucceeded = false;
  for (const host of hosts) {
    try {
      repos.push(...(await listReposForHost(host)));
      anySucceeded = true;
    } catch {
      unavailableHosts.push(host);
    }
  }

  cached = anySucceeded
    ? { searchAvailable: true, repos, unavailableHosts }
    : { searchAvailable: false, reason: 'Could not reach any configured GitHub host.' };
  return cached;
}
