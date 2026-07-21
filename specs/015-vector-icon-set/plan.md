# Implementation Plan: Upgrade to a Unified Vector Icon Set

**Branch**: `015-vector-icon-set` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-vector-icon-set/spec.md`

## Summary

Replace the app's hand-drawn, mixed fill/outline glyphs with a single uniform
outline vector family (**Tabler Icons, MIT**) so every icon reads at equal
visual weight, and swap the text-character affordances (`×`, `↑`/`↓`, `⌂`) in
the rows and the Settings/Cleanup overlays for real glyphs from that set. The
change is almost entirely data: paste stroke-only Tabler path data into the
existing icon catalog and flip the catalog's `<svg>` wrapper from
`fill="currentColor"` to Tabler's `fill="none" stroke="currentColor"
stroke-width="2"` recipe. The bespoke IntelliJ glyph is kept (Tabler has no
IntelliJ brand mark) but redrawn to survive the new wrapper at the set's weight.
No git behavior, no IPC, no new dependency, no persisted setting — inline SVG
assets only, bundled and offline.

## Technical Context

**Language/Version**: TypeScript (Node.js 24, pinned in `.nvmrc`), Electron renderer.

**Primary Dependencies**: None added. Icons are inline SVG strings compiled into
the renderer bundle (esbuild). Tabler Icons contributes **source SVG path data
only** (copied in), not an npm package — satisfies FR-011 / Principle V.

**Storage**: N/A (no persisted state touched; the icon catalog is compiled-in code).

**Testing**: `pnpm test` (node:test). One new pure unit assertion on the catalog
module (see contracts) — the delete/launch handlers are unchanged, so no
mutating-operation path is modified.

**Target Platform**: Desktop (Electron) on macOS/Windows/Linux; renders fully offline.

**Project Type**: Single-project desktop app (renderer + main). This feature is
renderer-only.

**Performance Goals**: No change — same number of inline SVGs, same 16px render
footprint; no layout reflow (FR-007).

**Constraints**: Offline-only, no network to display icons (FR-008/SC-005); no
new runtime dependency (FR-011); icons stay monochrome via `currentColor`
(FR-003); redistribution license text bundled (FR-009).

**Scale/Scope**: One catalog module rewritten (~11 launcher glyphs + 5 fixed
affordance glyphs), 4 call-site edits (`table.ts`, `settings.ts` ×2 kinds,
`cleanup.ts`), 1 license file, minor CSS for the delete-icon sizing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|-----------|---------|
| **I. System-Native Delegation** | No git interaction touched; icons are presentation only. | ✅ N/A |
| **II. Read-Only by Default / Destructive by Explicit Action** | The delete affordance's *glyph* changes; its handler, confirmation, and behavior are untouched (FR-005, FR-012). No mutating logic added. | ✅ Pass |
| **III. Never Resolve Conflicts** | Not touched. | ✅ N/A |
| **IV. Always-Observable State** | The git-state indicator glyphs, the `↑↓` out-of-sync cue, the `?` unavailable cue, and the update-warning `⚠` (with its yellow colour) are explicitly **out of scope** and unchanged (FR-014). New icons are neutral affordances that inherit text colour and introduce no colour of their own; they follow the existing dim-on-lock behavior. State remains distinguishable without colour. | ✅ Pass |
| **V. Local-Only, Minimal Footprint** | Inline SVG assets, no network to render, **no new runtime dependency** (FR-008/011). Tabler's MIT license text is added to the repo (FR-009). Launch commands unchanged. | ✅ Pass |
| **Dev Workflow (surgical)** | Change limited to glyph data + affordance glyphs + one license file + delete-icon CSS sizing. No adjacent refactors. The table's sort-direction arrow (`table.ts:408`) is **deliberately left as text** — it is neither a launcher, the delete affordance, nor an overlay control, so it is outside the spec's stated scope. | ✅ Pass |

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/015-vector-icon-set/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── icon-catalog.md  # Phase 1 output — catalog module's public contract
├── checklists/
│   └── requirements.md  # (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/renderer/view/icons/
└── catalog.ts           # PRIMARY EDIT: wrapper recipe + all glyph data + 5 fixed-affordance entries + pickable flag

src/renderer/view/
├── table.ts             # EDIT line 228: delete `×` → iconSvg('trash')  (sort arrow line 408 left as-is, out of scope)
├── settings.ts          # EDIT lines 80/88 reorder `↑`/`↓` → chevron-up/down; 235 close `×` → x; 266 remove-dir `×` → trash
└── cleanup.ts           # EDIT line 76 close `×` → x; line 185 worktree `⌂` → git-branch

src/renderer/styles.css  # EDIT: `.row-delete-ico` now holds an <svg> not a text glyph — ensure sizing/centering (see research R5)

THIRD_PARTY_LICENSES     # NEW: Tabler Icons MIT license text + attribution (FR-009)
```

**Structure Decision**: Single-project desktop app; this is a renderer-only,
data-first change. The icon catalog (`src/renderer/view/icons/catalog.ts`) is the
one true source of glyphs and its exported API (`iconSvg`, `iconLabel`,
`ICON_IDS`) is unchanged in shape — only the data behind it and the wrapper
recipe change, plus a new non-pickable tier for fixed affordances.

## Complexity Tracking

> No Constitution Check violations — this section intentionally empty.
