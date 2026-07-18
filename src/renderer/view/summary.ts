// Fleet composition bar + state-filter chips with counts (FR-029).

import type { Row, RowState } from '../../shared/types';
import { deriveRowState, type StateFilter } from './filter.js';

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
  title: HTMLElement;
  filters: HTMLElement;
  sumbar: HTMLElement;
}

/** Counts reflect the full fleet regardless of the active filter, so chips stay meaningful to switch between. */
export function renderSummary(
  els: SummaryElements,
  rows: Row[],
  activeFilter: StateFilter,
  onFilterChange: (filter: StateFilter) => void,
  failedPaths: Set<string> = new Set(),
): void {
  const counts: Record<RowState, number> = { clean: 0, dirty: 0, 'out-of-sync': 0, unavailable: 0 };
  for (const row of rows) counts[deriveRowState(row)] += 1;
  const total = rows.length;

  els.title.textContent = `Fleet — ${total} ${total === 1 ? 'repository' : 'repositories'}`;

  els.filters.innerHTML = '';
  els.filters.appendChild(makeChip('all', total, activeFilter === 'all', () => onFilterChange('all')));
  for (const state of STATES) {
    els.filters.appendChild(
      makeChip(LABELS[state], counts[state], activeFilter === state, () => onFilterChange(state), SWATCH_CLASS[state]),
    );
  }
  // 'failed' is not a RowState (007 data-model.md R1): its count comes from failedPaths, not the
  // per-state tally above, and it's deliberately excluded from the sumbar segments below (R2) —
  // a failed repo usually overlaps an existing state, so counting it there would double-count rows.
  els.filters.appendChild(
    makeChip('failed', failedPaths.size, activeFilter === 'failed', () => onFilterChange('failed'), 'sw-fail'),
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
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `filter${active ? ' active' : ''}`;

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
