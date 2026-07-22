# Quickstart / Validation: Local-Only Branch Filter

## Prerequisites

```bash
cd .worktrees/026-local-only-filter
nvm use          # Node 24 per .nvmrc
pnpm install     # if not already
```

Set up a small fleet mixing branch states: at least one repository whose current branch has never been pushed (`git checkout -b scratch` with no `git push -u`), one with a normal tracked branch, one whose remote branch was deleted (`gone`), and one linked worktree on its own never-pushed branch.

## Automated checks

```bash
pnpm test        # builds, then runs node --test on dist/tests/*.test.js
```

Expect all existing tests to pass plus the new `isLocalOnly`/`filterRows 'local-only'` cases in `tests/filter.test.ts` (see plan.md's Development Workflow note and data-model.md).

## Manual scenarios (run `pnpm start`)

| # | Scenario | Expected |
|---|----------|----------|
| A | Look at the filter chip row | A new "local-only" chip appears after "gone", showing a live count (FR-001, FR-003) |
| B | Click the "local-only" chip | Only working trees whose current branch has no upstream configured are shown; everything else (tracked, gone, detached, unavailable) disappears (FR-002, US1-AS1/AS2) |
| C | With "local-only" active, click "All" | The full fleet reappears, unfiltered (US1-AS3) |
| D | With "local-only" active, look at a family whose primary is tracked but whose worktree has no upstream | Only that worktree's row is shown beneath the (otherwise non-matching) primary (US1-AS4) |
| E | With "local-only" active, type a search query that matches only tracked repos | The list narrows to nothing — search and filter compose with AND, same as every other chip (FR-004) |
| F | Turn off the "Worktrees" toggle while "local-only" is active | Local-only worktrees disappear from view (still counted in the chip's total), matching existing toggle behavior (FR-004) |
| G | Start a long operation (Refresh/Pull all/Cleanup/Rebase worktrees) | The "local-only" chip becomes non-interactive with a `not-allowed` cursor, no colour change (FR-005) |
| H | Put a working tree in a detached-HEAD state | It never appears under "local-only", even with no upstream conceptually applicable (FR-006, edge case) |
| I | Make a working tree's directory go missing (unavailable) | It never appears under "local-only" (FR-006, edge case) |
| J | Compare a repo with a deleted remote branch ("gone" tag) against "local-only" | It appears under "gone", never under "local-only" — the two remain distinct (edge case) |

## Out of scope for this quickstart

- No new IPC, main-process, or persisted-setting behavior exists to validate.
- No index.html/CSS change exists to validate — the chip is generated entirely by `summary.ts` into the existing `#filters` container.
