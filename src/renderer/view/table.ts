// Table rendering: primary rows + grouped worktrees, left-edge state indicator + glyph (FR-028),
// name/slug/host, branch+tracking, counts, tooltip, collision fragment, and the per-row ⋮ action menu.

import type { Action, Row, WorkingTreeEntry, Remote, RowState } from '../../shared/types';
import { deriveRowState } from './filter.js';
import { isActionEnabledForRow } from '../../shared/actions.js';
import { iconSvg, iconLabel } from './icons/catalog.js';
import type { SortDimension, SortDirection } from './sort.js';

/** Row-level launch target the renderer forwards to `runAction` (path is the tilde form; main expands it). */
export interface RowActionHandlers {
  onRun: (actionId: string, target: { path: string; remoteUrl: string | null }) => void;
  onDelete: (target: { path: string; isWorktree: boolean; familyPath?: string }) => void;
}

const STATE_ROW_CLASS: Record<RowState, string> = {
  clean: 'r-clean',
  dirty: 'r-dirty',
  'out-of-sync': 'r-sync',
  unavailable: 'r-dead',
};
const STATE_GLYPH_CLASS: Record<RowState, string> = {
  clean: 'g-clean',
  dirty: 'g-dirty',
  'out-of-sync': 'g-sync',
  unavailable: 'g-dead',
};
const STATE_GLYPH_TEXT: Record<RowState, string> = { clean: '', dirty: '', 'out-of-sync': '↑↓', unavailable: '?' };
const STATE_GLYPH_LABEL: Record<RowState, string> = {
  clean: 'clean',
  dirty: 'uncommitted changes',
  'out-of-sync': 'out of sync',
  unavailable: 'unavailable',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function appendText(parent: HTMLElement, className: string, text: string): HTMLElement {
  const node = el('div', className);
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return iso.slice(0, 10); // git's `%cI` is strict ISO 8601, so this is already YYYY-MM-DD
}

function fillBranchCell(cell: HTMLElement, entry: WorkingTreeEntry): void {
  if (entry.availability !== 'ok') {
    appendText(cell, 'branch', '—');
    appendText(cell, 'track', 'unavailable');
    return;
  }
  const { head } = entry;
  if (head.detached) {
    appendText(cell, 'branch', 'detached');
    return;
  }
  appendText(cell, 'branch', head.branch);
  const track = el('div', 'track');
  if (head.upstream.tracking === 'local-only') {
    const tag = el('span', 'tag local');
    tag.textContent = 'local-only';
    track.appendChild(tag);
  } else {
    track.appendChild(document.createTextNode('origin/'));
    const up = el('span', 'up');
    up.textContent = head.branch;
    track.appendChild(up);
  }
  cell.appendChild(track);
}

function buildLocalCell(entry: WorkingTreeEntry): HTMLElement {
  const cell = el('div', 'num');
  const metric = el('span');
  if (entry.availability !== 'ok') {
    metric.className = 'metric m-none';
    metric.textContent = '—';
  } else if (entry.local > 0) {
    metric.className = 'metric m-dirty';
    const n = el('span', 'n');
    n.textContent = String(entry.local);
    metric.appendChild(n);
    metric.appendChild(document.createTextNode(' changed'));
  } else {
    metric.className = 'metric m-none';
    metric.textContent = 'clean';
  }
  cell.appendChild(metric);
  return cell;
}

function buildAbCell(entry: WorkingTreeEntry): HTMLElement {
  const cell = el('div', 'num');
  if (entry.availability !== 'ok') {
    const metric = el('span', 'metric m-none');
    metric.textContent = '—';
    cell.appendChild(metric);
    return cell;
  }
  const { head } = entry;
  if (head.detached || head.upstream.tracking === 'local-only') {
    const metric = el('span', 'metric m-none');
    metric.textContent = 'n/a';
    cell.appendChild(metric);
    return cell;
  }
  const { ahead, behind } = head.upstream;
  if (ahead === 0 && behind === 0) {
    const metric = el('span', 'metric m-none');
    metric.textContent = 'in sync';
    cell.appendChild(metric);
    return cell;
  }
  const ab = el('span', 'ab');
  const up = el('span', `up ${ahead > 0 ? 'm-sync' : 'm-none'}`);
  up.textContent = String(ahead);
  const dn = el('span', `dn ${behind > 0 ? 'm-sync' : 'm-none'}`);
  dn.textContent = String(behind);
  ab.appendChild(up);
  ab.appendChild(dn);
  cell.appendChild(ab);
  return cell;
}

// Per-row action icons: rendered inline (never an overlay, so nothing can be clipped or hidden),
// in configured order (FR-004), disabled for `${2}` actions on remote-less rows (FR-013), and the
// cell is empty when there are no actions (FR-009). `remote` is the row's own remote — for a
// worktree row, its primary's remote (threaded by renderRows).
function buildMenuCell(
  entry: WorkingTreeEntry,
  remote: Remote,
  actions: Action[],
  handlers: RowActionHandlers,
): HTMLElement {
  const cell = el('div', 'menu');
  for (const action of actions) {
    const enabled = isActionEnabledForRow(action, remote);
    const btn = el('button', 'row-action-ico');
    btn.type = 'button';
    btn.innerHTML = iconSvg(action.iconId); // bundled static SVG (no user input) — safe
    // The app's tooltip is CSS-driven via [data-tip] (see styles.css), not the native `title`
    // attribute, to match the row-name tooltip and avoid Electron's unreliable native tooltip timing.
    btn.setAttribute('data-tip', enabled ? action.name : `${action.name} — no remote configured`);
    btn.setAttribute('aria-label', `${action.name} (${iconLabel(action.iconId)})`);

    if (!enabled) {
      btn.disabled = true;
      btn.classList.add('disabled');
    } else {
      btn.addEventListener('click', () =>
        handlers.onRun(action.id, { path: entry.fullPath, remoteUrl: remote?.rawUrl ?? null }),
      );
    }
    cell.appendChild(btn);
  }
  return cell;
}

// Always-visible delete icon (004 FR-001) — its own fixed cell, separate from the
// user-configurable .menu, so it renders on every row regardless of actions.length.
function buildDeleteCell(
  entry: WorkingTreeEntry,
  isWorktree: boolean,
  familyPath: string | undefined,
  handlers: RowActionHandlers,
): HTMLElement {
  const btn = el('button', 'row-delete-ico');
  btn.type = 'button';
  btn.textContent = '×';
  btn.setAttribute('aria-label', 'Delete');
  btn.setAttribute('data-tip', 'Delete');
  btn.addEventListener('click', () => handlers.onDelete({ path: entry.fullPath, isWorktree, familyPath }));
  return btn;
}

function buildRow(
  entry: WorkingTreeEntry,
  remote: Remote,
  defaultHost: string,
  isWorktree: boolean,
  familyPath: string | undefined,
  actions: Action[],
  handlers: RowActionHandlers,
): HTMLElement {
  const state = deriveRowState(entry);
  const row = el('div', `row${isWorktree ? ' wt' : ''} ${STATE_ROW_CLASS[state]}`);
  row.tabIndex = 0;

  const glyphCell = el('div', 'glyph-cell');
  const glyph = el('span', `g ${STATE_GLYPH_CLASS[state]}`);
  glyph.setAttribute('role', 'img');
  glyph.setAttribute('aria-label', STATE_GLYPH_LABEL[state]);
  glyph.textContent = STATE_GLYPH_TEXT[state];
  glyphCell.appendChild(glyph);
  row.appendChild(glyphCell);

  const nameCell = el('div', 'name-cell');
  const name = el('div', 'name');
  name.setAttribute('data-tip', entry.fullPath);
  const dirName = el('span', 'dirname');
  dirName.textContent = entry.directoryName;
  name.appendChild(dirName);
  if (entry.collisionFragment) {
    name.appendChild(document.createTextNode(' '));
    const frag = el('span', 'frag');
    frag.textContent = `…/${entry.collisionFragment}`;
    name.appendChild(frag);
  }
  nameCell.appendChild(name);

  const slug = el('div', 'slug');
  slug.textContent = remote && remote.slug ? remote.slug : entry.directoryName;
  if (remote && remote.host && remote.host !== defaultHost) {
    const host = el('span', 'host ext');
    host.textContent = remote.host;
    slug.appendChild(host);
  }
  nameCell.appendChild(slug);
  row.appendChild(nameCell);

  const branchCell = el('div', 'branch-cell');
  fillBranchCell(branchCell, entry);
  row.appendChild(branchCell);

  row.appendChild(buildLocalCell(entry));
  row.appendChild(buildAbCell(entry));

  appendText(row, 'num changed', entry.availability === 'ok' ? relativeTime(entry.lastChange) : '—');

  row.appendChild(buildMenuCell(entry, remote, actions, handlers));
  row.appendChild(buildDeleteCell(entry, isWorktree, familyPath, handlers));

  return row;
}

export function renderRows(
  listEl: HTMLElement,
  rows: Row[],
  defaultHost: string,
  actions: Action[],
  handlers: RowActionHandlers,
): void {
  listEl.innerHTML = '';
  for (const row of rows) {
    listEl.appendChild(buildRow(row, row.remote, defaultHost, false, undefined, actions, handlers));
    if (row.kind === 'repository') {
      // A worktree row inherits its primary's remote for `${2}` (worktree entries carry no remote of their own).
      // familyPath = the primary's own fullPath, needed to deregister the worktree if its directory ever goes
      // missing (005 data-model.md/research R2/R3) — populated unconditionally, not only when unavailable, to
      // avoid a stale-snapshot race if the directory vanishes between render and click.
      for (const wt of row.worktrees) {
        listEl.appendChild(buildRow(wt, row.remote, defaultHost, true, row.fullPath, actions, handlers));
      }
    }
  }
}

export function updateSortIndicator(theadEl: HTMLElement, dimension: SortDimension, direction: SortDirection): void {
  theadEl.querySelectorAll<HTMLElement>('.sortable[data-sort]').forEach((header) => {
    const active = header.dataset.sort === dimension;
    header.classList.toggle('active', active);
    const arrow = header.querySelector('.arw');
    if (arrow) arrow.textContent = active ? (direction === 'asc' ? '↑' : '↓') : '';
  });
}

export function wireSortHeaders(theadEl: HTMLElement, onSort: (dimension: SortDimension) => void): void {
  theadEl.querySelectorAll<HTMLElement>('.sortable[data-sort]').forEach((header) => {
    header.tabIndex = 0;
    const dimension = header.dataset.sort as SortDimension;
    const activate = (): void => onSort(dimension);
    header.addEventListener('click', activate);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
}
