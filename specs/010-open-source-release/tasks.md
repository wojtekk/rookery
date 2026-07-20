# Tasks: Publish as a Public Open-Source Project on GitHub

**Input**: Design documents from `/specs/010-open-source-release/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ci-workflow.md, contracts/release-workflow.md, quickstart.md

**Tests**: NOT included — this feature adds repository infrastructure (CI/release
config, LICENSE, README), not application/mutating code; the constitution's
runnable-check mandate applies to code paths like pull/push/delete/remove, which
this feature doesn't touch. `quickstart.md`'s five scenarios are the validation
mechanism instead (manual, since they require a live public GitHub repo).

**Organization**: By user story. US1 (P1, CI) and US2 (P2, release) share one
Foundational prerequisite (pnpm version pinning) but otherwise no code — separate
workflow files. US3 (P3, README/LICENSE) only references them in prose. All three
are independently testable once Setup + Foundational are done.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable (different file, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 (user-story phases only)

---

## Phase 1: Setup

**Purpose**: The one action every story's *real* validation depends on. Does not
block writing the files in US1–US3 (those have no code dependency on it) — only
their Checkpoints (actually seeing a check run, a release publish, or a working
Releases link) need it.

- [X] T001 **MANUAL — do not run automatically, confirm with the maintainer first.** Create a public GitHub repository named `rookery`; push this repository's existing history to it as `origin`/`main`; confirm GitHub Actions is enabled (default for public repos). No file path — this is a one-time GitHub-side action, not a code change (research.md §10). Renaming/creating a public repo and pushing history for the first time is a hard-to-reverse, externally-visible action — get explicit sign-off before doing it, and do it manually or via `gh` with the maintainer present, not as an unattended task. **Done**: maintainer created `wojtekk/rookery`, rewrote `main`'s author history to the personal identity, and pushed — confirmed via `git ls-remote origin` matching local `main` (`34c4267`) exactly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared config both `test.yml` (US1) and `release.yml` (US2) need in order to even run — found via `/speckit-analyze`: `pnpm/action-setup` resolves its pnpm version from a `packageManager` field in `package.json` (or an explicit `version:` input), not from `pnpm-lock.yaml`. Without it, both workflows' first setup step fails immediately.

**⚠️ CRITICAL**: T003 and T006 both depend on this — do it before either workflow file is expected to actually run (writing the files themselves doesn't require it, but don't validate a Checkpoint before this lands).

- [X] T002 Add `"packageManager": "pnpm@<major>.x.x"` to `package.json`, pinning the pnpm major version the maintainer standardizes on (research.md §9)

**Checkpoint**: `package.json` has a `packageManager` field; both workflows can now resolve a pnpm version without any per-workflow `version:` input.

---

## Phase 3: User Story 1 - Automated verification on every change (Priority: P1) 🎯 MVP

**Goal**: `.github/workflows/test.yml` runs the existing test suite on every push
and pull request, on `ubuntu-latest` only, with pass/fail visible directly on
GitHub (FR-002, FR-003).

**Independent Test**: quickstart.md Scenario 1 — break a test on a throwaway
branch/PR, confirm a failing check appears on GitHub without running anything
locally; fix it, confirm the check turns green.

- [X] T003 [US1] Create `.github/workflows/test.yml`: `on: push: branches: ['**']` (all branches, tags excluded — avoids double-triggering alongside release.yml on a tag push) and `on: pull_request`; single job named `test` on `ubuntu-latest`; steps `actions/checkout` → `actions/setup-node` (`node-version-file: .nvmrc`) → `pnpm/action-setup` → `pnpm install --frozen-lockfile` → `pnpm test` (per contracts/ci-workflow.md, research.md §6) (depends on T002)

**Checkpoint**: Run quickstart.md Scenario 1 against the live `rookery` repo (T001). User Story 1 is complete and independently testable here — nothing else in this feature needs to exist for it to work.

---

## Phase 4: User Story 2 - Cross-platform release on tag (Priority: P2)

**Goal**: Pushing a `v*.*.*` tag builds unsigned macOS/Windows/Linux artifacts
and publishes all three to one GitHub Release — or none at all if any platform
build fails (FR-004, FR-005, FR-006, FR-013).

**Independent Test**: quickstart.md Scenario 2 — tag a test version, confirm a
Release with exactly three correctly-named assets appears only after all three
platform builds succeed; confirm a deliberately broken platform build blocks
the release entirely; confirm re-pushing the same tag replaces assets rather
than duplicating (Scenario 2's negative/re-tag checks). Scenario 3 confirms the
documented Gatekeeper/SmartScreen bypass actually works on real machines.

- [X] T004 [P] [US2] Add `electron-builder` to `devDependencies` in `package.json`; add a build-only script (e.g. `"dist": "electron-builder --publish=never"`) — no built-in publish step, this only produces local artifacts (research.md §1, §3)
- [X] T005 [P] [US2] Create `electron-builder.yml` at repo root: `appId`, `productName: Rookery`, `directories.output: release` (**must not be left as the default `dist/`** — that's already the TypeScript build's output directory, per research.md §1/finding I1), `files: ['dist/**/*', 'package.json']` (explicit allowlist so the packaged app doesn't pick up `specs/`, `tests/`, or other repo content — finding U1), mac target `dmg`, Windows target `nsis`, Linux target `AppImage`, artifact filenames `rookery-${version}.dmg` / `rookery-${version}-setup.exe` / `rookery-${version}.AppImage` (research.md §2, data-model.md — note: `CSC_IDENTITY_AUTO_DISCOVERY=false` is a CI *environment variable* for the mac build, not something this config file sets)
- [X] T006 [US2] Create `.github/workflows/release.yml`: `on: push: tags: ['v*.*.*']`; `build` matrix job (`macos-latest`, `windows-latest`, `ubuntu-latest`) — checkout, `actions/setup-node` (`node-version-file: .nvmrc`), `pnpm/action-setup`, `pnpm install --frozen-lockfile`, `pnpm run build`, run the `dist` script from T004 (mac leg sets `CSC_IDENTITY_AUTO_DISCOVERY=false`), `actions/upload-artifact` per OS sourced from `release/` (T005's `directories.output`); `publish` job with `needs: build` — `actions/download-artifact` (all three), `softprops/action-gh-release` with `tag_name: ${{ github.ref_name }}`, `generate_release_notes: true` (finding U3), and `files:` covering all three downloaded artifacts (contracts/release-workflow.md, research.md §3–§5) (depends on T002, T004, T005)

**Checkpoint**: Run quickstart.md Scenarios 2 and 3 against the live `rookery` repo. Independently testable — doesn't require US1 or US3 to exist.

---

## Phase 5: User Story 3 - A newcomer can understand, obtain, and contribute (Priority: P3)

**Goal**: `LICENSE` plus README additions so a stranger can, within 60 seconds
each, learn the project's purpose, find the download link, understand the
contribution process, and know what the license permits (FR-007–FR-012,
FR-013's README-facing half).

**Independent Test**: quickstart.md Scenario 4 (README readability, ≤60s per
item) and Scenario 5 (LICENSE content correctness) — both readable/checkable
without US1 or US2 actually running.

- [X] T007 [P] [US3] Create `LICENSE` at repo root: the unmodified Commons Clause License Condition v1.0 text, followed by the unmodified MIT License text it modifies, with the correct copyright line (research.md §7, data-model.md)
- [X] T008 [US3] Update `README.md`: badges row (CI status, license, latest release) + an opening "what this is" paragraph near the top (FR-007); a "Download" section linking to the GitHub Releases page with Gatekeeper/SmartScreen bypass instructions (FR-008, FR-013); a "License" section summarizing MIT + Commons Clause in plain language — explicitly noting it's source-available, not OSI-approved open source — linking to `LICENSE` (FR-012); extend the existing "Contributing" section with the expected change-proposal process (FR-009); rewrite the existing "Releasing it" section (currently claims "there's no packaged distribution yet") to describe the real tag-triggered automated release flow (data-model.md) (depends on T007 for the LICENSE link/summary to be accurate, and on T006 for the "Releasing it" section to describe the real workflow)

**Checkpoint**: Run quickstart.md Scenarios 4 and 5. All three user stories are now independently complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final sign-off once all three stories are in place.

- [X] T009 [P] Run `pnpm run build && pnpm test` locally to confirm the new `electron-builder` devDependency, `electron-builder.yml`, and `packageManager` field don't break the existing build/test pipeline
- [ ] T010 Full `quickstart.md` walkthrough (all 5 scenarios, in order) against the live `rookery` repo as a final sign-off pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 is a manual, human-performed action — start it whenever convenient; it only gates the *Checkpoints*, not writing the files in Phases 2–5.
- **Foundational (Phase 2)**: T002 has no dependency on T001 — it's a `package.json` edit that can happen anytime, but MUST land before T003's or T006's Checkpoints are run (their workflow files reference the version it pins).
- **User Stories (Phases 3–5)**: US1 (T003) and US2 (T004–T006) depend on Foundational (T002); US3 (T007–T008) has no dependency on Foundational. All three stories can be implemented (files written) in parallel once T002 exists. Real end-to-end verification (the Checkpoints) additionally needs T001 done.
- **Polish (Phase 6)**: depends on Phases 3–5 all being complete.

### User Story Dependencies

- **User Story 1 (P1)**: depends only on Foundational (T002) — no dependency on US2/US3.
- **User Story 2 (P2)**: depends on Foundational (T002); T004→T005→T006 is an internal chain within the story, not a cross-story one.
- **User Story 3 (P3)**: independent to write, but its README content *describes* US1/US2's real behavior accurately only once T006 (release workflow) exists — so while T008 can be drafted anytime, do a final pass after T006 lands to make sure the "Releasing it" section matches what was actually built.

### Parallel Opportunities

- T004 and T005 (both US2) can run in parallel with each other and with T007 (US3) — different files, no shared dependency.
- T003 (US1) can start as soon as T002 lands, in parallel with all of US2/US3's file work.
- T001 (manual) can happen at any point in parallel with all file-based work.

---

## Parallel Example: Kicking off all three stories once Foundational is done

```bash
# T002 lands first (single shared prerequisite), then, different files, no dependencies between them:
Task: "Create .github/workflows/test.yml (US1, T003)"
Task: "Add electron-builder devDependency + build script to package.json (US2, T004)"
Task: "Create electron-builder.yml (US2, T005)"
Task: "Create LICENSE (US3, T007)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 (can run in parallel with everything else) + T002 (Foundational — required before T003's Checkpoint)
2. T003 → **STOP and VALIDATE**: quickstart.md Scenario 1 against the live repo
3. This alone already delivers real value: every future push/PR gets automated test visibility.

### Incremental Delivery

1. Setup (T001, whenever convenient) + Foundational (T002) + User Story 1 (T003) → validate → this is the MVP
2. Add User Story 2 (T004–T006) → validate (Scenarios 2–3) → tagged releases now work
3. Add User Story 3 (T007–T008) → validate (Scenarios 4–5) → the repo is now genuinely usable by strangers
4. Polish (T009–T010) → final sign-off

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- T001 is the only task in this feature that isn't a file edit — flag it clearly to whoever executes this list; it needs the maintainer's explicit action, not an agent silently running `gh repo create`.
- Commit after each task or logical group, consistent with existing project practice.
