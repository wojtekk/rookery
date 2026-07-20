# Implementation Plan: Fix Delete Button Tooltip Clipping

**Branch**: `012-fix-delete-tooltip` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-fix-delete-tooltip/spec.md`

## Summary

The row delete icon's "Delete" tooltip (`[data-tip]:hover::after` on
`.row-delete-ico`) is left-anchored and grows rightward, but the icon sits at
the table's rightmost column outside the `.menu` wrapper that already has a
right-edge alignment fix (`.menu [data-tip]:hover::after { left: auto; right:
0; }`). The tooltip therefore overflows `.list`'s right edge and gets clipped,
because `.list`'s `overflow-y: auto` also forces horizontal clipping per the
CSS Overflow spec. That same rightward overflow is the most likely trigger for
a horizontal scrollbar appearing on `.list`, which — since `border-radius: 14px`
was removed from `.list` in the just-merged 011 scrollbar feature — now exposes
Chromium's unstyled default `::-webkit-scrollbar-corner` as a stray white box
in the bottom-right corner.

Technical approach: **renderer-only, mostly CSS**. Apply the same
`left: auto; right: 0` tooltip-alignment fix already proven for `.menu`
tooltips to `.row-delete-ico`'s tooltip, scoped narrowly (not by widening the
`.menu` selector, since the delete icon is deliberately outside `.menu`, per
`table.ts:184-185`). This removes the overflow trigger at its source, so no
separate `::-webkit-scrollbar-corner` styling is added (per the 2026-07-20
clarification: fix the specific trigger only, no general corner styling).

Manual verification surfaced a second, related clipping direction: near the
bottom of the *visible* list, the tooltip's downward growth (`top: calc(100% +
8px)`) has no room, so it was invisible — the exact scenario already named in
spec.md's Edge Cases. An initial CSS-only attempt (`.row:last-child`) proved
wrong: the affected row is the last one **visible** in a short window, not
necessarily the DOM's last row, and "is there room below me in the current
viewport" is a runtime fact no static selector can express. The corrected fix
is a small `mouseover`-delegated measurement in `renderer.ts` — in the same
shape as the file's existing scrollbar-reveal class-toggle pattern
(`renderer.ts:98-110`) — that toggles a `.tip-up` class flipping the tooltip
upward when there isn't enough space below (research.md Decision 1a). Once
built this way, the same fix was extended to cover configurable per-row
action icons (`.menu`/`row-action-ico`, feature 002) too, since they share the
identical tooltip mechanism and are equally affected (FR-006). Still no new
dependency, no new IPC, no main-process change, no persisted setting.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled per `tsconfig.renderer.json`; CSS in `src/renderer/styles.css`

**Primary Dependencies**: Electron 40 (renderer process, Chromium engine); no new runtime dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`; the existing
suite is pure-logic (parsing/filtering/sorting) with no DOM/CSS test harness,
and this fix is DOM geometry + CSS positioning — validated manually via
`quickstart.md`, consistent with how the 011 scrollbar feature and other
visual-only changes were verified. Also spot-checked in an isolated Playwright
browser harness against the real markup/CSS during development (not part of
the repo's test suite).

**Target Platform**: Desktop (Electron) on the user's local OS — macOS,
Windows, Linux, rendered by Electron 40's bundled Chromium

**Project Type**: Single-project desktop app (Electron main + renderer); this
fix touches the renderer's CSS and one small event-delegated measurement in
`renderer.ts`

**Performance Goals**: N/A — a `getBoundingClientRect()` read on `mouseover`,
same cost class as the existing scroll/hover listeners already on `#list`

**Constraints**: No new dependency (Principle V); MUST NOT change the delete
button's click/confirmation behavior (FR-005); fix is scoped to the specific
overflow trigger, not general-purpose corner styling (per Clarifications)

**Scale/Scope**: One CSS rule addition/adjustment plus one delegated
`mouseover` listener, affecting the delete icon's and every configurable
`.menu` action icon's tooltip, on both repository rows and nested worktree
rows; no other tooltip (name path, failed-pull glyph) is affected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This is a CSS + small DOM-measurement fix to a hover tooltip's positioning; it
touches none of the constitution's mutation, state-colour, or lockout
mechanics.

- **I. System-Native Delegation** — Unaffected; no git interaction.
- **II. Read-Only by Default, Destructive by Explicit Action** — Unaffected;
  FR-005 explicitly requires the delete button's click/confirmation behavior
  to stay unchanged — only its hover presentation is in scope.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Unaffected: the tooltip's content and
  trigger condition (hover) are unchanged, only its computed position; no
  change to row state colours, indicators, or the long-operation lockout
  (the delete icon's tooltip is already suppressed during lockout, per
  Principle IV — this fix does not touch that behavior).
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry, no network activity; a CSS selector plus a few lines of DOM
  measurement (matching an existing in-file pattern) is the entire mechanism.

**Development Workflow** — No mutating operation is touched, so the
runnable-check-on-mutation rule doesn't apply; this is a visual fix validated
manually per `quickstart.md`, matching how prior UI-only polish (e.g. spec 011)
was verified.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/012-fix-delete-tooltip/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify + clarify)
└── spec.md
```

No `contracts/` directory: this fix exposes no external interface (no IPC, no
API, no CLI surface) — it is entirely internal renderer CSS.

### Source Code (repository root)

```text
src/renderer/
├── styles.css     # add a right-edge tooltip-alignment rule for
                    #   .row-delete-ico[data-tip]:hover::after (same shape as
                    #   the existing .menu [data-tip]:hover::after rule at
                    #   lines 707-711), so its tooltip grows leftward from the
                    #   rightmost column instead of overflowing .list's right
                    #   edge; plus a .tip-up[data-tip]:hover::after rule
                    #   flipping any row-edge icon's tooltip upward when JS
                    #   says there's no room below
└── renderer.ts    # a small mouseover-delegated positionRowIconTooltip() (in
                    #   the same shape as the existing revealScrollbar/
                    #   scheduleScrollbarHide class-toggle pattern) that
                    #   measures space below a .row-delete-ico or
                    #   .row-action-ico inside #list's visible bounds and
                    #   toggles the .tip-up class

tests/              # no new test file — no new parsing/filtering/sorting
                    #   logic to unit-test; verified manually via quickstart.md
```

**Structure Decision**: Single-project Electron layout (already established).
The change is one CSS rule addition/adjustment in `src/renderer/styles.css`
plus one delegated listener and helper function in `src/renderer/renderer.ts`;
no change to `view/table.ts` (the `data-tip` attribute and `row-delete-ico`
class already exist there — only their CSS/JS handling changes), no change to
the main process, IPC surface, or `src/shared/types.ts`.

## Complexity Tracking

*No violations — this section is not needed.*
