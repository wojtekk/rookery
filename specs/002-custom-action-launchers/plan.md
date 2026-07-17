# Implementation Plan: Custom Per-Repository Action Launchers

**Branch**: `002-custom-action-launchers` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-custom-action-launchers/spec.md`

## Summary

Turn the ⋮ kebab menu that 001-repo-dashboard reserved (but left empty) into a
user-configurable launcher. In Settings the user manages an ordered list of
**Actions** — each an icon (from a bundled catalog), a display name, and a command
template — bounded by a single limit constant (default 6). Every repository and
worktree row's ⋮ menu lists those actions in order; selecting one launches the
command with the row's own full path (`${1}`) and raw remote URL (`${2}`)
substituted as **shell positional parameters** (never spliced into command text),
running through the user's login shell so CLI shims (`code`, `idea`) resolve. The
list is seeded on first run with five editable defaults (GitHub, IntelliJ, VS
Code, Finder, Terminal) and persists in the existing settings JSON. Launches are
non-blocking; a failed launch surfaces a per-action, per-row error without
freezing the dashboard. Actions whose command references `${2}` are disabled on
rows with no configured origin.

Technical approach: extend the existing Electron (main + preload + renderer)
TypeScript app. No new runtime dependency. The only genuinely new mechanism is the
**launch path** in the main process: `spawn($SHELL, ['-l','-c', 'set -f; IFS=; ' +
template, base, pathValue, remoteUrl], { detached, stdio:'ignore' })`. Everything
else is additive UI + settings plumbing over 001's seams: the reserved kebab slot
in `view/table.ts`, the settings modal in `view/settings.ts`, `config.ts`
persistence, and the typed IPC bridge. `git config --get remote.origin.url` is
already run by 001's probe (P5) — this feature stops discarding the raw URL so
`${2}` has a value. Pure logic (action-list ops, `${2}`-enablement, limit) is
isolated for `node:test`, matching 001's test discipline.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js (Electron 32+ bundled runtime) —
same as 001; no version change.

**Primary Dependencies**: Electron (existing). System `git` (existing, for the
raw origin URL via the probe already in place). The user's login shell
(`$SHELL`, fallback `/bin/sh`) invoked via Node `child_process.spawn` — the same
`child_process` already used for git. No new runtime dependency; icons ship as
static bundled SVG assets.

**Storage**: The existing single settings JSON in `app.getPath('userData')`,
extended with an `actions` array. No new store; atomic temp-file + rename reused
from `config.ts` (001 R5).

**Testing**: `node:test` (stdlib) over pure-logic modules — action-list ops
(add/edit/remove/move within the limit), `${2}`-enablement per row, and the
launch argument-safety contract (values reach the command as intact arguments and
cannot break out, verified with paths containing spaces/quotes/`$`/backticks).
No test framework dependency. Matches 001's pure-core pattern.

**Target Platform**: Cross-platform desktop via Electron; primary development
target macOS. The five seeded default commands are macOS-form (`open`, `open -a`,
CLI shims); they are ordinary editable actions, so a different OS's default set is
a follow-up, not a rework (see research R5).

**Project Type**: Desktop application (Electron main + preload + renderer) —
extends the existing single project.

**Performance Goals**: Selecting an action launches it and returns control to the
UI without a perceptible freeze (SC-002); a failed launch surfaces a visible
error within 2 s (SC-004); adding/seeing a new action works in under 30 s without
leaving Settings (SC-001).

**Constraints**: Local-only — no telemetry, no app-initiated network (Constitution
V). Repo-derived values (`${1}`, `${2}`) MUST be passed as intact arguments, never
spliced into command text (Constitution V, FR-005). Launches run only on explicit
per-row user selection, never on a timer (FR-006, Constitution V). Context-isolated
renderer; all launching stays in main (renderer never spawns).

**Scale/Scope**: Single user; up to the action-limit constant (default 6) actions,
applied uniformly to every row (actions are global, not per-repository).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against **Constitution v1.4.0** (amended this planning session to reframe
external targets from a fixed enumeration to user-configured launch commands with
the original five as seeded defaults, and to add the argument-safe-substitution
mandate — the exact scope of this feature).

| Principle | Gate | Status |
|-----------|------|--------|
| I. System-Native Delegation | Launches delegate to system-native tools via the user's own shell/`PATH`; no bundled binaries; the raw remote URL comes from the system git already in use. | ✅ PASS |
| II. Read-Only by Default | The app itself performs no repository mutation; it launches user-authored external commands only on an explicit per-row selection (a deliberate user action, one row at a time). A user's command could itself mutate, but that is user-owned, equivalent to typing it in their terminal; the app neither generates nor schedules such commands. No app-driven mutating operation is added. | ✅ PASS |
| III. Never Resolve Conflicts | No merge/rebase/pull in this feature. | ✅ PASS (N/A) |
| IV. Always-Observable State | Additive UI on the reserved kebab slot; launches never freeze the UI (FR-006), and `${2}`-dependent actions are honestly disabled with explanation on remote-less rows (FR-013) rather than silently misbehaving. Existing state surfacing is untouched. | ✅ PASS |
| V. Local-Only, Minimal Footprint | No telemetry, no app network; user-configured launch commands (the five reframed defaults) are launched, never embedded, only on user action (v1.4.0). `${1}`/`${2}` are substituted as shell positional parameters — intact arguments, never command text — satisfying the new argument-safe mandate. No new runtime dependency (shell via existing `child_process`; icons are static assets). | ✅ PASS |

No violations → Complexity Tracking is empty. (The lone tension — the pre-1.4.0
fixed launch list — was resolved by the constitution amendment recorded above, not
by a plan-level exception.)

## Project Structure

### Documentation (this feature)

```text
specs/002-custom-action-launchers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ipc-api.md       # new/changed renderer <-> main IPC methods
│   └── launch.md        # launch command contract (substitution + failure detection)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

Additive over 001's tree. **New** files marked `(new)`; **changed** files marked
`(∆)`; unmarked 001 files are untouched.

```text
src/
├── shared/
│   ├── types.ts          # (∆) add Action; extend Settings with `actions`; add rawUrl to Remote
│   └── actions.ts        # (new) ACTION_LIMIT constant + pure list ops (add/edit/remove/move,
│                         #        limit check, ${2}-enabled-for-row, default seed set)   [tested]
├── main/
│   ├── main.ts           # (∆) register new IPC handlers (actions CRUD/reorder, runAction)
│   ├── config.ts         # (∆) load/save `actions`; seed the five defaults on first run
│   ├── actions/
│   │   └── launch.ts     # (new) spawn user command via login shell w/ positional-param
│   │                     #        substitution; grace-window failure detection
│   └── git/
│       └── parse.ts      # (∆) keep the raw origin URL alongside parsed host/slug (P5)
├── preload/
│   └── preload.ts        # (∆) expose getActions/setActions/runAction on window.repoDashboard
└── renderer/
    ├── renderer.ts       # (∆) hold actions in view state; open on Settings changes
    └── view/
        ├── table.ts      # (∆) render the ⋮ menu from actions; per-row ${2} disable (FR-013)
        ├── settings.ts   # (∆) actions section: list, add/edit form, remove, up/down reorder
        └── icons/
            ├── catalog.ts    # (new) id → bundled SVG manifest (offline, fixed set)
            └── *.svg         # (new) bundled devicon-inspired glyphs

tests/
├── actions.test.ts       # (new) list ops, limit enforcement, ${2}-enabled-for-row, seed set
└── launch.test.ts        # (new) argument-safety: path/url with spaces/quotes/$/backticks reach
                          #        the command intact; grace-window classifies 127/126 as failure
```

**Structure Decision**: Extend the existing single Electron project along its
established seams rather than introducing new architecture. The one new main-process
concern (launching) gets its own `main/actions/launch.ts`; all decision logic that
can be pure (list mutations, limit, `${2}`-enablement, the default seed) lives in
`shared/actions.ts` so it is unit-testable with `node:test` without Electron —
preserving 001's "testable pure core" discipline and the constitution's
"one runnable check" rule for the security-sensitive substitution path.

## Complexity Tracking

> No constitution violations — no entries. The fixed-launch-list tension was
> resolved by amending the constitution to v1.4.0 (a deliberate governance change
> the user approved), not by a plan-level exception.
