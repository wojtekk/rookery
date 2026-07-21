// Bootstrap: calls IPC, holds view state (sort, state filter, worktree toggle), re-renders on change.

import type { CleanupResult, Row, Settings, RepoDashboardApi, UpdateReason, UpdateResult, WorkingTreeEntry } from '../shared/types';
import { sortRows } from './view/sort.js';
import { deriveRowState, filterRows, type StateFilter } from './view/filter.js';
import { renderRows, renderSkeletonRows, renderNoMatchRows, updateSortIndicator, wireSortHeaders } from './view/table.js';
import { renderSummary } from './view/summary.js';
import { renderToolbar } from './view/toolbar.js';
import { renderSearch } from './view/search.js';
import { renderEmptyState } from './view/empty.js';
import { renderSettingsModal, openSettingsModal } from './view/settings.js';
import { openCleanupOverlay, renderCleanupOverlay } from './view/cleanup.js';
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
  search: document.getElementById('search') as HTMLElement,
  fleetTitle: document.getElementById('fleetTitle') as HTMLElement,
  filters: document.getElementById('filters') as HTMLElement,
  sumbar: document.getElementById('sumbar') as HTMLElement,
  thead: document.getElementById('thead') as HTMLElement,
  list: document.getElementById('list') as HTMLElement,
  empty: document.getElementById('empty') as HTMLElement,
  gitWarning: document.getElementById('gitWarning') as HTMLElement,
  settingsModal: document.getElementById('settingsModal') as HTMLElement,
  cleanupOverlay: document.getElementById('cleanupOverlay') as HTMLElement,
  tableLoader: document.getElementById('tableLoader') as HTMLElement,
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
let searchQuery = ''; // debounced, committed value fed to filterRows (016 FR-001/006)
let searchExpanded = false;
const SEARCH_DEBOUNCE_MS = 150;
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
// Left the field empty and clicked/tabbed away — fold back to the icon after a grace period rather
// than staying expanded-but-idle; cancelled if the user refocuses before it fires.
const SEARCH_FOLD_MS = 3000;
let searchFoldTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing = false;
let updating = false; // re-entry guard + toolbar spinner for "Pull all" (FR-009)
let cleaning = false; // re-entry guard + toolbar spinner for "Cleanup"; mutually exclusive with updating (FR-012)
let failedPaths = new Set<string>(); // paths with result 'failed' from the last "Pull all" run (FR-014)
let warnings = new Map<string, UpdateReason>(); // warned-set reasons from the last "Pull all" run (013 FR-001/004), in-memory only (FR-011)
let loadState: LoadState = 'loading';
let busyShowTimer: ReturnType<typeof setTimeout> | undefined;
let busyLoaderShownAt: number | null = null;
const REVEAL_HIDE_DELAY_MS = 1000;
let revealHideTimer: ReturnType<typeof setTimeout> | undefined;

/** Row + sort-header dim and table loader paint after the show-delay (FR-004/005/014); every other
 *  control's block is immediate via render(). */
function beginBusyLock(): void {
  busyShowTimer = setTimeout(() => {
    busyLoaderShownAt = Date.now();
    els.list.classList.add('busy');
    els.thead.classList.add('busy');
    setLoaderVisible(els.tableLoader, true);
  }, LOADER_SHOW_DELAY_MS);
}

/** Release on any settlement (FR-006/013): no visual shown -> immediate; else after the min-visible tail. */
function endBusyLock(): void {
  clearTimeout(busyShowTimer);
  const finish = () => {
    els.list.classList.remove('busy');
    els.thead.classList.remove('busy');
    setLoaderVisible(els.tableLoader, false);
    busyLoaderShownAt = null;
  };
  const wait = remainingMinVisibleMs(busyLoaderShownAt, Date.now());
  if (wait > 0) setTimeout(finish, wait);
  else finish();
}

/** Reveal the table scrollbar and (re)start the hide countdown (US2/US3). */
function revealScrollbar(): void {
  els.list.classList.add('scrolling');
  scheduleScrollbarHide();
}

/** (Re)start the countdown that hides the scrollbar after inactivity, without revealing it. */
function scheduleScrollbarHide(): void {
  clearTimeout(revealHideTimer);
  revealHideTimer = setTimeout(() => els.list.classList.remove('scrolling'), REVEAL_HIDE_DELAY_MS);
}

// Tooltip box height (~30px: padding + line height + border) plus its 8px gap, rounded up.
const TOOLTIP_MIN_SPACE_PX = 40;

/** Flip a row icon's tooltip upward when there's no room below it in the *visible* list — a
 *  scroll-position fact `:last-child` can't express, since the last DOM row isn't necessarily the
 *  last one in view (012 edge case). Covers the delete icon, every configurable .menu action icon,
 *  and the warn icon (013) — horizontal growth direction is unaffected and stays per-icon in CSS. */
function positionRowIconTooltip(btn: HTMLElement): void {
  const spaceBelow = els.list.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom;
  btn.classList.toggle('tip-up', spaceBelow < TOOLTIP_MIN_SPACE_PX);
}

// A warning clears on Refresh only when its cause is locally visible as resolved (FR-008): stuck-skip
// reasons check the specific condition that stuck them; attempt-failure reasons reuse feature 007's
// "row now looks clean" rule (deriveRowState), since a re-run of "Pull all" is what truly reconfirms them.
function isWarningResolved(entry: WorkingTreeEntry, reason: UpdateReason): boolean {
  if (reason.category === 'unavailable') return entry.availability === 'ok';
  if (reason.category === 'detached') return entry.availability === 'ok' && !entry.head.detached;
  return deriveRowState(entry) === 'clean';
}

// A manual refresh re-reads local git state only (Principle II — no fetch), so it can only prove a
// failed repo was fixed when that fix is itself locally visible (e.g. the user resolved the
// divergence/conflict themselves). ponytail: a failure whose repo already looked clean before "Pull
// all" (e.g. pure network/auth failure) will also be cleared by this — only a re-run of "Pull all"
// can truly confirm a fetch succeeds.
function pruneFixedFailedPaths(): void {
  if (failedPaths.size === 0 && warnings.size === 0) return;
  const stillFailed = new Set<string>();
  const stillWarned = new Map<string, UpdateReason>();
  const check = (entry: WorkingTreeEntry): void => {
    if (failedPaths.has(entry.fullPath) && deriveRowState(entry) !== 'clean') stillFailed.add(entry.fullPath);
    const reason = warnings.get(entry.fullPath);
    if (reason && !isWarningResolved(entry, reason)) stillWarned.set(entry.fullPath, reason);
  };
  for (const row of rows) {
    check(row);
    if (row.kind === 'repository') {
      for (const wt of row.worktrees) check(wt);
    }
  }
  failedPaths = stillFailed;
  warnings = stillWarned;
}

async function doRefresh(opts: { pruneFixedFailed?: boolean } = {}): Promise<void> {
  if (refreshing || updating || cleaning) return; // FR-002/SC-005: at most one long operation at a time
  refreshing = true;
  beginBusyLock();
  render();
  try {
    rows = await api.refresh();
    if (opts.pruneFixedFailed) pruneFixedFailedPaths();
  } finally {
    // FR-013: release on resolve, failure result, or reject/throw — never leave the UI locked.
    refreshing = false;
    endBusyLock();
    render();
  }
}

async function doUpdateAll(): Promise<void> {
  if (updating || cleaning) return; // FR-012: mutually exclusive with Cleanup
  updating = true;
  failedPaths = new Set();
  warnings = new Map();
  beginBusyLock();
  render();

  try {
    const outcomes = await api.updateAll();
    failedPaths = new Set(outcomes.filter((o) => o.result === 'failed').map((o) => o.path));
    warnings = new Map(outcomes.filter((o) => o.reason).map((o) => [o.path, o.reason!]));

    const counts: Record<UpdateResult, number> = { updated: 0, 'already-current': 0, skipped: 0, failed: 0 };
    for (const o of outcomes) counts[o.result]++;
    showNotice(
      `Updated ${counts.updated} · ${counts['already-current']} already current · ${counts.skipped} skipped · ${counts.failed} failed`,
    );
  } finally {
    // FR-013: release on resolve, failure result, or reject/throw — never leave the UI locked.
    updating = false;
    endBusyLock();
    render();
  }
  await doRefresh();
}

/** Two-phase flow (contracts/ipc-cleanup.md): read-only scan -> review overlay -> remove selected. */
async function doCleanup(): Promise<void> {
  if (cleaning || updating) return; // FR-012: mutually exclusive with Pull all
  cleaning = true;
  beginBusyLock();
  render();

  try {
    // cleaning (and the busy lock) spans the review overlay too — released only by onConfirm/onCancel below.
    const plan = await api.scanCleanup();
    openCleanupOverlay(plan, {
      onConfirm: (selected) => {
        void (async () => {
          try {
            const outcomes = await api.executeCleanup(selected);
            const counts: Record<CleanupResult, number> = { removed: 0, skipped: 0, failed: 0 };
            for (const o of outcomes) counts[o.result]++;
            showNotice(`Removed ${counts.removed} · ${counts.skipped} skipped · ${counts.failed} failed`); // FR-013
          } finally {
            cleaning = false;
            endBusyLock();
          }
          await doRefresh();
        })();
      },
      onCancel: () => {
        cleaning = false; // FR-009: nothing removed
        endBusyLock();
        render();
      },
    });
    render();
  } catch (err) {
    // scanCleanup rejected before the review overlay ever opened — release here (FR-013).
    cleaning = false;
    endBusyLock();
    render();
    throw err;
  }
}

function render(): void {
  // FR-001/015/016: drives filter-chip and row-action locking below (toolbar derives its own copy).
  const busy = refreshing || updating || cleaning;
  const hasDirectories = settings.observedDirectories.length > 0;
  const screen = decideStartupScreen(loadState, hasDirectories);
  const isInitialLoading = screen === 'loader';

  renderToolbar(
    els.toolbar,
    { showWorktrees: settings.showWorktrees, refreshing, updating, cleaning, hasRepos: rows.length > 0 },
    {
      onToggleWorktrees: (show) => {
        settings.showWorktrees = show;
        void api.setShowWorktrees(show);
        render();
      },
      onRefresh: () => void doRefresh({ pruneFixedFailed: true }),
      onUpdateAll: () => void doUpdateAll(),
      onCleanup: () => void doCleanup(),
      onOpenSettings: () => {
        openSettingsModal();
        render();
      },
    },
  );

  renderSearch(
    els.search,
    { query: searchQuery, expanded: searchExpanded, busy: busy || isInitialLoading },
    {
      onQueryChange: (raw) => {
        clearTimeout(searchDebounceTimer);
        if (raw === '') {
          // Clearing (× / Esc / backspace-to-empty) always commits instantly — no reason to wait
          // out the debounce to reach the already-inactive, empty-query state (contracts §2).
          searchQuery = '';
          render();
          return;
        }
        searchDebounceTimer = setTimeout(() => {
          searchQuery = raw;
          render();
        }, SEARCH_DEBOUNCE_MS);
      },
      onToggleExpanded: (expanded) => {
        searchExpanded = expanded;
        render();
      },
      onBlur: () => {
        clearTimeout(searchFoldTimer);
        if (searchQuery !== '') return; // only auto-fold an empty field, not one mid-search
        searchFoldTimer = setTimeout(() => {
          searchExpanded = false;
          render();
        }, SEARCH_FOLD_MS);
      },
      onFocus: () => clearTimeout(searchFoldTimer),
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
    busy,
  );

  updateSortIndicator(els.thead, settings.sortDimension, settings.sortDirection);

  const sorted = sortRows(rows, settings.sortDimension, settings.sortDirection);
  const visible = filterRows(sorted, stateFilter, settings.showWorktrees, failedPaths, searchQuery);
  const noRepos = rows.length === 0;
  const noMatches = !noRepos && visible.length === 0; // rows exist, search/filter hides all of them (FR-005)

  if (isInitialLoading) {
    // No real data yet — mocked rows keep .list's flex space (and the footer's position) stable.
    renderSkeletonRows(els.list);
  } else if (noMatches) {
    // Keeps .list's border/outline intact (016) rather than swapping to the separate onboarding
    // `.empty` block below, which is reserved for the genuinely-no-repositories case.
    renderNoMatchRows(els.list);
  } else {
    renderRows(
      els.list,
      visible,
      settings.defaultHost,
      settings.actions,
      {
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
      },
      failedPaths,
      busy,
      warnings,
      searchQuery.trim(),
    );
  }

  const showEmpty = noRepos && !isInitialLoading;
  els.list.hidden = showEmpty;
  els.empty.hidden = !showEmpty;
  if (showEmpty) {
    renderEmptyState(
      els.empty,
      hasDirectories,
      () => {
        openSettingsModal();
        render();
      },
      busy,
    );
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

  renderCleanupOverlay(els.cleanupOverlay);

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
  if (refreshing || updating || cleaning) return; // FR-014: sort is blocked while a long operation runs
  if (settings.sortDimension === dimension) {
    settings.sortDirection = settings.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    settings.sortDimension = dimension;
    settings.sortDirection = 'asc';
  }
  void api.setSort(settings.sortDimension, settings.sortDirection);
  render();
});

els.list.addEventListener('scroll', revealScrollbar);
els.list.addEventListener('mouseenter', revealScrollbar);
els.list.addEventListener('mouseleave', scheduleScrollbarHide);

// Delegated (rows are re-created on every render) — 'mouseover' bubbles, unlike 'mouseenter'.
els.list.addEventListener('mouseover', (e) => {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest('.row-delete-ico, .row-action-ico, .row-warn-ico');
  if (btn instanceof HTMLElement) positionRowIconTooltip(btn);
});

void (async () => {
  await checkGitStatus();
  let locked = false;
  try {
    settings = await api.getSettings();
    render(); // first paint: add-directory screen if no directories configured, else nothing yet (loader pending)

    if (settings.observedDirectories.length > 0) {
      beginBusyLock();
      locked = true;
    }

    rows = await api.listRepositories();
    rows = await api.refresh(); // startup performs an implicit refresh (ipc-api.md); loadState stays 'loading' across both calls
  } catch {
    showNotice('Failed to load repositories.');
  } finally {
    loadState = 'ready';
    if (locked) endBusyLock();
    render();
  }
})();
