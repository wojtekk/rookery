# Phase 0 Research: Update All Repositories

All unknowns from the plan's Technical Context, resolved. Each entry: Decision /
Rationale / Alternatives considered.

## R1 — Integration strategy: fast-forward only (drop `-Xours`)

**Decision**: Integrate with `git merge --ff-only <upstream>`. If it is not a
fast-forward, do not merge — roll back and report `failed`. The script's
divergence branch (`git merge -Xours ...`) is **not** ported.

**Rationale**: Constitution Principle III forbids auto-resolving conflicts and
mandates fail-loud + handoff for a pull that can't complete cleanly; it even
pre-defines the "failed autostash pull = light red" state. `--ff-only` is the
exact primitive for "advance only if there's nothing to reconcile." Confirmed
with the user during clarification (recorded in plan Complexity Tracking).

**Alternatives considered**: (a) `-Xours` auto-merge — rejected: silently buries
upstream changes under local, violates III and the tool's honesty purpose.
(b) `git pull --ff-only` — equivalent, but doing `fetch` then `merge --ff-only`
as two steps matches the script's structure, lets us fetch once and inspect
SHAs, and keeps the timeout boundaries explicit. (c) `--rebase` — rejected:
rewrites local history and can conflict → interactive resolution, banned by III.

## R2 — Autostash + rollback sequence (reused, non-destructive)

**Decision**: Per repo, mirror the script's non-destructive spine:

1. Detect dirty (tracked/staged/untracked) via plumbing (`git diff-files
   --quiet`, `git diff-index --cached --quiet HEAD`, `git ls-files --others
   --exclude-standard`).
2. If dirty: `git stash push --include-untracked -m <marker>`.
3. `git fetch <remote> <branch>`.
4. Compare `HEAD` vs `@{u}`: equal → `already-current`; upstream is ancestor of
   HEAD (local ahead) → `already-current`; HEAD is ancestor of upstream (behind)
   → `git merge --ff-only`; otherwise (diverged) → **fail**.
5. Restore: if a stash was made, `git stash pop` (or `apply --index` then
   `drop`); if the pop conflicts, leave changes safe in the stash and report
   `failed` (never discard).
6. On any failure before/after the merge, restore the stash so the repo is back
   to its pre-run inspectable state.

**Rationale**: This is the part of `upgrade-repo.sh` that is fully constitution-
compliant and battle-tested; reusing it honors "keep main logic unchanged" for
everything except the banned auto-merge branch. Autostash satisfies III's
explicit "pull-all MUST use `--autostash`". Steps use plumbing exit codes, not
scraped human output (Principle I / Technical Constraints).

**Alternatives considered**: `git pull --autostash --ff-only` (one command) —
tempting and simpler, but it couples fetch+merge+stash under one 5s-ish process
and gives coarser failure attribution; the explicit sequence lets us apply the
longer fetch deadline precisely and classify outcomes. Revisit as a
simplification if the explicit sequence proves fiddly (ponytail: named ceiling).

## R3 — Non-interactive git + per-repo deadline (no hang)

**Decision**: Run every git invocation in the engine with env
`GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND='ssh -oBatchMode=yes
-oStrictHostKeyChecking=accept-new'`, and bound the whole per-repo sequence with
a deadline (default ~60s) — reusing `execFile`'s `timeout`+`killSignal:
'SIGKILL'` (already in `runGit`) plus a `withDeadline`-style wrapper for the
multi-command sequence. On breach: kill, roll back if possible, report `failed`.

**Rationale**: FR-013/SC-007 require the run to always terminate and never
prompt. `GIT_TERMINAL_PROMPT=0` turns a credential prompt into an immediate
error (Principle I: no password prompting). SSH `BatchMode=yes` does the same for
SSH remotes. The existing 5s `SPAWN_TIMEOUT_MS` is right for local status probes
but too short for a real network `fetch`, so the engine passes a longer
`timeoutMs` — hence the backward-compatible `opts` param on `runGit`.

**Alternatives considered**: relying on git's own default prompt/timeout —
rejected: a GUI subprocess with no TTY can still block on some helpers, and
there is no global fetch timeout. Hardcoding a new global `SPAWN_TIMEOUT_MS` —
rejected: would slow the scan's fast-fail probes.

## R4 — Where eligibility is computed

**Decision**: Compute eligibility in the **main process** by flattening
`lastSnapshot` (repositories + their `worktrees`) and keeping working trees where
`availability === 'ok'` && `head.detached === false` && `head.upstream.tracking
=== 'tracked'`. (`remote !== null` is implied by a tracked upstream but is also
checked for clarity.) The renderer just calls `updateAll()` with no args.

**Rationale**: The scan data already lives in `lastSnapshot` in `main.ts`; the
main process owns it and the git subprocesses. Filtering there avoids shipping a
target list across IPC and keeps the renderer dumb. A tracked upstream is the
single predicate that subsumes both user-named filters ("local-only repo" = no
remote → can't be tracked; "no remote branch tracked" = `tracking: 'local-only'`)
plus detached/unavailable.

**Alternatives considered**: renderer computes eligible paths and passes them in
— rejected: duplicates the type-walk the main process can do directly, and lets a
stale renderer snapshot drive mutations. Re-probe eligibility fresh per repo —
unnecessary; `lastSnapshot` is post-startup-refresh and the engine re-checks
SHAs anyway.

## R5 — Transient "failed pull" state: carry & clear

**Decision**: Represent failed-pull as a renderer-held `Set<string>` of failed
repo paths (`failedPaths`), **not** a new `RowState` value or a scan-derived
field. `table.ts` paints a light-red edge (`--fail-edge`) for any visible row
whose `fullPath` is in the set, layered as the highest-precedence edge. Populate
it from the `updateAll()` result; clear it at the **start** of the next
`updateAll()` run. Add `--fail-edge` to `styles.css` (the CSS var the
constitution's colour set already implies).

**Rationale**: A failed pull is an event, not a derivable repository state — a
re-scan cannot reconstruct "I tried to pull this and it wouldn't fast-forward."
Keeping it as ephemeral renderer state avoids polluting the scan data model and
the `Head`/`WorkingTree` types. Post-run we still call `doRefresh()` so
ahead/behind is honest; the light-red overlay sits on top of the (now amber
out-of-sync) diverged rows to say "pull attempted & failed."

**Alternatives considered**: extend `RowState`/`Head` with a `pullFailed` flag —
rejected: it isn't part of git-derived state and would have to be threaded
through scan + parse for no reason. Persist failed paths — rejected: it's
run-scoped feedback, not a setting (Principle V minimal footprint).

## R6 — Animated icon + re-entry guard

**Decision**: Add an `updating: boolean` to `ToolbarState` and an `onUpdateAll`
handler; render a new control whose `spin-icon` gets the existing
`.spin 0.8s linear infinite` animation while `updating` (exactly how
`.ctrl.refresh.busy` already works). Guard re-entry in `renderer.ts`
(`if (updating) return;`), mirroring the existing `doRefresh` guard.

**Rationale**: Reuses the established toolbar pattern and CSS keyframe verbatim
(FR-009). No new animation code.

**Alternatives considered**: a progress bar / per-repo progress — rejected as
scope creep; the spec asks only for an animated icon and a final summary.
`onScanProgress`-style streaming could be added later if desired (named ceiling).

## R7 — Post-run summary surface

**Decision**: Reuse the existing `showNotice(message)` toast in `renderer.ts` for
the one-line summary (e.g. "Updated 5 · 3 already current · 2 skipped · 1
failed"). Then call `doRefresh()` to re-derive rows.

**Rationale**: `showNotice` is the app's established transient-message surface
(used for launch failures); no new UI. Counts-only matches the clarified
decision (no per-repo reason). Reporting "already current" as its own bucket is a
minor honest extension of FR-011's updated/skipped/failed counts (Principle IV
honesty) and needs no re-clarification.

**Alternatives considered**: a modal summary — rejected: heavier than warranted
and the app reserves dialogs for destructive confirmations. The abandoned
006-console-panel would have shown full per-command output; explicitly out of
scope here.
