// Observed-directories modal: add (native folder picker) / remove / persist (FR-002/FR-015/FR-016).

import type { AddDirectoryResult } from '../../shared/types';

export interface SettingsModalHandlers {
  onAdd: (path: string) => Promise<AddDirectoryResult>;
  onRemove: (path: string) => Promise<void>;
  onPick: () => Promise<string | null>;
  /** A directory was actually added/removed — the caller should re-scan. */
  onModified: () => void;
  /** The modal closed (X, backdrop, Done) without necessarily changing anything — just re-render. */
  onClose: () => void;
}

let isOpen = false;

export function openSettingsModal(): void {
  isOpen = true;
}

export function renderSettingsModal(
  container: HTMLElement,
  directories: string[],
  handlers: SettingsModalHandlers,
): void {
  container.innerHTML = '';
  if (!isOpen) return;

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.setAttribute('aria-label', 'Observed directories');
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) {
      isOpen = false;
      handlers.onClose();
    }
  });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const head = document.createElement('div');
  head.className = 'modal-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Observed directories';
  const close = document.createElement('span');
  close.className = 'modal-close';
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', () => {
    isOpen = false;
    handlers.onClose();
  });
  head.appendChild(h2);
  head.appendChild(close);
  modal.appendChild(head);

  const list = document.createElement('div');
  list.className = 'dir-list';
  if (directories.length === 0) {
    const none = document.createElement('div');
    none.className = 'dir';
    none.textContent = 'No directories observed yet.';
    list.appendChild(none);
  }
  for (const dir of directories) {
    const row = document.createElement('div');
    row.className = 'dir';
    const path = document.createElement('span');
    path.className = 'path';
    path.title = dir;
    path.textContent = dir;
    const rm = document.createElement('span');
    rm.className = 'rm';
    rm.title = 'Stop observing';
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      void handlers.onRemove(dir).then(handlers.onModified);
    });
    row.appendChild(path);
    row.appendChild(rm);
    list.appendChild(row);
  }
  modal.appendChild(list);

  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  const error = document.createElement('span');
  error.className = 'dir-error';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.textContent = '+ Add directory…';
  addBtn.addEventListener('click', () => {
    void (async () => {
      const picked = await handlers.onPick();
      if (!picked) return;
      const result = await handlers.onAdd(picked);
      if (!result.ok) {
        error.textContent = result.reason;
        return;
      }
      handlers.onModified();
    })();
  });
  const grow = document.createElement('span');
  grow.className = 'grow';
  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn ghost';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => {
    isOpen = false;
    handlers.onClose();
  });
  foot.appendChild(addBtn);
  foot.appendChild(error);
  foot.appendChild(grow);
  foot.appendChild(doneBtn);
  modal.appendChild(foot);

  scrim.appendChild(modal);
  container.appendChild(scrim);
}
