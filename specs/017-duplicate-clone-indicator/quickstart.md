# Quickstart / Validation: Duplicate-Clone Indicator

## Prerequisites

```bash
cd .worktrees/017-duplicate-repo-viz
nvm use          # Node 24 per .nvmrc
pnpm install     # if not already
```

Set up at least one real duplicate on disk before testing — e.g. two clones of the same remote sharing a directory name under different parent folders:

```bash
mkdir -p /tmp/dup-a /tmp/dup-b
git clone <any-small-remote-url> /tmp/dup-a/example-repo
git clone <any-small-remote-url> /tmp/dup-b/example-repo
```

Add both `/tmp/dup-a` and `/tmp/dup-b` as observed directories (Settings).

## Automated checks

```bash
pnpm test        # builds, then runs node --test on dist/tests/*.test.js
```

Expect all prior tests to stay green — this feature adds no new pure logic (see plan.md Constitution Check), so no new test cases are expected here; a regression in the existing `filter.test.ts` or `sort.test.ts` suites would indicate an accidental behavior change.

## Manual scenarios (run `pnpm start`)

| # | Scenario | Expected |
|---|----------|----------|
| A | With the two `example-repo` clones discovered, look at both rows | Both show the new duplicate icon next to the name, alongside the existing "…/dup-a" / "…/dup-b" text (FR-001) |
| B | Look at a repository with no duplicate | No duplicate icon appears (FR-008) |
| C | Hover the duplicate icon on one row | Tooltip explains the repo is cloned in more than one place and names *that row's own* parent folder — phrased as "this copy is under …/{parent}", never as if it were the sibling's location (FR-002, clarified 2026-07-21; A1) |
| D | Click the duplicate icon (search currently collapsed) | Search box opens, is pre-filled with the repository's identity, and the table immediately narrows to both `example-repo` rows — no visible debounce delay (FR-004) |
| E | After D, clear the search field via the × button | Full list returns, exactly as a manually-typed search would clear (FR-005) |
| F | Set up a **second** duplicate where *neither* clone has a remote: `git init /tmp/dup-a/no-origin-repo && git init /tmp/dup-b/no-origin-repo` (leave both without an `origin`), refresh, then click the duplicate icon on one of them | Both `no-origin-repo` rows show the icon (they collide on directory name alone — the empty-slug + dirname key), and clicking narrows the search to both by directory name (FR-004 fallback). ⚠️ Removing `origin` from just *one* clone of a normal pair does the opposite — the icon disappears from **both**, since a mixed remote/no-remote pair no longer shares a detection key |
| G | Start Refresh / Pull all / Cleanup, then try clicking a duplicate icon | Nothing happens; cursor shows not-allowed; no colour/opacity change on the icon (FR-006) |
| H | Scroll so a duplicated row is the last *visible* row, then hover its duplicate icon | Tooltip flips upward instead of clipping off the bottom of the window (FR-007) |
| I | Add a third clone of the same remote under a third parent folder, refresh | All three rows show the icon; clicking any one of them narrows the table to all three (Edge Case: 3+ clones) |

## Notes

- No network traffic occurs beyond the git clones you set up manually for testing (Principle V).
- The duplicate indicator and its click are entirely renderer-side; no IPC round-trip, no main-process change.
