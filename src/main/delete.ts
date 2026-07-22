// Delete risk assessment. See contracts/delete.md and data-model.md. Deliberately free of any
// `electron` import (like actions/launch.ts) so it stays unit-testable with plain `node:test` —
// the dialog/shell-touching orchestration that consumes this lives in main.ts, matching the
// project's existing pattern (pickDirectory/runAction) of keeping electron-touching code there.

import { probeFetch, probeStatus } from './git/probe';
import { parsePorcelainStatusV2 } from './git/parse';

export interface DeleteRiskResult {
  atRisk: boolean;
  reasons: string[];
}

/**
 * Freshly (never cached) determines whether deleting `path` would be destructive
 * (Clarifications, Session 2026-07-17). `hasRemote` gates whether a fetch is attempted at all —
 * a remote-less repo is at-risk on that basis alone, with nothing to fetch.
 */
export async function computeDeleteRisk(path: string, hasRemote: boolean): Promise<DeleteRiskResult> {
  const reasons: string[] = [];

  if (!hasRemote) {
    reasons.push('has no remote configured');
  } else {
    const fetchOk = await probeFetch(path);
    if (!fetchOk) reasons.push('sync status could not be verified');
  }

  const { head, local } = parsePorcelainStatusV2(await probeStatus(path));
  if (local > 0) reasons.push('has uncommitted changes that will be lost');

  // Only meaningful when a remote exists: with no remote at all, every branch is trivially
  // local-only, and "has no remote configured" above already fully captures that risk —
  // adding this too would double-count the same underlying fact as two reasons.
  if (hasRemote && !head.detached) {
    if (head.upstream.tracking === 'local-only') {
      reasons.push('branch has no upstream / has never been pushed');
    } else if (head.upstream.tracking === 'gone') {
      reasons.push('remote branch was deleted — its history is no longer recoverable from origin');
    } else if (head.upstream.ahead > 0) {
      reasons.push('has commits that have not been pushed');
    }
  }

  return { atRisk: reasons.length > 0, reasons };
}
