import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { buildInvocation, launchCommand } from '../src/main/actions/launch';

// Shell-hostile values: if any were spliced into the command text they'd execute or mangle.
const HOSTILE = ['a b', 'a"b', 'a$(touch pwned)b', 'a`id`b', 'a;b', 'a*b', "a'b"];

/** Spawns the REAL invocation but with a piped stdout so we can read the value the command observed. */
function observe(placeholder: '${1}' | '${2}', value: string): Promise<string> {
  const path = placeholder === '${1}' ? value : '/tmp/x';
  const remote = placeholder === '${2}' ? value : null;
  const { shell, argv } = buildInvocation(`printf %s ${placeholder}`, path, remote);
  return new Promise((resolve, reject) => {
    const child = spawn(shell, argv, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', () => resolve(out));
  });
}

test('buildInvocation: values go to argv, never into the command/script text (FR-005)', () => {
  const { argv } = buildInvocation('code ${1}', '/repos/my repo', 'git@github.com:o/r.git');
  // argv = ['-l', '-c', script, $0, $1, $2]
  assert.equal(argv[0], '-l');
  assert.equal(argv[1], '-c');
  assert.equal(argv[2], 'set -f; IFS=; code ${1}'); // template verbatim, no value spliced in
  assert.equal(argv[4], '/repos/my repo'); // $1 = path, intact
  assert.equal(argv[5], 'git@github.com:o/r.git'); // $2 = remote, intact
  assert.ok(!argv[2]!.includes('/repos/my repo'));
  assert.ok(!argv[2]!.includes('github.com'));
});

test('${1} path substitution is intact for shell-hostile values (FR-005)', async () => {
  for (const value of HOSTILE) {
    assert.equal(await observe('${1}', value), value);
  }
});

test('${2} remote substitution is intact for shell-hostile values (FR-005)', async () => {
  for (const value of HOSTILE) {
    assert.equal(await observe('${2}', value), value);
  }
});

test('${2} + null remote precondition returns {ok:false} without launching (FR-013 guard)', async () => {
  const result = await launchCommand('open ${2}', '/repos/r', null);
  assert.equal(result.ok, false);
});

test('non-${2} command with null remote still launches ok', async () => {
  const result = await launchCommand('true', '/repos/r', null);
  assert.equal(result.ok, true);
});

test('a non-existent command resolves {ok:false} within the grace window (exit 127, FR-007/SC-004)', async () => {
  const result = await launchCommand('no-such-cmd-xyz-12345 ${1}', '/repos/r', null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /not found/i);
});
