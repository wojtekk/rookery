# Implementation Plan: Local Repository Dashboard

**Branch**: `001-repo-dashboard` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-repo-dashboard/spec.md`

## Summary

A local, single-user Electron desktop app that lists locally-cloned git
repositories found in user-configured parent directories. For each working tree
(primary repository or linked worktree) it shows the remote slug (primary
identifier) + host, directory name, current branch with tracking status, a dirty
change count, and ahead/behind commit divergence — with a colored left-edge state
indicator plus a redundant non-color cue (git-porcelain status glyph + numeric text)
for clean / dirty / out-of-sync / unavailable state. The UI (command bar, fleet
summary + state filters, sortable columns, settings modal, deferred per-repo action
kebab) is specified in [design/README.md](./design/README.md). All git data comes from
the **system git client** via non-mutating subprocess calls; nothing is fetched
from the network and no repository state is ever modified. Refresh happens at
startup and on explicit user demand only.

Technical approach: Electron (main + preload + renderer) in TypeScript. The main
process shells out to system `git` with `--no-optional-locks`, using
`status --porcelain=v2 --branch` as the primary probe (one call yields branch,
upstream, ahead/behind, and dirty count). Repos are inspected concurrently with a
bounded pool and a per-repo timeout (FR-027). The renderer is plain TypeScript +
DOM (no UI framework — a 50-row interactive list does not justify one). Settings
persist as a JSON file in Electron's `userData` directory.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js (Electron 32+ bundled runtime).

**Primary Dependencies**: Electron (desktop shell). System `git` (>= 2.15, for
`--no-optional-locks`) invoked via Node `child_process` — NOT a bundled git
library (Constitution I forbids bundling git / libgit2). No UI framework; no
runtime dependency beyond Electron.

**Storage**: A single JSON settings file in `app.getPath('userData')` (observed
directories, sort dimension/direction, worktree filter, default host). No database.

**Testing**: `node:test` (stdlib runner) over compiled pure-logic modules —
porcelain parsing, canonical-identity/dedup/grouping, sort/tie-break, and state +
worktree filtering — plus a read-only probe assertion (`.git/index` untouched after a
full probe). No test framework dependency.

**Target Platform**: Cross-platform desktop via Electron; primary development
target macOS. (OS-specific external launchers are out of scope for this feature.)

**Project Type**: Desktop application (Electron main + preload + renderer).

**Performance Goals**: Full list for ~50 repos visible in < 10 s from launch
(SC-001); UI never freezes during scan/refresh (SC-006); a single hung repo never
blocks the rest and refresh terminates in bounded time (SC-007).

**Constraints**: Read-only — non-mutating git invocations that do not write the
index/stat cache (`--no-optional-locks`, verified); no network traffic of the
app's own (no fetch this feature); per-repo inspection deadline (default 5 s,
tunable); context-isolated renderer with a preload IPC bridge (no
`nodeIntegration`).

**Scale/Scope**: Single user; up to ~50 primary repositories, each with a small
number of linked worktrees; display + configure + refresh only (no mutating repo
actions in this feature).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. System-Native Delegation | Uses system `git` via subprocess; no bundled git binary/library; relies on system credentials (no network this feature, so credentials are not even exercised). | ✅ PASS |
| II. Read-Only by Default | Feature is read-only end to end; every git call is non-mutating (`--no-optional-locks`); no mutating operations are in scope. | ✅ PASS |
| III. Never Resolve Conflicts | No pull/merge/rebase in this feature — nothing that could resolve a conflict. | ✅ PASS (N/A) |
| IV. Always-Observable State | Core of the feature: min row fields (slug, dir name, branch+tracking, local/ahead/behind), left-edge state indicator + glyph + redundant non-color cue (FR-028), no auto-refresh (FR-012), responsive UI (FR-017). Aligned with Constitution v1.3.0 (edge indicator + glyph, green=ok, grey=unavailable). | ✅ PASS |
| V. Local-Only, Minimal Footprint | No telemetry, no app network calls; only new runtime dep is Electron (the chosen desktop platform); renderer is dependency-free. | ✅ PASS |

No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-repo-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ipc-api.md       # renderer <-> main IPC contract
│   └── git-probe.md     # git command contract (inputs -> parsed fields)
├── design/              # UI design (approved)
│   ├── README.md        # visual/interaction spec — source of truth for presentation
│   └── dashboard-mockup.html   # interactive mockup
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── types.ts          # Row, Repository, WorkingTree(Entry), Head, Remote, Settings, RowState (shared)
├── main/
│   ├── main.ts           # app lifecycle, BrowserWindow, IPC handlers
│   ├── config.ts         # load/save settings JSON in userData
│   ├── scan.ts           # discover repos in observed dirs (1 level); pool + per-repo timeout
│   └── git/
│       ├── probe.ts      # run non-mutating git commands for one working tree
│       ├── parse.ts      # parse porcelain v2 / worktree list / remote url  (pure)
│       └── identity.ts   # canonical identity + family grouping/dedup       (pure)
├── preload/
│   └── preload.ts        # contextBridge: expose typed IPC API to renderer
└── renderer/
    ├── index.html
    ├── renderer.ts       # bootstrap, call IPC, hold view state (sort/filter/worktree)
    ├── styles.css        # tokens; left-edge state indicator + glyph; layout
    └── view/
        ├── toolbar.ts    # command bar: worktrees toggle, refresh (spin), settings button
        ├── summary.ts    # fleet composition bar + state-filter chips (FR-029)
        ├── table.ts      # primary rows + grouped worktrees; edge indicator + glyph;
        │                 #   name/slug/host (host only when != defaultHost); branch+tracking;
        │                 #   counts; ⋮ kebab (deferred per-repo actions slot)
        ├── sort.ts       # sort dimensions + deterministic tie-break        (pure)
        ├── filter.ts     # apply state + worktree filters                   (pure)
        ├── settings.ts   # settings modal: observed dirs (+counts/unreadable) & prefs
        └── empty.ts      # guided empty state

tests/
├── parse.test.ts         # porcelain v2 / worktree / remote-url parsing
├── identity.test.ts      # canonical identity, dedup, family grouping, external-primary in-scope
├── sort.test.ts          # sort dimensions + deterministic tie-break
├── filter.test.ts        # state filter + worktree filter (incl. unavailable rows)
└── readonly.test.ts      # .git/index untouched after full probe (racy-stat fixture)
```

**Structure Decision**: Single Electron project with the standard three-context
split (main / preload / renderer) plus a `shared/` module for the data types that
cross the IPC boundary. Pure logic (parsing, identity, sort) is isolated into
dependency-free modules so it is unit-testable with `node:test` without spinning
up Electron. This keeps the testable core honest (Constitution's "one runnable
check" discipline) and leaves clean seams for the future per-repository actions
the spec defers.

## Complexity Tracking

> No constitution violations — no entries.
