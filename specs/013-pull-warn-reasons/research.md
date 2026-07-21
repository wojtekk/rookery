# Research: Explain Why a Repository Wasn't Updated by Pull All

Phase 0 decisions. There were no open `NEEDS CLARIFICATION` markers (the three
clarification sessions resolved detail level, warned-set scope, persistence,
and placement/reusability); this document records the technical decisions that
turn those answers into an implementable design, grounded in the current code.

## Investigation recap (root cause)

The three reported repos (`tf-auth0-pro`, `mb-pro-customer-frontend-api`,
`identity-web-bff`) were each exactly 1 commit behind `origin/main` and emitted
`fsmonitor_ipc__send_query: unspecified error on '.git/fsmonitor--daemon.ipc'`.
Verified directly:

- That error goes to **stderr**; `git status` / `merge --ff-only` still exit `0`
  (checked at the shell). So it is a *symptom*, not the direct blocker; the
  daemon has since self-healed and all three now read `0 0`.
- The real gap is a **product gap**: `UpdateResult` (`shared/types.ts:89`) is a
  flat 4-value enum. `updateRepo` collapses diverged / fetch-failed /
  stash-failed / timed-out / merge-failed into one `'failed'` (`update.ts:113–148`),
  and `updateAll` emits `'skipped'` for every ineligible tree with no sub-reason
  (`update.ts:198–201`). No reason is captured, so none can be shown.

Conclusion: the fix is to *capture and surface the reason*, not to chase the
fsmonitor daemon (an environmental git-state issue, explicitly out of scope).

## Decision 1 — Where reasons are produced (main side)

**Decision**: Have the internal update helpers return `{ result, reason? }`
instead of a bare `UpdateResult`, and map each existing failure branch to a
category:

| Control-flow point (`update.ts`) | Category |
|----------------------------------|----------|
| `updateRepo` deadline fires (`:138`) | `timed-out` |
| `updateRepoInner` stash push fails (`:119`) / `restoreStash` fails (`:131`) | `stash-failed` |
| `classifyAndMerge` fetch throws (`:102`) | `fetch-failed` |
| neither ref is an ancestor → diverged (`:107`) | `diverged` |
| `merge --ff-only` or a rev-parse throws (`:109`, `:104`) | `update-failed` (catch-all, carries detail) |

For **skips** (in `updateAll`, where eligibility is computed at `:178`), derive
the sub-reason from the entry itself — no new git calls:
`availability !== 'ok'` → `unavailable`; `head.detached` → `detached`;
otherwise (no tracked upstream / local-only) → **skipped with no reason**
(never warned, FR-005).

**Rationale**: Categories map 1:1 onto branches that already exist — this is
labeling, not new logic, so FR-010 (no behavior change) holds by construction.
The catch-all `update-failed` guarantees any unexpected git error still yields a
reason with detail rather than an empty warning.

**Alternatives rejected**: (a) A separate diagnostic git call per skipped repo —
violates "no new probes" (spec assumption) and Principle II's read-only economy.
(b) Parsing stderr to auto-classify sub-types of fetch failure (auth vs offline)
— unnecessary; the raw detail (Decision 3) already shows it.

## Decision 2 — Reason carried over IPC, warned == reason-present

**Decision**: Widen `RepoUpdateOutcome` to `{ path, result, reason? }` and treat
**`reason` presence as the definition of "warned"**. `updateAll` attaches a
reason only for the warned set (failed attempts + unavailable + detached);
`updated` / `already-current` / no-upstream-skip carry none.

**Rationale**: No new IPC channel is needed — `main.ts:200` already returns the
outcome array and Electron's structured clone carries the extra field
transparently. Making "warned ⇔ reason present" collapses the warned-set
predicate into a trivial, testable `o.reason !== undefined`, keeping the
renderer logic and its tests tiny.

**Alternatives rejected**: A new `getWarnings()` IPC method — redundant; the
data already rides on the outcomes the renderer receives.

## Decision 3 — Capturing git's underlying error text (FR-003)

**Decision**: In `runGit` (`git/probe.ts:19–35`), capture `execFile`'s third
callback argument (`stderr`) and attach it to the rejected `Error`
(`(err as ...).stderr = stderr`) before `reject(err)`. `update.ts` reads
`err.stderr` (falling back to `err.message`) to populate `reason.detail`,
trimmed and length-capped.

**Rationale**: One line, no signature change, no new dependency. `runGit` is
shared (probe + delete + update); attaching stderr to the error is inert for
every existing caller (they ignore it) and available to the one that needs it.
This is what makes the fsmonitor message — and any future obscure git error —
visible (SC-003).

**Alternatives rejected**: A second `runGitCapturingStderr` variant — needless
duplication of a 15-line function.

## Decision 4 — One warning surface, reusable, next to the slug (FR-014/FR-015)

**Decision**: Generalize the existing failed-only `⚠` (`table.ts:220–224`,
`FAIL_TOOLTIP`) into a **reusable `.row-warn-ico`** rendered inside the
`name-cell` adjacent to the slug. It is driven by an optional per-row
`warning?: UpdateReason` (source-agnostic), not by anything Pull-all-specific.
The leftmost `glyph-cell` reverts to showing the pure git-state glyph; the
warn icon becomes the single home for the pull-outcome reason across the whole
warned set. The `.fail` light-red row tint and the "Failed" filter stay keyed
on `result === 'failed'` (FR-012), so a stuck-skip shows the icon without the
tint/filter.

**Long-slug handling (must-not-clip)**: `.slug` is currently a single element
with `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
(`styles.css:503`), so an icon placed *inside* it would be truncated away on a
long org/slug. The icon MUST instead be a **non-shrinking sibling** of the slug
text: make the slug line a flex row of `[slug text: min-width:0; ellipsis]` +
`[.row-warn-ico: flex-shrink:0]`, reusing the exact pattern the name line
already uses (`.name .dirname` truncates, `.name .frag` is `flex-shrink:0` —
`table.ts:228–239`). Result: the slug text loses characters to the ellipsis
first; the `⚠` is always visible (FR-007 for the icon itself, not just its
tooltip).

**Rationale**: The user asked for the icon "nested to slug, below the existing
indicator" and for it to be reusable ("refresh might show warnings too"). One
reason-bearing icon avoids a row ever showing two competing `⚠` marks
(ponytail: reuse, don't duplicate) and gives a future producer (e.g.
Refresh-detected conditions, out of scope now) a ready seam — it only has to
populate the same per-row `warning`. Principle IV is preserved: the failed row
keeps its light-red tint (colour) *and* now a reason-bearing icon with an
accessible name (non-colour cue, FR-013).

**Alternatives rejected**: (a) Keep the `glyph-cell` `⚠` and add a *second*
icon by the slug — duplicate signal, rejected. (b) Attach the reason to the
existing glyph tooltip in place — rejected in clarify: a clean detached-HEAD
tree renders green in `glyph-cell` and would carry no warning at all.

**Revised 2026-07-21 (post-implementation, live-testing feedback, twice)**:
first moved from the slug column to a fixed position on the branch-tracking
column's right edge (`position: absolute` within `.branch-cell`); then moved
again, from that fixed corner to **inline at the end of the branch name**
(the cell's first line) — a `flex-shrink:0` sibling of `.branch-text`, same
pattern as `.name`'s `.dirname`/`.frag`. Reads more naturally as "this
branch has a warning" than a corner badge, and lets the tooltip grow
rightward into open row space (Decision 5) instead of needing to grow
leftward back over the branch text. Both revisions are UI placement only;
the icon remains the single reusable, source-agnostic affordance the reason
above argues for.

## Decision 5 — Tooltip: multi-line, unclipped, left-column origin (FR-006/FR-007)

**Decision**: Reuse the `[data-tip]:hover::after` mechanism with a warn-specific
rule: `white-space: pre-line` + a `max-width` so the category line and the
(often multi-line) git detail wrap and read cleanly; encode the tooltip text as
`"<category sentence>\n\n<git detail>"`. Reuse feature 012's
`positionRowIconTooltip` + `.tip-up` flip (`renderer.ts:113–121`, delegated
`mouseover` at `:357`) by extending its selector to `.row-warn-ico`.

**Rationale**: The warn icon sits on the **left** (slug column), so the delete
icon's right-edge alignment (`right: 0`) does not apply — default leftward-from-
`left:0` growth is correct; the only clipping risk is the bottom edge, which the
existing `.tip-up` flip already handles. Multi-line is the one genuinely new CSS
need (the delete/action tips are `white-space: nowrap`, single-line).

**Alternatives rejected**: A bespoke popover/tooltip component — over-built; the
`::after` tip already exists, is offline, and is consistent with every other row
tooltip.

**Revised 2026-07-21 (post-implementation, live-testing feedback, twice)**:
the initial `max-width: 320px` (no explicit `width`) rendered unreadably
narrow — `.row-warn-ico`'s own tiny glyph box is the `::after` tooltip's
positioning containing block, so the browser's shrink-to-fit width
calculation collapsed toward the widest single unbreakable word (a
`max-width` only caps sizing, it doesn't set it). Fix: an explicit `width:
320px` instead of `max-width`. Direction was revised twice alongside the
icon's position (Decision 4): first to grow leftward while the icon sat at
the branch-tracking column's fixed right-edge corner; then back to the
default **rightward** growth once the icon moved inline after the branch
name, since it now has open row space to its right and growing rightward
reads more naturally than reaching back over the branch text.

## Decision 6 — Clearing warnings (FR-008/FR-011)

**Decision**: Hold warnings in a renderer `warnings: Map<path, UpdateReason>`
alongside the existing `failedPaths` set; both are (re)built from each
`updateAll` run and are in-memory only (cleared on restart — FR-011). Extend
`pruneFixedFailedPaths` (`renderer.ts:129`) to also drop a warning whose cause
is locally resolved on a manual Refresh: `unavailable` clears when
`availability === 'ok'`, `detached` clears when the head is no longer detached,
and attempt-failures clear under feature 007's existing "row now looks clean"
rule.

**Rationale**: Mirrors the shipped in-memory failed-state model exactly, so the
behavior is consistent and needs no persistence. The known limitation (a purely
environmental failure on an otherwise-clean tree is also cleared by Refresh, and
only a re-run of Pull all reconfirms) is inherited from — and identical to —
feature 007's documented behavior.

## Decision 7 — Testing strategy

**Decision**: Extend `tests/update.test.ts` (drives real temp git repos) to
assert reason categories on the diverged and fetch-failed paths and that
success paths carry no reason; add a small pure test for the skip-reason
derivation (unavailable / detached → reason; no-upstream → none). Icon
placement and tooltip geometry are validated manually via `quickstart.md`
(no DOM/CSS harness in the repo, consistent with 011/012).

**Rationale**: Satisfies the constitution's mutating-operation runnable-check
rule for `update.ts` while keeping to the repo's established "pure logic is
unit-tested, visuals are manual" split.
