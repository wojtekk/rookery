import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshAfterDelete } from '../src/shared/delete';
import type { DeleteOutcome } from '../src/shared/types';

test('shouldRefreshAfterDelete: false when cancelled', () => {
  const outcome: DeleteOutcome = { outcome: 'cancelled' };
  assert.equal(shouldRefreshAfterDelete(outcome), false);
});

test('shouldRefreshAfterDelete: true when deleted', () => {
  const outcome: DeleteOutcome = { outcome: 'deleted' };
  assert.equal(shouldRefreshAfterDelete(outcome), true);
});

test('shouldRefreshAfterDelete: true when failed', () => {
  const outcome: DeleteOutcome = { outcome: 'failed', reason: 'permission denied' };
  assert.equal(shouldRefreshAfterDelete(outcome), true);
});
