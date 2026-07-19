# Implementation Plan: Cleanup Gone Branches and Worktrees

**Branch**: `008-branch-cleanup` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-branch-cleanup/spec.md`

## Summary

Add a header **"Cleanup"** control (a sibling of the existing "Pull all" button)
that, per **repository** (not per worktree), removes `[gone]` branches and stale
worktrees — but only after the user reviews and confirms exactly what will go.

Because branch/worktree data needed to decide what is stale is **not** in the
current scan snapshot (`Head` has no "gone" flag; `probeWorktreeList` discards
branch/prunable info), Cleanup is genuinely **two-phase**:

1. **Scan (read-only, new git work)** — a new `src/main/cleanup.ts` engine runs,
   per repository, the logic of the user's `~/local/git-cleanup-all.sh` in
   *detect-only* mode: `git fetch -p` → `git for-each-ref
   --format='%(refname:short) %(upstream:track) %(worktreepath)' refs/heads/` to
   find `[gone]` branches, plus `git worktree list --porcelain` to find worktrees
   whose directory is missing or whose branch is merged. It returns a **removal
   plan** (candidates grouped by repo) without deleting anything.
2. **Confirm + remove** — the renderer opens a **review overlay** (built on the
   existing `.scrim`/`.modal` CSS from the settings modal) listing every
   candidate, each a checkbox **selected by default**, with a worktree indicator.
   The user unselects any they want to keep and confirms; a second engine call
   removes only the selected items and returns per-item outcomes. A counts-only
   toast (`showNotice`, exactly as Pull all) then shows, followed by a re-scan.

Removal mirrors the script's commands with one deliberate safety split:
`git branch -D` force-deletes selected `[gone]` branches (matching the script);
`git worktree remove` is run **without `--force`** for present worktrees (so
uncommitted/untracked work blocks removal, preserving the script's safety), and
**with `--force`** only for worktrees whose directory is already missing (nothing
to lose — matching feature 005). Git runs non-interactively under a per-repo
deadline, parallel across repository "families" and sequential within each,
reusing the exact `runPool` + `NON_INTERACTIVE_ENV` + deadline pattern from
`update.ts`.

## Technical Context

**Language/Version**: TypeScript ~5.9 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`) — unchanged.

**Primary Dependencies**: None new. Reuses `runGit` (`src/main/git/probe.ts`),
`runPool` (`src/main/scan.ts`), the IPC/preload/contextBridge plumbing, the
renderer toolbar/`render()`/`showNotice`/`doRefresh` machinery, the `spin`
keyframe, and the `.scrim`/`.modal`/`.modal-head`/`.modal-body`/`.modal-foot`/
`.btn` CSS from the settings modal.

**Storage**: N/A. No new persisted setting. The removal plan is transient state
held in the renderer between scan and confirm; nothing is written to disk.

**Testing**: `node:test` with real temp-git-repo fixtures (the project's
established pattern, cf. `tests/delete-risk.test.ts`, `update.ts` tests) for the
`cleanup.ts` engine — covering: detect `[gone]` branch, detect missing-directory
worktree, detect merged-branch worktree, skip the current branch, skip the main
worktree, do **not** remove a present worktree with uncommitted changes (plain
`remove` fails safely), force-delete an unmerged `[gone]` branch, `--force` only
on missing-dir worktrees, and execute-only-selected. Manual quickstart validation
of the full button → scan → overlay → select → remove → summary → refresh flow,
per the constitution's mandate that mutating-operation changes be manually
exercised against a real repo including a failure path.

**Target Platform**: Local desktop (Electron on the user's OS) — unchanged.

**Project Type**: Single-project desktop application — unchanged.

**Performance Goals**: Both the scan and the removal run through the bounded
`runPool` (pool size ~6) across repository families, so a dashboard of N repos
completes in roughly the time of the slowest few `fetch -p` calls, not their sum.
No new work is added to the startup/scan hot path — the Cleanup scan runs only on
explicit click.

**Constraints**: Read-only until the button is clicked, and nothing is removed
until the user confirms the overlay (Principle II). No conflict resolution;
present worktrees with local work are never force-removed (Principle III). Git via
system subprocess with the system credential mechanism, non-interactive
(`GIT_TERMINAL_PROMPT=0`, SSH `BatchMode=yes`), no password prompting
(Principle I). Per-repo deadline (~60s, matching `update.ts`, since `fetch -p` is
a real network op) so every run terminates. UI never freezes during scan or
removal (Principle IV).

**Scale/Scope**: One new main-process module (`cleanup.ts`), two new IPC methods
(`scanCleanup`, `executeCleanup`) threaded through preload + `RepoDashboardApi` +
`main.ts`, one new renderer overlay module (`src/renderer/view/cleanup.ts`), a new
toolbar control + `cleaning` state + `onCleanup` handler, checkbox CSS + a
`.ctrl.cleanup` busy rule, and ~1 new test file. No new dependency, no new
persisted setting, no change to the startup scan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

- **I. System-Native Delegation** — ✅ Pass. All git work shells out to system
  `git` via the existing `runGit`; credentials use the system mechanism. The
  engine sets `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND='ssh -oBatchMode=yes …'`
  (reused from `update.ts`) — this *disables* prompting, never stores/supplies
  credentials. No bundled git; the only porcelain parsing is `for-each-ref` /
  `worktree list --porcelain`, both stable machine formats (permitted exception).
- **II. Read-Only by Default, Destructive by Explicit Action** — ✅ Pass, and
  this feature is the *reason* Principle II was amended (v1.5.0) to name "branch
  cleanup" explicitly. Cleanup runs only on an explicit click, never on a timer.
  It is a bulk irreversible action, and Principle II requires such actions be
  "presented one item at a time or require explicit per-item confirmation" — the
  review overlay **satisfies this directly**: every branch/worktree is listed and
  individually opt-out-able before anything is removed. Nothing is removed on
  cancel.
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — ✅ Pass. Cleanup never
  merges or rebases. Present worktrees are removed with plain `git worktree
  remove` (no `--force`), which fails safely when the worktree holds
  uncommitted/untracked work; such a worktree is left intact and reported as
  skipped/failed, not forced. `--force` is used only where the directory is
  already gone (nothing to destroy).
- **IV. Always-Observable State** — ✅ Pass. The run is async and pooled so the
  UI never freezes; the button shows the existing busy/spin cue; results are a
  counts toast; state is re-derived by an explicit post-run `doRefresh()` so
  removed branches/worktrees disappear from the list honestly.
- **V. Local-Only, Minimal Footprint** — ✅ Pass. No telemetry, no app-initiated
  network beyond git talking to its configured remotes (the `fetch -p` in the
  explicit Cleanup scan). No new runtime dependency (YAGNI): reuses `runGit`,
  `runPool`, `showNotice`, and the settings-modal CSS.

**Result**: PASS. No principle deviations. One design choice worth recording (a
*stricter-than-required* safeguard, not a violation) is in Complexity Tracking.

## Complexity Tracking

| Choice | Why | Simpler alternative rejected because |
|--------|-----|--------------------------------------|
| Full checkbox **review overlay** rather than a single native "Clean up N repos?" confirm | User asked for a per-item selectable list (worktree indicator, unselect to keep); it also *exceeds* Principle II's per-item-confirmation bar cleanly | A single bulk confirm would satisfy the constitution's minimum but not the user's requirement and would force-delete unmerged `[gone]` branches with no per-item opt-out — the overlay is what makes force-delete safe |
| New `cleanup.ts` scan doing fresh `git fetch -p` + `for-each-ref` + `worktree list` instead of reading `lastSnapshot` | The snapshot carries no `[gone]` flag and no worktree branch/prunable data (confirmed in code); stale gone-status would delete the wrong branches | Reusing the snapshot (as Pull all does) is impossible without first enriching the whole scan hot path with data only Cleanup needs — worse for startup performance |
| `git worktree remove` **without** `--force` for present worktrees, diverging from delete's `--force` | Preserves the script's safety guarantee (fails on uncommitted work) and satisfies Principle III | Delete's `--force` would silently discard uncommitted/untracked work in a bulk operation — unacceptable for an unattended-feeling batch |

## Project Structure

### Documentation (this feature)

```text
specs/008-branch-cleanup/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ipc-cleanup.md   # Phase 1 output — scanCleanup/executeCleanup IPC contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── cleanup.ts        # NEW — scan (detect) + execute (remove selected) engine
│   ├── main.ts           # +2 ipcMain.handle: scanCleanup, executeCleanup
│   ├── update.ts         # (reference: families/pool/deadline/NON_INTERACTIVE_ENV)
│   ├── scan.ts           # reuse exported runPool
│   └── git/probe.ts      # reuse runGit
├── preload/
│   └── preload.ts        # +2 invoke forwarders: scanCleanup, executeCleanup
├── shared/
│   └── types.ts          # + CleanupCandidate, CleanupSelection, CleanupOutcome, RepoDashboardApi methods
└── renderer/
    ├── index.html        # + <div id="cleanupOverlay"></div>
    ├── styles.css        # + checkbox CSS, + .ctrl.cleanup(.busy) rules
    ├── renderer.ts       # + cleaning flag, doCleanup(), onCleanup handler, mount overlay in render()
    └── view/
        ├── toolbar.ts    # + Cleanup button (clone of Pull-all block), ToolbarState/Handlers fields
        └── cleanup.ts    # NEW — review overlay (isOpen + openCleanupOverlay + renderCleanupOverlay)

tests/
└── cleanup.test.ts       # NEW — engine detect/execute cases on temp-git-repo fixtures
```

**Structure Decision**: Single-project Electron layout (unchanged). The engine
lives in `src/main/cleanup.ts` mirroring `update.ts`; the overlay lives in
`src/renderer/view/cleanup.ts` mirroring `settings.ts`. Detection and removal are
two exported functions in the one engine module (split of the script's single
pass) so the read-only scan is independently testable and can never delete.
