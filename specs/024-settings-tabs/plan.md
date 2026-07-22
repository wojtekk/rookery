# Implementation Plan: Tabbed Settings Window

**Branch**: `024-settings-tabs` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-settings-tabs/spec.md`

## Summary

Today's Settings modal (`src/renderer/view/settings.ts`) stacks "Observed
directories" and "Actions" as two always-visible `.settings-section` blocks
inside `.modal-body`. This feature splits them into two selectable tabs —
Directories (default) and Actions — so only one settings group is visible
at a time (FR-001–FR-006), with the tab strip rendered below the "Settings"
header and above the panels (FR-011, clarified 2026-07-21).

**Technical approach**: renderer-only, no new component. Both panels stay
in the DOM simultaneously; a tab click toggles the native `hidden`
attribute on the inactive panel and `aria-selected` on the tab buttons —
it does not re-render, remove, or recreate either panel. This makes the
clarified in-progress-form preservation (FR-012) free: the Actions
add/edit form's typed `<input>` values live in DOM nodes that a tab switch
never touches. `renderActionsSection` gains a return type (the
`HTMLElement` it builds) so its caller can attach `id="tab-actions"`/
`role="tabpanel"`/`aria-labelledby` to it; its internal list/form logic is
untouched. A new module-level `activeTab` variable (alongside the existing
`editingId`/`formIcon` transient state in the same file) is reset to
`'directories'` only in `openSettingsModal()`, so a fresh window open
always lands on Directories (FR-004) while an in-session data-driven
re-render (e.g. after adding a directory) redraws on whichever tab the
user was already viewing. See `research.md` for the three decisions behind
this design and `contracts/settings-tabs.md` for the exact DOM/ARIA shape.

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict); dual build
(`tsconfig.json` for main, `tsconfig.renderer.json` for renderer), Node.js
24 (`.nvmrc`).

**Primary Dependencies**: Electron 40 (renderer process); zero runtime
dependencies added.

**Storage**: N/A — no new persisted setting (FR-010); `activeTab` is
in-memory, renderer-local, reset on every window open.

**Testing**: `node:test` via `pnpm test` (`node --test dist/tests/*.test.js`
after `tsc`). No new pure/branching logic is introduced — showing/hiding a
panel via the native `hidden` attribute and toggling `aria-selected` are
DOM-state changes, not decision logic, matching the existing untested
`selectIcon`/`editingId` pattern already in `settings.ts` and features
017/018's precedent for presentation-only diffs. No new test file.

**Target Platform**: Electron desktop application on the user's local OS.

**Project Type**: Desktop app (Electron) — `src/main`, `src/preload`,
`src/renderer`, `src/shared`. This feature touches only
`src/renderer/view/settings.ts` and `src/renderer/styles.css`.

**Performance Goals**: N/A — no data processing changes; same DOM nodes
per render, just conditionally hidden.

**Constraints**: Renderer-only; no new IPC/dependency/persisted setting
(FR-010); MUST NOT change directory/action add/edit/remove/reorder
behavior, persistence, or re-scan triggers (FR-002, FR-003, SC-004); header
row keeps only title + close (FR-011); FR-012's in-progress-form
preservation applies only across tab switches within one open session, not
across a close/reopen.

**Scale/Scope**: One file gains a tab strip + two panel-attribute wrappers
and one new module variable (`settings.ts`); one file gains tab-strip/
tab-button CSS (`styles.css`). No test file, no other source file.

## Constitution Check

*GATE: evaluated against constitution v4.0.0.*

| Principle | Assessment |
|-----------|------------|
| **I. System-Native Delegation** | ✅ N/A — no git invocation; pure presentation reorganisation of an existing modal. |
| **II. Read-Only by Default** | ✅ No new mutation; directory/action add/edit/remove/reorder keep their exact existing IPC calls (`onAdd`, `onRemove`, `onSetActions`, …), just reachable from inside a tab instead of a stacked section. |
| **III. Never Resolve Conflicts** | ✅ N/A — no pull/push/merge behavior touched. |
| **IV. Always-Observable State** | ✅ N/A to repo-row state (this modal has none); the long-operation lockout that already disables Settings entirely while Refresh/Pull all/Cleanup runs (feature 009) is unaffected — Settings still cannot be opened mid-operation, so no new interaction between tabs and the lockout exists. |
| **V. Local-Only, Minimal Footprint** | ✅ No new dependency; no telemetry/network; no new persisted setting (FR-010). |

**Development Workflow**: Not a mutating operation and introduces no new
branching/pure logic (toggling the `hidden` attribute and `aria-selected`
based on which button was clicked is DOM-state assignment, not a decision
point requiring a runnable check) — matching features 017/018's precedent
for presentation-only diffs. Manual verification via `quickstart.md`
scenarios A–G, run against the real Settings window (`pnpm start`),
covering every existing control inside its new tab (Development Workflow's
"change touching adjacent controls must be manually exercised" spirit,
applied here since no repository-mutating operation itself changed).

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/024-settings-tabs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── settings-tabs.md # Phase 1 output — tab strip/panel DOM+ARIA contract
├── checklists/
│   └── requirements.md  # From /speckit-specify (all items passing)
└── spec.md
```

### Source Code (repository root)

```text
src/renderer/
├── view/settings.ts   # + tab-strip markup/wiring in renderSettingsModal;
│                       #   + activeTab module var (reset in openSettingsModal);
│                       #   renderActionsSection now returns the HTMLElement it builds
│                       #   so the caller can tag it id="tab-actions"/role="tabpanel"
└── styles.css          # + .tab-strip / .tab-btn / .tab-btn.active rules
```

**Structure Decision**: Single-project Electron layout (already
established); no new files. The tab strip and its wiring live entirely in
`settings.ts` because that file already owns the modal's full DOM
construction and its transient UI state (`editingId`, `formIcon`) — adding
`activeTab` alongside them keeps all Settings-modal view state in one
place, consistent with the file's existing convention, rather than
introducing a new state-holding module for two booleans' worth of state.

## Complexity Tracking

*No violations — this section is not needed.*
