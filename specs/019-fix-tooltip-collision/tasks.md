# Tasks: Fix Duplicate-Indicator Tooltip Collision

**Input**: Design documents from `/specs/019-fix-tooltip-collision/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated tests. This fix is a single declarative CSS
selector with no new parsing/filtering/sorting logic for the project's
`node --test` suite to exercise. Verified manually via `quickstart.md`
(Scenarios A–G) — matching how prior CSS-only changes in this project
(features 011, 012, 015) were validated.

**Organization**: By user story (US1 is the P1/MVP fix; US2 is the P2
no-regression check on non-duplicate rows, verified by the same change).
Existing single-project Electron/TS layout; the only file touched is
`src/renderer/styles.css` — no new files or project scaffolding.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 (user-story phases only)

No Setup or Foundational phase: there is no project initialization and no
shared prerequisite beyond the one existing tooltip CSS this fix extends.

---

## Phase 1: User Story 1 — See only the duplicate notice when hovering the duplicate icon (Priority: P1) 🎯 MVP

**Goal**: Hovering a row's duplicate-clone icon shows exactly one tooltip
(the duplicate notice); the row's directory-path tooltip does not also
render.

**Independent Test**: On a row with the duplicate-clone icon, hover directly
over it and confirm only the duplicate-notice tooltip renders — no second
tooltip appears behind or alongside it (per spec.md User Story 1).

- [X] T001 [US1] In `src/renderer/styles.css`, add
      `.name:has(.row-dup-ico:hover)::after { display: none; }` immediately
      after the existing `.list.busy .name[data-tip]:hover::after { display:
      none; }` rule (line 870), per research.md Decision 2 — reusing the
      identical "hide `.name`'s tooltip via `display: none`" pattern already
      established there, for a second, independent trigger

**Checkpoint**: US1 fully satisfied and independently verifiable — quickstart
Scenarios A, F.

---

## Phase 2: User Story 2 — No regression for rows without a duplicate icon (Priority: P2)

**Goal**: Rows without the duplicate-clone icon continue to show the
directory-path tooltip exactly as before this fix.

**Independent Test**: Hover the name text of a row with no duplicate-clone
icon and confirm the directory-path tooltip appears unchanged (per spec.md
User Story 2).

- [ ] T002 [US2] Verify that T001 alone satisfies this: the new selector only
      matches `.name` elements that contain a `.row-dup-ico` descendant, so
      rows without the icon are structurally untouched. Run quickstart.md
      Scenarios B and C to confirm; no code change is anticipated here

**Checkpoint**: US1 + US2 together fully resolve the reported collision —
quickstart Scenarios A–C, F.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Regression-check the untouched parts of the app and close out
the manual validation this fix relies on in place of automated tests.

- [X] T003 [P] Run `pnpm test` to confirm the existing `node --test` suite
      (parsing/filtering/sorting logic) is unaffected by this CSS-only change
- [ ] T004 Run the full `quickstart.md` walkthrough (Scenarios A–G) against
      `pnpm start`, including Scenario D (no regression to other row icon
      tooltips, FR-005), Scenario E (duplicate icon's click behavior
      unchanged), and Scenario G (long-operation lockout suppression still
      holds, Constitution Principle IV)

**Checkpoint**: Feature complete and manually validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately.
- **User Story 2 (Phase 2)**: Depends on T001 — it verifies a consequence of
  that same change rather than introducing new code.
- **Polish (Phase 3)**: Depends on both stories being complete.

### Within Each User Story

Each story has a single task; there is no meaningful parallel split within a
story.

### Parallel Opportunities

- T003 and T004 (Phase 3) are independent verification methods and can run in
  parallel.
- No other tasks are parallelizable: T002 verifies T001's single-line change;
  there is nothing else to split.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (US1): add the one CSS rule.
2. **STOP and VALIDATE**: run quickstart Scenarios A and F.
3. This alone resolves the reported bug's entire symptom.

### Incremental Delivery

1. US1 → validate → the duplicate icon's tooltip renders alone (MVP).
2. US2 → validate (Scenarios B, C) → confirm no regression on any other row,
   with no additional code required.
3. Phase 3 polish/regression checks close out the fix.

---

## Notes

- [P] tasks = different files or independent verification, no dependency on
  an incomplete task.
- [Story] label maps task to specific user story for traceability.
- No test-first tasks: this fix has no new pure logic to unit-test (see Tests
  note above).
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently before
  continuing.
