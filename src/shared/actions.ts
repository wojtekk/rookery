// Pure action-list logic: limit, seed set, ordered add/edit/remove/move, and `${2}`-enablement.
// No Electron, no DOM — the testable invariants (FR-003 limit, FR-014 reorder, FR-013 disable) live here.
// See specs/002-custom-action-launchers/{data-model.md, research.md R5/R6}.

import type { Action, Remote } from './types';

/** Max configurable actions (FR-003). Single source of truth; the UI reads this constant. */
export const ACTION_LIMIT = 6;

// `${2}` is the raw `git remote get-url origin` value (SSH form `git@host:owner/repo.git`, `ssh://`
// form, or already-https) — per spec, an action needing a browsable page is responsible for its own
// transform. Exported so tests/actions.test.ts can run the identical pipeline without duplicating it.
export const GITHUB_URL_SED = 's#^git@([^:]+):#https://\\1/#; s#^ssh://git@#https://#';

/** Seeded on true first run only (config.ts sentinel = absence of the `actions` key). macOS-form, all editable (FR-012). */
export const DEFAULT_ACTIONS: readonly Action[] = [
  {
    id: 'github',
    name: 'GitHub',
    iconId: 'github',
    command: `u="\${2}"; u="\${u%.git}"; open "$(printf '%s' "$u" | sed -E '${GITHUB_URL_SED}')"`,
  },
  { id: 'intellij', name: 'IntelliJ', iconId: 'intellij', command: 'idea ${1}' },
  { id: 'vscode', name: 'VS Code', iconId: 'vscode', command: 'code ${1}' },
  { id: 'finder', name: 'Finder', iconId: 'finder', command: 'open ${1}' },
  { id: 'terminal', name: 'Terminal', iconId: 'terminal', command: 'open -a Terminal ${1}' },
];

/** True while another action can be added (FR-003). */
export function canAdd(actions: readonly Action[]): boolean {
  return actions.length < ACTION_LIMIT;
}

/** Appends a fully-formed action (id minted by the caller); a no-op at the limit so it can never be exceeded. */
export function add(actions: readonly Action[], action: Action): Action[] {
  return canAdd(actions) ? [...actions, action] : [...actions];
}

/** Replaces the editable fields of the action with matching id, preserving position and id. */
export function edit(actions: readonly Action[], id: string, patch: Omit<Action, 'id'>): Action[] {
  return actions.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

/** Removes the action with matching id (removing the last one leaves `[]` → menu hides, FR-009). */
export function remove(actions: readonly Action[], id: string): Action[] {
  return actions.filter((a) => a.id !== id);
}

function swap(actions: readonly Action[], i: number, j: number): Action[] {
  const next = [...actions];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Moves the action one position toward the front; no-op if first or absent (FR-014). */
export function moveUp(actions: readonly Action[], id: string): Action[] {
  const i = actions.findIndex((a) => a.id === id);
  return i > 0 ? swap(actions, i, i - 1) : [...actions];
}

/** Moves the action one position toward the back; no-op if last or absent (FR-014). */
export function moveDown(actions: readonly Action[], id: string): Action[] {
  const i = actions.findIndex((a) => a.id === id);
  return i >= 0 && i < actions.length - 1 ? swap(actions, i, i + 1) : [...actions];
}

/** True iff the command template references the raw-remote-URL placeholder `${2}` (literal token). */
export function commandUsesRemote(command: string): boolean {
  return command.includes('${2}');
}

/**
 * FR-013: a `${2}`-using action is disabled only on rows with no origin at all (`remote === null`).
 * A present-but-unparseable origin still carries `rawUrl`, so `${2}` stays enabled. Non-`${2}` actions
 * are always enabled. `remote` here is the row's own remote — for a worktree row, its primary's remote.
 */
export function isActionEnabledForRow(action: Action, remote: Remote): boolean {
  if (!commandUsesRemote(action.command)) return true;
  return remote !== null && remote.rawUrl.length > 0;
}
