import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  ACTION_LIMIT,
  DEFAULT_ACTIONS,
  GITHUB_URL_SED,
  canAdd,
  add,
  edit,
  remove,
  moveUp,
  moveDown,
  commandUsesRemote,
  isActionEnabledForRow,
} from '../src/shared/actions';
import type { Action, Remote } from '../src/shared/types';

function action(id: string, command = `echo ${id}`): Action {
  return { id, name: id, iconId: 'terminal', command };
}

const ids = (actions: readonly Action[]): string[] => actions.map((a) => a.id);

test('DEFAULT_ACTIONS: the five seeds in order (FR-012)', () => {
  assert.deepEqual(
    DEFAULT_ACTIONS.map((a) => [a.name, a.command]),
    [
      ['GitHub', `u="\${2}"; u="\${u%.git}"; open "$(printf '%s' "$u" | sed -E '${GITHUB_URL_SED}')"`],
      ['IntelliJ', 'idea ${1}'],
      ['VS Code', 'code ${1}'],
      ['Finder', 'open ${1}'],
      ['Terminal', 'open -a Terminal ${1}'],
    ],
  );
});

test('DEFAULT_ACTIONS: GitHub command still uses the literal ${2} token (FR-013 disable detection)', () => {
  assert.equal(commandUsesRemote(DEFAULT_ACTIONS[0]!.command), true);
});

test('GITHUB_URL_SED: converts SSH-form and ssh:// remotes to https, leaves https as-is (SC-GitHub)', () => {
  const toHttps = (rawUrl: string): string => {
    const result = spawnSync('sh', ['-c', `u=$1; u=\${u%.git}; printf '%s' "$u" | sed -E '${GITHUB_URL_SED}'`, 'sh', rawUrl]);
    return result.stdout.toString();
  };
  assert.equal(toHttps('git@github.com:owner/repo.git'), 'https://github.com/owner/repo');
  assert.equal(toHttps('ssh://git@github.schibsted.io/owner/repo.git'), 'https://github.schibsted.io/owner/repo');
  assert.equal(toHttps('https://github.com/owner/repo.git'), 'https://github.com/owner/repo');
  assert.equal(toHttps('https://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('add: ACTION_LIMIT is never exceeded (FR-003)', () => {
  let list: Action[] = [];
  for (let i = 0; i < ACTION_LIMIT + 3; i++) list = add(list, action(`a${i}`));
  assert.equal(list.length, ACTION_LIMIT);
  assert.equal(canAdd(list), false);
  // adding at the limit is a no-op, not a throw
  assert.deepEqual(ids(add(list, action('overflow'))), ids(list));
});

test('canAdd: true below the limit, false at it', () => {
  assert.equal(canAdd([]), true);
  assert.equal(canAdd(Array.from({ length: ACTION_LIMIT - 1 }, (_, i) => action(`a${i}`))), true);
  assert.equal(canAdd(Array.from({ length: ACTION_LIMIT }, (_, i) => action(`a${i}`))), false);
});

test('edit: replaces fields but keeps id and position', () => {
  const list = [action('a'), action('b'), action('c')];
  const edited = edit(list, 'b', { name: 'B!', iconId: 'vscode', command: 'code ${1}' });
  assert.deepEqual(ids(edited), ['a', 'b', 'c']);
  assert.deepEqual(edited[1], { id: 'b', name: 'B!', iconId: 'vscode', command: 'code ${1}' });
});

test('remove: drops the id; removing the last leaves [] (FR-009)', () => {
  assert.deepEqual(ids(remove([action('a'), action('b')], 'a')), ['b']);
  assert.deepEqual(remove([action('only')], 'only'), []);
});

test('moveUp / moveDown: exactly one adjacent swap, no-op at the ends (FR-014)', () => {
  const list = [action('a'), action('b'), action('c')];
  assert.deepEqual(ids(moveUp(list, 'b')), ['b', 'a', 'c']);
  assert.deepEqual(ids(moveDown(list, 'b')), ['a', 'c', 'b']);
  // no-ops at the ends and for an unknown id
  assert.deepEqual(ids(moveUp(list, 'a')), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveDown(list, 'c')), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveUp(list, 'zzz')), ['a', 'b', 'c']);
});

test('commandUsesRemote: only the literal ${2} token', () => {
  assert.equal(commandUsesRemote('open ${2}'), true);
  assert.equal(commandUsesRemote('code ${1}'), false);
  assert.equal(commandUsesRemote('open -a Terminal ${1}'), false);
});

test('isActionEnabledForRow: FR-013 disable matrix', () => {
  const remoteCmd = action('gh', 'open ${2}');
  const localCmd = action('code', 'code ${1}');
  const parsed: Remote = { host: 'github.com', slug: 'o/r', rawUrl: 'git@github.com:o/r.git' };
  const unparseable: Remote = { host: null, slug: null, rawUrl: '/Volumes/backup/bare.git' };
  const none: Remote = null;

  // ${2} command: enabled whenever an origin URL exists (parsed OR unparseable), disabled only with no origin
  assert.equal(isActionEnabledForRow(remoteCmd, parsed), true);
  assert.equal(isActionEnabledForRow(remoteCmd, unparseable), true);
  assert.equal(isActionEnabledForRow(remoteCmd, none), false);

  // non-${2} command: always enabled, even with no origin
  assert.equal(isActionEnabledForRow(localCmd, parsed), true);
  assert.equal(isActionEnabledForRow(localCmd, none), true);
});
