import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideStartupScreen, remainingMinVisibleMs, LOADER_MIN_VISIBLE_MS } from '../src/renderer/view/loadstate';

test('decideStartupScreen: loading + directories configured -> loader', () => {
  assert.equal(decideStartupScreen('loading', true), 'loader');
});

test('decideStartupScreen: loading + no directories -> add-directory', () => {
  assert.equal(decideStartupScreen('loading', false), 'add-directory');
});

test('decideStartupScreen: ready + directories configured -> results', () => {
  assert.equal(decideStartupScreen('ready', true), 'results');
});

test('decideStartupScreen: ready + no directories -> add-directory', () => {
  assert.equal(decideStartupScreen('ready', false), 'add-directory');
});

test('decideStartupScreen: hasDirectories true never yields add-directory (SC-006)', () => {
  assert.notEqual(decideStartupScreen('loading', true), 'add-directory');
  assert.notEqual(decideStartupScreen('ready', true), 'add-directory');
});

test('remainingMinVisibleMs: never shown (null) -> 0', () => {
  assert.equal(remainingMinVisibleMs(null, 1000), 0);
});

test('remainingMinVisibleMs: already elapsed -> 0', () => {
  assert.equal(remainingMinVisibleMs(0, LOADER_MIN_VISIBLE_MS), 0);
  assert.equal(remainingMinVisibleMs(0, LOADER_MIN_VISIBLE_MS + 500), 0);
});

test('remainingMinVisibleMs: mid-window -> positive, <= minMs', () => {
  const result = remainingMinVisibleMs(1000, 1100, LOADER_MIN_VISIBLE_MS);
  assert.equal(result, LOADER_MIN_VISIBLE_MS - 100);
  assert.ok(result > 0 && result <= LOADER_MIN_VISIBLE_MS);
});

test('remainingMinVisibleMs: never returns negative', () => {
  assert.equal(remainingMinVisibleMs(0, 10_000), 0);
});
