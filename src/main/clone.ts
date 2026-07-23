// Clone engine (contracts/clone-engine.md): the one mutating call in feature 027. Electron-free
// (like update.ts) so it stays unit-testable with plain node:test.

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGit } from './git/probe';
import { NON_INTERACTIVE_ENV } from './update';
import type { CloneOutcome } from '../shared/types';

const CLONE_TIMEOUT_MS = 120000;

function expandTilde(p: string): string {
  const home = os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

// ponytail: 500 chars mirrors update.ts's errorDetail cap — plenty for a git one-liner.
const DETAIL_MAX_LEN = 500;

function errorDetail(err: unknown): string {
  const e = err as { stdout?: string; stderr?: string };
  const text =
    [e?.stdout, e?.stderr]
      .filter((s): s is string => !!s && s.trim() !== '')
      .join('\n')
      .trim() || (err instanceof Error ? err.message : String(err));
  return text.length > DETAIL_MAX_LEN ? text.slice(0, DETAIL_MAX_LEN) + '…' : text;
}

/**
 * The parent directory to start observing after a successful clone (data-model §6 / FR-010): the
 * destination's tilde-expanded parent, or `null` when it's already observed. Pure (tilde-expand +
 * dedup only) so the observed-directory rule is unit-testable without the Electron main process;
 * the actual settings persistence stays in the IPC handler.
 */
export function cloneParentToObserve(destination: string, observedDirectories: string[]): string | null {
  const parent = path.dirname(expandTilde(destination));
  return observedDirectories.includes(parent) ? null : parent;
}

/**
 * Pre-flight check for the modal's proactive warning: does `destination` already exist as a
 * non-empty directory, or as a file? Either way `git clone` would refuse it — this just lets the
 * UI say so before the user clicks Clone rather than only after the subprocess fails.
 */
export async function isDestinationOccupied(destination: string): Promise<boolean> {
  const dest = expandTilde(destination);
  let stat;
  try {
    stat = await fs.stat(dest);
  } catch {
    return false; // doesn't exist — nothing in the way
  }
  if (!stat.isDirectory()) return true; // a file already sits at this exact path
  try {
    return (await fs.readdir(dest)).length > 0;
  } catch {
    // Unreadable (EACCES) or removed between stat and readdir (TOCTOU): this is informational only
    // and must never throw, so degrade to "not occupied" — git itself will refuse if it truly can't clone.
    return false;
  }
}

/**
 * Runs `git clone -- <url> <destination>` (research §7): url/destination are separate argv
 * entries after `--` (Principle V arg-safety, INV-3), non-interactive env so a credential prompt
 * fails loud, and a generous timeout since a real clone can take a while. Never throws across the
 * IPC boundary (FR-011) — git's own refusal of a non-empty existing destination becomes the
 * failure reason, leaving no partial state the app treats as real (INV-1).
 */
export async function cloneRepository(url: string, destination: string): Promise<CloneOutcome> {
  const dest = expandTilde(destination);
  try {
    await runGit(['clone', '--', url, dest], os.homedir(), {
      env: NON_INTERACTIVE_ENV,
      timeoutMs: CLONE_TIMEOUT_MS,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: errorDetail(err) };
  }
}
