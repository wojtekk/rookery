# Feature Specification: User-Facing README & Extracted Developer Docs

**Feature Branch**: `028-readme-user-docs`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Improve documentation in README.md, extract Dev documentation to another file. Make documentation attractive for users, explain what app does. Use learnings from our discussion and changes we already made."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prospective user understands what the app is and why to use it (Priority: P1)

Someone lands on the project page having never heard of Rookery. Within the first
screenful they learn what the app does (manage many local git repositories from one
window), who it's for (anyone juggling a dozen checkouts), and the headline value
(one button to pull all, one to rebase every worktree, one to clean up cruft). A
screenshot shows the actual interface, and each core workflow is explained in plain
language backed by a diagram.

**Why this priority**: This is the entire point of the request — "make documentation
attractive for users, explain what app does." If a newcomer can't tell what the app
is and whether it's for them, nothing else in the docs matters. Delivered alone, this
already turns the README into an effective front door.

**Independent Test**: Give the README to a person who has never seen the project and
ask them, after 30 seconds, "what does this do and would you use it?" Success is a
correct one-sentence answer plus a reason to try it — with no need to open any other
file or read source code.

**Acceptance Scenarios**:

1. **Given** a reader opening the README top-to-bottom, **When** they read only the
   first screenful, **Then** they can state what the app does, who it's for, and at
   least one concrete benefit.
2. **Given** a reader interested in a core workflow (Pull all, Rebase worktrees,
   Cleanup, Clone, launchers), **When** they reach that section, **Then** they find a
   plain-language explanation and a diagram whose described behavior matches how the
   app actually behaves.
3. **Given** a reader evaluating trust, **When** they read the safety section, **Then**
   they understand the app makes no network calls of its own, inspects read-only, and
   collects no telemetry.

---

### User Story 2 - Contributor or builder finds developer documentation without wading through user content (Priority: P2)

A developer wants to build the app from source, understand its architecture, follow
the contribution process, or cut a release. They find a dedicated developer document
covering running locally, the three-context architecture, contributing conventions,
and the release process — kept out of the user-facing README so neither audience has
to skim past the other's content.

**Why this priority**: The request explicitly asks to "extract Dev documentation to
another file." It's P2 rather than P1 because it serves a smaller audience than the
prospective-user front door, but it is a named, required deliverable and directly
improves both documents by separating concerns.

**Independent Test**: A developer asked "how do I build and contribute?" can answer
using only the developer document, and the README no longer contains build/architecture/
release detail beyond a short pointer to that document.

**Acceptance Scenarios**:

1. **Given** a developer who wants to build locally, **When** they open the developer
   document, **Then** they find the exact commands and prerequisites to install, build,
   run, and test.
2. **Given** a reader of the README, **When** they look for deep developer detail,
   **Then** they find a brief pointer to the developer document rather than the detail
   inline.
3. **Given** the two documents, **When** compared, **Then** developer-only content
   (architecture tree, contributing rules, release steps) lives in the developer
   document and not duplicated in the README.

---

### User Story 3 - Reader understands prerequisites and installation up front (Priority: P3)

Before committing, a reader wants to know what they need to run Rookery (system git;
the optional GitHub CLI for Clone search) and how to get a prebuilt build past the
first-launch OS security prompts. These are stated clearly and early, so the
requirement is discovered before, not after, a failed first run.

**Why this priority**: Requirements and install friction are real adoption blockers,
but they matter only once a reader is already interested — so they follow the value
pitch (P1). Getting the optional-vs-required distinction right (git required, gh
optional) prevents a common misunderstanding.

**Independent Test**: A reader can answer "what must I install to use this, and what's
optional?" and "how do I open the download on my OS the first time?" from the README
alone.

**Acceptance Scenarios**:

1. **Given** a reader checking prerequisites, **When** they read the requirements
   section, **Then** they learn system git is required and the GitHub CLI is optional
   (enabling Clone search, with manual-URL clone as the fallback).
2. **Given** a reader who downloaded a prebuilt build, **When** their OS blocks the
   unsigned app on first launch, **Then** the README tells them how to open it anyway
   on macOS and Windows.

---

### Edge Cases

- **A described workflow diverges from actual behavior**: every diagram and behavioral
  claim must match the current implementation (e.g. autostashed work is restored on
  *both* the clean and conflict paths of Pull all / Rebase worktrees). A diagram that
  contradicts the code is a defect, not a stylistic choice.
- **The optional dependency is described as required**: the GitHub CLI must never read
  as mandatory — Clone works via a pasted URL without it.
- **Developer detail leaks back into the README**: future edits must not reintroduce
  build/architecture/release detail inline; the README keeps only a pointer.
- **A screenshot or diagram goes stale**: if the interface or a workflow changes, the
  corresponding visual must be updated or removed rather than left misrepresenting the app.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The README MUST state, within the first screenful, what the app does, who
  it is for, and at least one concrete benefit.
- **FR-002**: The README MUST include at least one screenshot of the actual application
  interface.
- **FR-003**: The README MUST explain each core user workflow in plain language: Pull
  all, Rebase worktrees, Cleanup, Clone, open-in-your-apps launchers, and watching
  multiple directories.
- **FR-004**: Every diagram and behavioral claim in the README MUST accurately reflect
  the current application behavior — including that autostashed changes are restored on
  both the successful and the conflict/abort paths of Pull all and Rebase worktrees.
- **FR-005**: The README MUST describe prerequisites: system git as required, and the
  GitHub CLI as optional (enabling Clone type-ahead search, with pasted-URL clone as the
  fallback when it is absent).
- **FR-006**: The README MUST communicate the safety posture: the app originates no
  network traffic of its own, background inspection is read-only, and no telemetry is
  collected.
- **FR-007**: The README MUST include download and first-launch instructions for
  prebuilt, unsigned builds (macOS Gatekeeper and Windows SmartScreen bypass).
- **FR-008**: The README MUST summarize the license terms in plain language and link to
  the full license text.
- **FR-009**: Developer-focused content (running/building locally, architecture,
  contributing process, release process) MUST live in a separate developer document,
  not inline in the README.
- **FR-010**: The README MUST link to the developer document so a contributor can find
  it in one hop.
- **FR-011**: The developer document MUST cover, at minimum: local build/run/test
  commands and prerequisites, the architecture overview, contributing conventions, and
  the release process.
- **FR-012**: No previously available developer information MUST be lost in the
  extraction — content moved out of the README MUST be present in the developer document.
- **FR-013**: A dedicated workflow document MUST describe the author's
  domain-driven, worktree-isolated, layered-`CLAUDE.md` working style with concrete
  examples and copy-ready templates; the README MUST mention this workflow briefly and
  link to that document rather than carrying the full methodology inline.

### Key Entities *(include if feature involves data)*

- **README (user-facing document)**: The project's front door. Audience: prospective
  and current users. Contains value proposition, screenshot, core-workflow explanations
  with diagrams, requirements, safety posture, download/first-launch, license summary,
  and a pointer to the developer document.
- **Developer document**: The contributor/builder reference. Audience: developers.
  Contains local build/run/test, architecture, contributing conventions, and release
  process.
- **Workflow document**: The working-method guide (FR-013). Audience: developers adopting
  the author's working style. Contains the domain-driven, worktree-isolated,
  layered-`CLAUDE.md` methodology with concrete examples and copy-ready templates. The
  README links to it rather than carrying the method inline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time reader can correctly state what the app does and one benefit
  within 30 seconds of opening the README, without opening any other file.
- **SC-002**: 100% of README diagrams and behavioral claims match the current
  implementation when verified against the code.
- **SC-003**: A developer can locate build, architecture, contributing, and release
  information in a single dedicated document, and the README contains none of that
  detail inline beyond a one-line pointer.
- **SC-004**: A reader can correctly distinguish required (system git) from optional
  (GitHub CLI) prerequisites using only the README.
- **SC-005**: Zero developer information available before the extraction is missing
  after it (verified by comparing pre-extraction README content against the developer
  document).

## Assumptions

- The audience split is two groups — prospective/current users (README) and
  developers/contributors (developer document); other audiences are out of scope.
- The developer document lives at `docs/development.md` and the workflow document at
  `docs/workflow.md`, consistent with the repository's existing `docs/` layout.
- Diagrams are rendered as ASCII text blocks (per the resolved decision during this
  work) rather than a diagramming library, so they display everywhere the README does.
- Behavioral accuracy is judged against the current `main` implementation of the
  relevant engines (`src/main/update.ts`, `cleanup.ts`, `clone-discovery.ts`,
  `launch.ts`) and, for the settings-file path, `config.ts` / `package.json`, at the
  time of writing.
- This feature changes documentation only; no application source code, dependency,
  persisted setting, or IPC surface is added or modified.
