# Implementation Plan: Custom Modern Table Scrollbar

**Branch**: `011-custom-table-scrollbar` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-custom-table-scrollbar/spec.md`

## Summary

Replace the OS-default scrollbar on the repository table's one scrollable
region (`#list` / `.list` in `index.html`/`styles.css`, currently
`overflow-y: auto`) with a thin, auto-hiding overlay scrollbar in the style of
a modern code editor: invisible at rest, faded in on scroll/hover/keyboard
scroll, faded back out ~1s after activity stops, with an instant (non-animated)
show/hide when the OS "reduce motion" preference is on.

Technical approach: **renderer-only, CSS-first**. Style the thumb thin via
`::-webkit-scrollbar` pseudo-elements (Electron's bundled Chromium supports
these; the standard `scrollbar-width`/`scrollbar-color` properties alone can't
express an idle-hidden/active-revealed overlay, so they're not sufficient on
their own). Drive the reveal/hide state with a small `.list.scrolling` class
toggle plus a debounce timer — the same shape as the existing
`busyShowTimer`/`setTimeout`+`clearTimeout` pattern already in `renderer.ts` —
wired to `scroll`, `mouseenter`/`mouseleave`, and `keydown` (arrow/Page/Home/
End) on `#list`. Gate the fade transition itself behind
`@media (prefers-reduced-motion: no-preference)`, mirroring the existing gate
at `styles.css:1175`. No new dependency, no new IPC, no main-process change,
no persisted setting.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled per `tsconfig.renderer.json`

**Primary Dependencies**: Electron 40 (renderer process, Chromium engine); no new runtime dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`; the existing
suite is pure-logic (parsing/filtering/sorting) with no DOM/CSS test harness,
and this feature is pure DOM/CSS behavior — validated manually via
`quickstart.md`, consistent with how prior visual-only features (e.g. spec 009)
were verified

**Target Platform**: Desktop (Electron) on the user's local OS — macOS,
Windows, Linux, rendered by Electron 40's bundled Chromium

**Project Type**: Single-project desktop app (Electron main + renderer); this
feature touches the renderer only

**Performance Goals**: Reveal within one frame of scroll/hover/keydown (SC-002);
fade-out ~1s after the last activity (SC-003); the scroll region's own scroll
performance is unaffected (styling only, no new scroll-handling logic beyond a
debounce timer)

**Constraints**: No new dependency (Principle V); no layout shift when the
scrollbar appears/disappears (FR-009); graceful fallback to the native
scrollbar if the styling technique is unsupported (FR-012); fade transitions
disabled under `prefers-reduced-motion` (FR-007)

**Scale/Scope**: One scrollable container (`#list`/`.list`); no other
scrollable region exists in the app today, so no cross-component reuse concern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature is purely cosmetic/interaction chrome around the table's existing
scroll container and touches none of the constitution's mutation, state-colour,
or lockout mechanics. Gate evaluation:

- **I. System-Native Delegation** — Unaffected; no git interaction.
- **II. Read-Only by Default, Destructive by Explicit Action** — Unaffected;
  no mutating operation is touched.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Unaffected in substance: the scrollbar
  lives on the same `.list` container that already dims during a long
  operation (`.list.busy`, per the v3.0.0 lockout mandate), and per the spec's
  edge cases the scrollbar continues to reflect/allow repositioning during
  that dimmed state without implying the (still-blocked) rows are actionable.
  No change to state colours, row indicators, or the lockout mechanism itself.
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry, no network activity; CSS + a small debounce-timer class toggle
  (reusing the existing timer pattern) is the entire mechanism.

**Development Workflow** — No mutating operation is touched, so the
runnable-check-on-mutation rule doesn't apply; this is a visual/interaction
change validated manually per `quickstart.md`, matching how prior UI-only
polish was verified in this project.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/011-custom-table-scrollbar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify + clarify)
└── spec.md
```

No `contracts/` directory: this feature exposes no external interface (no IPC,
no API, no CLI surface) — it is entirely internal renderer DOM/CSS behavior.

### Source Code (repository root)

```text
src/renderer/
├── index.html          # unchanged — #list is already the scrollable container
├── styles.css          # thin ::-webkit-scrollbar styling on .list; idle-hidden/
│                        #   active-visible opacity driven by a `.scrolling` class;
│                        #   fade transition gated behind
│                        #   `@media (prefers-reduced-motion: no-preference)`
│                        #   (mirrors the existing gate at line 1175)
└── renderer.ts          # wire scroll/mouseenter/mouseleave/keydown listeners on
                          #   #list; toggle `.scrolling` with a debounce timer
                          #   (same shape as the existing busyShowTimer pattern)

tests/                   # no new test file — pure DOM/CSS behavior, no new
                          #   parsing/filtering/sorting logic to unit-test;
                          #   verified manually via quickstart.md
```

**Structure Decision**: Single-project Electron layout (already established).
All changes live in `src/renderer/` (`styles.css` + `renderer.ts`); no change
to `view/table.ts` (it doesn't own the `#list` container itself — that's
static markup in `index.html` — so no per-row rendering code is touched), no
change to the main process, IPC surface, or `src/shared/types.ts`.

## Complexity Tracking

*No violations — this section is not needed.*
