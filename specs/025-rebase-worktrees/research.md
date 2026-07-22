# Phase 0 Research: Rebase Worktrees onto the Default Branch

All decisions below were grounded by reading the existing engine (`src/main/update.ts`),
settings (`src/main/config.ts`), the toolbar (`src/renderer/view/toolbar.ts`), the settings modal
(`src/renderer/view/settings.ts`), the renderer state (`src/renderer/renderer.ts`), and the
default-branch helper already in `src/main/cleanup.ts`. No open `NEEDS CLARIFICATION` remained after
`/speckit-clarify`.

## Decision 1 — Rebase target: `origin/<default>` after a fetch

**Decision**: For each repository family, determine the default branch name, run
`git -C <primary> fetch origin <default>`, then rebase each eligible worktree onto the
remote-tracking ref `origin/<default>` (`git -C <worktree> rebase origin/<default>`).

**Rationale**: Rebasing onto the freshly-fetched remote-tracking ref gets worktrees onto the true
latest default branch without ever checking out or fast-forwarding the primary's local default branch
(which may be dirty or checked out) — satisfying FR-004 "never modify the primary". This is the git
operation the user already performs by hand (Clarifications Q2, SC-002).

**Alternatives considered**: (a) Rebase onto the *local* default branch — rejected: requires the
primary to be updated first and risks a stale target. (b) Fetch + fast-forward local `main` then
rebase onto it — rejected: touches the primary's checkout/branch, can fail if `main` is dirty or
checked out, and is more moving parts.

## Decision 2 — Default-branch resolution

**Decision**: `default = primary.head.branch` when the primary (main worktree) is on a branch
(not detached); else `git -C <primary> symbolic-ref --short refs/remotes/origin/HEAD` stripped of the
`origin/` prefix; else the family is unresolvable → every worktree reported `failed` with reason
`default-branch-unknown`.

**Rationale**: Matches the spec's canonical definition ("branch checked out in the main worktree,
falling back to `origin/HEAD`") and reuses the exact logic already proven in `cleanup.ts`'s
`getDefaultBranch`. The primary row already carries `head.branch` from the scan, so the common case
needs no extra git call.

**Alternatives considered**: Per-worktree fork-point detection — rejected in the spec (git does not
record it reliably; "keep it cheap").

## Decision 3 — Engine lives in `update.ts`, reusing the private spine

**Decision**: Add `rebaseWorktrees(rows: Row[]): Promise<RepoUpdateOutcome[]>` and its pure helpers
to `src/main/update.ts`.

**Rationale**: The needed helpers (`isDirty`, `restoreStash`, `expandTilde`, the per-tree timeout
wrapper `updateRepo`-style deadline, `NON_INTERACTIVE_ENV`, `groupIntoFamilies`, `runPool`) are all
already in `update.ts` and mostly unexported. Co-locating avoids widening the module's export surface
just to share internals; `cleanup.ts` already imports `groupIntoFamilies`/`NON_INTERACTIVE_ENV` from
`update.ts`, so this is the established shared home. Smallest diff (Principle: surgical changes).

**Alternatives considered**: New `rebase-worktrees.ts` module — rejected: forces exporting several
`update.ts` internals for a ~40–60 line function. Adding a `mode` flag to `updateAll` — rejected:
couples two operations with different targets and eligibility rules and muddies careful control flow.

## Decision 4 — Family serialization is mandatory, unchanged

**Decision**: Reuse `groupIntoFamilies`: a primary and its linked worktrees share one `refs/stash`
(it lives in the common git dir), so their autostash/rebase/restore steps MUST run sequentially
within a family; families run in parallel through the existing bounded pool.

**Rationale**: Identical hazard to "Pull all" (concurrent autostash can pop the wrong worktree's
entry). Since only linked worktrees are rebased (never the primary), the family loop simply skips the
primary but keeps the serialization guarantee.

## Decision 5 — Per-worktree outcome classification

**Decision**: For each linked worktree, in family order:
1. `availability !== 'ok'` → `skipped`, reason `unavailable`.
2. `head.detached` → `skipped`, reason `detached`.
3. worktree branch === default branch → `skipped`, **no reason** (on-default no-op; not warned).
4. `origin/<default>` is already an ancestor of the worktree's HEAD → `already-current` (nothing to
   replay onto).
5. otherwise: autostash (incl. untracked) → `git rebase origin/<default>`; success → `updated`;
   conflict → `git rebase --abort` + report `failed` reason `rebase-conflict`; then restore the
   stash (a pop conflict → `failed` reason `stash-failed`, work left recoverable). Whole sequence
   bounded by the per-worktree timeout → `failed` reason `timed-out` on elapse (abort clears any
   in-progress rebase).

Fetch failure at the family level → every worktree in that family `failed`, reason `fetch-failed`.
Orphan-worktree rows → `skipped`, reason `orphan-worktree` (no known primary → default unknown).

**Rationale**: Mirrors `classifyAndMerge`/`rebaseOntoUpstream` exactly, only swapping the target from
`@{u}` to `origin/<default>` and adding the on-default and ancestor short-circuits. Reuses the
`RepoUpdateOutcome` shape verbatim (Key Entities), so the renderer surfaces failures with zero new
plumbing.

**Alternatives considered**: Rebasing the primary/main worktree too — rejected: out of scope
(bringing `main` current is "Pull all"'s job) and would risk the primary checkout.

## Decision 6 — Confirmation via native `dialog.showMessageBox` with a checkbox

**Decision**: The confirmation is a new main-process IPC `confirmRebaseWorktrees()` that calls
`dialog.showMessageBox(win, { type: 'warning', message, checkboxLabel: 'Do not remind me again',
buttons: ['Rebase worktrees', 'Cancel'], … })` and returns `{ proceed, suppress }`. The renderer
shows it only when `settings.rebaseReminderSuppressed` is false; on `proceed` with `suppress` it
persists via `setRebaseReminderSuppressed(true)` before running.

**Rationale**: Electron's message box has a built-in "don't ask again" checkbox
(`checkboxLabel`/`checkboxChecked`), so no new HTML/CSS overlay is needed. Deleting a row already uses
native main-process dialogs, so a native confirm is a consistent, established pattern here and is
strictly less code (Principle V / YAGNI). Being app-modal, it also naturally prevents interaction with
other controls while showing.

**Alternatives considered**: A custom HTML overlay mirroring `view/cleanup.ts` — rejected: more code
(markup + CSS + focus handling) for the same result; the native checkbox is purpose-built for exactly
this "reminder with opt-out" case. (If a future design wants the custom look, the overlay can replace
the native call without touching the engine.)

## Decision 7 — Reuse feature 013's failed/warn surface, rebuilt per run

**Decision**: `doRebaseWorktrees` writes its outcomes into the same module-level `failedPaths` and
`warnings` the "Pull all" handler uses, resetting both at the start of the run (as `doUpdateAll`
does). Manual Refresh prunes them via the existing `pruneFixedFailedPaths` rule.

**Rationale**: FR-009a ("latest mutating run wins, pruned on Refresh") falls out for free — the
renderer already treats these two variables as the single source of truth for the "Failed" filter and
the warn icon/tooltip. New reason categories only need sentences added to `table.ts`'s
`REASON_SENTENCE` map.

## Decision 8 — Toolbar button + empty-state gating

**Decision**: Add a `Rebase worktrees` `.ctrl` button to `toolbar.ts` with `rebasing` busy state and
a `hasWorktrees` gate; it is disabled when `!hasWorktrees` or when any other long op runs, and the
existing three become disabled while it runs (`busy` now includes `rebasing`).

**Rationale**: Mirrors the exact pattern already used for `.pull-all`/`.cleanup` (busy spinner +
`disabled` class + `wireActivate` guard). `hasWorktrees` is derived in the renderer from
`rows.some(r => r.kind === 'repository' && r.worktrees.length > 0)` (FR-021, Principle IV
"controls with nothing to act on MUST be blocked").

## Decision 9 — "Other" Settings tab

**Decision**: Widen `settings.ts`'s `activeTab` union to `'directories' | 'actions' | 'other'`, add a
third tab button + tabpanel containing a single checkbox/toggle bound to `rebaseReminderSuppressed`
(labelled to re-enable the reminder), persisted via `setRebaseReminderSuppressed`.

**Rationale**: Feature 024 just established the tab strip; adding a third tab is the discoverable,
consistent home for the re-enable control (FR-020, Clarifications Q1). No new modal or storage.
