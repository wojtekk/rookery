<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/026-local-only-filter/plan.md
<!-- SPECKIT END -->

Active feature: **Local-Only Branch Filter**
(`specs/026-local-only-filter/plan.md`) — adds an eighth filter chip, "local-only", alongside the
existing All/Clean/Uncommitted/Out of sync/Unavailable/Failed/Gone chips, narrowing the table to
working trees whose current branch has no upstream configured at all — a state the app already
detects and tags (the branch cell's `local-only` tag) but until now had no matching filter.
Mirrors the existing "gone" filter one-for-one in `src/renderer/view/filter.ts`: a new
`isLocalOnly` predicate (same guard shape as `isGone`) and a `'local-only'` sibling on
`StateFilter` — never a `RowState` member, for the same reason "gone" isn't (it already has its
own non-colour branch tag, so folding it into the 5-colour edge palette would be redundant).
`view/summary.ts` gets a `countLocalOnly` counting-worktrees-too helper (mirrors `countGone`) and
one more `makeChip(...)` call appended after "gone". **Renderer-only**: no new IPC, main-process
change, dependency, persisted setting, or HTML/CSS change — the chip is generated entirely into
the existing `#filters` container and needs no swatch, exactly like "gone". The one clarification
resolved during `/speckit-clarify` was the chip's exact label: `local-only`, matching the existing
branch-tag text verbatim rather than the spaced "local only" phrasing of the original request.
**Implementation complete through T005** — build and all 158 tests pass (155 prior + 3 new in
`tests/filter.test.ts` mirroring the existing `isGone`/`'gone'`-filter coverage: the predicate's
true/false cases, plain `filterRows` matching, and the hidden-worktree-surfaces-its-family case).
**T006 (the full `quickstart.md` walkthrough against `pnpm start`, scenarios A–J) is still
owed** — an agent cannot drive real mouse/click interaction against the Electron window from this
environment.

Prior feature: **Rebase Worktrees onto the Default Branch**
(`specs/025-rebase-worktrees/plan.md`) — adds a header **Rebase worktrees** action that replays
every linked worktree's branch onto its family's freshly-fetched `origin/<default>`, closing two
gaps "Pull all" leaves: local-only feature-branch worktrees are silently skipped (no tracked
upstream), and tracked worktrees only ever follow their own upstream, never `main`. Reuses
feature 014's proven non-destructive rebase spine (autostash → `git rebase origin/<default>` →
restore; abort + restore-to-exact-prior-state on the first conflict, never resolving it) inside
`src/main/update.ts`'s new `rebaseWorktrees(rows)`, alongside three exported pure helpers
(`resolveDefaultBranchName`, `rebaseCandidates`, `worktreeSkipReason`) for the eligibility/
classification logic that needs no git call. Per family: resolve the default branch (primary's
own checked-out branch, else `origin/HEAD`, else the family is unresolvable → every worktree
`failed`/`default-branch-unknown`), one `fetch origin <default>` (failure → every worktree
`failed`/`fetch-failed`), then each linked worktree in sequence (shared `refs/stash` forbids
concurrent autostash) — `skipped`/`unavailable`, `skipped`/`detached`, `skipped` with no reason
when already on the default branch, `already-current` when `origin/<default>` is already an
ancestor of its HEAD, else autostash → rebase → restore. Orphan worktrees (no known primary) are
`skipped`/`orphan-worktree` with zero git calls. Two new `UpdateReasonCategory` values
(`default-branch-unknown`, `orphan-worktree`) get their own `REASON_SENTENCE` entries in
`table.ts`; `rebaseReminderSuppressed` is a new persisted `Settings` boolean. A native
`dialog.showMessageBox` confirmation (with a "do not remind me again" checkbox) warns that
rebasing rewrites history before the first fetch/rebase of a run — cancelling is a total no-op;
ticking the checkbox persists via a new `setRebaseReminderSuppressed` IPC call before proceeding.
The reminder is re-enableable from a new **"Other"** tab in the Settings modal (widening feature
024's Directories/Actions tab strip to three), reusing the Cleanup overlay's `.cleanup-row`/
`.cleanup-checkbox`/`.cleanup-label` CSS classes verbatim for the toggle row — no new CSS needed
for it. "Rebase worktrees" is a fourth long operation folded into the existing UI-lockout
(mutually exclusive with Refresh/Pull all/Cleanup; disabled when no repository has a linked
worktree, FR-021) and reuses feature 013's `failedPaths`/`warnings` surface, rebuilt fresh per
run exactly like "Pull all" does. This required amending the constitution to **v4.1.0**:
Principle III's non-interactive-rebase latitude is generalised from naming only "Pull-all" to
any deliberate update action rebasing onto its own resolved target (Pull-all's tracked upstream,
or this feature's fetched default branch) — no guarantee removed, every abort/restore/
never-auto-merge rule carried over unchanged; Principle IV's long-operation enumeration gains
"Rebase worktrees" as a fourth member. **Main + renderer, one new persisted setting, three new
IPC methods** (`rebaseWorktrees`, `confirmRebaseWorktrees`, `setRebaseReminderSuppressed`) — no
new runtime dependency. **Implementation complete through T018 and T020** — build and all 146
tests pass (125 prior + 21 new in `tests/rebase-worktrees.test.ts`: 9 pure eligibility/
default-branch/reason-classification tests mirroring `update-eligibility.test.ts`, and 12
real-git-fixture tests covering every outcome path — local-only rebase, tracked-onto-default
rebase, already-current, the on-default no-git-call skip, dirty autostash restore, conflict
abort-and-restore, stash-pop collision, fetch failure, unresolvable default, orphan skip, and
the primary-untouched / no-work-lost invariants across a mixed multi-worktree run). **T019 (the
full `quickstart.md` walkthrough against `pnpm start`, scenarios A–N, including a real conflict
path and a fetch-failure path) is still owed** — an agent cannot drive real mouse/click/dialog
interaction against the Electron window from this environment.

Prior feature: **Relocate Search Icon Above the Table**
(`specs/018-relocate-search-header/plan.md`) — moves the header search control
(icon, expand-to-input, clear button — all from feature 016) out of the top
title bar's `#search` slot and into `.fleet-head`, the row directly above the
table, as its leftmost child, replacing the `<span id="fleetTitle">` node
that displayed "Fleet — N repositories" (a count the footer's "Showing X of
Y" text already carries). `index.html`'s `.fleet-head` now holds `#search`
before `#filters`; `renderer.ts` drops its now-dangling `fleetTitle` element
lookup and the `title` field it passed into `renderSummary`; `summary.ts`'s
`SummaryElements` interface drops `title` entirely along with the
`els.title.textContent` assignment, since there's no title element left to
write to. `styles.css` gains `flex-wrap: wrap` plus an 8px `row-gap` on
`.fleet-head` so the filter chips wrap to a second line when they and an
expanded search box don't both fit on one line (2026-07-21 clarification),
and drops the now-orphaned `.fleet-title` rule; the top `.bar`'s existing
`.bar-spacer { flex: 1 }` absorbs the freed space for free, needing no edit.
`view/search.ts`'s `renderSearch` and the feature-009 long-operation lockout
are untouched — only the DOM position of the container they mount into
changes. **Renderer-only**: no new IPC, main-process change, dependency, or
persisted setting — the diff touches only `index.html`, `renderer.ts`,
`view/summary.ts`, and `styles.css`. No new pure/branching logic was
introduced (moving a DOM node and deleting a `textContent` assignment are not
decision points, matching feature 017's precedent), so no new test file was
required per the plan's Constitution Check — **implementation complete
through T007 and T009**; build and all 122 tests pass unchanged. **T008 (the
full `quickstart.md` walkthrough against `pnpm start`, scenarios A–M plus
A2/B2) is still owed** — an agent cannot drive real mouse/hover/click/
window-resize interaction against the Electron window from this environment.

Prior feature: **Duplicate-Clone Indicator**
(`specs/017-duplicate-clone-indicator/plan.md`) — replaces today's unexplained
"…/parent-folder" `.frag` text (shown when two rows are clones of the same
remote sharing a directory name, per the existing `collisionFragment` gate in
`scan.ts`'s `assignCollisionFragments`) with a dedicated, clickable duplicate
indicator: a `<button class="row-dup-ico">` rendered next to `.frag` in
`buildRow` (`view/table.ts`) whenever `entry.collisionFragment` is set, using
a new Tabler-outline "layers-intersect" glyph (two overlapping rectangles)
added to the icon catalog (`view/icons/catalog.ts`) — chosen from 8 candidates
presented to the user in a throwaway HTML comparison page. Hovering it shows a tooltip stating the row is
cloned in more than one place plus this row's own parent-folder name — phrased
as "this copy is under …/{fragment}", **never** as if it were the sibling's
location, since `collisionFragment` is only ever this row's own parent folder
and no sibling-location data is threaded between rows (per a 2026-07-21
clarification: "keep it cheap"). Clicking it calls a new
`RowActionHandlers.onFindDuplicate(key)` — `key = remote?.slug ??
entry.directoryName`, the identical fallback already used for the `.slug`
cell — which `renderer.ts` implements as `searchExpanded = true; searchQuery =
key; render()`, reusing feature 016's search state and bypassing its 150 ms
debounce the same way its × clear button already does, so the table narrows
to every clone immediately. Detection itself (`scan.ts`, `filterRows`) is
completely unchanged — this feature is presentation-and-one-click-action only.
The button joins every other row icon's established conventions: `disabled =
locked` for the feature-009 long-operation lockout (no colour/opacity change,
`.row-dup-ico:disabled { cursor: not-allowed }` only) and the feature-012/013
`.tip-up`/`positionRowIconTooltip` upward-flip so its tooltip never clips.
**Renderer-only**: no new IPC, main-process change, dependency, or persisted
setting — the diff touches only `view/icons/catalog.ts`, `view/table.ts`,
`renderer.ts`, and `styles.css`. No new pure/branching logic was introduced
(the one new line, `remote?.slug ?? entry.directoryName`, is a trivial
fallback already used elsewhere), so no new test file was required per the
plan's Constitution Check — **implementation complete through T010 and T012**;
build and all 122 tests pass unchanged. **T011 (the full `quickstart.md`
walkthrough against `pnpm start`, scenarios A–I) is still owed** — an agent
cannot drive real mouse/hover/click interaction against the Electron window
from this environment. This feature's own `/speckit-analyze` pass surfaced
and fixed two pre-implementation issues: an unreachable edge case in the
original spec (a colliding pair where only *one* row lacks a remote — actually
impossible, since the detection key requires the same slug on both sides) and
an ambiguous tooltip-phrasing example that could have been misread as naming
the sibling's location instead of the row's own.

Prior feature: **Debounced Repository Search Filter**
(`specs/016-repo-search-filter/plan.md`) — a header search affordance narrows
the repository table live as the user types, matching a case-insensitive
substring against each row's remote slug, directory name, origin URL, and
current branch. Entered through an expandable magnifier icon (`#search` in
the header bar, `view/search.ts`) that opens into a text input with a
trailing × clear button (shown only when non-empty); Esc clears first, then
collapses on a second press once already empty. Matching is debounced 150 ms
via a plain `setTimeout` held in `renderer.ts` (no library, Principle V) —
the × button and Esc bypass that debounce and commit `''` immediately, since
reaching the already-inactive empty-query state should never feel laggy. The
matching itself lives in the existing pure `filterRows` (`view/filter.ts`),
extended with a trailing optional `searchQuery` parameter rather than a
second filtering pass, so search composes (AND) with the existing state
filter and the Worktrees toggle "for free" — the same choke point already
governs which worktrees a family surfaces. Two small pure helpers,
`searchMatchesRepo`/`searchMatchesWorktree`, encode the clarified worktree
rule: a repo-level match surfaces every one of its worktrees, but a match
found only on a worktree's own branch surfaces just that worktree under its
still-visible parent. An empty or whitespace-only query reduces the new
parameter to a no-op, so the pre-existing filter tests serve as a free
regression guard. A distinct "No repositories match your search." message
(`view/empty.ts`'s new `renderNoMatchState`) now covers the case where rows
exist but the search/filter combination hides all of them — kept separate
from the existing "no repositories discovered" onboarding copy so an active
search never reads as a broken/empty app (Principle IV). The search control
joins the feature-009 long-operation lockout: while Refresh/Pull all/Cleanup
runs, the icon and input go non-interactive with only a `not-allowed`
cursor — the input uses native `readOnly` rather than `disabled`
specifically because a disabled `<input>` greys out by default in most
browsers while `readOnly` doesn't, sidestepping the "no colour change"
constraint without any CSS override. **Renderer-only**: no new IPC,
main-process change, dependency, or persisted setting — `searchQuery` is a
plain in-memory module-level string in `renderer.ts`, reset only by an
explicit clear/Esc, and never touched by refresh/delete/pull-all/cleanup
(FR-009 verified: nothing else in `render()`'s call graph writes to it).
**Implementation complete through T016** — build and all 122 tests pass (110
prior + 12 new `filterRows` search cases covering per-field matching, the
worktree rule, AND-composition with the state and failed filters, and the
empty-query regression guard). **T017 (the full `quickstart.md` walkthrough
against `pnpm start`, scenarios A–M) is still owed** — an agent cannot drive
real mouse/hover/typing interaction against the Electron window from this
environment.

Prior feature: **Upgrade to a Unified Vector Icon Set**
(`specs/015-vector-icon-set/plan.md`) — replaced the app's hand-drawn, mixed
fill/outline glyphs with a single uniform outline family (Tabler Icons,
MIT): the icon catalog's `<svg>` wrapper flipped from
`fill="currentColor"` to Tabler's `fill="none" stroke="currentColor"
stroke-width="2"` recipe, and every text-character affordance (`×`, `↑`/`↓`,
`⌂`) in the rows and the Settings/Cleanup overlays was swapped for a real
glyph from the same set — including the row delete icon, now a trash glyph
sized to match its row-mates. The bespoke IntelliJ mark was kept (Tabler has
no IntelliJ brand) but redrawn to survive the new wrapper at the set's
stroke weight. **Renderer-only, no new runtime dependency** (Tabler
contributed source path data only, not an npm package) — Tabler's MIT
license text was added to a new root `THIRD_PARTY_LICENSES` file.
Implementation complete through all 14 tasks including the manual
quickstart walkthrough; build and all 110 tests passed; merged to `main`.

Prior feature: **Rebase Diverged Repositories on Pull All**
(`specs/014-pull-all-rebase/plan.md`) — closes the gap where "Pull all" only
fast-forwarded and reported any repository with local commits *and* an
advanced upstream as `failed`/`diverged`, even though the user's own `git
pull --autostash` (under `pull.rebase=true`) resolves the same repos
trivially. `classifyAndMerge`'s diverged branch in `src/main/update.ts` now
runs a non-interactive `git rebase @{u}`: a clean rebase reports `updated`
(local commits replayed atop upstream, no merge commit); a conflicting
rebase aborts, restores the repository byte-for-byte, and reports `failed`
with a new `rebase-conflict` reason (its own tooltip sentence in `table.ts`'s
`REASON_SENTENCE` map). This **supersedes the "diverged repo is always left
failed, never auto-merged" framing** in feature 013's paragraph below for the
clean-rebase case specifically — the constitution's Principle III was
amended to v4.0.0 to permit exactly this: a non-interactive, conflict-free
rebase, still never resolving a conflict, never fabricating a merge commit,
never run outside a deliberate "Pull all" action. No new IPC, dependency,
persisted setting, or UI state — reuses feature 013's `failed`/warn-icon
plumbing entirely, adding only the new reason label. Implementation complete
through all tasks; 105/105 tests passed (103 baseline + 2 new); merged to
`main`.

Prior feature: **Explain Why a Repository Wasn't Updated by Pull All**
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
