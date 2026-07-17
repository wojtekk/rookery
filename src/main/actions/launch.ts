// The feature's one new trust-boundary crossing: turn a user command template + a row's
// (path, remoteUrl) into a running process, passing repo-derived values ONLY as shell positional
// parameters — never spliced into the command text (Constitution v1.4.0, FR-005, contracts/launch.md).

import { spawn } from 'node:child_process';
import { commandUsesRemote } from '../../shared/actions';
import type { RunActionResult } from '../../shared/types';

export interface Invocation {
  shell: string;
  argv: string[];
}

/**
 * Builds the exact `spawn(shell, argv)` invocation. `${1}`/`${2}` in the template are ordinary shell
 * positional-parameter references; the shell binds `$1 = path`, `$2 = remoteUrl` from the trailing argv.
 * `set -f; IFS=;` makes even an unquoted `${1}`/`${2}` word-split-safe and glob-safe (research R1).
 */
export function buildInvocation(command: string, path: string, remoteUrl: string | null): Invocation {
  const shell = process.env.SHELL || '/bin/sh';
  const script = 'set -f; IFS=; ' + command;
  // $0 = shell (conventional), $1 = path, $2 = remoteUrl. Values are argv, never in `script`.
  const argv = ['-l', '-c', script, shell, path, remoteUrl ?? ''];
  return { shell, argv };
}

const NO_REMOTE_REASON = 'This action opens the remote URL, but this repository has no origin configured.';

// Grace window: a fast shell exit (126/127) or spawn error within this window is a launch failure;
// otherwise the command is considered launched (research R2, SC-004 ≤ 2s). 500ms is well under that.
const GRACE_MS = 500;

/**
 * Launches the command non-blocking (detached, stdio ignored). Guards the `${2}`-with-no-remote case
 * (FR-013) so it never runs with an empty value. Resolves `{ok:false, reason}` on a fast failure
 * (command not found / not executable / spawn error), else `{ok:true}` once the grace window elapses.
 */
export function launchCommand(command: string, path: string, remoteUrl: string | null): Promise<RunActionResult> {
  if (commandUsesRemote(command) && remoteUrl === null) {
    return Promise.resolve({ ok: false, reason: NO_REMOTE_REASON });
  }
  const { shell, argv } = buildInvocation(command, path, remoteUrl);
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: RunActionResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    let child;
    try {
      child = spawn(shell, argv, { detached: true, stdio: 'ignore' });
    } catch (err) {
      done({ ok: false, reason: err instanceof Error ? err.message : String(err) });
      return;
    }

    child.on('error', (err) => done({ ok: false, reason: err.message }));
    child.on('exit', (code) => {
      if (code === 127) done({ ok: false, reason: 'Command not found' });
      else if (code === 126) done({ ok: false, reason: 'Command found but not executable' });
      else done({ ok: true }); // exited cleanly (or with an app code) within the window — it launched
    });

    setTimeout(() => {
      if (!settled) {
        child.unref(); // long-lived GUI/terminal — let it outlive the dashboard
        done({ ok: true });
      }
    }, GRACE_MS);
  });
}
