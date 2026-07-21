# Implementation Plan: Explain Why a Repository Wasn't Updated by Pull All

**Branch**: `013-pull-warn-reasons` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-pull-warn-reasons/spec.md`

## Summary

"Pull all" already reports four flat outcomes (`updated` / `already-current` /
`skipped` / `failed`) and the renderer already surfaces `failed` as a
faint-red row tint plus a `⚠` glyph in the leftmost `glyph-cell` with a
**static** tooltip (`FAIL_TOOLTIP = 'pull failed — open in your merge tool'`,
`table.ts:38`). What is missing is the *reason*: every failure collapses into
one opaque `failed`, and the stuck-skip cases (unavailable / detached HEAD)
carry no per-row signal at all.

Technical approach: **enrich the existing warning affordance instead of adding
a parallel one.** (1) Widen the per-repo update result carried across the
`updateAll` IPC boundary from a bare string to `{ result, reason? }`, where
`reason` = a category + optional underlying git error text, populated for the
warned set (failed attempts + unavailable + detached — never no-upstream).
(2) Capture git's stderr on failure so obscure environmental causes (e.g. the
fsmonitor daemon error from the investigation) become visible. (3) Generalize
the renderer's `failedPaths`-driven `⚠` into a **reusable, source-agnostic
row-warning icon** rendered next to the slug (per the 2026-07-21 clarification),
carrying the real reason via the existing `[data-tip]` tooltip mechanism, and
reuse feature 012's `positionRowIconTooltip`/`.tip-up` flip so a multi-line git
message is never clipped. Feature 007's red tint and "Failed" filter chip keep
their current `result === 'failed'` meaning (FR-012); the warn icon is the
broader affordance layered on top.

This spans main (`update.ts`, one line in `git/probe.ts`), the shared type, and
the renderer (`renderer.ts`, `table.ts`, `styles.css`) — but adds **no new IPC
method, no dependency, and no persisted state** (warnings are in-memory, cleared
on restart — FR-011).

## Technical Context

**Language/Version**: TypeScript ~5.5 (strict), compiled per `tsconfig.*.json` (main + renderer)

**Primary Dependencies**: Electron 40 (main + renderer/Chromium); system `git` via `execFile` (Principle I); no new runtime dependency

**Storage**: N/A — warnings are session-only, held in memory in the renderer (FR-011); no new persisted setting

**Testing**: `node --test` over compiled `dist/tests/*.test.js`. New pure/near-pure logic (reason categorization in `update.ts`; skip-reason derivation; the "reason ⇒ warned" mapping) is unit-tested by extending `tests/update.test.ts` (which already drives real temp git repos) and, where pure, a small addition alongside `tests/filter.test.ts` conventions. The icon rendering + tooltip geometry are validated manually via `quickstart.md`, as with features 011/012.

**Target Platform**: Desktop (Electron 40) on the user's local OS — macOS, Windows, Linux

**Project Type**: Single-project Electron app (main process + preload + renderer)

**Performance Goals**: N/A — reason capture is a string carried on results already produced; the warn icon adds one delegated `mouseover` measurement in the same class as the existing tooltip/scrollbar listeners

**Constraints**: No network on hover/display (FR-009, Principle V); "Pull all" behavior itself MUST NOT change (FR-010, Principle III — a diverged repo is still left `failed`, never auto-merged); colour MUST NOT be the sole signal (FR-013, Principle IV); no new dependency (Principle V)

**Scale/Scope**: One shared type extension, reason capture at ~5 control-flow points in `update.ts`, a one-line stderr capture in `git/probe.ts`, and a renderer change that relocates/generalizes one existing glyph into a reusable icon + tooltip CSS. Affects repository rows and nested worktree rows uniformly.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. System-Native Delegation** — Preserved. Still shells out to system `git`; the only change is *reading* the stderr git already produced on a failed invocation (no new git behavior, no credential handling, no plumbing reimplementation).
- **II. Read-Only by Default, Destructive by Explicit Action** — Preserved. No new mutation; "Pull all" runs exactly as before (FR-010). Reason capture and rendering are read-only and additive.
- **III. Never Resolve Conflicts — Fail Loud, Hand Off** — Reinforced. A diverged repo is still stopped and left `failed`; this feature makes the "fail loud" *louder and clearer* (names the reason) without ever attempting resolution.
- **IV. Always-Observable State** — Reinforced, with care. This increases honest observability. Two obligations honored: (a) the warn icon is a non-colour cue with an accessible name (FR-013), so state is not colour-only even as it consolidates the failed `⚠`; (b) during a long operation the rows dim and tooltips are suppressed (feature 009) — warnings reflect only a *completed* run, so nothing new appears mid-operation. The mandated per-row state glyph and the failed row's light-red tint are retained.
- **V. Local-Only, Minimal Footprint** — Preserved. No new dependency (reuses the `⚠` character, the `[data-tip]` CSS, and the existing tooltip-positioning helper), no telemetry, and no network on hover/display (FR-009).

**Development Workflow** — `update.ts` is a mutating operation (pull), so per the workflow rule it MUST retain a runnable check that fails if the safety/behavior breaks: `tests/update.test.ts` is extended to assert both the unchanged outcomes AND the newly captured reasons, including at least one real failure path (a diverged repo → `reason.category === 'diverged'`).

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/013-pull-warn-reasons/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── update-outcome.md  # Phase 1 output — the extended updateAll IPC result shape
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify + clarify)
└── spec.md
```

A `contracts/` entry **is** warranted here (unlike 012): the `updateAll` IPC
result shape changes (its element type gains an optional `reason`).

### Source Code (repository root)

```text
src/shared/
└── types.ts        # add UpdateReason (category + optional detail) and widen
                    #   RepoUpdateOutcome to { path, result, reason? }

src/main/
├── update.ts       # capture a reason at each non-success control-flow point
                    #   (diverged / fetch-failed / stash-failed / timed-out /
                    #   update-failed) in updateRepo/classifyAndMerge; and in
                    #   updateAll, tag skipped trees that are stuck
                    #   (unavailable / detached) with a reason — no reason for
                    #   no-upstream skips (never warned)
└── git/probe.ts    # runGit: attach git's captured stderr to the rejected
                    #   Error (one-line change) so update.ts can surface it as
                    #   reason.detail (FR-003)

src/renderer/
├── renderer.ts     # derive a `warnings: Map<path, UpdateReason>` from the
                    #   updateAll outcomes (reason-present == warned); keep
                    #   failedPaths for the tint + "Failed" filter (FR-012);
                    #   extend pruneFixedFailedPaths to also drop a warning
                    #   once its cause is locally resolved (FR-008); extend the
                    #   delegated mouseover to position the new warn icon's tip
├── view/table.ts   # render a reusable `.row-warn-ico` next to the slug when a
                    #   row has a warning; generalize the failed-only `⚠`/
                    #   FAIL_TOOLTIP into this icon; keep the `.fail` row tint
└── styles.css      # slug line becomes a flex row so .row-warn-ico is a
                    #   flex-shrink:0 sibling (slug text truncates first, icon
                    #   never clipped on long slugs — same pattern as .name
                    #   .dirname/.frag) + a multi-line-capable warn tooltip
                    #   variant (category line + git detail), reusing .tip-up

tests/
└── update.test.ts  # extend: assert reason categories on failure/skip paths
                    #   (+ a tiny pure test for the skip-reason derivation)
```

**Structure Decision**: Established single-project Electron layout. The change
threads one optional field from `update.ts` through the existing `updateAll`
IPC (no new channel — `main.ts:200` already returns the outcomes; structured
clone carries the new field) into a renderer affordance that **generalizes an
existing one** rather than adding a second warning system.

## Complexity Tracking

*No violations — this section is not needed.*
