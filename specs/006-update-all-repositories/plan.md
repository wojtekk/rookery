# Implementation Plan: Update All Repositories

**Branch**: `006-update-all-repositories` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-update-all-repositories/spec.md`

## Summary

Add a single header control (a "Pull all" / update button, distinct from the
existing re-scan-only Refresh) that fast-forwards every eligible repository and
worktree to its tracked upstream in one click, with its icon animated while the
run is in flight. Eligibility (available, non-detached branch, tracked upstream,
has a remote) is read straight off the existing `lastSnapshot` in `main.ts` — no
new probing. Each eligible working tree is updated by a new `src/main/update.ts`
engine that reuses the *non-destructive* logic of the user's `upgrade-repo.sh`:
`git stash push --include-untracked` when dirty → `git fetch` → **fast-forward
only** (`git merge --ff-only`) → restore stash. On any divergence or failure the
engine rolls back and reports `failed` — it does **not** carry over the script's
`-Xours` auto-merge, which violates Constitution Principle III (agreed in
clarification). Git runs non-interactively (`GIT_TERMINAL_PROMPT=0`, SSH
`BatchMode=yes`) under a per-repo deadline so no repo can hang the run. Results
come back as a per-path outcome list; the renderer shows a one-line counts
summary, paints failed rows with a new light-red "failed pull" edge (the state
Principle IV already reserves), then re-scans so ahead/behind is honest again.

## Technical Context

**Language/Version**: TypeScript ~5.9 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`) — unchanged.

**Primary Dependencies**: None new. Reuses `runGit` (`src/main/git/probe.ts`),
the `runPool` concurrency helper (`src/main/scan.ts`, to be exported), the
existing IPC/preload/contextBridge plumbing, the renderer toolbar/table/notice
(`showNotice`) machinery, and the existing `spin` CSS keyframe.

**Storage**: N/A. No new persisted setting. The "failed pull" marking is
transient renderer state (a `Set<string>` of paths), not persisted and not
derived from a scan.

**Testing**: `node:test` with real temp-git-repo fixtures (the project's
established pattern, cf. `tests/delete-risk.test.ts`) for the `update.ts` engine
— covering fast-forward, autostash+ff+restore, diverged→failed (the mandatory
conflict/failure path), already-current, and skip/ineligible. Manual quickstart
validation of the full button→animation→summary→light-red→refresh flow, per the
constitution's mandate that mutating-operation changes be manually exercised.

**Target Platform**: Local desktop (Electron on the user's OS) — unchanged.

**Project Type**: Single-project desktop application — unchanged.

**Performance Goals**: Updates run through a bounded concurrency pool (reuse
`runPool`, pool size ~4–8) so a dashboard of N repos completes in roughly the
time of the slowest few network fetches, not their sum. No new work is added to
the startup/scan hot path.

**Constraints**: Fast-forward only (never auto-merge/rebase — Principle III).
Read-only until the button is clicked (Principle II). Git via system subprocess,
system credential mechanism, no password prompting (Principle I). Per-repo
deadline (default ~60s for the fetch+merge sequence, longer than the 5s scan
probe bound because a real network fetch legitimately takes longer) so every run
terminates (FR-013/SC-007). UI never freezes during the run (Principle IV).

**Scale/Scope**: One new main-process module (`update.ts`), one new IPC method
(`updateAll`) threaded through preload + `RepoDashboardApi`, a widened `runGit`
signature (backward-compatible `opts`), one exported `runPool`, a new toolbar
control, a new light-red row state in the renderer + CSS, and ~2 new/extended
test files. No new dependency, no new persisted setting.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

- **I. System-Native Delegation** — ✅ Pass. All git work shells out to the
  system `git` via `runGit`; credentials use the system mechanism. The engine
  sets `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND='ssh -oBatchMode=yes'` —
  this *disables* prompting (aligned with "MUST NOT prompt for passwords"),
  never stores or supplies credentials. No bundled git, no plumbing reimpl.
- **II. Read-Only by Default, Destructive by Explicit Action** — ✅ Pass. The
  update runs only on an explicit button click, never on a timer. It is exactly
  the "pull-all" mutation the constitution already names. Autostash keeps it
  non-destructive; a single deliberate click covers the whole batch (the
  per-item-confirmation clause targets *irreversible* bulk actions like deletion,
  not an autostashed pull that is fully recoverable).
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — ✅ Pass **by design
  decision**. Pull-all uses autostash; a repo that cannot fast-forward is
  stopped, left inspectable, and marked failed (light red) with handoff via the
  existing per-row launchers. The script's `-Xours` auto-merge is intentionally
  dropped. See Complexity Tracking for the recorded deviation from the user's
  "keep main logic unchanged" request.
- **IV. Always-Observable State** — ✅ Pass. Adds the light-red "failed
  autostash pull" edge the principle already specifies (currently unimplemented),
  paired with the existing non-colour cues (glyph/text/counts). The run is async
  and pooled so the UI never freezes; state is re-derived by an explicit
  post-run scan.
- **V. Local-Only, Minimal Footprint** — ✅ Pass. No telemetry, no app-initiated
  network beyond git talking to its configured remotes. No new runtime
  dependency (YAGNI): reuses `runGit`, `runPool`, and existing UI helpers.

**Result**: PASS. One recorded deviation (below) — a deliberate *narrowing* of
requested behavior to satisfy Principle III, not a principle violation.

## Complexity Tracking

| Deviation | Why Needed | Simpler / Requested Alternative Rejected Because |
|-----------|------------|--------------------------------------------------|
| Drop the script's `-Xours` auto-merge branch (user asked to "keep main logic unchanged") | Principle III forbids auto-resolving conflicts; `-Xours` silently buries upstream changes under local, defeating the tool's "at-a-glance truth" purpose | Keeping `-Xours` would require a MAJOR constitution amendment (rejected by the user during clarification); fail-loud is safer and still satisfies "don't make me deal with conflicts" (diverged repos are skipped + flagged, not forced on the user) |

## Project Structure

### Documentation (this feature)

```text
specs/006-update-all-repositories/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── update.md        # The updateAll IPC method + per-repo update state machine
│   └── ipc-api.md       # Amendment note: adds updateAll to RepoDashboardApi
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── update.ts               # NEW: updateRepo() state machine + updateAll(rows) orchestrator
│   ├── main.ts                 # + updateAll() handler reading lastSnapshot; register 'updateAll' IPC
│   ├── scan.ts                 # export runPool (reuse for the update pool) — one-word change
│   └── git/
│       └── probe.ts            # runGit: + optional opts { timeoutMs?, env? } (backward-compatible)
├── shared/
│   └── types.ts                # + RepoUpdateOutcome / UpdateResult; + updateAll on RepoDashboardApi
├── preload/
│   └── preload.ts              # + updateAll passthrough
└── renderer/
    ├── renderer.ts             # doUpdateAll(): running guard, call IPC, mark failedPaths, summary toast, doRefresh
    ├── styles.css              # + --fail-edge (light red) row edge; reuse spin keyframe for the new button
    └── view/
        ├── toolbar.ts          # + "Pull all" control (state.updating, onUpdateAll), animated spin-icon
        └── table.ts            # paint light-red edge for rows whose path ∈ failedPaths

tests/
├── update.test.ts              # NEW: engine fixtures — ff / autostash+ff / diverged→failed / current / skip
└── update-eligibility.test.ts  # NEW (or fold into above): the pure eligibility filter over Row[]
```

**Structure Decision**: Single-project Electron layout, unchanged. The mutating
git logic lives in its own electron-free `src/main/update.ts` (mirroring how
`delete.ts` keeps risk logic testable and separate from the electron
orchestration in `main.ts`), so the engine is unit-testable with plain
`node:test`. The renderer changes stay confined to the toolbar (new control),
table (light-red paint), `renderer.ts` (the run orchestration), and one CSS var.

## Phase 0 — Research

See [research.md](./research.md). Resolves: fast-forward-only git command
choice; autostash + rollback sequence adapted from the script; non-interactive
env + per-repo deadline; where eligibility is computed; how the transient
failed-pull state is carried and cleared.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — `UpdateResult` / `RepoUpdateOutcome`,
  eligibility predicate, transient failed-path set, the per-repo update state
  machine.
- [contracts/update.md](./contracts/update.md) — `updateAll()` IPC signature,
  ordering guarantees, the update state machine and its git command sequence.
- [contracts/ipc-api.md](./contracts/ipc-api.md) — amendment adding `updateAll`
  to `RepoDashboardApi` (extends 001's ipc-api contract).
- [quickstart.md](./quickstart.md) — runnable validation scenarios.
