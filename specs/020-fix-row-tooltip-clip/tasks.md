# Tasks: Fix Row Directory Tooltip Clipping

**Input**: Design documents from `/specs/020-fix-row-tooltip-clip/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated tests. This fix is a one-line extension of an
existing selector string with no new parsing/filtering/sorting logic for the
project's `node --test` suite to exercise. Verified manually via
`quickstart.md` (Scenarios A–E) — matching how the mechanism's origin
(feature 012) and its most recent reuse (feature 019) were validated.

**Organization**: By user story. Spec.md defines a single user story (US1,
P1) — there is no P2/P3 split for this fix. Existing single-project
Electron/TS layout; the only file touched is `src/renderer/renderer.ts` — no
new files, no CSS change (the flip rule is already element-agnostic, per
research.md), no `view/table.ts` change (the `data-tip` attribute already
exists).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 (user-story phase only)

No Setup or Foundational phase: there is no project initialization and no
shared prerequisite beyond the one existing tooltip-flip mechanism
(`positionRowIconTooltip`, feature 012) this fix extends.

---

## Phase 1: User Story 1 — Read the directory tooltip on any visible row (Priority: P1) 🎯 MVP

**Goal**: A row's directory-path tooltip flips upward instead of being
clipped when the row is last visible in a scrolled or short-window table,
for both repository and worktree rows, with no change when there's already
room below.

**Independent Test**: Scroll the repository table (or shrink the window)
until a row's bottom edge is close to the bottom of the visible list, hover
that row's name area, and confirm the directory-path tooltip is fully
visible instead of cut off (per spec.md User Story 1).

- [X] T001 [US1] In `src/renderer/renderer.ts`, extend the delegated
      `mouseover` listener's `target.closest(...)` selector (currently
      `'.row-delete-ico, .row-action-ico, .row-warn-ico, .row-dup-ico'`,
      around line 441) to also match `.name`, so
      `positionRowIconTooltip(btn)` is invoked for the directory-path
      tooltip exactly as it already is for the other four row elements —
      per research.md Decision 1. No other file changes: the
      `.tip-up[data-tip]:hover::after` CSS rule and the `data-tip` attribute
      on `.name` already exist unmodified.

**Checkpoint**: US1 fully satisfied and independently verifiable — quickstart
Scenarios A, B, C.

---

## Phase 2: Polish & Cross-Cutting Concerns

**Purpose**: Regression-check the untouched parts of the app and close out
the manual validation this fix relies on in place of automated tests.

- [X] T002 [P] Run `pnpm test` to confirm the existing `node --test` suite
      (parsing/filtering/sorting logic) is unaffected by this one-line
      renderer change
- [ ] T003 Run the full `quickstart.md` walkthrough (Scenarios A–E) against
      `pnpm start`, including Scenario D (the flip re-evaluates fresh on the
      next hover after a resize/scroll, FR-005) and Scenario E (no
      regression to the busy-lockout and duplicate-icon tooltip
      suppressions, Constitution Principle IV / feature 017)

**Checkpoint**: Feature complete and manually validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately.
- **Polish (Phase 2)**: Depends on User Story 1 being complete.

### Within Each User Story

A single task; there is no meaningful parallel split within the story.

### Parallel Opportunities

- T002 and T003 (Phase 2) are independent verification methods and can run
  in parallel.
- No other tasks are parallelizable: T001 is the entire fix.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (US1): extend the one selector string.
2. **STOP and VALIDATE**: run quickstart Scenarios A–C.
3. This alone resolves the reported bug's entire symptom.

### Incremental Delivery

1. US1 → validate → the directory tooltip flips upward on the last visible
   row, with no change elsewhere (MVP, and the whole feature).
2. Phase 2 polish/regression checks close out the fix.

---

## Notes

- [P] tasks = different files or independent verification, no dependency on
  an incomplete task.
- [Story] label maps task to specific user story for traceability.
- No test-first tasks: this fix has no new pure logic to unit-test (see Tests
  note above).
- Commit after each task or logical group.
