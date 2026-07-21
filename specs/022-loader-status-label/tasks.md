# Tasks: Label the Loader With the Active Operation

**Input**: Design documents from `/specs/022-loader-status-label/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated test file. Every changed line is a literal label
passed at an existing call site, DOM element creation/text assignment with
no new branch, or CSS — the constitution's runnable-check mandate targets
mutating-operation guard/safety logic, which this feature doesn't touch (see
research.md Decision 4). This mirrors features 017/018/020.

**Organization**: By user story. Spec.md defines two priorities: US1 (P1) —
the label exists, is correctly worded, positioned above the dots, timed with
the dots, and accessible; US2 (P2) — the label's visual weight is subdued/
blended rather than a dominant banner. No Setup or Foundational phase: there
is no project initialization and no shared prerequisite beyond the existing
`beginBusyLock`/`setLoaderVisible` choke point this fix extends.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 or US2 (user-story phase only)

---

## Phase 1: User Story 1 — See what the app is doing while it loads (Priority: P1) 🎯 MVP

**Goal**: The loader shows a correctly-worded label ("Loading…"/
"Refreshing…"/"Pulling…"/"Cleaning up…") above its three dots, in sync with
the dots' own show/hide timing, announced to assistive technology as a
polite status update.

**Independent Test**: Trigger each of the four operations (initial launch,
Refresh, Pull all, Cleanup) one at a time; confirm the loader shows the
correct label above the dots while visible, and no label once it hides (per
spec.md User Story 1, quickstart Scenarios A–D).

- [X] T001 [US1] In `src/renderer/view/loader.ts`, change
      `setLoaderVisible(container, visible)` to
      `setLoaderVisible(container, visible, label?)`. In the existing
      one-time build step (`childElementCount === 0` guard), create a
      `.loader-label` element first (with `role="status"`), then a
      `.loader-dots` wrapper containing the existing three `.loader-dot`
      children (currently appended directly to `container`) instead of
      appending the dots straight to `container`. When `visible` is `true`
      and `label` is provided, set the `.loader-label` element's
      `textContent` to `label`. Per research.md Decisions 1–3 and
      data-model.md.
- [X] T002 [US1] In `src/renderer/renderer.ts`, change `beginBusyLock()` to
      `beginBusyLock(label: string)` and pass `label` through to its
      `setLoaderVisible(els.tableLoader, true, label)` call. Update all four
      call sites to pass their own literal: the startup IIFE →
      `beginBusyLock('Loading…')`, `doRefresh()` → `beginBusyLock('Refreshing…')`,
      `doUpdateAll()` → `beginBusyLock('Pulling…')`, `doCleanup()` →
      `beginBusyLock('Cleaning up…')`. Depends on T001 (the signature it
      calls into). Per data-model.md's call-site table.
- [X] T003 [P] [US1] In `src/renderer/styles.css`, change `.table-loader`
      from a row to a column flex container (`flex-direction: column`,
      keep `align-items: center; justify-content: center;`) and add a new
      `.loader-dots { display: flex; gap: 16px; }` rule carrying the row
      gap `.table-loader` used to have between dots — so the label (now the
      first child, per T001) sits above the row of dots rather than beside
      or below them. Verify `.loader-dot:nth-child(2)`/`:nth-child(3)`'s
      pulse-stagger animation still applies correctly now that the dots'
      immediate parent is `.loader-dots` instead of `.table-loader` (per
      research.md Decision 2, no selector change is needed). Can be written
      in parallel with T001/T002 — targets class names already fixed by the
      design, in a different file.

**Checkpoint**: US1 fully satisfied and independently verifiable —
quickstart Scenarios A–D, F, G. The label exists, is correctly worded and
positioned, and is announced to assistive technology, even before US2's
visual polish.

---

## Phase 2: User Story 2 — Label doesn't distract from the loading animation (Priority: P2)

**Goal**: The label's font size and color read as part of the same quiet
loading indicator as the dots, not a bold banner.

**Independent Test**: Compare the label's font size and color against the
loader dots and confirm neither element visually overpowers the other (per
spec.md User Story 2, quickstart Scenario E).

- [X] T004 [US2] In `src/renderer/styles.css`, add a `.loader-label` rule:
      small font size close to the app's existing small-text scale (e.g.
      `font-size: 13px`, matching other muted small text in this
      stylesheet) and `color: var(--muted)` (the same colour already used
      by `.loader-dot`'s `background`), so the label blends with the dots
      rather than rendering at the browser's default text size/colour.

**Checkpoint**: Both user stories satisfied — the label is correct,
positioned, accessible, and visually subdued.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the existing suite is unaffected, then manually
validate the end-to-end behavior quickstart.md relies on for the parts an
automated test can't reach (real timing, real visual weight, optional
screen-reader check).

- [X] T005 [P] Run `pnpm test` to confirm the existing `node --test` suite
      passes unchanged (no new test file was added, per research.md
      Decision 4).
- [ ] T006 Run the full `quickstart.md` walkthrough (Scenarios A–G) against
      `pnpm start`, covering all four operations' labels, the label's
      position/visual weight, and the long-operation lockout regression
      check.

**Checkpoint**: Feature complete and validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately.
- **User Story 2 (Phase 2)**: Depends on T001 (the `.loader-label` element
  T004 styles must already exist) — in practice, do Phase 1 first.
- **Polish (Phase 3)**: Depends on Phase 1 and Phase 2 being complete.

### Within User Story 1

- T001 (the `loader.ts` signature/DOM change) blocks T002 (calls the new
  signature). T003 (CSS layout) targets fixed class names and can be
  written in parallel with T001/T002, in a different file.

### Parallel Opportunities

- T003 can run in parallel with T001/T002 (different file, no shared
  dependency on completed code — only on the design's fixed class names).
- T005 and T006 (Phase 3) are independent verification methods and can run
  in parallel.

---

## Parallel Example: User Story 1

```bash
# Can start together — different files, no interdependency on completed code:
Task: "Restructure .table-loader to column flex + add .loader-dots wrapper rule in src/renderer/styles.css"
Task: "Extend setLoaderVisible(container, visible, label?) in src/renderer/view/loader.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (US1): `loader.ts`'s label element, `renderer.ts`'s
   four labelled call sites, and the CSS layout that puts the label above
   the dots.
2. **STOP and VALIDATE**: run quickstart Scenarios A–D — every operation
   shows its correct label, in sync with the dots.
3. This alone resolves the reported request's core ask (informative text
   naming the operation).

### Incremental Delivery

1. US1 → validate → the loader is informative (correct label, correct
   position, correct timing, accessible) even if visually plain.
2. US2 → validate → the label now blends in — small, muted, no longer
   visually competing with the dots.
3. Phase 3 polish/regression checks close out the feature.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- [Story] label maps task to specific user story for traceability.
- Test-first is not mandated here (no TDD explicitly requested, and no new
  branching logic requires a runnable check per the constitution).
- Commit after each task or logical group.
