// Cleanup review overlay (FR-008/FR-009, research D8): candidates grouped by repository, every
// checkbox selected by default, a worktree indicator glyph when a worktree is also removed.
// Mirrors settings.ts's module-level isOpen + open/render pair and the shared .scrim/.modal CSS.

import type { CleanupCandidate } from '../../shared/types';
import { iconSvg } from './icons/catalog.js';

export interface CleanupOverlayHandlers {
  onConfirm: (selected: CleanupCandidate[]) => void;
  onCancel: () => void;
}

let isOpen = false;
let candidates: CleanupCandidate[] = [];
let checked = new Map<string, boolean>();
let handlers: CleanupOverlayHandlers | null = null;

export function openCleanupOverlay(plan: CleanupCandidate[], h: CleanupOverlayHandlers): void {
  isOpen = true;
  candidates = plan;
  checked = new Map(plan.map((c) => [c.id, true])); // selected by default (FR-008)
  handlers = h;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function close(): void {
  isOpen = false;
  candidates = [];
  checked = new Map();
  handlers = null;
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function candidateLabel(c: CleanupCandidate): string {
  if (c.branch) return c.branch;
  if (c.worktreePath) return basename(c.worktreePath);
  return c.id;
}

const REASON_TEXT: Record<CleanupCandidate['reason'], string> = {
  'gone-branch': 'gone',
  'missing-worktree': 'missing',
  'merged-worktree': 'merged',
};

export function renderCleanupOverlay(container: HTMLElement): void {
  container.innerHTML = '';
  if (!isOpen || !handlers) return;
  const h = handlers;

  const scrim = el('div', 'scrim');
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.setAttribute('aria-label', 'Review cleanup');
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) {
      close();
      h.onCancel();
    }
  });

  const modal = el('div', 'modal');

  const head = el('div', 'modal-head');
  const h2 = el('h2');
  h2.textContent = 'Review cleanup';
  const closeBtn = el('span', 'modal-close');
  closeBtn.innerHTML = iconSvg('x'); // bundled static SVG (no user input) — safe
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => {
    close();
    h.onCancel();
  });
  head.appendChild(h2);
  head.appendChild(closeBtn);
  modal.appendChild(head);

  const body = el('div', 'modal-body');

  if (candidates.length === 0) {
    const empty = el('div', 'cleanup-empty');
    const art = el('div', 'cleanup-empty-art');
    art.textContent = '🧹✨';
    const heading = el('div', 'cleanup-empty-heading');
    heading.textContent = 'Nothing to clean up';
    const sub = el('div', 'cleanup-empty-body');
    sub.textContent = 'Every branch and worktree is present, current, or still in use.';
    empty.appendChild(art);
    empty.appendChild(heading);
    empty.appendChild(sub);
    body.appendChild(empty);
    modal.appendChild(body);

    const foot = el('div', 'modal-foot');
    const grow = el('span', 'grow');
    const closeBtn = el('button', 'btn ghost');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      close();
      h.onCancel();
    });
    foot.appendChild(grow);
    foot.appendChild(closeBtn);
    modal.appendChild(foot);

    scrim.appendChild(modal);
    container.appendChild(scrim);
    return;
  }

  const byRepo = new Map<string, CleanupCandidate[]>();
  for (const c of candidates) {
    const group = byRepo.get(c.repoPath);
    if (group) group.push(c);
    else byRepo.set(c.repoPath, [c]);
  }

  const confirmBtn = el('button', 'btn');
  confirmBtn.type = 'button';

  const selectAllBtn = el('button', 'link-btn');
  selectAllBtn.type = 'button';
  selectAllBtn.textContent = 'Select all';
  selectAllBtn.addEventListener('click', () => {
    for (const c of candidates) checked.set(c.id, true);
    body.querySelectorAll<HTMLInputElement>('.cleanup-checkbox').forEach((cb) => (cb.checked = true));
    refreshFooter();
  });

  const clearSelectionBtn = el('button', 'link-btn');
  clearSelectionBtn.type = 'button';
  clearSelectionBtn.textContent = 'Clear selection';
  clearSelectionBtn.addEventListener('click', () => {
    for (const c of candidates) checked.set(c.id, false);
    body.querySelectorAll<HTMLInputElement>('.cleanup-checkbox').forEach((cb) => (cb.checked = false));
    refreshFooter();
  });

  const refreshFooter = (): void => {
    const n = [...checked.values()].filter(Boolean).length;
    confirmBtn.textContent = `Remove ${n} selected`;
    confirmBtn.disabled = n === 0;
    selectAllBtn.disabled = n === candidates.length;
    clearSelectionBtn.disabled = n === 0;
  };

  for (const [repoPath, items] of byRepo) {
    const group = el('div', 'cleanup-group');
    const groupHead = el('div', 'cleanup-group-head');
    groupHead.textContent = items[0]!.repoSlug ?? repoPath;
    group.appendChild(groupHead);

    const list = el('div', 'cleanup-list');
    for (const candidate of items) {
      const row = el('label', 'cleanup-row');

      const cb = el('input', 'cleanup-checkbox');
      cb.type = 'checkbox';
      cb.checked = checked.get(candidate.id) ?? true;
      cb.addEventListener('change', () => {
        checked.set(candidate.id, cb.checked);
        refreshFooter();
      });
      row.appendChild(cb);

      const label = el('span', 'cleanup-label');
      label.textContent = candidateLabel(candidate);
      row.appendChild(label);

      const reason = el('span', 'cleanup-reason');
      reason.textContent = REASON_TEXT[candidate.reason];
      row.appendChild(reason);

      if (candidate.worktreePath) {
        const glyph = el('span', 'cleanup-worktree-indicator');
        glyph.innerHTML = iconSvg('git-branch'); // bundled static SVG (no user input) — safe
        glyph.title = 'Also removes a worktree';
        row.appendChild(glyph);
      }

      list.appendChild(row);
    }
    group.appendChild(list);
    body.appendChild(group);
  }

  modal.appendChild(body);

  const foot = el('div', 'modal-foot');
  const grow = el('span', 'grow');
  const cancelBtn = el('button', 'btn ghost');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    close();
    h.onCancel();
  });
  confirmBtn.addEventListener('click', () => {
    const selected = candidates.filter((c) => checked.get(c.id));
    close();
    h.onConfirm(selected);
  });

  refreshFooter();
  foot.appendChild(selectAllBtn);
  foot.appendChild(clearSelectionBtn);
  foot.appendChild(grow);
  foot.appendChild(cancelBtn);
  foot.appendChild(confirmBtn);
  modal.appendChild(foot);

  scrim.appendChild(modal);
  container.appendChild(scrim);
}
