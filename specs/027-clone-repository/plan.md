# Implementation Plan: Clone a Repository

**Branch**: `027-clone-repository` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-clone-repository/spec.md`

## Summary

Add a header **Clone** action that opens a modal for cloning a remote repository
onto disk. The modal offers two paths to a URL: (a) a **search box** that filters
the 1,000+ repositories the user can access — discovered by shelling out to the
already-authenticated system `gh` CLI across every configured host/account — with
substring-ranked results capped at 50; or (b) a freely-editable **URL field** the
user can paste any HTTPS/SSH URL into, which works even when `gh` is unavailable.
The user picks a **destination** from their existing observed directories (or
browses/types a custom one), with the path auto-filled as `<dir>/<repo-name>` until
hand-edited. Confirming runs `git clone` (the one mutating step), which joins the
existing long-operation lockout as a fifth mutually-exclusive member. On success the
new repo's **parent** directory is added to the observed set (if absent) and the list
refreshes so the repo appears; on failure the modal stays open with the git error
shown and the user's input intact.

The clone itself is *already* permitted outbound activity under Constitution
Principle V ("git talking to its configured remotes"). The **discovery** step —
`gh auth status` + `gh repo list` — is genuinely new app-initiated network activity
and requires a constitution amendment (v5.0.0), directly mirroring how features 014
and 025 amended it before. `gh` is used exactly as `git` is: a system-native
subprocess relying on the user's own auth, never storing a token.

## Technical Context

**Language/Version**: TypeScript 5.5, Node.js 24 (`.nvmrc`), compiled to CommonJS
(main/tests) and ESM (renderer) — unchanged from the existing build.

**Primary Dependencies**: Electron 40 (existing). **No new runtime dependency.**
New *external tool* dependency at runtime: the system `gh` CLI (GitHub CLI) — used
only for discovery, degraded-gracefully when absent (FR-012). The clone uses the
system `git` (existing).

**Storage**: `settings.json` in `userData` (existing `Settings` shape). One new
persisted field: `lastCloneDirectory` (remembers the destination dropdown default).
`observedDirectories` gains entries automatically on successful clone (FR-010).

**Testing**: `node:test` + `node:assert/strict`, compiled to `dist/tests/*.test.js`,
run via `pnpm test`. Pure helpers unit-tested; the `git clone` engine tested against
a local `file://` fixture repo (no network), mirroring `rebase-worktrees.test.ts`.

**Target Platform**: macOS/Windows/Linux desktop (Electron), single local user.

**Project Type**: Desktop application — existing three-context split
(`main` / `preload` / `renderer`) plus `shared/`.

**Performance Goals**: Search filtering across 1,000+ cached repos must feel instant
as the user types (client-side substring match over an in-memory array — the same
technique `filter.ts` already uses). Discovery (`gh repo list`) runs once per session
and is cached; a first fetch of 1,000+ repos across multiple hosts may take a couple
of seconds and shows an in-modal loading state (never blocks the app).

**Constraints**: Local-only, no telemetry, no app-initiated HTTP — outbound activity
limited to (existing) git-to-remotes plus (new, amended) `gh`-to-GitHub for discovery
using the user's own auth. No credential storage or prompting (`GIT_TERMINAL_PROMPT=0`
via the existing `NON_INTERACTIVE_ENV`).

**Scale/Scope**: One new header action, one new modal, two new IPC methods, one new
persisted setting, ~5 new pure helpers, one new main-process engine module + one
discovery module, one new renderer view module, plus CSS for the modal's search
dropdown and form. Two new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution **v4.1.0** (pre-amendment) and the proposed **v5.0.0**:

- **Principle I — System-Native Delegation**: PASS (strengthened). Discovery shells
  out to the user's `gh`; clone shells out to the user's `git`. No bundled binaries,
  no reimplemented plumbing, no credential handling. `gh` is a *new* delegated tool,
  which the amendment explicitly blesses in the same spirit as `git`.
- **Principle II — Read-Only by Default, Destructive by Explicit Action**: PASS.
  Discovery is read-only. Clone is a new mutating operation (creates a directory,
  mutates `observedDirectories`) triggered only by an explicit confirmation, never on
  a timer (FR-007). Clone is *additive* (it creates a new repo; it never deletes or
  overwrites — an existing non-empty destination is refused, FR-011/Edge Cases), so it
  does not rise to the repository-deletion confirmation tier. The amendment names Clone
  in the mutating-operation list.
- **Principle III — Never Resolve Conflicts**: PASS (N/A). Clone creates a fresh
  working tree; there is no merge/rebase, no conflict surface.
- **Principle IV — Always-Observable State**: PASS. Clone joins the long-operation
  enumeration as the fifth member; it obeys the same at-most-one-at-a-time mutual
  exclusion, the same table/sort-header-only dim, and the same no-colour-change-
  elsewhere rule (FR-008). The amendment adds "Clone" to that enumeration.
- **Principle V — Local-Only, Minimal Footprint**: **AMENDMENT REQUIRED.** The
  current text permits only "git talking to its configured remotes and opening
  user-invoked external targets." Discovery adds `gh` talking to GitHub. This narrows
  the "MUST NOT make network calls of its own" guarantee → backward-incompatible →
  **MAJOR (v5.0.0)**, mirroring the 4.0.0 precedent of removing a Principle guarantee.
  No new runtime dependency is added (YAGNI upheld). See research §1 and the amended
  constitution.

**Gate result**: PASS, contingent on the v5.0.0 amendment (drafted and applied as
part of this plan — see `.specify/memory/constitution.md`). No entry needed in
Complexity Tracking: the added latitude is the minimum required to satisfy FR-002,
and the simpler alternative (no live repo list) was explicitly rejected by the user
during brainstorming.

## Project Structure

### Documentation (this feature)

```text
specs/027-clone-repository/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── clone-engine.md  # IPC + engine contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── types.ts               # + RemoteRepoSummary, CloneableReposResult, CloneOutcome,
│                              #   lastCloneDirectory on Settings, 2 methods on RepoDashboardApi
├── main/
│   ├── clone.ts               # NEW — cloneRepository() engine + pure deriveRepoName()
│   ├── clone-discovery.ts     # NEW — listCloneableRepos() (gh shell-out) + session cache
│   │                          #   + pure parseGhHosts()/parseGhRepoList()
│   ├── config.ts              # + lastCloneDirectory default + setLastCloneDirectory IPC
│   └── main.ts                # + registerIpc: listCloneableRepos, cloneRepository
│                              #   (clone handler adds parent dir to observedDirectories on success)
├── preload/
│   └── preload.ts             # + listCloneableRepos, cloneRepository, setLastCloneDirectory
└── renderer/
    ├── renderer.ts            # + cloning flag, doClone flow, onClone handler, mount clone modal
    ├── index.html             # + <div id="cloneModal"></div>
    ├── styles.css             # + .clone-* rules (search dropdown, form rows, url-scheme toggle)
    └── view/
        ├── toolbar.ts         # + Clone button (5th long-op), cloning in ToolbarState/Handlers
        ├── clone-model.ts     # NEW — PURE (type-only imports, no DOM): rankCloneCandidates(),
        │                      #   deriveRepoName(), buildDestination(). Unit-testable like filter.ts.
        └── clone.ts           # NEW — clone modal DOM view (mirrors cleanup.ts module pattern);
                               #   imports clone-model.ts. NOT unit-tested (touches document).

tests/
├── clone-engine.test.ts       # NEW — real-git-fixture cloneRepository outcomes (main/clone.ts)
│                              #   + pure parseGhRepoList/parseGhHosts (main/clone-discovery.ts)
└── clone-search.test.ts       # NEW — rankCloneCandidates, deriveRepoName, buildDestination
                               #   (renderer/view/clone-model.ts) incl. hand-edit-stops-autofill state
```

> **Pure/DOM split rationale**: `tests/` compiles as CommonJS (tsconfig.json). A test
> can import a renderer module only if that module has **type-only** imports and no DOM
> access — this is exactly why `filter.ts`/`loadstate.ts`/`sort.ts` are directly testable
> but `table.ts`/`cleanup.ts` (which `import document`/`./icons/catalog.js`) are not. So
> every clone helper that needs a test lives in the DOM-free `clone-model.ts`, and the
> `clone.ts` modal view is left untested-by-unit (validated via `quickstart.md` instead),
> matching the project's existing precedent.

**Structure Decision**: Follows the established feature-per-concern layout. The pure,
testable decision logic (URL→name derivation, result ranking, gh-output parsing,
destination-path building) is separated from the two side-effecting main-process
modules (`clone.ts` for the `git clone` subprocess, `clone-discovery.ts` for the `gh`
subprocess + cache), exactly as `update.ts` separates `rebaseCandidates`/
`resolveDefaultBranchName` (pure) from the git-touching engine. `deriveRepoName` is
needed on both sides (renderer builds the default path; main validates), so it lives
once and is imported where CommonJS/ESM allow — see research §6 for the placement
decision.

## Complexity Tracking

> No unjustified violations. The single constitution deviation (Principle V network
> latitude) is the minimum required by FR-002 and is handled by a versioned amendment,
> not an unexplained exception — so no row is required here.
