// Table rendering: primary rows + grouped worktrees, left-edge state indicator + glyph (FR-028),
// name/slug/host, branch+tracking, counts, tooltip, collision fragment, and the per-row ⋮ action menu.

import type { Action, Row, WorkingTreeEntry, Remote, RowState, UpdateReason, UpdateReasonCategory } from '../../shared/types';
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

// Plain-language lead line for the warn icon's tooltip (013 data-model.md "Category → sentence").
// Non-colour cue (Principle IV): the icon + this text identify the row, not the red tint alone.
const REASON_SENTENCE: Record<UpdateReasonCategory, string> = {
  diverged: 'Update blocked — diverged from upstream, fast-forward not possible',
  'fetch-failed': "Update blocked — couldn't reach the remote",
  'stash-failed': "Update blocked — local changes couldn't be safely stashed",
  'timed-out': 'Update blocked — timed out',
  'update-failed': 'Update blocked — failed unexpectedly',
  'rebase-conflict': 'Update blocked — rebase hit a conflict; resolve it in your merge tool',
  unavailable: 'Update skipped — working tree unavailable',
  detached: 'Update skipped — not on a branch (detached HEAD)',
};

function warnTooltip(reason: UpdateReason): string {
  const sentence = REASON_SENTENCE[reason.category];
  return reason.detail ? `${sentence}\n\n${reason.detail}` : sentence;
}

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

// Wraps the first case-insensitive match of `query` in `text` with a <mark class="search-hit">
// (016). Built from text nodes, never innerHTML — text is git-controlled (dir/branch/slug names),
// so this can't be trusted as markup.
function renderHighlighted(parent: HTMLElement, text: string, query: string): void {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) {
    parent.textContent = text;
    return;
  }
  parent.textContent = '';
  parent.appendChild(document.createTextNode(text.slice(0, idx)));
  const mark = el('mark', 'search-hit');
  mark.textContent = text.slice(idx, idx + query.length);
  parent.appendChild(mark);
  parent.appendChild(document.createTextNode(text.slice(idx + query.length)));
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

// Branch line (first line of the branch-tracking cell) as a flex row: [truncatable text] +
// [warn icon: flex-shrink:0] — same pattern as .name's .dirname/.frag, so a long branch name
// truncates before the icon ever clips (styles.css).
function buildBranchLine(text: string, reason: UpdateReason | undefined, searchQuery: string): HTMLElement {
  const line = el('div', 'branch');
  const label = el('span', 'branch-text');
  renderHighlighted(label, text, searchQuery);
  line.appendChild(label);
  if (reason) {
    const warnIco = el('span', 'row-warn-ico');
    warnIco.setAttribute('role', 'img');
    warnIco.setAttribute('aria-label', REASON_SENTENCE[reason.category]);
    warnIco.setAttribute('data-tip', warnTooltip(reason));
    warnIco.textContent = '⚠';
    line.appendChild(warnIco);
  }
  return line;
}

function fillBranchCell(
  cell: HTMLElement,
  entry: WorkingTreeEntry,
  reason: UpdateReason | undefined,
  searchQuery: string,
): void {
  if (entry.availability !== 'ok') {
    cell.appendChild(buildBranchLine('—', reason, ''));
    appendText(cell, 'track', 'unavailable');
    return;
  }
  const { head } = entry;
  if (head.detached) {
    cell.appendChild(buildBranchLine('detached', reason, ''));
    return;
  }
  cell.appendChild(buildBranchLine(head.branch, reason, searchQuery));
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
  locked: boolean,
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
    // FR-016: blocked while a long operation runs — on top of, not instead of, the "no remote" case
    // above; native disabled with no `.disabled` class added, so it stays visually unchanged.
    if (locked) btn.disabled = true;
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
  locked: boolean,
): HTMLElement {
  const btn = el('button', 'row-delete-ico');
  btn.type = 'button';
  btn.innerHTML = iconSvg('trash'); // bundled static SVG (no user input) — safe
  btn.setAttribute('aria-label', 'Delete');
  btn.setAttribute('data-tip', 'Delete');
  btn.disabled = locked; // FR-016: blocked while a long operation runs — no colour change
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
  failed: boolean,
  locked: boolean,
  reason: UpdateReason | undefined,
  searchQuery: string,
): HTMLElement {
  const state = deriveRowState(entry);
  const row = el('div', `row${isWorktree ? ' wt' : ''} ${STATE_ROW_CLASS[state]}${failed ? ' fail' : ''}`);
  // FR-004: removed from the tab order while a long operation runs, on top of the row dim.
  row.tabIndex = locked ? -1 : 0;

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
  renderHighlighted(dirName, entry.directoryName, searchQuery);
  name.appendChild(dirName);
  if (entry.collisionFragment) {
    name.appendChild(document.createTextNode(' '));
    const frag = el('span', 'frag');
    frag.textContent = `…/${entry.collisionFragment}`;
    name.appendChild(frag);
  }
  nameCell.appendChild(name);

  const slug = el('div', 'slug');
  renderHighlighted(slug, remote && remote.slug ? remote.slug : entry.directoryName, searchQuery);
  if (remote && remote.host && remote.host !== defaultHost) {
    const host = el('span', 'host ext');
    host.textContent = remote.host;
    slug.appendChild(host);
  }
  nameCell.appendChild(slug);
  row.appendChild(nameCell);

  const branchCell = el('div', 'branch-cell');
  fillBranchCell(branchCell, entry, reason, searchQuery);
  row.appendChild(branchCell);

  row.appendChild(buildLocalCell(entry));
  row.appendChild(buildAbCell(entry));

  appendText(row, 'num changed', entry.availability === 'ok' ? relativeTime(entry.lastChange) : '—');

  row.appendChild(buildMenuCell(entry, remote, actions, handlers, locked));
  row.appendChild(buildDeleteCell(entry, isWorktree, familyPath, handlers, locked));

  return row;
}

export function renderRows(
  listEl: HTMLElement,
  rows: Row[],
  defaultHost: string,
  actions: Action[],
  handlers: RowActionHandlers,
  failedPaths: Set<string>,
  locked = false,
  warnings: Map<string, UpdateReason> = new Map(),
  searchQuery = '',
): void {
  listEl.innerHTML = '';
  for (const row of rows) {
    listEl.appendChild(
      buildRow(
        row,
        row.remote,
        defaultHost,
        false,
        undefined,
        actions,
        handlers,
        failedPaths.has(row.fullPath),
        locked,
        warnings.get(row.fullPath),
        searchQuery,
      ),
    );
    if (row.kind === 'repository') {
      // A worktree row inherits its primary's remote for `${2}` (worktree entries carry no remote of their own).
      // familyPath = the primary's own fullPath, needed to deregister the worktree if its directory ever goes
      // missing (005 data-model.md/research R2/R3) — populated unconditionally, not only when unavailable, to
      // avoid a stale-snapshot race if the directory vanishes between render and click.
      for (const wt of row.worktrees) {
        listEl.appendChild(
          buildRow(
            wt,
            row.remote,
            defaultHost,
            true,
            row.fullPath,
            actions,
            handlers,
            failedPaths.has(wt.fullPath),
            locked,
            warnings.get(wt.fullPath),
            searchQuery,
          ),
        );
      }
    }
  }
}

const SKELETON_ROW_COUNT = 6;

function skeletonBox(className: string): HTMLElement {
  return el('div', `skel-box ${className}`);
}

// Mocked row for the initial-load skeleton: same grid as a real .row (so columns line up under
// thead) but every cell is a plain light box — no real text, no state colour (nothing is known yet).
function buildSkeletonRow(): HTMLElement {
  const row = el('div', 'row skeleton');

  const glyphCell = el('div', 'glyph-cell');
  const clock = el('span', 'skel-clock');
  clock.textContent = '⏱';
  clock.setAttribute('aria-hidden', 'true');
  glyphCell.appendChild(clock);
  row.appendChild(glyphCell);

  const nameCell = el('div', 'name-cell');
  nameCell.appendChild(skeletonBox('skel-name'));
  nameCell.appendChild(skeletonBox('skel-slug'));
  row.appendChild(nameCell);

  const branchCell = el('div', 'branch-cell');
  branchCell.appendChild(skeletonBox('skel-branch'));
  branchCell.appendChild(skeletonBox('skel-track'));
  row.appendChild(branchCell);

  const localCell = el('div', 'num');
  localCell.appendChild(skeletonBox('skel-num'));
  row.appendChild(localCell);

  const abCell = el('div', 'num');
  abCell.appendChild(skeletonBox('skel-num'));
  row.appendChild(abCell);

  const changedCell = el('div', 'num changed');
  changedCell.appendChild(skeletonBox('skel-changed'));
  row.appendChild(changedCell);

  row.appendChild(el('div', 'menu'));
  row.appendChild(el('div'));

  return row;
}

/** Repositories exist, but the search/filter combination hides all of them (016 FR-005): a centred
 *  message rendered inside the list itself, so the table's border/outline stays intact instead of
 *  swapping to the separate onboarding `.empty` block used when there are no repositories at all. */
export function renderNoMatchRows(listEl: HTMLElement): void {
  listEl.innerHTML = '';
  const wrap = el('div', 'no-match');
  const heading = el('div', 'empty-heading');
  heading.textContent = 'No matches';
  wrap.appendChild(heading);
  const body = el('div', 'empty-body');
  body.textContent = 'No repositories match your search.';
  wrap.appendChild(body);
  listEl.appendChild(wrap);
}

/** Fills the list with mocked placeholder rows while the initial scan is in flight (no real data yet). */
export function renderSkeletonRows(listEl: HTMLElement): void {
  listEl.innerHTML = '';
  for (let i = 0; i < SKELETON_ROW_COUNT; i++) listEl.appendChild(buildSkeletonRow());
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
