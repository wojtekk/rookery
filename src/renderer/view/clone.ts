// Clone modal (data-model.md §7, contracts/clone-engine.md). Mirrors cleanup.ts's module-level
// isOpen + open/render/close pattern and reuses the shared .scrim/.modal/.modal-head/.modal-body/
// .modal-foot/.btn CSS. Search/URL/destination editing happens via targeted DOM updates (not a
// full renderCloneModal re-render) so typing never loses focus or cursor position — the same
// reason settings.ts's action-form inputs mutate specific elements instead of re-rendering.

import type { CloneableReposResult, RemoteRepoSummary, Row } from '../../shared/types';
import { deriveRepoName, rankCloneCandidates, buildDestination, parseRemoteSlug } from './clone-model.js';
import { iconSvg } from './icons/catalog.js';
import { setLoaderVisible } from './loader.js';

export interface CloneModalHandlers {
  onClone: (url: string, destination: string, destDir: string) => void;
  onCancel: () => void;
  onRefreshList: () => void;
  onBrowse: () => Promise<string | null>;
  /** Pre-flight fs check: does the destination already exist as a non-empty dir/file? */
  onCheckDestination: (destination: string) => Promise<boolean>;
}

let isOpen = false;
let loading = false;
let result: CloneableReposResult | null = null;
let query = '';
let selected: RemoteRepoSummary | null = null;
let urlValue = '';
let scheme: 'ssh' | 'https' = 'ssh'; // default SSH (spec Assumptions)
let destDir = '';
let destPath = '';
let destPathEdited = false;
let cloneError: string | null = null;
let hostNoteDismissed = false;
let handlers: CloneModalHandlers | null = null;

// Matches .list's auto-hiding custom scrollbar (feature 011): idle-hidden thumb, revealed on
// scroll/hover, faded back out after this long.
const SCROLLBAR_HIDE_DELAY_MS = 1000;

/** Opens the modal immediately in a loading state; the caller kicks off discovery separately
 *  (T013) and reports it back via `setCloneDiscoveryResult`. */
export function openCloneModal(observedDirectories: string[], lastCloneDirectory: string, h: CloneModalHandlers): void {
  isOpen = true;
  loading = true;
  result = null;
  query = '';
  selected = null;
  urlValue = '';
  scheme = 'ssh';
  destDir = observedDirectories.includes(lastCloneDirectory) ? lastCloneDirectory : (observedDirectories[0] ?? '');
  destPath = '';
  destPathEdited = false;
  cloneError = null;
  hostNoteDismissed = false;
  handlers = h;
}

/** Puts the results area back into its loading state (used when "Refresh list" re-runs discovery,
 *  so the user gets the same spinner + inert search controls as on first open). */
export function setCloneLoading(): void {
  loading = true;
}

export function setCloneDiscoveryResult(r: CloneableReposResult): void {
  loading = false;
  result = r;
  hostNoteDismissed = false;
}

/** FR-011: a failed clone keeps the modal open, shows the reason, preserves every field. */
export function setCloneError(reason: string): void {
  cloneError = reason;
}

/** Clears a prior failure's reason so a retry doesn't show stale error text during "Cloning…". */
export function clearCloneError(): void {
  cloneError = null;
}

export function closeCloneModal(): void {
  isOpen = false;
  handlers = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function currentUrl(): string {
  return scheme === 'ssh' ? selected!.sshUrl : selected!.httpsUrl;
}

function formLabel(text: string): HTMLElement {
  const label = el('div', 'clone-label');
  label.textContent = text;
  return label;
}

/** Path of an existing row whose remote matches {host, slug}, or null (informational duplicate-clone check). */
function existingCloneFor(rows: Row[], host: string, slug: string): string | null {
  for (const row of rows) {
    const r = row.remote;
    if (r && r.host && r.host.toLowerCase() === host.toLowerCase() && r.slug.toLowerCase() === slug.toLowerCase()) {
      return row.fullPath;
    }
  }
  return null;
}

export function renderCloneModal(container: HTMLElement, observedDirectories: string[], cloning: boolean, rows: Row[]): void {
  container.innerHTML = '';
  if (!isOpen || !handlers) return;
  const h = handlers;

  const scrim = el('div', 'scrim');
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.setAttribute('aria-label', 'Clone a repository');
  // A text-selection drag that starts inside a field (e.g. the URL input) and ends outside the
  // modal fires a `click` with target === scrim — indistinguishable from an intentional backdrop
  // click unless the mousedown is checked too. Only treat it as dismiss when BOTH originate on
  // the scrim itself, not just where the drag happened to end.
  let scrimMouseDownOnSelf = false;
  scrim.addEventListener('mousedown', (e) => {
    scrimMouseDownOnSelf = e.target === scrim;
  });
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim && scrimMouseDownOnSelf && !cloning) {
      closeCloneModal();
      h.onCancel();
    }
  });

  const modal = el('div', 'modal clone-modal');

  const head = el('div', 'modal-head');
  const h2 = el('h2');
  h2.textContent = 'Clone a repository';
  const closeBtn = el('span', 'modal-close');
  closeBtn.innerHTML = iconSvg('x'); // bundled static SVG (no user input) — safe
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => {
    if (cloning) return;
    closeCloneModal();
    h.onCancel();
  });
  head.appendChild(h2);
  head.appendChild(closeBtn);
  modal.appendChild(head);

  const body = el('div', 'modal-body clone-body');

  // --- Search section (US1/US2 FR-002/003/012/013) ---
  body.appendChild(formLabel('Search repositories'));
  const searchRow = el('div', 'clone-search-row');
  const searchInput = el('input', 'clone-search-input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search repositories…';
  searchInput.value = query;
  searchInput.setAttribute('aria-label', 'Search repositories');

  const refreshListBtn = el('button', 'link-btn');
  refreshListBtn.type = 'button';
  refreshListBtn.textContent = 'Refresh list';
  refreshListBtn.addEventListener('click', () => h.onRefreshList());

  searchRow.appendChild(searchInput);
  searchRow.appendChild(refreshListBtn);
  body.appendChild(searchRow);

  const statusText = el('div', 'clone-search-status');
  body.appendChild(statusText);

  const hostNote = el('div', 'clone-host-note');
  body.appendChild(hostNote);

  // Loader overlays this fixed-min-height box (see .table-loader) so the results area doesn't
  // jump in size between the loading and loaded states.
  const resultsWrap = el('div', 'clone-results-wrap');
  const resultsList = el('div', 'clone-results');
  resultsList.setAttribute('role', 'listbox');
  resultsList.setAttribute('aria-label', 'Matching repositories');
  const loaderEl = el('div', 'clone-loader');
  loaderEl.hidden = true;
  resultsWrap.appendChild(resultsList);
  resultsWrap.appendChild(loaderEl);
  body.appendChild(resultsWrap);

  // --- URL field + scheme toggle (US2 FR-004) ---
  body.appendChild(formLabel('Repository URL'));
  const urlRow = el('div', 'clone-form-row');
  const urlInput = el('input', 'clone-url-input');
  urlInput.type = 'text';
  urlInput.placeholder = 'git@host:owner/repo.git or https://host/owner/repo.git';
  urlInput.value = urlValue;
  urlInput.setAttribute('aria-label', 'Repository URL');

  const schemeToggle = el('div', 'clone-scheme-toggle');
  const sshBtn = el('button', 'clone-scheme-btn');
  sshBtn.type = 'button';
  sshBtn.textContent = 'SSH';
  const httpsBtn = el('button', 'clone-scheme-btn');
  httpsBtn.type = 'button';
  httpsBtn.textContent = 'HTTPS';
  schemeToggle.appendChild(sshBtn);
  schemeToggle.appendChild(httpsBtn);

  urlRow.appendChild(urlInput);
  urlRow.appendChild(schemeToggle);
  body.appendChild(urlRow);

  const duplicateNote = el('div', 'clone-note');
  duplicateNote.hidden = true;
  body.appendChild(duplicateNote);

  // --- Destination (FR-005/006) ---
  body.appendChild(formLabel('Clone to directory:'));
  const destRow = el('div', 'clone-form-row');
  const destSelect = el('select', 'clone-dest-select');
  destSelect.setAttribute('aria-label', 'Destination directory');
  const browseBtn = el('button', 'btn ghost');
  browseBtn.type = 'button';
  browseBtn.textContent = 'Browse…';
  destRow.appendChild(destSelect);
  destRow.appendChild(browseBtn);
  body.appendChild(destRow);

  const destPathInput = el('input', 'clone-path-input');
  destPathInput.type = 'text';
  destPathInput.placeholder = 'Destination path';
  destPathInput.value = destPath;
  destPathInput.setAttribute('aria-label', 'Destination path');
  body.appendChild(destPathInput);

  const destOccupiedNote = el('div', 'clone-note');
  destOccupiedNote.hidden = true;
  body.appendChild(destOccupiedNote);

  const errorText = el('div', 'clone-error');
  body.appendChild(errorText);

  modal.appendChild(body);

  // --- Footer ---
  const foot = el('div', 'modal-foot');
  const grow = el('span', 'grow');
  const cancelBtn = el('button', 'btn ghost');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.disabled = cloning;
  cancelBtn.addEventListener('click', () => {
    closeCloneModal();
    h.onCancel();
  });
  const cloneBtn = el('button', 'btn');
  cloneBtn.type = 'button';
  cloneBtn.textContent = cloning ? 'Cloning…' : 'Clone';
  foot.appendChild(grow);
  foot.appendChild(cancelBtn);
  foot.appendChild(cloneBtn);
  modal.appendChild(foot);

  scrim.appendChild(modal);
  container.appendChild(scrim);

  // --- Wiring (targeted DOM updates only — no full re-render on keystroke) ---

  function refreshDestOptions(): void {
    destSelect.innerHTML = '';
    const options = observedDirectories.includes(destDir) || destDir === '' ? observedDirectories : [destDir, ...observedDirectories];
    for (const dir of options) {
      const opt = el('option');
      opt.value = dir;
      opt.textContent = dir;
      destSelect.appendChild(opt);
    }
    destSelect.value = destDir;
  }

  function refreshCloneButton(): void {
    const valid = deriveRepoName(urlValue) !== null && destPath.trim() !== '';
    cloneBtn.disabled = cloning || !valid;
  }

  function autofillDestPath(): void {
    if (destPathEdited) return;
    const name = deriveRepoName(urlValue);
    if (name === null || destDir === '') return;
    destPath = buildDestination(destDir, name);
    destPathInput.value = destPath;
    scheduleDestCheck();
  }

  /** Informational only (never blocks Clone) — surfaces an existing clone of the same remote. */
  function refreshDuplicateWarning(): void {
    const parsed = parseRemoteSlug(urlValue);
    const existingPath = parsed ? existingCloneFor(rows, parsed.host, parsed.slug) : null;
    duplicateNote.textContent = existingPath ? `Already cloned at ${existingPath}` : '';
    duplicateNote.hidden = !existingPath;
  }

  let destCheckTimer: ReturnType<typeof setTimeout> | undefined;

  /** Informational only (never blocks Clone) — debounced fs check so it doesn't fire on every
   *  keystroke; a stale response (path changed again before it resolved) is discarded. Skipped
   *  entirely once cloning has started: git itself creates the destination almost immediately,
   *  so a check racing against it would misreport the user's own in-progress clone as a
   *  pre-existing occupied directory. */
  function scheduleDestCheck(): void {
    clearTimeout(destCheckTimer);
    destOccupiedNote.hidden = true;
    if (cloning) return;
    const pathAtSchedule = destPath;
    if (pathAtSchedule.trim() === '') return;
    destCheckTimer = setTimeout(() => {
      void h
        .onCheckDestination(pathAtSchedule)
        .then((occupied) => {
          if (destPath !== pathAtSchedule) return; // stale — superseded by a later change
          destOccupiedNote.textContent = occupied ? 'This directory already exists and is not empty.' : '';
          destOccupiedNote.hidden = !occupied;
        })
        .catch(() => {}); // informational only — a check failure just leaves the note hidden
    }, 300);
  }

  function refreshSchemeToggle(): void {
    sshBtn.classList.toggle('active', scheme === 'ssh');
    httpsBtn.classList.toggle('active', scheme === 'https');
  }

  function setScheme(s: 'ssh' | 'https'): void {
    scheme = s;
    if (selected) {
      urlValue = currentUrl();
      urlInput.value = urlValue;
      refreshDuplicateWarning();
    }
    refreshSchemeToggle();
  }

  let resultsScrollHideTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleResultsScrollbarHide(): void {
    clearTimeout(resultsScrollHideTimer);
    resultsScrollHideTimer = setTimeout(() => resultsList.classList.remove('scrolling'), SCROLLBAR_HIDE_DELAY_MS);
  }
  function revealResultsScrollbar(): void {
    resultsList.classList.add('scrolling');
    scheduleResultsScrollbarHide();
  }
  resultsList.addEventListener('scroll', revealResultsScrollbar);
  resultsList.addEventListener('mouseenter', revealResultsScrollbar);
  resultsList.addEventListener('mouseleave', scheduleResultsScrollbarHide);

  let activeIndex = -1;

  function renderResults(): void {
    resultsList.innerHTML = '';

    if (loading) {
      // Search stays visible but inert — only the results area shows the loading state.
      searchInput.disabled = true;
      refreshListBtn.disabled = true;
      setLoaderVisible(loaderEl, true, 'Loading repositories…');
      statusText.hidden = true;
      resultsWrap.hidden = false;
      resultsList.hidden = true;
      hostNote.hidden = true;
      return;
    }
    searchInput.disabled = false;
    refreshListBtn.disabled = false;
    setLoaderVisible(loaderEl, false);

    if (!result || !result.searchAvailable) {
      // FR-012: search unavailable — never a blank list, URL/destination stay fully usable.
      statusText.textContent = result?.reason ?? 'Repository search is unavailable.';
      statusText.hidden = false;
      resultsWrap.hidden = true;
      hostNote.hidden = true;
      return;
    }

    statusText.hidden = true;
    resultsWrap.hidden = false;

    // FR-013: partial host availability — dismissible, doesn't block the results that did load.
    if (result.unavailableHosts.length > 0 && !hostNoteDismissed) {
      hostNote.hidden = false;
      hostNote.innerHTML = '';
      const text = el('span');
      text.textContent = `Could not reach: ${result.unavailableHosts.join(', ')}`;
      const dismiss = el('button', 'clone-host-note-dismiss');
      dismiss.type = 'button';
      dismiss.innerHTML = iconSvg('x'); // bundled static SVG (no user input) — safe
      dismiss.title = 'Dismiss';
      dismiss.addEventListener('click', () => {
        hostNoteDismissed = true;
        hostNote.hidden = true;
      });
      hostNote.appendChild(text);
      hostNote.appendChild(dismiss);
    } else {
      hostNote.hidden = true;
    }

    const ranked = rankCloneCandidates(result.repos, query, 50);
    activeIndex = ranked.length > 0 ? 0 : -1;
    resultsList.hidden = false;

    if (ranked.length === 0) {
      const empty = el('div', 'clone-result-empty');
      empty.textContent = 'No matching repositories.';
      resultsList.appendChild(empty);
      return;
    }

    ranked.forEach((repo, i) => {
      const item = el('div', `clone-result-item${i === activeIndex ? ' active' : ''}`);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(i === activeIndex));
      const label = el('span', 'clone-result-label');
      label.textContent = `${repo.owner}/${repo.name}`;
      const hostTag = el('span', 'clone-result-host');
      hostTag.textContent = repo.host;
      item.appendChild(label);
      item.appendChild(hostTag);
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep focus in the search input rather than the (about to vanish) item
        pick(repo);
      });
      resultsList.appendChild(item);
    });
  }

  function highlight(index: number): void {
    const items = resultsList.querySelectorAll<HTMLElement>('.clone-result-item');
    if (items.length === 0) return;
    activeIndex = Math.max(0, Math.min(index, items.length - 1));
    items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function pick(repo: RemoteRepoSummary): void {
    selected = repo;
    urlValue = currentUrl();
    urlInput.value = urlValue;
    autofillDestPath();
    refreshDuplicateWarning();
    refreshCloneButton();
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    renderResults();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(activeIndex - 1);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const ranked = result && result.searchAvailable ? rankCloneCandidates(result.repos, query, 50) : [];
      const repo = ranked[activeIndex];
      if (repo) pick(repo);
    }
  });

  urlInput.addEventListener('input', () => {
    urlValue = urlInput.value;
    selected = null; // manual edit detaches from any prior pick — scheme toggle can no longer rederive
    autofillDestPath();
    refreshDuplicateWarning();
    refreshCloneButton();
  });

  sshBtn.addEventListener('click', () => setScheme('ssh'));
  httpsBtn.addEventListener('click', () => setScheme('https'));

  destSelect.addEventListener('change', () => {
    // Edge Case: changing the directory re-derives the path only while it's still auto-filled
    // (quickstart E) — a prior hand-edit is never overwritten by a later directory change (F).
    destDir = destSelect.value;
    autofillDestPath();
    refreshCloneButton();
  });

  browseBtn.addEventListener('click', () => {
    void h
      .onBrowse()
      .then((picked) => {
        if (!picked) return;
        destDir = picked;
        refreshDestOptions();
        autofillDestPath();
        refreshCloneButton();
      })
      .catch(() => {}); // dialog rejection: leave the destination unchanged, never crash the handler
  });

  destPathInput.addEventListener('input', () => {
    destPath = destPathInput.value;
    destPathEdited = true; // Edge Case: a hand-edit stops further auto-fill
    scheduleDestCheck();
    refreshCloneButton();
  });

  cloneBtn.addEventListener('click', () => {
    if (cloneBtn.disabled) return;
    h.onClone(urlValue.trim(), destPath.trim(), destDir);
  });

  errorText.textContent = cloneError ?? '';
  errorText.hidden = !cloneError;

  refreshDestOptions();
  refreshSchemeToggle();
  renderResults();
  refreshDuplicateWarning();
  scheduleDestCheck();
  refreshCloneButton();
}
