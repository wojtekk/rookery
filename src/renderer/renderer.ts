// Bootstrap: calls IPC, holds view state (sort, state filter, worktree toggle), re-renders on change.

import type { Row, Settings, RepoDashboardApi } from '../shared/types';
import { sortRows } from './view/sort.js';
import { filterRows, type StateFilter } from './view/filter.js';
import { renderRows, updateSortIndicator, wireSortHeaders } from './view/table.js';
import { renderSummary } from './view/summary.js';
import { renderToolbar } from './view/toolbar.js';
import { renderEmptyState } from './view/empty.js';
import { renderSettingsModal, openSettingsModal } from './view/settings.js';

declare global {
  interface Window {
    repoDashboard: RepoDashboardApi;
  }
}

const api = window.repoDashboard;

const els = {
  toolbar: document.getElementById('toolbar') as HTMLElement,
  fleetTitle: document.getElementById('fleetTitle') as HTMLElement,
  filters: document.getElementById('filters') as HTMLElement,
  sumbar: document.getElementById('sumbar') as HTMLElement,
  thead: document.getElementById('thead') as HTMLElement,
  list: document.getElementById('list') as HTMLElement,
  empty: document.getElementById('empty') as HTMLElement,
  gitWarning: document.getElementById('gitWarning') as HTMLElement,
  settingsModal: document.getElementById('settingsModal') as HTMLElement,
  footLeft: document.getElementById('footLeft') as HTMLElement,
  footRight: document.getElementById('footRight') as HTMLElement,
};

let rows: Row[] = [];
let settings: Settings = {
  observedDirectories: [],
  sortDimension: 'slug',
  sortDirection: 'asc',
  showWorktrees: true,
  defaultHost: 'github.com',
};
let stateFilter: StateFilter = 'all';
let refreshing = false;

async function doRefresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  render();
  rows = await api.refresh();
  refreshing = false;
  render();
}

function render(): void {
  renderToolbar(
    els.toolbar,
    { showWorktrees: settings.showWorktrees, refreshing },
    {
      onToggleWorktrees: (show) => {
        settings.showWorktrees = show;
        void api.setShowWorktrees(show);
        render();
      },
      onRefresh: () => void doRefresh(),
      onOpenSettings: () => {
        openSettingsModal();
        render();
      },
    },
  );

  renderSummary({ title: els.fleetTitle, filters: els.filters, sumbar: els.sumbar }, rows, stateFilter, (filter) => {
    stateFilter = filter;
    render();
  });

  updateSortIndicator(els.thead, settings.sortDimension, settings.sortDirection);

  const sorted = sortRows(rows, settings.sortDimension, settings.sortDirection);
  const visible = filterRows(sorted, stateFilter, settings.showWorktrees);
  renderRows(els.list, visible, settings.defaultHost);

  els.list.hidden = rows.length === 0;
  els.empty.hidden = rows.length > 0;
  if (rows.length === 0) {
    renderEmptyState(els.empty, settings.observedDirectories.length > 0, () => {
      openSettingsModal();
      render();
    });
  }

  renderSettingsModal(els.settingsModal, settings.observedDirectories, {
    onAdd: (path) => api.addObservedDirectory(path),
    onRemove: (path) => api.removeObservedDirectory(path),
    onPick: () => api.pickDirectory(),
    onModified: () => {
      void (async () => {
        settings = await api.getSettings();
        await doRefresh();
      })();
    },
    onClose: () => render(),
  });

  els.footLeft.textContent = `Showing ${visible.length} of ${rows.length} · grouped by primary`;
  els.footRight.textContent = `last refresh ${new Date().toLocaleTimeString()} · no network traffic`;
}

async function checkGitStatus(): Promise<void> {
  const status = await api.getGitStatus();
  if (!status.available) {
    const warning = document.createElement('div');
    warning.className = 'git-warning';
    warning.textContent = `System git is unavailable: ${status.reason}`;
    els.gitWarning.appendChild(warning);
  }
}

wireSortHeaders(els.thead, (dimension) => {
  if (settings.sortDimension === dimension) {
    settings.sortDirection = settings.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    settings.sortDimension = dimension;
    settings.sortDirection = 'asc';
  }
  void api.setSort(settings.sortDimension, settings.sortDirection);
  render();
});

void (async () => {
  await checkGitStatus();
  settings = await api.getSettings();
  rows = await api.listRepositories();
  render();
  rows = await api.refresh(); // startup performs an implicit refresh (ipc-api.md)
  render();
})();
