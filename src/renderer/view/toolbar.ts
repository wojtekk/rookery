// Command bar: worktrees toggle (FR-024), refresh (FR-012/FR-014), settings (FR-002/FR-015/FR-016).

export interface ToolbarState {
  showWorktrees: boolean;
  refreshing: boolean;
  updating: boolean;
  cleaning: boolean;
  hasRepos: boolean;
}

export interface ToolbarHandlers {
  onToggleWorktrees: (show: boolean) => void;
  onRefresh: () => void;
  onUpdateAll: () => void;
  onCleanup: () => void;
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

  // FR-011/FR-012: a running long operation blocks every control below, not just the other two buttons.
  const busy = state.refreshing || state.updating || state.cleaning;

  const toggle = document.createElement('div');
  toggle.className = `ctrl toggle${state.showWorktrees ? ' on' : ''}${busy ? ' disabled' : ''}`;
  toggle.tabIndex = 0;
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(state.showWorktrees));
  toggle.setAttribute('aria-disabled', String(busy));
  const switchEl = document.createElement('span');
  switchEl.className = 'switch';
  toggle.appendChild(switchEl);
  toggle.appendChild(document.createTextNode(' Worktrees'));
  if (!busy) wireActivate(toggle, () => handlers.onToggleWorktrees(!state.showWorktrees));
  container.appendChild(toggle);

  const refreshBtn = document.createElement('div');
  // FR-001/009: blocked (not busy) while Pull all or Cleanup runs — any one of the three blocks the other two.
  const refreshLocked = !state.refreshing && (state.updating || state.cleaning);
  refreshBtn.className = `ctrl refresh${state.refreshing ? ' busy' : ''}${refreshLocked ? ' disabled' : ''}`;
  refreshBtn.tabIndex = 0;
  refreshBtn.setAttribute('role', 'button');
  refreshBtn.setAttribute('aria-busy', String(state.refreshing));
  refreshBtn.setAttribute('aria-disabled', String(refreshLocked));
  const spin = document.createElement('span');
  spin.className = 'spin-icon';
  spin.textContent = '↻';
  refreshBtn.appendChild(spin);
  refreshBtn.appendChild(document.createTextNode(' Refresh'));
  if (!state.refreshing && !state.updating && !state.cleaning) wireActivate(refreshBtn, handlers.onRefresh);
  container.appendChild(refreshBtn);

  const updateBtn = document.createElement('div');
  // FR-007: disabled with nothing to act on; FR-001/009: mutually exclusive with Refresh & Cleanup.
  const updateLocked = !state.updating && (state.refreshing || state.cleaning || !state.hasRepos);
  updateBtn.className = `ctrl pull-all${state.updating ? ' busy' : ''}${updateLocked ? ' disabled' : ''}`;
  updateBtn.tabIndex = 0;
  updateBtn.setAttribute('role', 'button');
  updateBtn.setAttribute('aria-busy', String(state.updating));
  updateBtn.setAttribute('aria-disabled', String(updateLocked));
  const updateSpin = document.createElement('span');
  updateSpin.className = 'spin-icon';
  updateSpin.textContent = '⇅';
  updateBtn.appendChild(updateSpin);
  updateBtn.appendChild(document.createTextNode(' Pull all'));
  if (!state.updating && !state.cleaning && !state.refreshing && state.hasRepos) wireActivate(updateBtn, handlers.onUpdateAll);
  container.appendChild(updateBtn);

  const cleanupBtn = document.createElement('div');
  // FR-007: disabled with nothing to act on; FR-001/009: mutually exclusive with Refresh & Pull all.
  const cleanupLocked = !state.cleaning && (state.refreshing || state.updating || !state.hasRepos);
  cleanupBtn.className = `ctrl cleanup${state.cleaning ? ' busy' : ''}${cleanupLocked ? ' disabled' : ''}`;
  cleanupBtn.tabIndex = 0;
  cleanupBtn.setAttribute('role', 'button');
  cleanupBtn.setAttribute('aria-busy', String(state.cleaning));
  cleanupBtn.setAttribute('aria-disabled', String(cleanupLocked));
  const cleanupSpin = document.createElement('span');
  cleanupSpin.className = 'spin-icon';
  cleanupSpin.textContent = '⌫';
  cleanupBtn.appendChild(cleanupSpin);
  cleanupBtn.appendChild(document.createTextNode(' Cleanup'));
  if (!state.cleaning && !state.updating && !state.refreshing && state.hasRepos) wireActivate(cleanupBtn, handlers.onCleanup);
  container.appendChild(cleanupBtn);

  const settingsBtn = document.createElement('div');
  settingsBtn.className = `ctrl${busy ? ' disabled' : ''}`;
  settingsBtn.tabIndex = 0;
  settingsBtn.setAttribute('role', 'button');
  settingsBtn.setAttribute('aria-haspopup', 'dialog');
  settingsBtn.setAttribute('aria-disabled', String(busy));
  settingsBtn.title = 'Manage observed directories';
  settingsBtn.textContent = '⚙ Settings';
  if (!busy) wireActivate(settingsBtn, handlers.onOpenSettings);
  container.appendChild(settingsBtn);
}
