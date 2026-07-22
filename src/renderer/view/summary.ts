// Fleet composition bar + state-filter chips with counts (FR-029).

import type { Row, RowState } from '../../shared/types';
import { deriveRowState, isGone, isLocalOnly, type StateFilter } from './filter.js';

const STATES: RowState[] = ['clean', 'dirty', 'out-of-sync', 'unavailable'];
const LABELS: Record<RowState, string> = {
  clean: 'clean',
  dirty: 'uncommitted',
  'out-of-sync': 'out of sync',
  unavailable: 'unavailable',
};
const SWATCH_CLASS: Record<RowState, string> = {
  clean: 'sw-clean',
  dirty: 'sw-dirty',
  'out-of-sync': 'sw-sync',
  unavailable: 'sw-dead',
};
const SEG_CLASS: Record<RowState, string> = {
  clean: 'seg-clean',
  dirty: 'seg-dirty',
  'out-of-sync': 'seg-sync',
  unavailable: 'seg-dead',
};

export interface SummaryElements {
  filters: HTMLElement;
  sumbar: HTMLElement;
}

/** Unlike the RowState tally above (primaries only), 'gone' counts worktrees too — a worktree's
 *  own branch, not its primary's, is what goes stale (mirrors failedPaths' broader scope). */
function countGone(rows: Row[]): number {
  let n = 0;
  for (const row of rows) {
    if (isGone(row)) n++;
    if (row.kind === 'repository') {
      for (const wt of row.worktrees) if (isGone(wt)) n++;
    }
  }
  return n;
}

/** Mirrors countGone: 'local-only' also counts worktrees, since a worktree's own branch — not its primary's — is what has no upstream. */
function countLocalOnly(rows: Row[]): number {
  let n = 0;
  for (const row of rows) {
    if (isLocalOnly(row)) n++;
    if (row.kind === 'repository') {
      for (const wt of row.worktrees) if (isLocalOnly(wt)) n++;
    }
  }
  return n;
}

/** Counts reflect the full fleet regardless of the active filter, so chips stay meaningful to switch between. */
export function renderSummary(
  els: SummaryElements,
  rows: Row[],
  activeFilter: StateFilter,
  onFilterChange: (filter: StateFilter) => void,
  failedPaths: Set<string> = new Set(),
  locked = false,
): void {
  const counts: Record<RowState, number> = { clean: 0, dirty: 0, 'out-of-sync': 0, unavailable: 0 };
  for (const row of rows) counts[deriveRowState(row)] += 1;
  const total = rows.length;

  els.filters.innerHTML = '';
  els.filters.appendChild(makeChip('all', total, activeFilter === 'all', () => onFilterChange('all'), undefined, locked));
  for (const state of STATES) {
    els.filters.appendChild(
      makeChip(
        LABELS[state],
        counts[state],
        activeFilter === state,
        () => onFilterChange(state),
        SWATCH_CLASS[state],
        locked,
      ),
    );
  }
  // 'failed' is not a RowState (007 data-model.md R1): its count comes from failedPaths, not the
  // per-state tally above, and it's deliberately excluded from the sumbar segments below (R2) —
  // a failed repo usually overlaps an existing state, so counting it there would double-count rows.
  els.filters.appendChild(
    makeChip('failed', failedPaths.size, activeFilter === 'failed', () => onFilterChange('failed'), 'sw-fail', locked),
  );
  // 'gone' is also not a RowState (kept out of the 5-colour edge palette, filter.ts) — no swatch,
  // same treatment as 'all'.
  els.filters.appendChild(
    makeChip('gone', countGone(rows), activeFilter === 'gone', () => onFilterChange('gone'), undefined, locked),
  );
  // 'local-only' is also not a RowState, for the same reason as 'gone' — no swatch, same treatment.
  els.filters.appendChild(
    makeChip(
      'local-only',
      countLocalOnly(rows),
      activeFilter === 'local-only',
      () => onFilterChange('local-only'),
      undefined,
      locked,
    ),
  );

  els.sumbar.innerHTML = '';
  els.sumbar.title = STATES.map((s) => `${counts[s]} ${LABELS[s]}`).join(' · ');
  for (const state of STATES) {
    if (counts[state] === 0) continue;
    const seg = document.createElement('span');
    seg.className = `seg ${SEG_CLASS[state]}`;
    seg.style.flex = String(counts[state]);
    els.sumbar.appendChild(seg);
  }
}

function makeChip(
  label: string,
  count: number,
  active: boolean,
  onClick: () => void,
  swatchClass?: string,
  locked = false,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `filter${active ? ' active' : ''}`;
  btn.disabled = locked; // FR-015: blocked while a long operation runs — native disabled, no colour change

  if (swatchClass) {
    const swatch = document.createElement('span');
    swatch.className = `swatch ${swatchClass}`;
    btn.appendChild(swatch);
  }
  const b = document.createElement('b');
  b.textContent = String(count);
  btn.appendChild(b);
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = label;
  btn.appendChild(k);

  btn.addEventListener('click', onClick);
  return btn;
}
