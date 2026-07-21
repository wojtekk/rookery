---
description: "Task list for Debounced Repository Search Filter"
---

# Tasks: Debounced Repository Search Filter

**Input**: Design documents from `/specs/016-repo-search-filter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/search-filter.md, quickstart.md

**Tests**: Included for the pure filter logic only — the combined state×search predicate is non-trivial branching logic, so the constitution's Development Workflow ("one runnable check") and the plan require it. UI behavior is validated manually via quickstart.md (an agent cannot drive real hover/typing/lockout against the Electron window).

**Organization**: Tasks are grouped by user story (spec.md priorities P1→P3). This is a renderer-only Electron feature; several stories necessarily edit the same three renderer files (`renderer.ts`, `view/search.ts`, `styles.css`), so cross-story parallelism is limited — see Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (setup, foundational, and polish carry no story label)

## Path Conventions

Single Electron project. Source under `src/renderer/`; tests under `tests/` at repo root (run from `.worktrees/016-repo-search-filter`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline; no new dependencies are introduced.

- [X] T001 Confirm toolchain and green baseline in `.worktrees/016-repo-search-filter`: run `nvm use` (Node 24), `pnpm install`, then `pnpm test` and confirm the existing suite passes before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure filter engine every story filters through. **All user stories depend on this.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Extend `filterRows` in `src/renderer/view/filter.ts`: add a trailing optional `searchQuery = ''` parameter (normalized as `.trim().toLowerCase()`; empty/whitespace ⇒ inactive), add pure helpers `searchMatchesRepo(entry, remote, q)` (slug · directoryName · rawUrl · branch) and `searchMatchesWorktree(entry, q)` (directoryName · own branch), and implement the combined state×search visibility rule per `data-model.md` (truth table) and `contracts/search-filter.md`. Empty query MUST reproduce today's output exactly.
- [X] T003 Extend `tests/filter.test.ts` with search cases: case-insensitive substring; independent match on each of slug / directoryName / origin(rawUrl) / branch; whitespace-only ⇒ full list; **empty-query regression guard**; worktree rule (repo match ⇒ all worktrees; worktree-branch-only match ⇒ parent + only that worktree); AND-composition with the state and `failed` filters; orphan-worktree search match. (Depends on T002's API.)

**Checkpoint**: `pnpm test` green, including new search cases and all pre-existing filter tests unchanged.

---

## Phase 3: User Story 1 - Narrow a long list by typing (Priority: P1) 🎯 MVP

**Goal**: A user types a fragment into an expandable search field and the table narrows, debounced, to rows whose slug/name/origin/branch contain it.

**Independent Test**: With ≥10 repos, click the search icon, type a fragment matching one repo's slug/origin/branch → only matching rows remain, settling ~150 ms after typing stops; matching is case-insensitive (quickstart A–E, H).

- [X] T004 [P] [US1] Add a `search` (magnifier) glyph entry to `src/renderer/view/icons/catalog.ts` (Tabler style, inherits the `stroke:currentColor` wrapper; `x` already exists for the later clear button).
- [X] T005 [US1] Create `src/renderer/view/search.ts` implementing `renderSearch(container, state, handlers)` per `contracts/search-filter.md §2`: collapsed magnifier icon that expands into a focused text input reflecting `state.query`; reports raw input via `onQueryChange`; `onToggleExpanded`. (× clear + busy handling come in US2/US3.)
- [X] T006 [US1] Add a `#search` container to the header in `src/renderer/index.html` (near `#toolbar` / `.fleet-head`).
- [X] T007 [US1] Wire search into `src/renderer/renderer.ts`: module-level `let searchQuery = ''` + a `setTimeout` debounce handle (150 ms trailing); call `renderSearch` into `#search`; on debounced change set `searchQuery` and `render()`; pass `searchQuery` as the new `filterRows(...)` argument (renderer.ts:284).
- [X] T008 [P] [US1] Style the collapsed icon and expanded input (expand/collapse layout, sizing, alignment with existing header controls) in `src/renderer/styles.css`.

**Checkpoint**: Typing filters the table live and debounced; MVP is demoable.

---

## Phase 4: User Story 2 - Recover the full list & understand "no matches" (Priority: P2)

**Goal**: A discoverable one-click clear returns to the full list, and a query matching nothing shows an honest, distinct message.

**Independent Test**: Type a fragment matching nothing → "No repositories match your search." (distinct from the discovered-empty state); click × → full list returns (quickstart F, G).

- [X] T009 [US2] Add the × clear button to `src/renderer/view/search.ts`: shown only when the query is non-empty; click or Esc clears to `''` immediately (bypassing debounce) via `onQueryChange('')`; Esc when already empty collapses the field. (Edits the US1 file — sequential after T005.)
- [X] T010 [US2] Render a distinct no-match state in `src/renderer/renderer.ts` (reusing/extending `src/renderer/view/empty.ts` copy as needed) when `rows.length > 0 && visible.length === 0`: message "No repositories match your search.", visibly separate from the `rows.length === 0` discovered-empty state.
- [X] T011 [P] [US2] Style the × clear button and the no-match message in `src/renderer/styles.css`.

**Checkpoint**: Clear and no-match feedback both work; US1 still works.

---

## Phase 5: User Story 3 - Composes with filters & obeys the long-op lockout (Priority: P3)

**Goal**: Search ANDs with the Failed chip and Worktrees toggle (already handled by the T002 engine), persists across list changes, and is blocked during long operations per Principle IV.

**Independent Test**: Failed chip + fragment → intersection only; worktree-branch-only match → parent + just that worktree; during Refresh/Pull all/Cleanup the search is non-interactive (not-allowed cursor, no colour change) then restores with the query preserved (quickstart I, J, K, L, M). (AND/worktree correctness is already asserted by T003.)

- [X] T012 [US3] Thread the existing `busy` flag (`refreshing||updating||cleaning`, renderer.ts:244) into `renderSearch` (`src/renderer/renderer.ts` + `src/renderer/view/search.ts`): while busy the icon/input is non-interactive (handlers not wired, `aria-disabled`), matching `renderToolbar`'s pattern; restored on settlement.
- [X] T013 [US3] Style the busy search state in `src/renderer/styles.css`: `cursor: not-allowed`, block pointer/typing, and **no colour/opacity change** (neutralize the native `disabled`/`readonly` grey-out) per constitution Principle IV.
- [X] T014 [US3] Verify FR-009 in `src/renderer/renderer.ts`: `render()` already re-applies the module-level `searchQuery` after refresh/delete/pull-all/cleanup — confirm no code path resets it, and add re-application only if a gap is found (no new file expected).

**Checkpoint**: All three stories functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 Run full build + suite: `pnpm test` in `.worktrees/016-repo-search-filter`; confirm all tests (existing + new search cases) pass.
- [X] T016 [P] Accessibility pass on `src/renderer/view/search.ts`: accessible label on the search icon ("Search repositories") and input, and correct `aria-disabled` in the busy state.
- [ ] T017 Execute `quickstart.md` scenarios A–M against `pnpm start` (manual — real hover/typing/lockout interaction), and confirm FR-012: searching triggers no git/network activity (footer still reads "no network traffic") and search state resets on restart.
- [X] T018 [P] Update the root `CLAUDE.md` "Active feature" narrative to describe feature 016 (currently stale on 013/015) — documentation-only touch-up.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — **blocks all user stories** (they all call the extended `filterRows`).
- **User Stories (Phase 3→5)**: each depends on Foundational. They are **mostly sequential**, not parallel, because US2 and US3 edit the same files US1 creates (`view/search.ts`, `renderer.ts`, `styles.css`).
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational. Delivers the MVP alone.
- **US2 (P2)**: after US1 (extends `view/search.ts` and `renderer.ts`).
- **US3 (P3)**: after US1 (extends `view/search.ts`, `renderer.ts`, `styles.css`); independent of US2.

### Parallel Opportunities

- T002 → T003 are sequential (test depends on the implemented API).
- Within US1: **T004 (catalog) and T008 (CSS) are [P]** — different files from the TS wiring; T005→T006→T007 are sequential (component → container → wiring).
- Within US2: **T011 (CSS) is [P]** with T009/T010.
- Within US3: T012 and T013 touch shared/CSS files respectively; T016 and T018 in Polish are [P] (different files).
- Cross-story parallelism is intentionally limited (shared renderer files) — do not parallelize US1/US2/US3.

---

## Parallel Example: User Story 1

```bash
# After T005–T007 land the component + wiring, these two touch independent files:
Task: "T004 Add 'search' glyph in src/renderer/view/icons/catalog.ts"
Task: "T008 Style search icon/input in src/renderer/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (filter engine + tests) → 3. Phase 3 US1 → **STOP & validate** typing-to-filter (quickstart A–E, H) → demoable MVP.

### Incremental Delivery

1. Foundational ready (green filter tests).
2. US1 → typing filters live (MVP).
3. US2 → clear + honest no-match feedback.
4. US3 → filter composition + long-op lockout.
5. Polish → full suite green + manual quickstart + doc update.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Renderer-only: no IPC, no main-process change, no new dependency, no persisted setting (plan.md).
- Backward-compat invariant: the empty-`searchQuery` path must keep every pre-existing `filter.test.ts` case green (T003).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
