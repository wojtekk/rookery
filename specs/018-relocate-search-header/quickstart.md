# Quickstart / Validation: Relocate Search Icon Above the Table

## Prerequisites

```bash
cd .worktrees/018-relocate-search-header
nvm use          # Node 24 per .nvmrc
pnpm install     # if not already
```

## Automated checks

```bash
pnpm test        # builds, then runs node --test on dist/tests/*.test.js
```

Expect all existing tests to pass unchanged — this feature introduces no new pure/branching logic (see plan.md's Constitution Check and Development Workflow note), so no new test file is added. A passing `pnpm test` run is itself the regression guard that `filterRows`, `renderSearch`, and the long-operation lockout are untouched.

## Manual scenarios (run `pnpm start`)

| # | Scenario | Expected |
|---|----------|----------|
| A | Look at the top title bar | No search icon present there (FR-001, US1-AS2) |
| A2 | Look at the top title bar's right side, where `#search` used to sit before `#toolbar` | `#toolbar` sits flush against the logo/spacer with no leftover gap or misalignment (FR-006) |
| B | Look at the row directly above the table | The search icon is the leftmost control in that row, with the filter chips to its right (FR-001, US1-AS1) |
| B2 | Click a filter chip (e.g. "dirty") after relocation | The table still narrows to that state, exactly as before relocation — chips are in working order, not just visually present (FR-003) |
| C | Look at that same row | No "Fleet — N repositories" text anywhere (FR-002, US2-AS1) |
| D | Look at the footer | Repository count text ("Showing X of Y...") is unchanged from before this feature (US2-AS2) |
| E | Click the relocated search icon | It expands into a focused text input, identical to its pre-relocation behavior (FR-004) |
| F | Type a query, wait ~150ms, then click × | Debounced narrowing then immediate clear — both work exactly as before (FR-004) |
| G | Type a query, then press Esc twice | First Esc clears the query, second collapses the input (FR-004, unchanged from feature 016) |
| H | Start a long operation (Refresh/Pull all/Cleanup) | The relocated search icon/input becomes non-interactive with a `not-allowed` cursor, no colour change — same lockout as before (FR-004) |
| I | Narrow the window until the expanded search input and all filter chips can't fit on one line | Filter chips wrap to a second line below the search row; nothing clips or overlaps (FR-007, clarified 2026-07-21) |
| J | Widen the window back out | Filter chips return to a single line beside the search control |
| K | With zero repositories discovered, look at the row above the table | Only the search icon and filter chips (all reading 0) are shown — no blank gap where the old text used to be (edge case) |
| L | Expand the search box and type a partial query, then trigger any unrelated re-render (e.g. Refresh completes) | The in-progress query is preserved and the input keeps focus — unaffected by relocation (edge case) |
| M | Compare the table's own sortable header row before/after | Spacing and alignment are pixel-identical — this feature must not touch it (FR-005) |

## Out of scope for this quickstart

- No new IPC, main-process, or persisted-setting behavior exists to validate.
- No new data model or filtering logic exists to validate beyond what feature 016 already covers.
