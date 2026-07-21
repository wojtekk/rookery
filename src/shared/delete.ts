// Pure delete-outcome logic: whether a delete's result warrants a refresh.
// No Electron, no DOM — see specs/021-no-refresh-on-cancel-delete/research.md Decision 1/2.

import type { DeleteOutcome } from './types';

/** False only for a cancelled delete — nothing changed on disk, so no refresh is needed. */
export function shouldRefreshAfterDelete(outcome: DeleteOutcome): boolean {
  return outcome.outcome !== 'cancelled';
}
