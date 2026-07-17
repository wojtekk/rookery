# Implementation Plan: Startup Loading Indicator

**Branch**: `003-startup-loading-indicator` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-startup-loading-indicator/spec.md`

## Summary

While the startup repository scan runs, the app must show a flat, indeterminate,
centered loading indicator instead of a blank screen — and must **never** flash
the add-directory screen before it. The primary requirement is a renderer-side
view-state change: on launch the app evaluates configuration state *first*, then
paints exactly one of `loader` / `add-directory` / `list|empty`. The existing
main-process startup scan (`api.listRepositories()` + `api.refresh()`) is reused
unchanged; no git, IPC, or storage changes are needed. Flicker on fast scans is
avoided with a ~150 ms show-delay and a ~400 ms minimum-visible window.

## Technical Context

**Language/Version**: TypeScript ~5.5 (compiled with `tsc`), Node 22 (pinned via `.nvmrc`)

**Primary Dependencies**: Electron 40.8.5 (main/preload/renderer split); no UI framework; no new runtime dependencies

**Storage**: Electron `userData` JSON settings (unchanged — this feature reads `observedDirectories.length` only)

**Testing**: `node:test` over pure logic (built to `dist/tests/*.test.js`); manual UI validation via `quickstart.md`

**Target Platform**: Local desktop (Electron on the user's OS; primary dev target macOS)

**Project Type**: Single-project desktop application (`src/main`, `src/preload`, `src/renderer`, `src/shared`)

**Performance Goals**: First meaningful paint decision resolves as soon as settings are read (no perceptible pre-paint stall); loader appears only for scans > ~150 ms; 60 fps CSS animation (GPU-friendly transform/opacity)

**Constraints**: UI must never freeze (Principle IV); no add-directory flash when directories are configured (SC-006); no network; renderer-only change

**Scale/Scope**: One transient app-level load state; ~5 files touched (renderer boot, one new view module, one new pure-logic module, HTML, CSS) + one test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.4.0:

- **I. System-Native Delegation** — ✅ N/A. No git invocation added; reuses the existing scan path.
- **II. Read-Only by Default** — ✅ Pass. The loader is purely presentational; it triggers no mutation and no new background activity.
- **III. Never Resolve Conflicts** — ✅ N/A. No merge/pull logic touched.
- **IV. Always-Observable State** — ✅ Pass (this feature *advances* the principle). It directly satisfies "Long or blocking operations MUST NOT freeze the UI" and "State MUST be refreshed at startup" by making the in-progress scan observable instead of a blank/misleading screen.
  - ⚠️ **Tracked deviation**: the spec explicitly scopes OUT loader-specific accessibility (reduced-motion handling, screen-reader "loading" announcement). Principle IV emphasizes redundant, non-colour cues. See Complexity Tracking — the deviation is bounded and spec-ratified.
- **V. Local-Only, Minimal Footprint** — ✅ Pass. No new dependency; reuses existing CSS animation idioms (`@keyframes spin`, the `prefers-reduced-motion` block already in `styles.css`). YAGNI honored.

**Result**: PASS with one tracked, justified deviation (accessibility scope-out). No blocking violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-startup-loading-indicator/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── loadstate.md     # View-state + timing contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/                     # (unchanged) startup scan already exists here
├── preload/                  # (unchanged) IPC bridge already exposes list/refresh
├── shared/
│   └── types.ts              # (maybe) add LoadPhase type if shared
└── renderer/
    ├── index.html            # + #loader container in the content area
    ├── styles.css            # + flat indeterminate loader styles + keyframes
    ├── renderer.ts           # boot flow: evaluate config first, drive loadState, gate first paint
    └── view/
        ├── loader.ts         # NEW: render/toggle the flat indeterminate loader element
        └── loadstate.ts      # NEW: PURE logic — startup view decision + loader show/min-visible timing

tests/
└── loadstate.test.ts         # NEW: node:test over the pure loadstate logic
```

**Structure Decision**: Single-project Electron layout (already established by 001/002).
This feature is **renderer-only**. Pure decision + timing logic is isolated in
`src/renderer/view/loadstate.ts` so it is unit-testable with `node:test` (matching
the project convention of `shared/actions.ts` + `actions.test.ts`), while DOM work
stays in `loader.ts` and the boot orchestration in `renderer.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Accessibility (reduced-motion / SR announcement) scoped OUT of loader, a partial narrowing of Principle IV | Spec clarification (Session 2026-07-17) ratified a purely-visual loader for this iteration to keep scope minimal; the loader is transient and carries no persistent state that colour/non-colour cues must disambiguate | Full a11y treatment now would add work the user explicitly deferred; Principle IV's redundant-cue mandate primarily targets *persistent per-row state*, not a transient progress affordance. Deviation is bounded and reversible (a `prefers-reduced-motion` freeze is a later one-line add, and the CSS idiom already exists). |
