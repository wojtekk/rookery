# Implementation Plan: Rebase Worktrees onto the Default Branch

**Branch**: `025-rebase-worktrees` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-rebase-worktrees/spec.md`

## Summary

Add a dedicated header action, **Rebase worktrees**, that replays each linked worktree's branch
onto its repository's default branch (`origin/<default>`, fetched fresh) using the proven,
non-destructive rebase spine from feature 014 (autostash → rebase → restore; abort + restore on the
first conflict; mark `failed`). It fills the gap where local-only feature-branch worktrees are
silently skipped by "Pull all" and where tracked worktrees only ever follow their own upstream, never
`main`. A one-time-dismissable native confirmation warns that rebasing rewrites history and must not
be run on shared branches; the "don't remind me again" choice is a new persisted setting,
re-enableable from a new **"Other"** Settings tab. The new action is a fourth long operation that
joins the existing UI-lockout, reuses feature 013's `failed`/warn surface (rebuilt per run), and is
disabled when no linked worktrees exist. A constitution amendment (Principles III & IV → v4.1.0) is a
prerequisite gate.

## Technical Context

**Language/Version**: TypeScript (ES modules), Node.js 24 (`.nvmrc`)

**Primary Dependencies**: Electron (main/preload/renderer); system `git` via `execFile`. No new
runtime dependency (Principle V). The confirmation uses Electron's built-in
`dialog.showMessageBox` (`checkboxLabel`/`checkboxChecked`).

**Storage**: Existing `settings.json` in `userData` (atomic temp-file + rename, `config.ts`). One new
boolean field, `rebaseReminderSuppressed`.

**Testing**: `node:test` + `assert/strict`. Pure decision logic → unit tests mirroring
`tests/update-eligibility.test.ts`; real-git-fixture tests for the rebase state machine mirroring
`tests/update.test.ts` (constitution runnable-check for a mutating op).

**Target Platform**: Desktop (Electron) on the user's local OS.

**Project Type**: Single desktop app (main + preload + renderer).

**Performance Goals**: Same as "Pull all" — bounded pool across families, per-worktree timeout; the
run must not hang on one unreachable remote.

**Constraints**: Offline-by-design except git fetching its configured remotes (Principle V);
non-interactive git only (`GIT_TERMINAL_PROMPT=0`, batch SSH, `GIT_EDITOR=true` — reuse
`NON_INTERACTIVE_ENV`). Never modify the primary's checkout or local default branch (FR-004).

**Scale/Scope**: Fleet-sized (tens–hundreds of worktrees); same order as the existing update engine.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Explicit, Never Automatic** — PASS. The action runs only on a deliberate button press, gated
  by an explicit confirmation; never on a timer.
- **II. Deliberate Mutation, Confirmed Destruction** — PASS. Rebase is a deliberate user action.
  It rewrites local history only; a confirmation reminder precedes it. It never deletes from disk, so
  the repository-deletion tier does not apply. Never resolves conflicts (aborts + restores).
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — ⚠️ **AMENDMENT REQUIRED (gate)**. The
  principle currently grants the non-interactive-rebase latitude to *"Pull-all"* by name. This
  feature performs the identical class of rebase (non-interactive, abort-on-first-conflict,
  restore-to-exact-prior-state, no merge commit) from a **new** action and onto the **default
  branch**. The guarantees are unchanged; only the wording must be generalised to cover a second
  deliberate update action. Classified **MINOR** (expanded guidance, no guarantee removed) →
  proposed constitution **v4.1.0**. Tracked in Complexity Tracking; must be ratified before merge
  (FR-014). Feature 014 set this precedent.
- **IV. Always-Observable State** — ⚠️ **AMENDMENT REQUIRED (gate)** + PASS on substance. The
  long-operation set is enumerated as "Refresh, Pull all, Cleanup"; "Rebase worktrees" is a fourth
  long operation and must be added so it blocks (and is blocked by) the others, dims only the table +
  sort-header, and leaves every other control colour-unchanged with a `not-allowed` cursor. The
  "controls with nothing to act on MUST be blocked" rule is honoured by disabling the button when no
  linked worktrees exist. The rebase results reuse the existing per-row failed (light-red) state and
  warn icon; no new colour or full-row fill. Enumeration update is **MINOR** (folded into v4.1.0).
- **V. Local-Only, Minimal Footprint** — PASS. No telemetry, no new network beyond `git fetch` to
  configured remotes, no new runtime dependency (native dialog + a few lines of engine code). Repo
  paths are passed to git as intact `-C <path>` arguments, never spliced into shell text.

**Development Workflow** — the mutating engine leaves runnable checks (pure eligibility/reason unit
tests + real-git-fixture rebase tests, incl. a conflict path), and the manual quickstart exercises a
real conflict/failure path before "done" (owed, as with prior mutating features).

**Gate result**: PASS to proceed to Phase 0, **conditional on** the v4.1.0 amendment being ratified
before merge (a documentation/governance step, not a code risk). No unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/025-rebase-worktrees/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── rebase-engine.md # Phase 1 output (engine + IPC contract)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── types.ts              # +Settings.rebaseReminderSuppressed; +UpdateReasonCategory cases;
│                             #  +RepoDashboardApi.{rebaseWorktrees,confirmRebaseWorktrees,
│                             #   setRebaseReminderSuppressed}
├── main/
│   ├── update.ts             # +rebaseWorktrees(rows) engine + pure helpers (reuses this module's
│   │                         #  private isDirty/restoreStash/expandTilde/timeout spine)
│   ├── config.ts             # +DEFAULT_SETTINGS.rebaseReminderSuppressed; +setRebaseReminderSuppressed IPC
│   └── main.ts               # +ipcMain 'rebaseWorktrees' (rebaseWorktrees(lastSnapshot));
│                             #  +ipcMain 'confirmRebaseWorktrees' (native message box w/ checkbox)
├── preload/
│   └── preload.ts            # +3 bridged methods
└── renderer/
    ├── renderer.ts           # +rebasing state; doRebaseWorktrees(); confirm-then-run flow;
    │                         #  reuses failedPaths/warnings (rebuilt per run — FR-009a)
    ├── view/
    │   ├── toolbar.ts        # +Rebase worktrees button; +rebasing/hasWorktrees state; busy incl. rebasing
    │   ├── settings.ts       # +"Other" tab + reminder toggle; activeTab widened to include 'other'
    │   └── table.ts          # +REASON_SENTENCE entries for new reason categories
    ├── index.html            # (no structural change; toolbar is rendered by toolbar.ts)
    └── styles.css            # +.ctrl.rebase button styling (mirrors .pull-all/.cleanup)

tests/
├── rebase-worktrees.test.ts  # NEW: pure eligibility/default-branch/reason unit tests +
│                             #  real-git-fixture rebase state-machine tests (incl. conflict)
```

**Structure Decision**: Single desktop-app layout (existing). The engine lives in `update.ts` (not a
new module) to reuse its private, unexported spine (`isDirty`, `restoreStash`, `expandTilde`, the
per-tree timeout wrapper, `NON_INTERACTIVE_ENV`, `groupIntoFamilies`) with the smallest diff —
`cleanup.ts` already imports from `update.ts`, so it is the established shared home for this
machinery. No new directories.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution amendment to Principle III (v4.1.0, MINOR) | The new action performs the same non-interactive, abort-on-conflict rebase the principle already permits, but the wording names only "Pull-all". | Not amending would leave the feature in literal violation despite honouring every guarantee; scoping the rebase to "Pull all" only would drop the entire feature. |
| Constitution amendment to Principle IV enumeration (v4.1.0, MINOR) | The UI-lockout rule lists three long operations by name; a fourth must be recognised so mutual exclusion and dimming apply. | Leaving it unlisted would make the lockout ambiguous for the new op; there is no simpler way to keep "at most one long operation at a time" honest. |
| One new persisted setting (`rebaseReminderSuppressed`) | "Do not remind me again" must survive restarts (FR-019). | A non-persistent in-memory flag fails FR-019; it rides the existing `Settings` object, so no new storage mechanism is introduced. |
