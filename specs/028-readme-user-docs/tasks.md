# Tasks: User-Facing README & Extracted Developer Docs

**Feature**: `028-readme-user-docs` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Type**: Documentation only — no application source, dependency, or IPC changes.

Tests are NOT generated: the spec requests no automated tests, and documentation is
validated by manual accuracy checks (see `quickstart.md`), not a test framework.

**Deliverables**: `README.md` (rewrite), `docs/development.md` (new), `docs/workflow.md` (new).

## Phase 1: Setup

- [x] T001 Capture the pre-rewrite `README.md` developer content (build/run/test,
  architecture, release) into a scratch list to compare against after extraction
  (baseline for FR-012 / SC-005 lossless check).

## Phase 2: Foundational (blocking — accuracy source-of-truth)

These pin down the facts every user-facing claim depends on. They MUST complete before
authoring, because SC-002 requires 100% claim/diagram accuracy.

- [x] T002 [P] Verify the Pull all / Rebase worktrees autostash spine in
  `src/main/update.ts`: confirm the stash is restored on **both** the clean-rebase and
  the conflict-abort paths, and that no auto-merge/conflict-resolution occurs (FR-004,
  Principle III).
- [x] T003 [P] Verify Clone discovery behavior in `src/main/clone-discovery.ts`:
  `gh` type-ahead when present, graceful pasted-URL fallback when absent (FR-005).
- [x] T004 [P] Verify launcher argument passing in `src/main/launch.ts`: repository-derived
  values are passed as intact positional arguments, never spliced into command text
  (Principle V — used by the launcher safety diagram).
- [x] T005 [P] Verify the settings-file path against `productName` in `package.json` and
  `src/main/config.ts` (must be `Rookery`, not `git-manager`).
- [x] T006 [P] Verify the safety posture against constitution v5.0.0 Principle V: the app
  itself originates no network traffic; permitted outbound is the user's own `git`/`gh`
  with the user's credentials; no telemetry, no stored tokens (FR-006).

## Phase 3: User Story 1 — Prospective user understands the app (P1) 🎯 MVP

**Goal**: A newcomer learns what Rookery does, who it's for, and why to use it — from the
README's first screenful, backed by an accurate screenshot and per-workflow diagrams.

**Independent test**: Give the README to someone unfamiliar; after 30s they correctly
state what it does + one benefit, opening no other file (SC-001, quickstart Scenario A).

- [x] T007 [US1] Write the value-proposition opening in `README.md`: what the app does,
  who it's for, ≥1 concrete benefit — all within the first screenful (FR-001).
- [x] T008 [US1] Add at least one screenshot of the actual interface to `README.md` (FR-002).
- [x] T009 [US1] Write the Pull all section in `README.md` with a plain-language
  explanation + ASCII diagram showing autostash-restore-on-both-paths (FR-003, FR-004;
  depends on T002).
- [x] T010 [US1] Write the Rebase worktrees section in `README.md` with explanation +
  ASCII diagram (same autostash-restore accuracy) (FR-003, FR-004; depends on T002).
- [x] T011 [US1] Write the Cleanup section in `README.md` with explanation + ASCII diagram
  (gone branches, stale/missing worktrees, confirmation) (FR-003).
- [x] T012 [US1] Write the Clone section in `README.md` with explanation + diagram
  (`gh` type-ahead + manual-URL fallback) (FR-003; depends on T003).
- [x] T013 [US1] Write the open-in-your-apps launchers section in `README.md` with the
  argument-safety comparison boxes (FR-003; depends on T004).
- [x] T014 [US1] Write the "watching multiple directories" section in `README.md` (FR-003).
- [x] T015 [US1] Write the safety-posture section in `README.md` using the v5.0.0-accurate
  wording (FR-006; depends on T006).
- [x] T016 [US1] Write the license summary + link to full license text in `README.md` (FR-008).
- [x] T017 [P] [US1] Author `docs/workflow.md`: the domain-driven, worktree-isolated,
  layered-`CLAUDE.md` method with concrete examples and copy-ready templates (FR-013).
- [x] T018 [US1] Add a brief mention of + link to `docs/workflow.md` in `README.md` (FR-013).

**Checkpoint**: README front door reads as an effective, accurate introduction on its own.

## Phase 4: User Story 2 — Developer finds extracted developer docs (P2)

**Goal**: A contributor finds build/architecture/contributing/release info in one dedicated
document, with none of it left inline in the README.

**Independent test**: A developer answers "how do I build and contribute?" from
`docs/development.md` alone; the README carries no such detail beyond a one-line pointer
(SC-003, quickstart Scenario G).

- [x] T019 [P] [US2] Author `docs/development.md`: local build/run/test commands +
  prerequisites (Node from `.nvmrc`, pnpm), architecture overview (main/preload/renderer),
  contributing conventions, release process — using the correct `Rookery` settings path
  (FR-011; depends on T005).
- [x] T020 [US2] Remove all inline developer detail from `README.md`, leaving a single
  one-line pointer to `docs/development.md` (FR-009, FR-010).
- [x] T021 [US2] Compare `docs/development.md` against the T001 baseline to confirm no
  developer information was lost in the extraction (FR-012, SC-005).

**Checkpoint**: Developer content lives in exactly one place, lossless, non-duplicated.

## Phase 5: User Story 3 — Reader understands prerequisites & install (P3)

**Goal**: A reader learns required vs optional prerequisites and how to get a prebuilt
build past first-launch OS security prompts.

**Independent test**: A reader answers "what must I install vs what's optional?" and "how
do I open the download on my OS?" from the README alone (SC-004, quickstart Scenarios D/E).

- [x] T022 [US3] Write the prerequisites section in `README.md`: system `git` required,
  `gh` CLI optional (Clone type-ahead) with pasted-URL fallback — `gh` never reading as
  mandatory (FR-005; depends on T003).
- [x] T023 [US3] Write the download + first-launch bypass section in `README.md` (macOS
  Gatekeeper, Windows SmartScreen) (FR-007).

**Checkpoint**: Prerequisites and install friction are resolved before a first run.

## Phase 6: Polish & Cross-Cutting

- [x] T024 Grep all three files for stray tool-artifact closing tags (`</content>`,
  `</invoke>`, `</parameter>`) and unbalanced code fences; remove any found (quickstart
  Scenario I).
- [x] T025 Verify ASCII diagrams display square (matched corners, aligned right edges)
  across all three documents.
- [x] T026 Follow every cross-link (README → `docs/development.md`, README → `docs/workflow.md`)
  and confirm each resolves.
- [x] T027 Run the full `quickstart.md` walkthrough (Scenarios A–I) and confirm every
  expected outcome, closing the SC-001..SC-005 gates.

## Dependencies

- **Phase 2 (T002–T006)** blocks all authoring that makes a behavioral claim (T009, T010,
  T012, T013, T015, T019, T022).
- **US1 (Phase 3)** is the MVP and depends only on Phase 2.
- **US2 (Phase 4)** depends on T001 (baseline) + T005; T020 (README pointer) is easiest
  after T019 exists.
- **US3 (Phase 5)** depends on T003; shares `README.md` with US1 (not parallelizable with
  US1's README tasks).
- **Phase 6** runs last, after all three documents exist.

## Parallel Opportunities

- Phase 2 verification tasks T002–T006 are all `[P]` (independent reads of different files).
- Across stories, the three deliverables are separate files: `docs/workflow.md` (T017) and
  `docs/development.md` (T019) can be authored in parallel with each other and with README
  work — but the many README-writing tasks are serialized on the single `README.md` file.

## Implementation Strategy

- **MVP = User Story 1** (Phase 1 + 2 + 3): an accurate, attractive README front door
  delivered alone already satisfies the core request.
- **Increment 2 = User Story 2**: extract developer docs (separation of concerns).
- **Increment 3 = User Story 3**: prerequisites + install friction.
- **Finish** with Phase 6 hygiene + the quickstart accuracy walkthrough (the SC gates).
