---

description: "Task list for Relocate Search Icon Above the Table"

---

# Tasks: Relocate Search Icon Above the Table

**Input**: Design documents from `/specs/018-relocate-search-header/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/header-layout.md, quickstart.md

**Tests**: No new pure/branching logic is introduced (plan.md Constitution Check) — this is a DOM-position and CSS change over already-tested mechanisms (016's `renderSearch`/`filterRows`, unchanged). No new automated test file is required; the change is validated by a passing `pnpm test` (regression guard) plus manual `quickstart.md` scenarios (an agent cannot drive real hover/click/resize interaction against the Electron window).

**Organization**: Tasks are grouped by user story (spec.md priorities P1→P2). This is a renderer-only Electron feature touching four existing files (`index.html`, `styles.css`, `renderer.ts`, `view/summary.ts`) — see Dependencies for why US1 and US2 land as one atomic edit rather than two independently-shippable checkpoints.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (Setup and Polish carry no story label)

## Path Conventions

Single Electron project. Source under `src/renderer/`; run from `.worktrees/018-relocate-search-header`.

---

## Phase 1: Setup

- [X] T001 Confirm toolchain and green baseline in `.worktrees/018-relocate-search-header`: run `nvm use` (Node 24), `pnpm install`, then `pnpm test` and confirm the existing suite passes before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

No dedicated foundational tasks: this feature adds no shared engine, entity, or new dependency. The one DOM slot both stories affect (the first child of `.fleet-head`) is edited once, in US1, rather than through a separate shared layer. Proceed to Phase 3.

---

## Phase 3: User Story 1 - Find search where the table starts (Priority: P1) 🎯 MVP

**Goal**: The search control (icon, expandable input, clear button) lives at the top-left of the row directly above the table instead of the top title bar, with all of its existing behavior preserved byte-for-byte.

**Independent Test**: Open the app; the search icon is the leftmost control in the row above the table and absent from the top title bar; clicking/typing/clearing/Esc and the long-operation lockout all behave exactly as before relocation (quickstart A, B, E–H).

- [X] T002 [US1] In `src/renderer/index.html`, move the `<div id="search"></div>` node out of `.bar` (delete it from between `.bar-spacer` and `#toolbar`) and insert it as the **first child** of `.fleet-head`, in the slot currently occupied by `<span class="fleet-title" id="fleetTitle">Fleet</span>` — replace that span with the moved `#search` div (contracts/header-layout.md "After"). `#filters` stays immediately after it, unchanged.
- [X] T003 [P] [US1] In `src/renderer/renderer.ts`, remove the `fleetTitle: document.getElementById('fleetTitle') as HTMLElement` element lookup (~line 27) and the `title: els.fleetTitle` field from the `renderSummary(...)` call (~line 313) — the DOM node it pointed at no longer exists after T002, so leaving this wiring in place would write to `null` and crash on render.
- [X] T004 [P] [US1] In `src/renderer/view/summary.ts`, remove the `title: HTMLElement` field from the `SummaryElements` interface and delete the `els.title.textContent = \`Fleet — ${total} ...\`` line — there is no title element left to write into (data-model.md).
- [X] T005 [US1] In `src/renderer/styles.css`, add `flex-wrap: wrap` plus a small `row-gap` (e.g. `8px`) to the existing `.fleet-head` rule so `#filters` wraps onto a second line when it and the expanded `#search` box don't both fit on one row at the current width (FR-007, clarified 2026-07-21; research.md R4). `justify-content: space-between` stays — no other change needed for the single-line case.

**Checkpoint**: Search icon renders leftmost above the table and behaves identically to its pre-relocation self (nothing in `view/search.ts` changed); the top title bar reflows with no gap (R2 — `.bar-spacer` handles this for free, no CSS edit needed there); narrow windows wrap the filter chips instead of clipping. As an unavoidable side effect of T002 (the same slot can't hold both nodes), the "Fleet — N repositories" text is already gone at this checkpoint — MVP is demoable.

---

## Phase 4: User Story 2 - Remove the redundant repository count (Priority: P2)

**Goal**: No trace of the "Fleet — N repositories" text or its styling remains anywhere in the codebase; the footer's own count is untouched.

**Independent Test**: Search the whole app for the phrase — none found; the footer's "Showing X of Y..." text renders exactly as before (quickstart C, D).

- [X] T006 [P] [US2] In `src/renderer/styles.css`, remove the now-orphaned `.fleet-title` rule — nothing references it after T002 removed its only element.

**Checkpoint**: Zero remaining references to `.fleet-title`/`fleetTitle` in the codebase (`index.html`, `styles.css`, `renderer.ts`, `summary.ts` — see research.md R3's grep); footer count is unchanged.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T007 Run full build + suite: `pnpm test` in `.worktrees/018-relocate-search-header`; confirm all existing tests pass unchanged (no new logic — plan.md Constitution Check).
- [ ] T008 Execute all `quickstart.md` scenarios (A–M plus A2/B2) against `pnpm start` (manual — real hover/click/window-resize interaction, plus zero-repository and mid-search-relocation edge cases, the top-bar-reflow check, and the post-relocation chip-click check).
- [X] T009 [P] Update the root `CLAUDE.md` "Active feature" narrative to describe feature 018 (currently describes 017) — documentation-only touch-up.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: empty — nothing blocks the user stories beyond Setup.
- **User Stories (Phase 3→4)**: US2's only remaining task (T006) is independent of US1's tasks in file terms, but is only meaningful — and only non-empty — because T002 already removed `.fleet-title`'s element; sequencing US2 after US1 avoids leaving a temporarily-orphaned CSS rule visible as a "finished" state.
- **Polish (Phase 5)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Setup. Delivers the MVP alone — search relocation is fully functional and, as a same-edit side effect, the old title text is already gone (T002 cannot vacate the slot without removing it).
- **US2 (P2)**: after US1 (T006 cleans up styling for the element T002 already deleted — same coupling shape as feature 017's US2/US1 relationship).

### Parallel Opportunities

- T003 (renderer.ts) and T004 (summary.ts) are [P] — different files, both only need T002 done first.
- T006 (US2) is [P] relative to Polish tasks once US1 is complete.
- T009 in Polish is [P] (independent doc-only file).

---

## Parallel Example: User Story 1

```bash
# After T002 (index.html) lands, these touch independent files and can run together:
Task: "T003 Remove fleetTitle lookup/wiring in src/renderer/renderer.ts"
Task: "T004 Remove title field from SummaryElements in src/renderer/view/summary.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 3 US1 (T002–T005) → **STOP & validate** the search icon relocates correctly and behaves identically (quickstart A, B, E–H) → demoable MVP; the redundant text is already gone as a side effect.

### Incremental Delivery

1. Setup ready (green baseline).
2. US1 → search lives above the table, fully functional (MVP).
3. US2 → last trace of the old styling removed.
4. Polish → full suite green + manual quickstart + doc update.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Renderer-only: no IPC, no main-process change, no new dependency, no persisted setting (plan.md).
- Backward-compat invariant: `view/search.ts`'s `renderSearch` and its long-operation lockout are never edited — only the DOM position of the container it mounts into changes (T002).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
