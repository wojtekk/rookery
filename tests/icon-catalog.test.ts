// Pure unit test for the icon catalog contract (specs/015-vector-icon-set/contracts/icon-catalog.md,
// checks C1–C6). The catalog is DOM-free, so this runs under node:test with no Electron/jsdom.
// Guards the presentation contract the feature-015 glyph swap depends on: uniform stroke weight,
// picker excludes fixed affordances, offline output, safe fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_IDS, iconSvg, iconLabel } from '../src/renderer/view/icons/catalog';

const FIXED_AFFORDANCES = ['trash', 'x', 'chevron-up', 'chevron-down', 'git-branch'];

test('C1/C2: every pickable id renders a well-formed, uniform-weight <svg>', () => {
  for (const id of ICON_IDS) {
    const svg = iconSvg(id);
    assert.ok(svg.startsWith('<svg'), `${id} should start with <svg`);
    assert.ok(svg.endsWith('</svg>'), `${id} should end with </svg>`);
    assert.match(svg, /stroke="currentColor"/, `${id} must inherit currentColor`);
    assert.match(svg, /stroke-width="2"/, `${id} must render at the set weight (2)`);
    assert.doesNotMatch(svg, /fill="currentColor"/, `${id} wrapper must not fill with colour`);
  }
});

test('C1: each fixed affordance also renders a valid <svg>', () => {
  for (const id of FIXED_AFFORDANCES) {
    const svg = iconSvg(id);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${id} should be a valid <svg>`);
    assert.match(svg, /stroke="currentColor"/, `${id} must inherit currentColor`);
  }
});

test('C4/C5: ICON_IDS holds launchers and excludes fixed affordances', () => {
  assert.ok(ICON_IDS.includes('github'), 'github must be pickable');
  assert.ok(ICON_IDS.includes('gear'), 'gear must be pickable');
  assert.ok(ICON_IDS.includes('intellij'), 'intellij must be pickable (bespoke launcher)');
  for (const id of FIXED_AFFORDANCES) {
    assert.ok(!ICON_IDS.includes(id), `${id} must NOT be offered in the picker (FR-010)`);
  }
});

test('C3: unknown id returns a non-empty fallback <svg>, never throws', () => {
  const svg = iconSvg('__does_not_exist__');
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'fallback must be a valid <svg>');
  assert.equal(iconLabel('__does_not_exist__'), '__does_not_exist__', 'unknown label falls back to id');
});

test('C6: no icon output references the network (fully offline)', () => {
  for (const id of [...ICON_IDS, ...FIXED_AFFORDANCES, '__unknown__']) {
    assert.doesNotMatch(iconSvg(id), /http/i, `${id} must not contain an external URL`);
  }
});
