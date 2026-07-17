// Settings modal: observed directories (add/remove/persist, 001) + custom action launchers
// (list, add, edit, remove, reorder within ACTION_LIMIT — FR-001/002/003/014). The action list is
// computed with the pure helpers in shared/actions.ts and persisted whole via `setActions`.

import type { Action, AddDirectoryResult } from '../../shared/types';
import { ACTION_LIMIT, add, canAdd, edit, moveDown, moveUp, remove } from '../../shared/actions.js';
import { ICON_IDS, iconLabel, iconSvg } from './icons/catalog.js';

export interface SettingsModalHandlers {
  onAdd: (path: string) => Promise<AddDirectoryResult>;
  onRemove: (path: string) => Promise<void>;
  onPick: () => Promise<string | null>;
  /** A directory was actually added/removed — the caller should re-scan. */
  onModified: () => void;
  /** The modal closed (X, backdrop, Done) without necessarily changing anything — just re-render. */
  onClose: () => void;
  /** Persist the full ordered actions list (FR-010). */
  onSetActions: (actions: Action[]) => Promise<void>;
  /** Actions changed — reload settings and re-render (no repo re-scan needed). */
  onActionsChanged: () => void;
}

let isOpen = false;

// Transient add/edit-form state (DOM-only; reset on every real re-render — see note in renderActionsSection).
let editingId: string | null = null;
let formIcon: string = ICON_IDS[0]!;

export function openSettingsModal(): void {
  isOpen = true;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function renderActionsSection(modal: HTMLElement, actions: Action[], handlers: SettingsModalHandlers): void {
  // Every real re-render is a fresh start: leave any in-progress edit mode (it's transient DOM state).
  editingId = null;
  formIcon = ICON_IDS[0]!;

  const section = el('div', 'settings-section');
  const h = el('h2');
  h.textContent = 'Actions';
  section.appendChild(h);

  const hint = el('div', 'section-hint');
  hint.textContent = 'Launchers shown in each repository row’s ⋮ menu. ${1} = path, ${2} = remote URL.';
  section.appendChild(hint);

  const list = el('div', 'action-list');
  if (actions.length === 0) {
    const none = el('div', 'action-empty');
    none.textContent = 'No actions — the ⋮ menu is hidden until you add one.';
    list.appendChild(none);
  }

  actions.forEach((action, index) => {
    const row = el('div', 'action-row');

    const ico = el('span', 'action-ico');
    ico.innerHTML = iconSvg(action.iconId); // bundled static SVG (no user input) — safe
    row.appendChild(ico);

    const meta = el('div', 'action-meta');
    const name = el('div', 'action-name');
    name.textContent = action.name;
    const cmd = el('code', 'action-cmd');
    cmd.textContent = action.command;
    meta.appendChild(name);
    meta.appendChild(cmd);
    row.appendChild(meta);

    const controls = el('div', 'action-controls');

    const up = el('button', 'mini');
    up.type = 'button';
    up.textContent = '↑';
    up.title = 'Move up';
    up.setAttribute('aria-label', `Move ${action.name} up`);
    up.disabled = index === 0;
    up.addEventListener('click', () => void handlers.onSetActions(moveUp(actions, action.id)).then(handlers.onActionsChanged));

    const down = el('button', 'mini');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'Move down';
    down.setAttribute('aria-label', `Move ${action.name} down`);
    down.disabled = index === actions.length - 1;
    down.addEventListener('click', () =>
      void handlers.onSetActions(moveDown(actions, action.id)).then(handlers.onActionsChanged),
    );

    const editBtn = el('button', 'mini');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit ${action.name}`);

    const rm = el('button', 'mini danger');
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.setAttribute('aria-label', `Remove ${action.name}`);
    rm.addEventListener('click', () => void handlers.onSetActions(remove(actions, action.id)).then(handlers.onActionsChanged));

    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(editBtn);
    controls.appendChild(rm);
    row.appendChild(controls);
    list.appendChild(row);

    // Edit populates the form below in place (DOM-only, no re-render) — wired after the form exists.
    editBtn.addEventListener('click', () => enterEditMode(action));
  });
  section.appendChild(list);

  // --- Add / edit form ---
  const form = el('div', 'action-form');

  const iconPicker = el('div', 'icon-picker');
  iconPicker.setAttribute('role', 'radiogroup');
  iconPicker.setAttribute('aria-label', 'Icon');
  for (const id of ICON_IDS) {
    const opt = el('button', 'icon-opt');
    opt.type = 'button';
    opt.dataset.icon = id;
    opt.innerHTML = iconSvg(id);
    opt.title = iconLabel(id);
    opt.setAttribute('role', 'radio');
    opt.setAttribute('aria-label', iconLabel(id));
    opt.setAttribute('aria-checked', String(id === formIcon));
    if (id === formIcon) opt.classList.add('selected');
    opt.addEventListener('click', () => selectIcon(iconPicker, id));
    iconPicker.appendChild(opt);
  }
  form.appendChild(iconPicker);

  const nameInput = el('input', 'action-name-input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name (e.g. VS Code Insiders)';
  nameInput.setAttribute('aria-label', 'Action name');

  const cmdInput = el('input', 'action-cmd-input');
  cmdInput.type = 'text';
  cmdInput.placeholder = 'Command (e.g. code-insiders ${1})';
  cmdInput.setAttribute('aria-label', 'Action command');

  form.appendChild(nameInput);
  form.appendChild(cmdInput);

  const foot = el('div', 'action-form-foot');
  const submit = el('button', 'btn');
  submit.type = 'button';
  submit.textContent = 'Add action';
  const formError = el('span', 'action-error');

  const refreshSubmitState = (): void => {
    const nameOk = nameInput.value.trim().length > 0;
    const cmdOk = cmdInput.value.trim().length > 0;
    const limitOk = editingId !== null || canAdd(actions); // editing doesn't grow the list
    submit.disabled = !(nameOk && cmdOk && limitOk);
    formError.textContent = limitOk ? '' : `Limit reached (${ACTION_LIMIT}). Remove one to add another.`;
  };
  nameInput.addEventListener('input', refreshSubmitState);
  cmdInput.addEventListener('input', refreshSubmitState);

  submit.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const command = cmdInput.value.trim();
    if (!name || !command) return;
    const next =
      editingId !== null
        ? edit(actions, editingId, { name, iconId: formIcon, command })
        : add(actions, { id: crypto.randomUUID(), name, iconId: formIcon, command });
    void handlers.onSetActions(next).then(handlers.onActionsChanged);
  });

  foot.appendChild(submit);
  foot.appendChild(formError);
  form.appendChild(foot);
  section.appendChild(form);
  modal.appendChild(section);

  // Enter edit mode: fill the form from an existing action (in place, no re-render).
  function enterEditMode(action: Action): void {
    editingId = action.id;
    nameInput.value = action.name;
    cmdInput.value = action.command;
    selectIcon(iconPicker, action.iconId);
    submit.textContent = 'Save changes';
    refreshSubmitState();
    nameInput.focus();
  }

  refreshSubmitState();
}

function selectIcon(picker: HTMLElement, id: string): void {
  formIcon = id;
  picker.querySelectorAll<HTMLElement>('.icon-opt').forEach((opt) => {
    const on = opt.dataset.icon === id;
    opt.classList.toggle('selected', on);
    opt.setAttribute('aria-checked', String(on));
  });
}

export function renderSettingsModal(
  container: HTMLElement,
  directories: string[],
  actions: Action[],
  handlers: SettingsModalHandlers,
): void {
  container.innerHTML = '';
  if (!isOpen) return;

  const scrim = el('div', 'scrim');
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.setAttribute('aria-label', 'Settings');
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) {
      isOpen = false;
      handlers.onClose();
    }
  });

  const modal = el('div', 'modal');

  const head = el('div', 'modal-head');
  const h2 = el('h2');
  h2.textContent = 'Settings';
  const close = el('span', 'modal-close');
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', () => {
    isOpen = false;
    handlers.onClose();
  });
  head.appendChild(h2);
  head.appendChild(close);
  modal.appendChild(head);

  const modalBody = el('div', 'modal-body');

  // --- Observed directories section ---
  const dirSection = el('div', 'settings-section');
  const dirH = el('h2');
  dirH.textContent = 'Observed directories';
  dirSection.appendChild(dirH);

  const list = el('div', 'dir-list');
  if (directories.length === 0) {
    const none = el('div', 'dir');
    none.textContent = 'No directories observed yet.';
    list.appendChild(none);
  }
  for (const dir of directories) {
    const row = el('div', 'dir');
    const path = el('span', 'path');
    path.title = dir;
    path.textContent = dir;
    const rm = el('span', 'rm');
    rm.title = 'Stop observing';
    rm.textContent = '×';
    rm.addEventListener('click', () => void handlers.onRemove(dir).then(handlers.onModified));
    row.appendChild(path);
    row.appendChild(rm);
    list.appendChild(row);
  }
  dirSection.appendChild(list);

  const dirFoot = el('div', 'dir-foot');
  const error = el('span', 'dir-error');
  const addBtn = el('button', 'btn');
  addBtn.type = 'button';
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
  dirFoot.appendChild(addBtn);
  dirFoot.appendChild(error);
  dirSection.appendChild(dirFoot);
  modalBody.appendChild(dirSection);

  // --- Actions section ---
  renderActionsSection(modalBody, actions, handlers);
  modal.appendChild(modalBody);

  // --- Footer ---
  const foot = el('div', 'modal-foot');
  const grow = el('span', 'grow');
  const doneBtn = el('button', 'btn ghost');
  doneBtn.type = 'button';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => {
    isOpen = false;
    handlers.onClose();
  });
  foot.appendChild(grow);
  foot.appendChild(doneBtn);
  modal.appendChild(foot);

  scrim.appendChild(modal);
  container.appendChild(scrim);
}
