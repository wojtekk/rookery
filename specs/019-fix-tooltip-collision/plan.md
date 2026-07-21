# Implementation Plan: Fix Duplicate-Indicator Tooltip Collision

**Branch**: `019-fix-tooltip-collision` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-fix-tooltip-collision/spec.md`

## Summary

Hovering a row's duplicate-clone icon (`.row-dup-ico`, added in feature 017)
today shows two tooltips stacked on top of each other: the icon's own
"also cloned elsewhere" notice, and the row's directory-path tooltip
(`.name[data-tip]`). The cause is structural, not a styling bug: `buildRow`
(`view/table.ts:320`) appends `.row-dup-ico` as a *child* of `.name`
(`view/table.ts:311` sets `.name`'s own `data-tip`), and CSS `:hover` matches
an ancestor whenever any descendant is hovered — so hovering the icon
satisfies both `.name[data-tip]:hover` and `.row-dup-ico[data-tip]:hover` at
once, and each gets its own `::after` tooltip box (`styles.css:839-854`).

Technical approach: **CSS-only, one rule**. Use `:has()` (supported since
Chromium 105; Electron 40 ships Chromium ~132) so `.name` can detect that its
own `.row-dup-ico` child is being hovered and hide its own tooltip exactly
then, letting the icon's tooltip win — matching the user-confirmed priority
("duplication takes priority") and the codebase's own established pattern
for suppressing this exact tooltip in another circumstance
(`styles.css:868-872` already suppresses `.name`'s tooltip during the
long-operation lockout the same way, via `display: none` on its `::after`).
No DOM change, no JS change, no new dependency.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict); CSS in `src/renderer/styles.css`

**Primary Dependencies**: Electron 40 (renderer process, Chromium ~132+); no new runtime dependency

**Storage**: N/A — no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`; the suite is
pure-logic (parsing/filtering/sorting) with no DOM/CSS harness. This fix adds
no branching logic — a single declarative CSS selector — so it is validated
manually via `quickstart.md`, consistent with features 011/012/015.

**Target Platform**: Desktop (Electron) on the user's local OS — macOS,
Windows, Linux, rendered by Electron 40's bundled Chromium

**Project Type**: Single-project desktop app (Electron main + renderer); this
fix touches only `src/renderer/styles.css`

**Performance Goals**: N/A — a declarative `:has()` selector, evaluated by
the browser's existing style engine exactly as any other hover rule

**Constraints**: No new dependency (Principle V); MUST NOT change either
tooltip's wording, content, or growth direction (FR-004); MUST NOT alter any
other row icon's tooltip behavior (FR-005)

**Scale/Scope**: One CSS rule addition, affecting only rows that render the
duplicate-clone icon (`entry.collisionFragment` set); every other row and
every other row icon's tooltip is untouched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This is a single declarative CSS rule governing which of two existing hover
tooltips is visible; it touches none of the constitution's mutation,
state-colour, or lockout mechanics.

- **I. System-Native Delegation** — Unaffected; no git interaction.
- **II. Read-Only by Default, Destructive by Explicit Action** — Unaffected;
  no mutating operation is touched, and the duplicate icon's click behavior
  (`onFindDuplicate`) is unchanged — only its hover presentation relative to
  `.name`'s tooltip is in scope.
- **III. Never Resolve Conflicts** — Unaffected.
- **IV. Always-Observable State** — Unaffected: neither tooltip's content nor
  the row's state colour/indicator changes. The existing long-operation
  suppression of `.name`'s tooltip (`styles.css:868-872`, Principle IV's
  FR-017 requirement) is untouched and remains compatible — the duplicate
  icon is already `disabled` during lockout (`table.ts:257`), and a disabled
  element does not match `:hover`, so the new rule and the lockout rule never
  compete for the same hover.
- **V. Local-Only, Minimal Footprint** — Preserved: no new dependency, no
  telemetry, no network activity; a single CSS selector is the entire
  mechanism.

**Development Workflow** — No mutating operation is touched, so the
runnable-check-on-mutation rule doesn't apply; this is a visual fix validated
manually per `quickstart.md`, matching how prior CSS-only fixes (011, 012,
015) were verified.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/019-fix-tooltip-collision/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── spec.md
```

No `contracts/` directory: this fix exposes no external interface (no IPC,
no API, no CLI surface) — it is entirely internal renderer CSS.

### Source Code (repository root)

```text
src/renderer/
└── styles.css     # add a .name:has(.row-dup-ico:hover)::after { display:
                    #   none; } rule immediately after the existing
                    #   .list.busy .name[data-tip]:hover::after suppression
                    #   rule (styles.css:868-872), which already establishes
                    #   the identical "hide .name's tooltip via display:none"
                    #   pattern for a different trigger condition

tests/              # no new test file — no new parsing/filtering/sorting
                    #   logic to unit-test; verified manually via quickstart.md
```

**Structure Decision**: Single-project Electron layout (already established).
The change is one CSS rule addition in `src/renderer/styles.css`; no change
to `view/table.ts` (the DOM structure and both `data-tip` attributes already
exist there and stay exactly as they are), no change to `renderer.ts`, the
main process, IPC surface, or `src/shared/types.ts`.

## Complexity Tracking

*No violations — this section is not needed.*
