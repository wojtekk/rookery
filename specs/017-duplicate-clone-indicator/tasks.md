---
description: "Task list for Duplicate-Clone Indicator"
---

# Tasks: Duplicate-Clone Indicator

**Input**: Design documents from `/specs/017-duplicate-clone-indicator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/duplicate-indicator.md, quickstart.md

**Tests**: No new pure/branching logic is introduced (plan.md Constitution Check) — the feature composes existing, already-tested mechanisms (the `collisionFragment` gate, 016's `filterRows`, the delete icon's disabled/tooltip pattern). No new automated test file is required; UI behavior is validated manually via `quickstart.md` (an agent cannot drive real hover/click/lockout interaction against the Electron window).

**Organization**: Tasks are grouped by user story (spec.md priorities P1→P3). This is a renderer-only Electron feature touching a handful of existing files (`table.ts`, `renderer.ts`, `styles.css`, `icons/catalog.ts`) — see Dependencies for the resulting sequencing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup and Polish carry no story label)

## Path Conventions

Single Electron project. Source under `src/renderer/`; run from `.worktrees/017-duplicate-repo-viz`.

---

## Phase 1: Setup

- [X] T001 Confirm toolchain and green baseline in `.worktrees/017-duplicate-repo-viz`: run `nvm use` (Node 24), `pnpm install`, then `pnpm test` and confirm the existing suite passes before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

No dedicated foundational tasks: this feature adds no shared engine. Detection (`scan.ts`) and matching (`filterRows`, 016) are reused unchanged (FR-003); the one new icon asset and the one new handler are each scoped to a single story below, and US2 builds directly on the button US1 creates rather than on a separate shared layer. Proceed to Phase 3.

---

## Phase 3: User Story 1 - Recognize a duplicate clone at a glance (Priority: P1) 🎯 MVP

**Goal**: Every row sharing today's existing collision key shows a dedicated icon next to its name, with a tooltip explaining what it means.

**Independent Test**: With two clones of the same remote sharing a directory name under different parent folders, both rows show the new icon; hovering explains the repo is cloned elsewhere and names this row's own parent folder; a repo with no duplicate shows nothing extra (quickstart A–C).

- [X] T002 [P] [US1] Add one new "duplicate/copy" glyph entry to `src/renderer/view/icons/catalog.ts` (Tabler-outline recipe — `fill="none" stroke="currentColor" stroke-width="2"`, inherited from `iconSvg()`'s wrapper — same shape as every existing entry, e.g. `trash`/`search`).
- [X] T003 [US1] In `buildRow` (`src/renderer/view/table.ts:290-295`), inside the existing `if (entry.collisionFragment)` block, render a new `<button class="row-dup-ico" type="button">` alongside the current `.frag` text node: `btn.innerHTML = iconSvg('<new-id-from-T002>')`; `aria-label` and `data-tip` set to an explanatory sentence built from `entry.collisionFragment` (research.md R4 — e.g. "This repository is also cloned elsewhere (this copy is under …/{fragment})"). ⚠️ `{fragment}` is **this** row's own parent folder, never the sibling's location — do not phrase it as "cloned under …/{fragment}", which would misread the row's own path as the other copy's (A1); `btn.disabled = locked` (the `locked` parameter is already in scope in `buildRow`). No click listener yet — added in US2. When `entry.collisionFragment` is `null`, output MUST stay byte-for-byte identical to today (no new element).
- [X] T004 [P] [US1] Add `.row-dup-ico` base styling to `src/renderer/styles.css`: size/color/cursor mirroring `.row-action-ico`'s shape (styles.css:700-711) and a hover state; add `.row-dup-ico` to the shared icon-sizing selector list (styles.css:757-762, the `display: block` rule shared by `.row-delete-ico svg, .row-action-ico svg, ...`).

**Checkpoint**: Icon renders next to `.frag` exactly when a duplicate exists, with correct tooltip text; unaffected rows are pixel-identical to before. MVP is demoable (awareness alone already resolves the original confusion).

---

## Phase 4: User Story 2 - Jump straight to all the copies (Priority: P2)

**Goal**: Clicking the indicator opens/fills the existing repository search so the table narrows to every clone of that repository.

**Independent Test**: Click the duplicate icon (search collapsed) → search opens, pre-filled with the repository's identity, table narrows immediately (no debounce wait); clearing the field returns the full list; a row with no parsed remote falls back to matching by directory name (quickstart D–F).

- [X] T005 [US2] Add `onFindDuplicate: (key: string) => void` to the `RowActionHandlers` interface (`src/renderer/view/table.ts:11-14`) and wire the button created in T003 to call `handlers.onFindDuplicate(remote?.slug ?? entry.directoryName)` on click — the identical fallback pattern already used for the `.slug` cell at `table.ts:299`. (Depends on T003.)
- [X] T006 [US2] Implement `onFindDuplicate` in `src/renderer/renderer.ts` (alongside the existing `onRun`/`onDelete` handlers passed into `buildRow`): `searchExpanded = true; searchQuery = key; render();` — set directly and rendered synchronously, the same debounce-bypass shape the existing × clear path already uses (`renderer.ts:68`, `297`, `304`).

**Checkpoint**: Clicking a duplicate icon isolates every clone of that repository via the existing search box; clearing search behaves exactly as a manually typed query would. US1 still renders correctly.

---

## Phase 5: User Story 3 - Behaves like every other row control (Priority: P3)

**Goal**: The indicator is inert (not just dim) during a long operation and its tooltip never clips, matching every other row icon's established behavior.

**Independent Test**: During Refresh/Pull all/Cleanup, clicking the icon does nothing and shows a not-allowed cursor with no colour/opacity change; on the last visible row of a scrolled list, its tooltip flips upward instead of clipping (quickstart G–H).

- [X] T007 [P] [US3] Add `.row-dup-ico:disabled { cursor: not-allowed; }` to `src/renderer/styles.css`, mirroring `.row-delete-ico:disabled` (styles.css:748-750) — no colour/opacity change, `disabled = locked` (already set in T003) is the only signal.
- [X] T008 [US3] Add `.row-dup-ico` to the tooltip-flip delegation selector in `src/renderer/renderer.ts` (`target.closest('.row-delete-ico, .row-action-ico, .row-warn-ico')`, `renderer.ts:437`) so `positionRowIconTooltip` toggles `.tip-up` on it near the list bottom, consistent with every other row icon tooltip (012/013).

**Checkpoint**: All three stories functional and independently testable; the indicator behaves identically to the delete/custom-action icons in every lockout and tooltip-positioning respect.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Run full build + suite: `pnpm test` in `.worktrees/017-duplicate-repo-viz`; confirm all existing tests pass unchanged (no new pure logic — see plan.md Constitution Check).
- [X] T010 [P] Accessibility check on the new button in `src/renderer/view/table.ts`: confirm its `aria-label` reads sensibly on its own (screen-reader convention consistent with `.row-delete-ico`'s `aria-label` at `table.ts:251`).
- [ ] T011 Execute `quickstart.md` scenarios A–I against `pnpm start` (manual — real hover/click/lockout interaction, plus a 3-clone scenario), including confirming no new git/network activity occurs (Principle V).
- [X] T012 [P] Update the root `CLAUDE.md` "Active feature" narrative to describe feature 017 (currently describes 016) — documentation-only touch-up.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: empty — nothing blocks the user stories beyond Setup.
- **User Stories (Phase 3→5)**: US2 depends on the button US1 creates (T003); US3's styling (T007) is independent of US2 but its tooltip-flip wiring (T008) is independent of both and could in principle land any time after T003.
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Setup. Delivers the MVP alone (awareness fixes the original confusion even without the click action).
- **US2 (P2)**: after US1 (T005 wires the click listener onto US1's button — same file, sequential).
- **US3 (P3)**: after US1 (T003 sets `disabled = locked`, already present); independent of US2.

### Parallel Opportunities

- T002 (catalog) and T004 (CSS) are [P] — different files from T003's TS change.
- T007 (CSS) and T008 (renderer.ts selector) are both [P] relative to each other and to US2's tasks — different files, no shared incomplete dependency.
- T010 and T012 in Polish are [P] (different files).
- T005 and T006 are sequential within US2 (T006's handler is what T005's click calls).

---

## Parallel Example: User Story 1

```bash
# These touch independent files and can run together, ahead of/alongside T003:
Task: "T002 Add duplicate/copy glyph in src/renderer/view/icons/catalog.ts"
Task: "T004 Style .row-dup-ico in src/renderer/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 3 US1 (icon + tooltip) → **STOP & validate** the icon renders correctly and explains itself (quickstart A–C) → demoable MVP that already resolves the original confusion.

### Incremental Delivery

1. Setup ready (green baseline).
2. US1 → duplicate rows are self-explanatory (MVP).
3. US2 → one click isolates every copy via search.
4. US3 → lockout + tooltip-flip parity with every other row icon.
5. Polish → full suite green + manual quickstart + doc update.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Renderer-only: no IPC, no main-process change, no new dependency, no persisted setting (plan.md).
- Backward-compat invariant: rows with `entry.collisionFragment === null` render byte-for-byte identically to today (T003).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
