# Tasks: Custom Modern Table Scrollbar

**Input**: Design documents from `/specs/011-custom-table-scrollbar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated tests. This feature is pure DOM/CSS behavior
(scrollbar chrome + a class-toggling reveal timer) with no new parsing/
filtering/sorting logic — the project's existing `node --test` suite has no
DOM-testing harness (no jsdom), and introducing one for a single scrollbar
would violate the plan's "no new dependency" constraint (Principle V). This
feature is verified manually via `quickstart.md` (Scenarios A–G), matching how
prior DOM-only view changes in this project were validated.

**Organization**: By user story (US1+US2 together are the P1/MVP slice; US3 is
P2). Existing single-project Electron/TS layout; every task edits an existing
file — `src/renderer/styles.css` and `src/renderer/renderer.ts` — no new
files or project scaffolding.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (user-story phases only)

No Setup or Foundational phase: there is no project initialization and no
shared prerequisite beyond what User Story 1 itself creates (the base thin-
scrollbar CSS that US2/US3 both key off via the `.scrolling` class).

---

## Phase 1: User Story 1 — Uncluttered table by default (Priority: P1) 🎯 MVP (1/2)

**Goal**: The table's scrollbar is a thin, styled line rather than the OS
default, and stays fully invisible while idle.

**Independent Test**: Launch the app with a scrollable table and leave it
untouched — confirm no scrollbar track or thumb is visible anywhere along the
table's edge, and that scrolling still works via wheel/trackpad even though
nothing shows yet (per spec.md User Story 1).

- [X] T001 [US1] In `src/renderer/styles.css`, add `::-webkit-scrollbar` (thin width, e.g. 8px), `::-webkit-scrollbar-track` (transparent — no background/border, so it never reads as a boxy default track), and `::-webkit-scrollbar-thumb` (rounded, coloured from an existing token such as `--line`, `opacity: 0` by default) rules scoped to `.list` (next to the existing `.list` rule at styles.css:319, per research.md Decision 1); do not set `scrollbar-gutter` (would reserve permanent space and violate FR-009's no-layout-shift requirement)

**Checkpoint**: Scrollbar is thin-shaped in the DOM inspector but invisible at rest — US1 fully satisfied and independently verifiable (quickstart Scenario A).

---

## Phase 2: User Story 2 — Scrollbar appears while scrolling (Priority: P1) 🎯 MVP (2/2)

**Goal**: Scrolling the table fades the thin thumb in; it fades back out
~1s after the user stops, and keyboard-driven scrolling reveals it too.

**Independent Test**: Scroll the table and confirm the thumb fades in
immediately and fades out shortly after scrolling stops, with the thumb's
size/position accurately reflecting content (per spec.md User Story 2).

- [X] T002 [US2] In `src/renderer/styles.css`, add `.list.scrolling::-webkit-scrollbar-thumb { opacity: 1; }` and wrap the base thumb rule's `opacity` `transition` in `@media (prefers-reduced-motion: no-preference)` (mirroring the existing gate at styles.css:1175), so revealed/hidden is instant when reduced motion is requested (depends on T001; FR-006/FR-007)
- [X] T003 [US2] In `src/renderer/renderer.ts`, add a `REVEAL_HIDE_DELAY_MS` constant (~1000, per data-model.md) and a `revealHideTimer` module variable (same shape as the existing `busyShowTimer` at renderer.ts:70), plus `revealScrollbar()` (adds `.scrolling` to `els.list` and (re)starts a timeout that removes it after `REVEAL_HIDE_DELAY_MS`) and `scheduleScrollbarHide()` (starts that same removal timeout without adding the class) helper functions (depends on T002)
- [X] T004 [US2] In `src/renderer/renderer.ts`, add a `scroll` event listener on `els.list` that calls `revealScrollbar()`, placed near the existing `wireSortHeaders(els.thead, ...)` top-level wiring (renderer.ts:314) (depends on T003)
- [ ] T005 [US2] Per research.md Decision 5: during quickstart Scenario D, verify whether the T004 `scroll` listener already fires (and thus reveals the scrollbar) for keyboard-driven scrolling (arrow keys, Page Up/Down, Home/End on a focused row). If it does not, add a `keydown` listener on `els.list` in `src/renderer/renderer.ts` for those keys that also calls `revealScrollbar()` (depends on T004; FR-004 clarification)

**Checkpoint**: US1 + US2 together deliver the full P1/MVP experience — clean by default, informative while scrolling (quickstart Scenarios A, B, D, E, F).

---

## Phase 3: User Story 3 — Scrollbar appears on hover (Priority: P2)

**Goal**: Hovering the table also reveals the scrollbar, without requiring a
scroll first, so users can discover and grab it to drag-scroll.

**Independent Test**: With the table idle, hover the pointer over it without
scrolling and confirm the thumb fades in; move away and confirm it fades out
(per spec.md User Story 3).

- [X] T006 [US3] In `src/renderer/renderer.ts`, add `mouseenter` and `mouseleave` listeners on `els.list` next to the T004 `scroll` listener: `mouseenter` calls `revealScrollbar()`; `mouseleave` calls `scheduleScrollbarHide()` (not an immediate class removal, so a drag or recent scroll isn't cut short — per spec.md User Story 3 Acceptance Scenario 2/3) (depends on T004)

**Checkpoint**: All three user stories work together — full modern-IDE reveal behavior (quickstart Scenario C).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Regression-check the untouched parts of the app and close out
the manual validation this feature relies on in place of automated tests.

- [X] T007 [P] Run `pnpm test` to confirm the existing `node --test` suite (parsing/filtering/sorting logic) is unaffected by this feature's CSS/DOM-only changes
- [ ] T008 Run the full `quickstart.md` walkthrough (Scenarios A–G) against `pnpm start`, including Scenario G (scrollbar still works while the table is dimmed during a long operation, per Feature 009) and Scenario E (no layout shift, FR-009)

**Checkpoint**: Feature complete and manually validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately.
- **User Story 2 (Phase 2)**: Depends on US1's CSS (T001) existing so the
  `.scrolling` counterpart rule has a base thumb to toggle.
- **User Story 3 (Phase 3)**: Depends on US2's JS wiring (T004) — reuses
  `revealScrollbar()`/`scheduleScrollbarHide()` and the same listener
  registration point.
- **Polish (Phase 4)**: Depends on all desired user stories being complete.

### Within Each User Story

Tasks are listed in the order they must be done — each edits (or builds
directly on) the previous task's output in the same two files, so there is no
meaningful parallel split within a story.

### Parallel Opportunities

- T007 and T008 (Phase 4) are independent verification methods and can run in
  parallel.
- No other tasks are parallelizable: this is a two-file feature (`styles.css`,
  `renderer.ts`) where every task builds on the class name or helper function
  the previous task introduced.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1 (US1): thin, hidden-by-default scrollbar.
2. Complete Phase 2 (US2): scroll/keyboard-triggered reveal + fade + reduced-motion.
3. **STOP and VALIDATE**: run quickstart Scenarios A, B, D, E, F.
4. This is the MVP — spec.md marks US1 and US2 as equally-essential P1s.

### Incremental Delivery

1. US1 + US2 → validate → this is the deliverable MVP.
2. Add US3 (hover reveal) → validate (Scenario C) → full feature complete.
3. Phase 4 polish/regression checks close out the feature.

---

## Notes

- [P] tasks = different files or independent verification, no dependency on an incomplete task.
- [Story] label maps task to specific user story for traceability.
- No test-first tasks: this feature has no new pure logic to unit-test (see Tests note above).
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently before continuing.
