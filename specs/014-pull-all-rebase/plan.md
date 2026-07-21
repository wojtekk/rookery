# Implementation Plan: Rebase Diverged Repositories on Pull All

**Branch**: `014-pull-all-rebase` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-pull-all-rebase/spec.md`

## Summary

"Pull all" currently only fast-forwards (`git merge --ff-only`) and reports every
non-fast-forwardable repository as `failed` (reason `diverged`). The user updates those
same repositories trivially with `git pull --autostash` because their global
`pull.rebase=true` rebases local commits onto the upstream. This feature closes that gap:
for an eligible **diverged** repository (local commits present *and* upstream advanced),
"Pull all" now rebases the local commits onto the upstream. On any conflict it aborts the
rebase, restores the repository to its exact prior state, and reports `failed` with a new
`rebase-conflict` reason — never resolving a conflict, never creating a merge commit.

Technical approach: the change is confined to the single `diverged` branch of
`classifyAndMerge` in `src/main/update.ts`. The surrounding `updateRepoInner` already
autostashes with `--include-untracked` before classification and restores afterward, so the
working tree is already clean when the rebase runs — a plain non-interactive
`git rebase @{u}` with an `--abort` on failure is all that's needed. One new reason
category (`rebase-conflict`) is threaded through `shared/types.ts` and the renderer's
tooltip map. No new IPC, dependency, persisted setting, or UI state.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 24 (pinned in `.nvmrc`; `nvm use` before any `pnpm`/`node`)

**Primary Dependencies**: Electron (existing); system-installed `git` invoked via `execFile`. **No new runtime dependency.**

**Storage**: None. `warnings` is renderer-only in-memory (reused from feature 013); no persisted setting added.

**Testing**: `node:test` with **real git fixtures** (bare remote + clones in temp dirs), following `tests/update.test.ts` / `tests/delete-risk.test.ts`; `tsc` build as the type/compile check.

**Target Platform**: Desktop (Electron) on the user's local OS (macOS primary).

**Project Type**: Desktop app — `src/main` (Electron-free, unit-testable engine), `src/renderer`, `src/shared`.

**Performance Goals**: Unchanged. Per-repo bounded by the existing 60 s family deadline and 5 s per-spawn `SPAWN_TIMEOUT_MS`; families run through a pool of 6, sequential within a family.

**Constraints**: Offline-by-design (only git-to-its-remotes network); non-interactive git (no prompts, no editor); never discard uncommitted work; never leave a rebase in progress.

**Scale/Scope**: Tens–hundreds of local working trees per run.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|-----------|---------|-------|
| **I. System-Native Delegation** | ✅ PASS | Uses the system `git rebase`; no bundled git, no reimplemented plumbing. Runs under the existing `NON_INTERACTIVE_ENV`, extended with an editor guard (`GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true`) so a rebase can never block on an editor. Credentials via the fetch step's existing mechanism only. |
| **II. Read-Only by Default, Destructive by Explicit Action** | ✅ PASS | Rebase runs only inside "Pull all", a deliberate user action; never on a timer. Startup/refresh remain read-only. |
| **III. Never Resolve Conflicts — Fail Loud, Hand Off** | ✅ PASS (amendment **ratified**) | The required amendment is now recorded: constitution **v4.0.0** (2026-07-21) permits a non-interactive, conflict-free rebase of a diverged repo while keeping the no-conflict-resolution / no-interactive / no-merge-commit core. The *no-conflict-resolution* guarantee is fully preserved (non-interactive rebase, abort on first conflict, hand off); only the *"a diverged repo is left untouched / never rewritten"* guarantee was relaxed. See Complexity Tracking and research.md Decision 6; FR-012 verified by tasks T011. |
| **IV. Always-Observable State** | ✅ PASS | Reuses the existing `failed` result → light-red row → "Failed" filter → feature-013 warn icon. Only a new *reason* string is added; no new visual state (spec Q3). |
| **V. Local-Only, Minimal Footprint** | ✅ PASS | No new dependency, no app network, no telemetry, no new persisted config. Change is a few lines in one engine function plus a reason label. |

**Gate result**: PASS. The Principle III amendment that this gate was conditional on has been
recorded — constitution **v4.0.0** (`/speckit-constitution`, 2026-07-21); its wording is
captured in `research.md` (Decision 6) and Complexity Tracking. No remaining gate conditions;
tasks T011 re-verifies the ratified state before merge (FR-012).

## Project Structure

### Documentation (this feature)

```text
specs/014-pull-all-rebase/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── update-engine.md # Phase 1 output — the update-outcome contract change
└── checklists/
    └── requirements.md  # from /speckit-specify + /speckit-clarify
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── types.ts         # CHANGE: add 'rebase-conflict' to UpdateReasonCategory
├── main/
│   └── update.ts        # CHANGE: diverged branch of classifyAndMerge → rebase-or-abort
└── renderer/
    └── view/
        └── table.ts     # CHANGE: add REASON_SENTENCE['rebase-conflict']

tests/
└── update.test.ts       # CHANGE: retarget the diverged test; ADD rebase-clean + rebase-conflict tests
```

**Structure Decision**: Reuse the existing three-layer layout (`main`/`renderer`/`shared`)
with no new files in `src/`. The engine change lives entirely in `src/main/update.ts`
(Electron-free, real-git-testable). The renderer touch is a single map entry. All new
behavior is covered by `tests/update.test.ts` using the existing real-git fixtures.

## Complexity Tracking

> Only the Principle III tension requires justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle III relaxed to allow a conflict-free rebase to **rewrite local history** on a diverged repo (previously guaranteed untouched/`failed`) | This *is* the feature: it makes "Pull all" match the user's proven, everyday `git pull --autostash` (under `pull.rebase=true`), which is the entire reported bug. Fast-forward-only leaves routine, cleanly-rebasable repos stuck as `failed`. | **Keep FF-only + only explain better** (spec option B) was offered and rejected by the user — feature 013 already added the explanation and the user still wants the repos actually updated. **Merge instead of rebase** is a worse Principle III fit (fabricates merge commits = auto-merge). The relaxation is minimized: non-interactive, abort-on-first-conflict, never resolves, restores exact prior state, never merges. |
