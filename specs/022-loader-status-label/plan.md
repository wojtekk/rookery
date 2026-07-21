# Implementation Plan: Label the Loader With the Active Operation

**Branch**: `022-loader-status-label` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-loader-status-label/spec.md`

## Summary

The table loader (`#tableLoader`, built by `view/loader.ts`'s
`setLoaderVisible`) currently shows only three pulsing dots — no indication
of *which* of the app's four busy operations (initial load, Refresh, Pull
all, Cleanup) is running. All four share one choke point,
`renderer.ts`'s `beginBusyLock()`/`endBusyLock()`. Technical approach: give
`beginBusyLock` a required `label: string` parameter and thread it into
`setLoaderVisible`, which now builds a persistent `.loader-label` element
(created once, `role="status"`, text updated on each show) above a new
`.loader-dots` wrapper holding the existing three dots. Each of the four
call sites passes its own literal label ("Loading…", "Refreshing…",
"Pulling…", "Cleaning up…") — no new decision function, since each site
already unambiguously knows which operation it is. `.table-loader` becomes
a column flex container so the label sits above the row of dots; `.loader-label`
is styled with the same `--muted` colour and a small font size already used
elsewhere in the app, so it blends in rather than reading as a banner.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled under
`tsconfig.renderer.json`

**Primary Dependencies**: Electron 40 (renderer process); no new runtime
dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`. No new test
file — every changed line is a literal label passed at an existing call
site, or DOM/CSS with no new branch (see `research.md` Decision 4), matching
the precedent set by features 017/018/020.

**Target Platform**: Desktop (Electron) on the user's local OS

**Project Type**: Single-project desktop app (Electron main + renderer);
this feature only touches renderer-side presentation

**Performance Goals**: N/A — no new work on any hot path; the loader's
existing 150 ms show-delay / 400 ms min-visible timing (`view/loadstate.ts`)
is unchanged

**Constraints**: No new dependency (Principle V); MUST NOT change which
controls the long-operation lockout blocks or how it dims rows (Principle
IV) — only the loader's own content gains a label

**Scale/Scope**: Two files edited (`view/loader.ts`, `renderer.ts`), one
stylesheet edited (`styles.css`); zero new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. System-Native Delegation** — Unaffected; no git interaction changes.
- **II. Read-Only by Default, Destructive by Explicit Action** — Unaffected;
  no mutating operation's trigger or behavior changes, only what its
  existing busy indicator displays.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Reinforced: the constitution's
  rationale is "at-a-glance truth"; naming which operation is running is a
  direct extension of that intent, and a non-colour cue (text) matches the
  existing "redundant non-colour cue" pattern used elsewhere for state
  (status glyphs, warning icons). The long-operation lockout's scope (which
  controls block, what dims) is verified unchanged — only `setLoaderVisible`
  and `beginBusyLock`'s signatures grow a parameter; `endBusyLock`, the
  `.busy` dim classes, and the lockout's control-blocking logic are untouched.
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry; the diff is a few lines of DOM/CSS.

**Development Workflow** — This change does not touch a mutating repository
operation (pull, push, delete, remove) — it only labels the existing,
unchanged busy/lock mechanism those operations already trigger — so the
"runnable check for guard/safety behavior" mandate does not apply (confirmed
in `research.md` Decision 4: no new predicate or branch is introduced).
Manual verification: `quickstart.md` walks all four operations, confirming
each shows its correct label, appears/disappears with the dots, and reads
as visually subdued.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/022-loader-status-label/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── spec.md
```

No `contracts/` directory: no IPC method, main-process change, or external
interface is added or altered — this is a renderer-only presentation change
over an existing, unchanged busy/lock mechanism.

### Source Code (repository root)

```text
src/renderer/
├── view/
│   └── loader.ts        # setLoaderVisible(container, visible, label?):
│                         #   builds .loader-label (once, role="status") +
│                         #   .loader-dots wrapper (once, holds the existing
│                         #   3 .loader-dot children); sets label text on
│                         #   each visible=true call
├── renderer.ts           # beginBusyLock(label: string) — 4 call sites
│                         #   (startup IIFE, doRefresh, doUpdateAll,
│                         #   doCleanup) each pass their own literal label
└── styles.css             # .table-loader: row -> column flex; new
                          #   .loader-dots (row flex, carries the old gap);
                          #   new .loader-label (small, --muted, blended)
```

**Structure Decision**: Single-project Electron layout (already
established). No new file: the label is threaded through the two functions
that already form the sole choke point for every operation that shows this
loader, matching the "smallest diff at the existing choke point" pattern
used by prior small renderer fixes (e.g. 021's single-call-site gate).

## Complexity Tracking

*No violations — this section is not needed.*
