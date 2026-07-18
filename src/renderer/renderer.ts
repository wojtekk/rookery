// Bootstrap: calls IPC, holds view state (sort, state filter, worktree toggle), re-renders on change.

import type { Row, Settings, RepoDashboardApi, UpdateResult } from '../shared/types';
import { sortRows } from './view/sort.js';
import { filterRows, type StateFilter } from './view/filter.js';
import { renderRows, updateSortIndicator, wireSortHeaders } from './view/table.js';
import { renderSummary } from './view/summary.js';
import { renderToolbar } from './view/toolbar.js';
import { renderEmptyState } from './view/empty.js';
import { renderSettingsModal, openSettingsModal } from './view/settings.js';
import { decideStartupScreen, remainingMinVisibleMs, LOADER_SHOW_DELAY_MS, type LoadState } from './view/loadstate.js';
import { setLoaderVisible } from './view/loader.js';

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
  loader: document.getElementById('loader') as HTMLElement,
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
  actions: [],
};

/** Transient, non-blocking notice (bottom-right toast); auto-dismisses. Used for launch failures (FR-007). */
function showNotice(message: string): void {
  let host = document.getElementById('notices');
  if (!host) {
    host = document.createElement('div');
    host.id = 'notices';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'notice';
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}
let stateFilter: StateFilter = 'all';
let refreshing = false;
let updating = false; // re-entry guard + toolbar spinner for "Pull all" (FR-009)
let failedPaths = new Set<string>(); // paths with result 'failed' from the last "Pull all" run (FR-014)
let loadState: LoadState = 'loading';
let loaderShownAt: number | null = null;

async function doRefresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  render();
  rows = await api.refresh();
  refreshing = false;
  render();
}

async function doUpdateAll(): Promise<void> {
  if (updating) return;
  updating = true;
  failedPaths = new Set();
  render();

  const outcomes = await api.updateAll();
  failedPaths = new Set(outcomes.filter((o) => o.result === 'failed').map((o) => o.path));

  const counts: Record<UpdateResult, number> = { updated: 0, 'already-current': 0, skipped: 0, failed: 0 };
  for (const o of outcomes) counts[o.result]++;
  showNotice(
    `Updated ${counts.updated} · ${counts['already-current']} already current · ${counts.skipped} skipped · ${counts.failed} failed`,
  );

  updating = false;
  await doRefresh();
}

function render(): void {
  renderToolbar(
    els.toolbar,
    { showWorktrees: settings.showWorktrees, refreshing, updating },
    {
      onToggleWorktrees: (show) => {
        settings.showWorktrees = show;
        void api.setShowWorktrees(show);
        render();
      },
      onRefresh: () => void doRefresh(),
      onUpdateAll: () => void doUpdateAll(),
      onOpenSettings: () => {
        openSettingsModal();
        render();
      },
    },
  );

  renderSummary(
    { title: els.fleetTitle, filters: els.filters, sumbar: els.sumbar },
    rows,
    stateFilter,
    (filter) => {
      stateFilter = filter;
      render();
    },
    failedPaths,
  );

  updateSortIndicator(els.thead, settings.sortDimension, settings.sortDirection);

  const sorted = sortRows(rows, settings.sortDimension, settings.sortDirection);
  const visible = filterRows(sorted, stateFilter, settings.showWorktrees, failedPaths);
  renderRows(els.list, visible, settings.defaultHost, settings.actions, {
    onRun: (actionId, target) => {
      const action = settings.actions.find((a) => a.id === actionId);
      void api.runAction(actionId, target).then((res) => {
        if (!res.ok) showNotice(`${action?.name ?? 'Action'} failed on ${target.path}: ${res.reason}`);
      });
    },
    // deleteRow owns its own dialogs/errors (main-process, native) — the renderer just refreshes
    // afterward regardless of outcome; a cancelled/failed delete simply re-reports the row unchanged.
    onDelete: (target) => {
      void api.deleteRow(target).then(() => doRefresh());
    },
  }, failedPaths);

  const hasDirectories = settings.observedDirectories.length > 0;
  const screen = decideStartupScreen(loadState, hasDirectories);
  els.list.hidden = rows.length === 0;
  const showEmpty = rows.length === 0 && screen !== 'loader';
  els.empty.hidden = !showEmpty;
  if (showEmpty) {
    renderEmptyState(els.empty, hasDirectories, () => {
      openSettingsModal();
      render();
    });
  }

  renderSettingsModal(els.settingsModal, settings.observedDirectories, settings.actions, {
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
    onSetActions: (actions) => api.setActions(actions),
    onActionsChanged: () => {
      // Actions changed — reload settings and re-render so the ⋮ menus and the list update (FR-008).
      // No repo re-scan needed (the row data is unchanged).
      void (async () => {
        settings = await api.getSettings();
        render();
      })();
    },
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
  let showLoaderTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    settings = await api.getSettings();
    render(); // first paint: add-directory screen if no directories configured, else nothing yet (loader pending)

    if (settings.observedDirectories.length > 0) {
      showLoaderTimer = setTimeout(() => {
        loaderShownAt = Date.now();
        setLoaderVisible(els.loader, true);
      }, LOADER_SHOW_DELAY_MS);
    }

    rows = await api.listRepositories();
    rows = await api.refresh(); // startup performs an implicit refresh (ipc-api.md); loadState stays 'loading' across both calls
  } catch {
    showNotice('Failed to load repositories.');
  } finally {
    clearTimeout(showLoaderTimer);
    const finish = () => {
      loadState = 'ready';
      setLoaderVisible(els.loader, false);
      render();
    };
    const wait = remainingMinVisibleMs(loaderShownAt, Date.now());
    if (wait > 0) setTimeout(finish, wait);
    else finish();
  }
})();
