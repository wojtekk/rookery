// Command bar: worktrees toggle (FR-024), refresh (FR-012/FR-014), settings (FR-002/FR-015/FR-016).

export interface ToolbarState {
  showWorktrees: boolean;
  refreshing: boolean;
  updating: boolean;
  cleaning: boolean;
  rebasing: boolean;
  hasRepos: boolean;
  hasWorktrees: boolean;
}

export interface ToolbarHandlers {
  onToggleWorktrees: (show: boolean) => void;
  onRefresh: () => void;
  onUpdateAll: () => void;
  onCleanup: () => void;
  onRebaseWorktrees: () => void;
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
  const busy = state.refreshing || state.updating || state.cleaning || state.rebasing;

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
  // FR-001/009: blocked (not busy) while Pull all, Cleanup, or Rebase worktrees runs.
  const refreshLocked = !state.refreshing && (state.updating || state.cleaning || state.rebasing);
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
  if (!busy) wireActivate(refreshBtn, handlers.onRefresh);
  container.appendChild(refreshBtn);

  const updateBtn = document.createElement('div');
  // FR-007: disabled with nothing to act on; FR-001/009: mutually exclusive with the other long ops.
  const updateLocked = !state.updating && (state.refreshing || state.cleaning || state.rebasing || !state.hasRepos);
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
  if (!state.updating && !state.cleaning && !state.refreshing && !state.rebasing && state.hasRepos) wireActivate(updateBtn, handlers.onUpdateAll);
  container.appendChild(updateBtn);

  const cleanupBtn = document.createElement('div');
  // FR-007: disabled with nothing to act on; FR-001/009: mutually exclusive with the other long ops.
  const cleanupLocked = !state.cleaning && (state.refreshing || state.updating || state.rebasing || !state.hasRepos);
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
  if (!state.cleaning && !state.updating && !state.refreshing && !state.rebasing && state.hasRepos) wireActivate(cleanupBtn, handlers.onCleanup);
  container.appendChild(cleanupBtn);

  const rebaseBtn = document.createElement('div');
  // FR-021: disabled with no linked worktrees; FR-013: mutually exclusive with the other long ops.
  const rebaseLocked = !state.rebasing && (state.refreshing || state.updating || state.cleaning || !state.hasWorktrees);
  rebaseBtn.className = `ctrl rebase${state.rebasing ? ' busy' : ''}${rebaseLocked ? ' disabled' : ''}`;
  rebaseBtn.tabIndex = 0;
  rebaseBtn.setAttribute('role', 'button');
  rebaseBtn.setAttribute('aria-busy', String(state.rebasing));
  rebaseBtn.setAttribute('aria-disabled', String(rebaseLocked));
  const rebaseSpin = document.createElement('span');
  rebaseSpin.className = 'spin-icon';
  rebaseSpin.textContent = '⤴';
  rebaseBtn.appendChild(rebaseSpin);
  rebaseBtn.appendChild(document.createTextNode(' Rebase worktrees'));
  if (!state.rebasing && !state.refreshing && !state.updating && !state.cleaning && state.hasWorktrees) {
    wireActivate(rebaseBtn, handlers.onRebaseWorktrees);
  }
  container.appendChild(rebaseBtn);

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
