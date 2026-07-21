# Quickstart / Validation: Debounced Repository Search Filter

## Prerequisites

```bash
cd .worktrees/016-repo-search-filter
nvm use          # Node 24 per .nvmrc
pnpm install     # if not already
```

## Automated checks (pure logic)

```bash
pnpm test        # builds, then runs node --test on dist/tests/*.test.js
```

Expect all prior tests to stay green (the extended `filterRows` is backward-compatible) **plus** the new search cases in `tests/filter.test.ts`:
- substring match is case-insensitive and literal;
- matches on each of slug / directory name / origin / branch independently;
- empty / whitespace-only query returns the pre-feature result (regression guard);
- worktree rule: repo match ⇒ all worktrees; worktree-branch-only match ⇒ parent + only that worktree;
- AND-composition with the state/`failed` filter.

## Manual scenarios (run `pnpm start`)

Set up observed directories so the table has **≥ 50 repositories** (enough to exercise SC-001 — isolate one repo without scrolling), ideally including one with multiple worktrees on distinct branches.

| # | Scenario | Expected |
|---|----------|----------|
| A | Click the search icon in the header | It expands into a focused text input (FR-001, expandable icon) |
| B | Type a fragment of one repo's slug | Only rows whose slug/name/origin/branch contain it remain; result settles ~150 ms after you stop typing, not on every keystroke (FR-002, FR-003) |
| C | Type quickly then stop | No visible per-keystroke flicker; one settle (SC-002) |
| D | Type "FINN" against slug "finn-no" | Matches (case-insensitive, FR-003) |
| E | Type text that matches only an **origin URL** substring | Matching row(s) shown even though slug/name don't contain it (FR-003) |
| F | Type a fragment that matches nothing | "No repositories match your search." message, distinct from the discovered-empty state (FR-005) |
| G | Click the × button | Query clears immediately, full list returns (FR-007) |
| H | Type " main " (surrounding spaces) | Matches "main"; whitespace-only query shows everything (FR-006) |
| I | Turn Worktrees on; search a branch that exists only in one worktree (parent doesn't match) | Parent row shown with **only** that worktree; sibling worktrees hidden (FR-008) |
| J | Search a fragment that matches a parent repo | Parent shown with **all** its worktrees (FR-008) |
| K | Enable the "Failed" chip, then type a fragment | Only rows that are both failed AND matching (AND-composition, FR-010) |
| L | Start Refresh / Pull all / Cleanup, then try the search icon/input | Non-interactive for the duration (`not-allowed` cursor, no colour change); editable again once it settles, with the prior query preserved (FR-011, SC-005) |
| M | With an active query, click Refresh and let the set change | Same query re-applied to the new set without retyping (FR-009) |

## Notes

- No network traffic occurs (Principle V) — the footer still reads "no network traffic".
- Search state is session-only; restarting the app starts with no active search (FR-012).
