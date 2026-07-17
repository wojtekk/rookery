// Pure startup screen decision + loader timing (no DOM, no clock reads). See contracts/loadstate.md.

export type LoadState = 'loading' | 'ready';
export type StartupScreen = 'loader' | 'add-directory' | 'results';

export const LOADER_SHOW_DELAY_MS = 150;
export const LOADER_MIN_VISIBLE_MS = 400;

/** Which of the three startup screens to paint (hasDirectories === true never yields 'add-directory' — SC-006/FR-010). */
export function decideStartupScreen(loadState: LoadState, hasDirectories: boolean): StartupScreen {
  if (!hasDirectories) return 'add-directory';
  return loadState === 'loading' ? 'loader' : 'results';
}

/** Ms still required before a shown loader may be replaced by results. Never negative. */
export function remainingMinVisibleMs(shownAt: number | null, now: number, minMs = LOADER_MIN_VISIBLE_MS): number {
  if (shownAt === null) return 0;
  return Math.max(0, minMs - (now - shownAt));
}
