<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/015-vector-icon-set/plan.md
<!-- SPECKIT END -->

Active feature: **Explain Why a Repository Wasn't Updated by Pull All**
(`specs/013-pull-warn-reasons/plan.md`) — "Pull all" used to collapse every
non-success outcome into one opaque `failed` (or a bare `skipped`), so a
diverged branch, an unreachable remote, a failed autostash, a timeout, an
unavailable working tree, and a detached HEAD were all visually identical.
Fix: widen `RepoUpdateOutcome` with an optional `reason?: { category;
detail? }` (`shared/types.ts`), capture `execFile`'s stderr on a rejected git
call (`git/probe.ts`'s `runGit`) so obscure errors (e.g. the fsmonitor daemon
noise from the original bug report) become visible, and label each existing
non-success branch in `update.ts` (`diverged` / `fetch-failed` /
`stash-failed` / `timed-out` / `update-failed` catch-all for attempts;
`unavailable` / `detached` for stuck skips — never for a no-tracked-upstream
skip, which is never warned). The renderer generalizes feature 007's
failed-only `⚠`/`FAIL_TOOLTIP` into a reusable, source-agnostic
`.row-warn-ico`, rendered **inline at the end of the branch name** — the
first line of the branch-tracking cell (`.branch` is now a flex row; the
icon is a `flex-shrink:0` sibling of `.branch-text`, same pattern as
`.name`'s `.dirname`/`.frag`, so a long branch name truncates before the
icon ever clips — `glyph-cell` reverts to showing the plain git-state
glyph). Revised twice already, both times from live-testing feedback: first
from an initial slug-line placement to a fixed corner on the branch-tracking
cell's right edge (`position: absolute`) — that pass also fixed a tooltip
bug where the box collapsed to an unreadably narrow, one-word-per-line width
because the icon's own tiny box was the tooltip's CSS containing block, so
shrink-to-fit sizing collapsed toward the widest single word (fixed with an
explicit `width: 320px` instead of `max-width`); then from that fixed corner
to the current inline-after-branch-name placement, which reads more
naturally and lets the tooltip grow **rightward** (the default `[data-tip]`
direction, reverted from a leftward override) into the row's open space.
The tooltip's lead sentence was also reworded to open with "Update blocked —"
(attempted-and-failed categories) or "Update skipped —" (stuck-skip
categories) instead of a bare category fragment, so hovering makes the
attempted-vs-skipped distinction (FR-004) obvious. It's still multi-line
(`white-space: pre-line`, lead sentence + optional git detail) and reuses
feature 012's `.tip-up`/`positionRowIconTooltip` flip (its `mouseover`
selector now also matches `.row-warn-ico`). `warnings: Map<path,
reason>` is renderer-only, in-memory, rebuilt on every "Pull all" run, and
pruned on manual Refresh via the same feature-007 "row now looks clean" rule
(plus per-category checks for `unavailable`/`detached`) — `failedPaths` and
the "Failed" filter chip keep their unchanged `result === 'failed'` meaning
(FR-012); the warn icon is strictly additive. **Renderer + main, no new
IPC/dependency/persisted setting** — "Pull all" behavior itself is unchanged
(FR-010, Principle III: a diverged repo is still left `failed`, never
auto-merged). **Implementation complete through T012** — build and all 103
tests pass (102 prior + a new pure `skipReason` test; the diverged/
fetch-failed cases in `tests/update.test.ts` now assert `reason.category`
directly, satisfying the constitution's mutating-operation runnable-check for
`update.ts`). **T013 (the full `quickstart.md` walkthrough against `pnpm
start`, scenarios A–L) is still owed** — an agent cannot drive real
mouse/hover interaction against the Electron window from this environment.

Prior feature: **Fix Delete Button Tooltip Clipping**
(`specs/012-fix-delete-tooltip/plan.md`) — the delete icon's (and every
configurable per-row action icon's) hover tooltip was clipped at the table's
right edge, and — on whichever row is last **visible** in a scrolled or short
window, not necessarily the table's actual last row — also clipped
vertically with no room to grow downward; a related unstyled
`::-webkit-scrollbar-corner` white-box artifact was also exposed by feature
011's `border-radius` removal. Fix: reuse `.menu`'s existing `left: auto;
right: 0` right-edge tooltip alignment for `.row-delete-ico` too
(`styles.css`); add a `.tip-up[data-tip]:hover::after` rule plus a
`mouseover`-delegated `positionRowIconTooltip()` measurement in
`renderer.ts` (mirrors the existing scrollbar-reveal class-toggle pattern)
that flips the tooltip upward when there's no room below in the *visible*
list — a scroll-position fact a static `:last-child` selector can't express
(a `:last-child`-only attempt was tried first and replaced after manual
testing disproved it). Applies uniformly to the delete icon and every
configurable `.menu` action icon (FR-006, added after user-reported testing
found the same bug there). No `::-webkit-scrollbar-corner` styling is added —
scoped to the specific overflow trigger, per an explicit clarification.
**Renderer-only**: no new dependency, no IPC/main-process change, no
persisted setting. Build and all 102 tests passed; the branch was merged to
`main` (two real implementation gaps — the last-*visible*-vs-last-DOM-row
distinction; extending the fix to custom action icons — were found and fixed
via manual testing before merge). Feature 013 above reused (and had to
update, to stay uniform) both its `.tip-up`/`positionRowIconTooltip`
mechanism and its generalized `⚠` glyph.

Prior feature: **Publish as a Public Open-Source Project on GitHub**
(`specs/010-open-source-release/plan.md`) — rename the public GitHub repo
`git-manager` → `rookery`; add `.github/workflows/test.yml` (push/PR, `pnpm
test`, `ubuntu-latest` only — the suite is platform-agnostic); add
`.github/workflows/release.yml` (tag `v*.*.*` → 3-OS `electron-builder`
matrix build, unsigned/unnotarized, then a `publish` job gated on `needs:
build` so a GitHub Release with all three assets — `rookery-<version>.dmg`,
`rookery-<version>-setup.exe`, `rookery-<version>.AppImage` — is only ever
created if all three platforms succeed, never partially); add root
`LICENSE` (MIT + Commons Clause 1.0 — free use/modification for everyone
including businesses, no selling/monetizing the software itself,
source-available rather than OSI-approved open source); extend the existing
README with badges, a purpose statement, a Download section (with
Gatekeeper/SmartScreen bypass instructions), a License summary, and an
updated "Releasing it" section replacing its stale "no packaged distribution
yet" text. No application source code changes. **Implementation complete
through T009** (`packageManager` pin, `test.yml`, `release.yml`,
`electron-builder.yml`, `LICENSE`, README updates) — build and all 102 tests
pass. **T010 (the full 5-scenario `quickstart.md` walkthrough against the
live `rookery` repo) is still owed** before this is considered fully
validated — it requires pushing a real tag and observing GitHub Actions/a
live Release, which an agent cannot do from this environment. The one
manual, explicitly-confirmed prerequisite outside file changes — creating
the public `rookery` repo on GitHub (under the `wojtekk` account) and
pushing `main` to it — is **done** (research.md §10); `origin` is
`git@github.com-personal:wojtekk/rookery.git` and GitHub Actions should now
run `test.yml` on every push/PR automatically.

Prior features: **Add Auto-Hiding Thin Scrollbar to the Repository Table**
(`specs/011-custom-table-scrollbar/plan.md`) — replaced the OS-default
scrollbar on the table's one scrollable region (`.list`) with a thin,
auto-hiding overlay scrollbar (idle-hidden, revealed on scroll/hover/keyboard
navigation, faded back out ~1s after activity stops); CSS `::-webkit-scrollbar`
styling plus a `.scrolling` class toggle in `renderer.ts`; dropped `.list`'s
`border-radius` (later found to have exposed an unstyled scrollbar-corner
artifact, fixed under feature 012 above). **Block UI During Long Operations**
(`specs/009-block-ui-during-operations/plan.md`, Spec = **Revision
2026-07-19e**) — while one of Refresh, Pull all, or Cleanup runs, the system
blocks essentially every control that operates on repositories or
reconfigures the view: the other two of the three buttons, **Settings, the
Worktrees toggle, every filter chip, the sort-header row, and every row-level
action (delete, custom launch)**. Only the table rows and the sort-header row
visually dim to barely-visible (repository **and** nested worktree rows, plus
the header); every other blocked control (Settings, toggle, filter chips, row
actions, the two non-running buttons) **MUST NOT change colour/opacity** —
only the mouse cursor becomes `not-allowed`. A repository row's
directory-path tooltip is suppressed for the duration. Table rows are also
removed from the tab order (`tabIndex=-1`) on top of the dim. The loader still
shows over the table (150 ms show-delay / 400 ms min-visible, reused
unchanged). Pull all/Cleanup stay disabled when no repositories are discovered
(Refresh stays available), independent of the long-op lock. **Renderer-only**:
no new IPC, no main-process change, no dependency, no persisted setting. Lock
release lives in the existing `finally` blocks in `doRefresh`/`doUpdateAll`/
`doCleanup` so any settlement — success, failure result, or rejection —
clears every lock/dim (FR-013). Still **no whole-viewport dim and no native
`inert`** — every control is blocked individually by its own render logic
(native `<button disabled>` for filter chips/row actions; conditional
`wireActivate` + CSS override for the toolbar's `<div role="button">`
controls; a guarded callback for the sort header). The constitution was
amended a second time, to v3.0.0 (Principle IV re-expanded after v2.0.0's
narrowing proved too narrow). **Implementation is complete through T015**
(T001–T009 = the 2.0.0-scoped per-row/per-button foundation; T010–T015 = the
3.0.0-scoped extension) — build and all 102 tests pass. **T009 and T016
(manual `quickstart.md` click-throughs) are still owed** before merge — an
agent cannot drive real mouse/keyboard/hover interaction against the
Electron window from this environment. **Cleanup Gone Branches and
Worktrees** (`specs/008-branch-cleanup/plan.md`) — a header "Cleanup" button
that removes `[gone]` branches and stale worktrees per repository after a
review overlay, via two IPC methods (`scanCleanup`, `executeCleanup`); `git
worktree remove` without `--force` (with `--force` only for
missing-directory worktrees). **Filter Repositories Needing Attention**
(`specs/007-failed-repos-filter/plan.md`) — a "Failed" state-filter chip
narrowing the list to working trees whose most recent "Pull all" failed.
**Update All Repositories** (`specs/006-update-all-repositories/plan.md`) —
a header "Pull all" button that fast-forwards every eligible
repository/worktree to its tracked upstream, autostashing dirty work and
never auto-merging a diverged repo (left `failed`, light red). **Delete a
Worktree Whose Directory Is Already Missing**
(`specs/005-delete-missing-worktree/plan.md`), **Delete Repository Row**
(`specs/004-delete-repository-row/plan.md`), **Startup Loading Indicator**
(`specs/003-startup-loading-indicator/plan.md`), **Custom Per-Repository
Action Launchers** (`specs/002-custom-action-launchers/plan.md`), and the
foundational **Repo Dashboard** (`specs/001-repo-dashboard/plan.md`).

## Toolchain

Requires **Node.js 24** (pinned in `.nvmrc`). Before running any `pnpm`/`node`
command, switch with `nvm use` (reads `.nvmrc`).
