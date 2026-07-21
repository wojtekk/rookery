---

description: "Task list for feature 015 — Unified Vector Icon Set"
---

# Tasks: Upgrade to a Unified Vector Icon Set

**Input**: Design documents from `specs/015-vector-icon-set/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/icon-catalog.md, quickstart.md

**Tests**: One pure unit test on the catalog module is included (per the contract's runnable check). No other tests requested — the delete/launch handlers are unchanged (glyph-only), so no mutating-operation path is touched.

**Organization**: Grouped by user story. The catalog rewrite is Foundational because a single file (`catalog.ts`) supplies the glyphs every story consumes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (equal weight), US2 (trash delete), US3 (recognizability)

## Path Conventions

Single-project Electron app; renderer sources under `src/renderer/`. Repo root is the `.worktrees/015-vector-icon-set/` working tree.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bundle the license required to redistribute Tabler glyph data.

- [X] T001 [P] Create `THIRD_PARTY_LICENSES` at repo root with the Tabler Icons MIT license text and copyright (© Paweł Kuna), plus a one-line note that only SVG path data is vendored inline (FR-009, research R7).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rewrite the one catalog module every story depends on. **No story can proceed until T002 is done.**

- [X] T002 Rewrite `src/renderer/view/icons/catalog.ts`:
  (a) change the `iconSvg()` wrapper from `fill="currentColor"` to `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` (keep `viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"`) — research R2;
  (b) replace every launcher entry's `svg` with the stroke-only Tabler path data (from `/tmp/claude-501/iconcmp/tabler.*.svg`) for ids `github`, `vscode`, `finder`, `terminal`, `git`, `folder`, `globe`(browser), `code`, `rocket`(launch), `gear`(settings) — keep the ids unchanged (FR-004/012, data-model invariants);
  (c) redraw the `intellij` entry as a **self-contained** glyph (explicit per-element paint) so it renders visible ink under `fill="none"` at the set's weight (FR-006, research R3);
  (d) add the `pickable?: boolean` field to `IconEntry` and five fixed-affordance entries with `pickable: false`: `trash`, `x`, `chevron-up`, `chevron-down`, `git-branch` (research R4);
  (e) set `ICON_IDS` to entries where `pickable !== false`;
  (f) restate `FALLBACK_SVG` as stroke-only so it inherits the weight-2 wrapper.

- [X] T003 Add a pure unit test for the catalog contract (e.g. `tests/icon-catalog.test.ts`, node:test) asserting C1–C6 from `contracts/icon-catalog.md`: every `ICON_IDS` glyph and each fixed affordance returns a well-formed `<svg>…</svg>` containing `stroke="currentColor"`; `ICON_IDS` includes `github`/`gear` and excludes `trash`/`x`; unknown id returns a non-empty `<svg>`; no output contains `http`.

**Checkpoint**: `pnpm build` + `pnpm test` green; launcher icons already re-skin (they render via `iconSvg`).

---

## Phase 3: User Story 1 — Icons read at equal visual weight (Priority: P1) 🎯 MVP

**Goal**: Every launcher/toolbar icon and every Settings/Cleanup overlay control glyph reads at one uniform weight.

**Independent Test**: Open the app with several repos + seeded launchers; confirm no icon in a row is heavier/lighter than its neighbours, and the overlay close/reorder/worktree glyphs match that weight (quickstart A, B, F, H, I, K).

- [X] T004 [US1] In `src/renderer/view/settings.ts`, swap the overlay text glyphs for `iconSvg()` output: line 80 `up.textContent = '↑'` → `chevron-up`; line 88 `down.textContent = '↓'` → `chevron-down`; line 235 `close.textContent = '×'` → `x`; line 266 `rm.textContent = '×'` → `trash` (use `innerHTML = iconSvg(id)`; keep each button's existing title/aria and handler).
- [X] T005 [US1] In `src/renderer/view/cleanup.ts`, line 76 `closeBtn.textContent = '×'` → `iconSvg('x')` (keep title/handler). *(Same file as T006 — do together, not in parallel with it.)*
- [X] T006 [US1] In `src/renderer/view/cleanup.ts`, line 185 `glyph.textContent = '⌂'` → `iconSvg('git-branch')`; leave the `title = 'Also removes a worktree'` unchanged (FR-013, research R6).
- [X] T007 [US1] In `src/renderer/styles.css`, ensure the Settings/Cleanup overlay control buttons (close, remove-dir, reorder up/down, worktree indicator) center their new `<svg>` at the same footprint the text glyphs occupied — reuse the `.menu` action-icon sizing pattern; no layout shift (FR-007).

**Checkpoint**: Launchers + overlays all render at uniform weight; US1 independently testable.

---

## Phase 4: User Story 2 — Delete affordance is a trash icon (Priority: P2)

**Goal**: The per-row delete control shows a trash glyph in the same style/weight, delete flow unchanged.

**Independent Test**: A row's delete control shows a trash icon matching the launcher icons; activating it runs the existing delete flow (quickstart D, E).

- [X] T008 [US2] In `src/renderer/view/table.ts`, line 228 `btn.textContent = '×'` → `btn.innerHTML = iconSvg('trash')` (import `iconSvg` if not already; keep the `.row-delete-ico` class, title/aria, `data-tip`, and click handler exactly — FR-005/012).
- [X] T009 [US2] In `src/renderer/styles.css` (`.row-delete-ico`, ~line 642), adapt the rule so it centers the 16px `<svg>` at the same footprint the `×` had (match `.menu` icon sizing); verify hover/disabled states still apply (FR-007, research R5).

**Checkpoint**: Trash delete icon matches row-mates; delete behavior verified unchanged.

---

## Phase 5: User Story 3 — Icons stay recognizable (Priority: P3)

**Goal**: Guardrail — brand + generic launchers remain identifiable; IntelliJ recognizable at the heavier weight; picker still correct.

**Independent Test**: All launcher glyphs identifiable; Settings picker offers the same launchers and does NOT offer trash/x/chevron/git-branch (quickstart C, G).

- [X] T010 [US3] Visually verify in `pnpm start` that GitHub, VS Code, Git, Finder, terminal, folder, browser, code, launch, settings are each recognizable, and the bespoke IntelliJ mark reads clearly at stroke-2 (FR-006, SC-002). Adjust the IntelliJ path data in `catalog.ts` if it reads too light/heavy.
- [X] T011 [US3] Confirm the Settings icon picker (driven by `ICON_IDS`) lists exactly the launcher ids and excludes `trash`/`x`/`chevron-up`/`chevron-down`/`git-branch` (FR-010, contract C4). Covered by T003 assertions; re-confirm in the live picker.

---

## Phase 6: Polish & Cross-Cutting

- [X] T012 Run `pnpm build` and `pnpm test` — all green (prior suite + T003). Also confirm **no new runtime dependency**: `package.json` and the lockfile are unchanged (icons are inline SVG only) — FR-011.
- [X] T013 Complete the `quickstart.md` manual walkthrough (scenarios A–N) against `pnpm start`, including offline render (M) and layout-no-shift (L). *(Owed as a pre-merge human check — an agent cannot drive real mouse/hover here.)*
- [X] T014 Grep the renderer to confirm no stray `×`/`⌂` affordance glyphs remain in scope (`table.ts`, `settings.ts`, `cleanup.ts`); the table sort arrow at `table.ts:408` is intentionally left as text (research R8, SC-003).

---

## Dependencies & Execution Order

- **T001** (license) is independent — do anytime.
- **T002** (catalog) blocks **everything** in Phases 3–5. **T003** depends on T002.
- **US1 (T004–T007)**, **US2 (T008–T009)**, **US3 (T010–T011)** all depend only on T002 and are otherwise **independent of each other** — can proceed in any order / in parallel once T002 lands.
- **Phase 6** runs last.

### Parallel opportunities

- T001 ‖ T002 (different files).
- After T002, these edit **different files** and can run in parallel: T004 (`settings.ts`) ‖ {T005 → T006} (`cleanup.ts`, run sequentially — same file) ‖ T008 (`table.ts`). CSS tasks T007/T009 both touch `styles.css` — serialize those two.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**: delivers the core reported value (equal visual weight) on its own.
- Then **US2** (trash delete) and **US3** (recognizability guardrail) as incremental follow-ons.
- Ship after Phase 6's build/test green; T013 manual walkthrough gates merge.
