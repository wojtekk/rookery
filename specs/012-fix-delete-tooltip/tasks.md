# Tasks: Fix Delete Button Tooltip Clipping

**Input**: Design documents from `/specs/012-fix-delete-tooltip/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated tests. This fix is CSS positioning plus a small
DOM-geometry measurement, with no new parsing/filtering/sorting logic for the
project's `node --test` suite to exercise. Verified manually via
`quickstart.md` (Scenarios A–F) and, during development, an isolated
Playwright browser harness against the real markup/CSS — matching how prior
DOM/CSS-only changes in this project (e.g. feature 011) were validated.

**Organization**: By user story (US1 is the P1/MVP fix; US2 is the P2
consequence verified by the same fix). Existing single-project Electron/TS
layout; the files touched are `src/renderer/styles.css` and
`src/renderer/renderer.ts` — no new files or project scaffolding.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 (user-story phases only)

No Setup or Foundational phase: there is no project initialization and no
shared prerequisite beyond the one existing CSS rule this fix extends.

---

## Phase 1: User Story 1 — Read the full delete tooltip (Priority: P1) 🎯 MVP

**Goal**: The "Delete" tooltip on a row's delete icon renders fully, without
being clipped by the table's right edge, on any row and at any window width.

**Independent Test**: Hover the delete icon on a repository row and a
worktree row at normal and narrow window widths, and while scrolled — confirm
the full "Delete" text is always visible (per spec.md User Story 1).

- [X] T001 [US1] In `src/renderer/styles.css`, extend the existing right-edge
      tooltip-alignment selector at line 708
      (`.menu [data-tip]:hover::after { left: auto; right: 0; }`) to also
      match `.row-delete-ico[data-tip]:hover::after`, per research.md
      Decision 1 (reuse the existing rule rather than duplicating it)

- [X] T001b [US1] Found during manual verification (quickstart Scenario A):
      the same `.list` clipping also blocks the tooltip's downward growth
      when there's no room below the hovered row inside the *visible* list —
      not necessarily the table's last row, since a short window can leave
      more rows below, reachable only by scrolling. A first CSS-only attempt
      (`.row:last-child`) missed this and was replaced per research.md
      Decision 1a (revised):
      - In `src/renderer/styles.css`, add
        `.tip-up[data-tip]:hover::after { top: auto; bottom:
        calc(100% + 8px); }` right after T001's rule
      - In `src/renderer/renderer.ts`, add `TOOLTIP_MIN_SPACE_PX` (~40),
        `positionRowIconTooltip(btn)` (measures `spaceBelow` between the
        button and `#list`'s visible bottom edge via
        `getBoundingClientRect()`, toggles `.tip-up`), and a `mouseover`
        listener delegated on `els.list` (rows are re-created every render)
        — same shape as the existing `revealScrollbar`/
        `scheduleScrollbarHide` pattern (depends on T001)

- [X] T001c [US1] Per FR-006 (added after the user confirmed the same issue
      affects configurable per-row action icons): extend T001b's delegated
      `mouseover` listener in `src/renderer/renderer.ts` to also match
      `.row-action-ico` targets (`target.closest('.row-delete-ico,
      .row-action-ico')`), since `.menu` action icons anchor their tooltip
      from an icon at/near the row's right edge identically to the delete
      icon and are equally affected — verified in the same isolated browser
      harness used for T001b (depends on T001b)

**Checkpoint**: US1 fully satisfied and independently verifiable — quickstart
Scenarios A, B, C, D.

---

## Phase 2: User Story 2 — No stray artifact during hover (Priority: P2)

**Goal**: Hovering a delete icon no longer causes an unstyled white/light box
to appear in the table's bottom-right corner.

**Independent Test**: Hover a delete icon (including on the last row) and
confirm no corner artifact appears, before, during, or after the hover (per
spec.md User Story 2).

- [ ] T002 [US2] Verify that T001 alone resolves this: per research.md
      Decision 2, the corner artifact's only known trigger is the same
      rightward tooltip overflow fixed in T001, so no additional styling is
      expected. Run quickstart.md Scenario E to confirm; if the artifact
      still appears after T001, this indicates a second overflow source and
      needs further investigation before closing this story (no code change
      anticipated here per the 2026-07-20 clarification — general
      `::-webkit-scrollbar-corner` styling is explicitly out of scope)

**Checkpoint**: US1 + US2 together fully resolve the reported bug — quickstart
Scenarios A–E.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Regression-check the untouched parts of the app and close out
the manual validation this fix relies on in place of automated tests.

- [X] T003 [P] Run `pnpm test` to confirm the existing `node --test` suite
      (parsing/filtering/sorting logic) is unaffected by this CSS-only change
- [ ] T004 Run the full `quickstart.md` walkthrough (Scenarios A–F) against
      `pnpm start`, including Scenario F (no regression to delete's
      click/confirmation behavior, FR-005)

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
- No other tasks are parallelizable: T001b/T001c build directly on T001's
  selector and each other's listener code in the same two files.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (US1): fix the tooltip's right-edge clipping.
2. **STOP and VALIDATE**: run quickstart Scenarios A–D.
3. This alone resolves the reported bug's primary (P1) symptom.

### Incremental Delivery

1. US1 → validate → the tooltip renders correctly (MVP).
2. US2 → validate (Scenario E) → confirm the corner artifact is gone too,
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
