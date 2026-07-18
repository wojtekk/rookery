// Command bar: worktrees toggle (FR-024), refresh (FR-012/FR-014), settings (FR-002/FR-015/FR-016).

export interface ToolbarState {
  showWorktrees: boolean;
  refreshing: boolean;
  updating: boolean;
}

export interface ToolbarHandlers {
  onToggleWorktrees: (show: boolean) => void;
  onRefresh: () => void;
  onUpdateAll: () => void;
  onOpenSettings: () => void;
}

function wireActivate(el: HTMLElement, activate: () => void): void {
  el.addEventListener('click', activate);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
}

export function renderToolbar(container: HTMLElement, state: ToolbarState, handlers: ToolbarHandlers): void {
  container.innerHTML = '';

  const toggle = document.createElement('div');
  toggle.className = `ctrl toggle${state.showWorktrees ? ' on' : ''}`;
  toggle.tabIndex = 0;
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(state.showWorktrees));
  const switchEl = document.createElement('span');
  switchEl.className = 'switch';
  toggle.appendChild(switchEl);
  toggle.appendChild(document.createTextNode(' Worktrees'));
  wireActivate(toggle, () => handlers.onToggleWorktrees(!state.showWorktrees));
  container.appendChild(toggle);

  const refreshBtn = document.createElement('div');
  refreshBtn.className = `ctrl refresh${state.refreshing ? ' busy' : ''}`;
  refreshBtn.tabIndex = 0;
  refreshBtn.setAttribute('role', 'button');
  refreshBtn.setAttribute('aria-busy', String(state.refreshing));
  const spin = document.createElement('span');
  spin.className = 'spin-icon';
  spin.textContent = '↻';
  refreshBtn.appendChild(spin);
  refreshBtn.appendChild(document.createTextNode(' Refresh'));
  if (!state.refreshing) wireActivate(refreshBtn, handlers.onRefresh);
  container.appendChild(refreshBtn);

  const updateBtn = document.createElement('div');
  updateBtn.className = `ctrl pull-all${state.updating ? ' busy' : ''}`;
  updateBtn.tabIndex = 0;
  updateBtn.setAttribute('role', 'button');
  updateBtn.setAttribute('aria-busy', String(state.updating));
  const updateSpin = document.createElement('span');
  updateSpin.className = 'spin-icon';
  updateSpin.textContent = '⇅';
  updateBtn.appendChild(updateSpin);
  updateBtn.appendChild(document.createTextNode(' Pull all'));
  if (!state.updating) wireActivate(updateBtn, handlers.onUpdateAll);
  container.appendChild(updateBtn);

  const settingsBtn = document.createElement('div');
  settingsBtn.className = 'ctrl';
  settingsBtn.tabIndex = 0;
  settingsBtn.setAttribute('role', 'button');
  settingsBtn.setAttribute('aria-haspopup', 'dialog');
  settingsBtn.title = 'Manage observed directories';
  settingsBtn.textContent = '⚙ Settings';
  wireActivate(settingsBtn, handlers.onOpenSettings);
  container.appendChild(settingsBtn);
}
