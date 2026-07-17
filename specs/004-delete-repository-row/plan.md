# Implementation Plan: Delete Repository Row

**Branch**: `004-delete-repository-row` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-delete-repository-row/spec.md`

## Summary

Every row (repository, orphan worktree, or linked worktree) gets a fixed, always-
visible "x" delete icon in a new rightmost column. Clicking it always shows one
native confirmation dialog; if a fresh, live check finds the repository "at risk"
(dirty, no remote, unpushed commits, or the check itself can't be verified) a
second native dialog states the action is destructive and irreversible — never
more than two prompts total. On confirmation, a linked/orphan worktree is removed
via `git worktree remove --force`; any other row is deleted via the OS trash
(falling back to permanent delete if trash is unavailable). The whole flow —
both dialogs, the live git check, and the deletion — is orchestrated in the main
process behind one new IPC call, reusing Electron's native `dialog` module (no
new UI components) and the existing `scan.ts`/`probe.ts` primitives (no new
runtime dependencies).

## Technical Context

**Language/Version**: TypeScript ~5.9 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`)

**Primary Dependencies**: Electron 40.8.5 (main/preload/renderer split); Electron's
built-in `dialog` (confirmation UI) and `shell.trashItem` (OS trash) — both already
part of the existing Electron dependency, no new npm package; no UI framework

**Storage**: Electron `userData` JSON settings — **unchanged**. Repository rows are
children *discovered inside* an observed directory (`scan.ts`), not the observed
directory entries themselves, so deleting a repository/worktree never touches
`observedDirectories`; the next scan simply stops finding it.

**Testing**: `node:test` over pure logic (risk-combination logic, message building);
manual UI + real-repository validation via `quickstart.md` for the git-mutating
paths (trash, worktree remove, fetch failure), per the constitution's mandate that
mutating operations be manually exercised including a failure path.

**Target Platform**: Local desktop (Electron on the user's OS; primary dev target macOS)

**Project Type**: Single-project desktop application (`src/main`, `src/preload`, `src/renderer`, `src/shared`)

**Performance Goals**: First confirmation appears immediately on click (no git call
gates it); the live risk check (local `git status` + a bounded `git fetch`) runs
between the two prompts and is capped by the existing 5s per-process spawn timeout
so it can never hang the UI indefinitely.

**Constraints**: UI must never freeze (Principle IV); at most two confirmation
prompts ever (FR-005); no new runtime dependency (Principle V); deletion must be
reversible via OS trash whenever possible (FR-008/FR-009).

**Scale/Scope**: One new IPC method, one new main-process module
(`src/main/delete.ts`), one new probe function (`probeFetch`), one new grid
column + icon in the renderer, ~2 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.4.0:

- **I. System-Native Delegation** — ✅ Pass. Worktree removal and the live sync
  check both shell out to the system `git` via the existing `execFile`-based
  `runGit` helper (`git/probe.ts`) — no bundled git, no reimplemented plumbing.
- **II. Read-Only by Default, Destructive by Explicit Action** — ✅ Pass. This
  feature is the concrete implementation of the principle's own example
  ("worktree removal ... MUST be triggered by a deliberate user action" and
  "MUST require explicit per-item confirmation"). The one read-only step added
  (`git fetch`) only runs as part of an explicit delete click, never on a timer.
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — ✅ N/A. No merge/rebase
  logic is touched; `--force` on `git worktree remove` discards a dirty *worktree*
  after explicit double-confirmation, which is not conflict resolution.
- **IV. Always-Observable State** — ✅ Pass. After any outcome (deleted, failed, or
  cancelled) the dashboard re-derives state via the existing `refresh()` path, so
  the row list is always an honest reflection of disk state — no new client-side
  state to go stale.
- **V. Local-Only, Minimal Footprint** — ✅ Pass. `git fetch` is git talking to its
  own already-configured remote (explicitly permitted outbound activity); OS
  trash is a platform feature via Electron's existing `shell` module. No new
  runtime dependency is added (YAGNI honored).

**Result**: PASS. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-delete-repository-row/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── ipc-api.md         # New/changed IPC surface
│   └── delete.md          # Delete orchestration contract (dialogs, risk check, removal)
├── checklists/
│   └── requirements.md   # Spec quality checklist (from /speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── main.ts                # + `deleteRow`: the full orchestration (dialogs, worktree-remove/trash,
│   │                          #   ipcMain.handle wiring) — electron-touching, like pickDirectory/runAction
│   ├── delete.ts               # NEW: `computeDeleteRisk` only — deliberately electron-free (like
│   │                          #   actions/launch.ts) so it stays unit-testable with plain node:test
│   └── git/
│       ├── probe.ts            # + probeFetch (new, non-mutating*: git fetch is read-only); `runGit` exported
│       └── parse.ts            # unchanged — parsePorcelainStatusV2 reused as-is
├── preload/
│   └── preload.ts              # + deleteRow bridge method
├── shared/
│   └── types.ts                # + DeleteTarget, DeleteOutcome, RepoDashboardApi.deleteRow
└── renderer/
    ├── styles.css               # + delete-icon column/styles
    └── view/
        └── table.ts             # + fixed rightmost delete-icon cell, wired to handlers.onDelete

tests/
├── delete-risk.test.ts         # NEW: node:test over the pure risk-combination + message logic
```

**Structure Decision**: Single-project Electron layout (already established by
001/002/003). This feature touches all three processes but stays proportionate:
one new main-process module owns the entire delete flow (dialogs, risk check,
removal), mirroring how `actions/launch.ts` owns the entire launch flow; the
renderer only gains a button and an IPC call, with no new dialog/modal
components (native `dialog.showMessageBox` is used from main, matching the
existing `pickDirectory()` pattern).

## Complexity Tracking

*No violations — table intentionally omitted.*
