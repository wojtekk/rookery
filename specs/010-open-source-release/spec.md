# Feature Specification: Publish as a Public Open-Source Project on GitHub

**Feature Branch**: `010-open-source-release`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "I want to publish code on github - public repository. Help me: create github actions (test on push; release on tag for mac windows and linux - propose a proper release way); improve README.md to contain what this project is about, links to releases, how to contribute, other useful information; help choose a licence - free to use for everyone, commercial modification and monetisation disallowed, open source contribution allowed, commercial use not."

## Clarifications

### Session 2026-07-20

- Q: What should the public GitHub repository be named — keep the current `git-manager` name, or rename it to match the app's current product name, "Rookery"? → A: Rename the public repo to `rookery`, matching `package.json`'s `productName`.
- Q: Should the test-on-push check run on a single OS runner, or the same three-OS matrix as the release build? → A: Single OS (Linux) — the current test suite is entirely platform-agnostic Node/TypeScript logic, so a three-OS matrix would add cost without added coverage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated verification on every change (Priority: P1)

As the maintainer, whenever I or a contributor pushes a commit or opens a pull request, I want the test suite to run automatically and its result to show up on GitHub, so regressions are caught without anyone having to remember to run tests locally.

**Why this priority**: this is the foundation that makes accepting outside contributions safe at all — without it, every PR is a manual trust exercise.

**Independent Test**: push a commit that breaks an existing test (without touching README or release configuration) and confirm the failure is visible on GitHub against that commit/PR.

**Acceptance Scenarios**:

1. **Given** a push to any branch or a pull request against the repository, **When** the change is submitted, **Then** an automated check runs the project's test suite and reports a pass/fail status on that commit/PR.
2. **Given** a push that breaks an existing test, **When** the check runs, **Then** the failure is visible on GitHub without the maintainer needing to run tests locally.

---

### User Story 2 - Cross-platform release on tag (Priority: P2)

As the maintainer, when I tag a new version, I want ready-to-run builds for macOS, Windows, and Linux published automatically to GitHub Releases, so anyone can get the app without cloning the repo or building it themselves.

**Why this priority**: this is what turns "the code is on GitHub" into "people can actually use the app" — it's the core deliverable of publishing.

**Independent Test**: push a version tag and verify a GitHub Release appears with three downloadable artifacts (one per OS), with no manual build or upload step.

**Acceptance Scenarios**:

1. **Given** a new version tag is pushed, **When** the release workflow runs, **Then** a GitHub Release is created containing a downloadable build for macOS, Windows, and Linux.
2. **Given** the build fails for any one of the three platforms, **When** the workflow finishes, **Then** no release is published for that tag, and the failure is visible to the maintainer.
3. **Given** a pushed tag does not match the expected version-tag pattern, **When** it is pushed, **Then** the release workflow does not run.

---

### User Story 3 - A newcomer can understand, obtain, and contribute (Priority: P3)

As a stranger who finds the repository, I want the README to tell me what the project does, where to download it, how to propose a change, and what I'm legally allowed to do with it, so I don't have to dig through source code or ask the maintainer directly.

**Why this priority**: a public repository without this is only usable by its author — this is what makes "publish it publicly" actually mean something to anyone else.

**Independent Test**: reading only the README, a person can state the project's purpose, find the latest release, describe the expected contribution process, and state what the license does and doesn't allow.

**Acceptance Scenarios**:

1. **Given** a visitor opens the README, **When** they read the opening section, **Then** they can identify what the project is and who it's for.
2. **Given** a visitor wants the latest build, **When** they follow a link in the README, **Then** they land on the GitHub Releases page.
3. **Given** a visitor wants to contribute, **When** they read the README's contributing section, **Then** they know the expected process before opening a pull request.
4. **Given** a visitor wants to know what they may legally do with the project, **When** they check the README or LICENSE, **Then** the permitted and forbidden uses (free use, no commercial redistribution/monetization, contributions welcome) are unambiguous.

---

### Edge Cases

- What happens when the test suite fails on the default branch itself (not just a PR)? The failure must still be visibly reported (e.g., a failing check/badge) — nothing silently hides a red build.
- What happens if a release tag is pushed again for a version that was already released (re-tag or re-run)? The rerun replaces that release's artifacts rather than silently failing or producing a duplicate release.
- What happens if one platform's build fails only transiently (e.g., a flaky runner)? No release is published until all three platform builds succeed for that tag — partial releases are not acceptable (see FR-006).
- How is an unsigned/unnotarized build's OS security warning (macOS Gatekeeper, Windows SmartScreen) communicated to someone downloading it? Builds are shipped unsigned by design (see FR-013); the README documents both warnings and how to proceed past each.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST be hosted as a public GitHub repository, renamed from `git-manager` to `rookery` to match the shipped application's product name.
- **FR-002**: The system MUST automatically run the project's automated test suite, on a single Linux runner, on every push to any branch and on every pull request opened or updated against the repository — matching what the current suite actually exercises (platform-agnostic logic, no Electron-window or OS-specific behavior under test).
- **FR-003**: The system MUST report that test run's pass/fail result directly on the corresponding commit and/or pull request in GitHub, requiring no local action by the maintainer to see it.
- **FR-004**: The system MUST produce a distributable, installable build of the application for each of: macOS, Windows, and Linux.
- **FR-005**: The system MUST automatically build and publish all three platform artifacts to a GitHub Release whenever a version tag is pushed.
- **FR-006**: The system MUST NOT publish a release for a tag unless all three platform builds for that tag succeed — either all three artifacts are published together, or none are.
- **FR-007**: The README MUST state, near the top and in plain language, what the project is and who it's for.
- **FR-008**: The README MUST link to the GitHub Releases page so a visitor can obtain the latest build without building from source.
- **FR-009**: The README MUST document the expected process for proposing a change (e.g., opening an issue first for large changes, running tests before submitting a pull request).
- **FR-010**: The project MUST include a LICENSE file at the repository root stating the terms under which the code may be used, modified, and distributed.
- **FR-011**: The license MUST permit anyone — including businesses — to freely use, run, and modify the project, MUST prohibit selling the project or a derivative of it, or offering it (or a substantially similar product/service built on it) commercially for a fee, and MUST otherwise keep the project open and contribution-friendly. Resolved as: the **MIT License, modified by the Commons Clause License Condition 1.0** (MIT covers use/modify/contribute; the Commons Clause carve-out restricts selling the software or a service substantially derived from it, while leaving ordinary business *use* of the tool unrestricted).
- **FR-012**: The README MUST summarize, in plain language next to the LICENSE link, what the license does and does not permit.
- **FR-013**: Release builds MUST be produced unsigned and unnotarized (no Apple Developer or Windows code-signing certificate required), and the README MUST document the resulting first-run OS security warning (macOS Gatekeeper, Windows SmartScreen) and how a user proceeds past it.

### Key Entities

- **CI Workflow**: the automated definition that runs the test suite on push/PR and exposes a pass/fail status per commit/PR.
- **Release Workflow**: the automated definition triggered by a version tag that produces one build artifact per target OS and attaches them to a GitHub Release.
- **GitHub Release**: a tagged, versioned entry on GitHub bundling the three platform artifacts and release notes.
- **LICENSE**: the document stating the legal terms governing use, modification, and distribution of the project.
- **README**: the project's front door — purpose, release link, contribution process, and license summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pushes and pull requests, from the day this ships, produce a visible automated pass/fail result on GitHub with no manual step required to see it.
- **SC-002**: A tagged version produces a published GitHub Release containing all three (macOS, Windows, Linux) artifacts from a single automated run, with zero manual build or upload steps by the maintainer.
- **SC-003**: A first-time visitor can state the project's purpose, find the download link, and describe the contribution process, each within 60 seconds of opening the README.
- **SC-004**: Zero releases are ever published with fewer than three platform artifacts — no partial release occurs.

## Assumptions

- The project already has an automated test suite runnable via a single command (confirmed: `pnpm test` in the current README) — CI reuses it as-is rather than introducing new tests.
- A release is triggered by a tag following a `v<semver>` pattern (e.g., `v1.2.0`); any other tag is ignored by the release workflow.
- A failing test does not block a push from being accepted (no branch-protection rule is configured as part of this feature) — it only needs to be visibly reported. Requiring the check before merge is a separate repository-settings decision the maintainer can make afterward.
- No auto-update mechanism is in scope — users manually download newer releases from GitHub Releases; this remains a personal/community tool, not managed software.
- The project's existing local-only / no-network-calls / no-telemetry constraints govern the shipped application's runtime behavior, not the build-and-release process itself — running builds on GitHub's cloud infrastructure is a process change, not a change to the app.
- "Document the contribution process" (FR-009) means writing down expectations already implied by current practice (spec-first workflow, tests must pass, keep diffs surgical); it does not include adding new tooling such as a CLA or issue/PR templates unless requested later.
- MIT + Commons Clause is a "source-available" license, not an OSI-approved open-source license (the Commons Clause sales restriction is what OSI's Open Source Definition disallows) — the README's license summary (FR-012) must be honest about this distinction rather than calling the project "open source" unqualified.
- The `rookery` rename (FR-001) applies to the public GitHub repository and everything user-visible that names the project (README title, release artifact filenames); it does not require renaming local directories, internal spec/branch naming conventions, or any code identifiers beyond what's already `Rookery`-branded in `package.json`.
- The single-OS test scope (FR-002) is a deliberate tradeoff, not a permanent constraint: if a future feature adds Electron-window or OS-specific behavior under test, expanding the push/PR check to a multi-OS matrix should be revisited at that time.
