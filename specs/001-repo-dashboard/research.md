# Phase 0 Research: Local Repository Dashboard

All Technical Context items were resolvable from the spec, the constitution, and
empirical git checks (git 2.55.0 on the dev machine). No open NEEDS CLARIFICATION
remain.

**Adversarial-review findings (referenced throughout these artifacts):** the spec
went through a Codex adversarial review whose three findings are cited by number in
plan/data-model/contracts:
- **Finding 1** — external-primary disclosure/scope: a discovered worktree whose
  primary is outside all observed dirs. Resolved in R2 below (keep in scope; don't
  render the external primary) and spec FR-026(c).
- **Finding 2** — worktree sync-state was undefined/inconsistent (worktrees had a
  dirty count but no ahead/behind, and FR-028 said "a repository"). Resolved by
  giving worktrees the same full state model as primaries (spec FR-023/FR-028;
  data-model `WorkingTree` shared core).
- **Finding 3** — no git version/capability contract for the read-only flags.
  Resolved in R7 below (>= 2.15 floor + fail-safe).

## R1 — Non-mutating git probe command set

**Decision**: Read every working tree with `--no-optional-locks` and derive the
whole row from two calls, plus one `worktree list` per primary:

| Datum (spec) | Command |
|--------------|---------|
| validity + canonical identity | `git -C <dir> rev-parse --is-inside-work-tree --absolute-git-dir --git-common-dir --show-toplevel` |
| branch, tracking, ahead/behind, dirty count (FR-007/008/009) | `git -C <dir> --no-optional-locks status --porcelain=v2 --branch` |
| last change time (sort key) | `git -C <dir> --no-optional-locks log -1 --format=%cI` |
| linked worktrees (FR-021) | `git -C <dir> worktree list --porcelain` (primary only) |
| slug + host (FR-006) | `git -C <dir> config --get remote.origin.url` (parse) |

**Rationale**: `status --porcelain=v2 --branch` is the linchpin — one call emits
`# branch.head`, `# branch.upstream`, `# branch.ab +x -y`, and one line per dirty
path. Verified behavior: with **no upstream**, `# branch.upstream` and
`# branch.ab` are simply **absent** — that absence is the exact signal for
"local-only branch" (FR-007) and "ahead/behind unavailable" (FR-009). Detached
HEAD shows `# branch.head (detached)`. This gives the complete `RowState`
(dirty/ahead/behind → color + non-color cue) from a single parse, satisfying the
"one computed struct" goal and keeping the per-repo cost within the time budget.

**Alternatives considered**:
- `git status --porcelain=v1` + separate `rev-list --count @{u}..` / `..@{u}`:
  two extra subprocesses per repo, worse for the 50-repo budget. Rejected.
- A git library (nodegit / isomorphic-git): bundles/embeds git behavior,
  violating Constitution I and risking behavioral drift from the user's CLI.
  Rejected.

## R2 — Canonical identity, dedup, and worktree families (FR-026)

**Decision**: A working tree's canonical identity is the pair
`(realpath(resolve(dir, gitCommonDir)), realpath(topLevel))` from `rev-parse`.
Working trees sharing the same real common-dir are one **family**; the member whose
**own git-dir** (from `--absolute-git-dir`) equals the common-dir is the **primary**,
the rest are worktrees. Dedup by identity so a repo reachable via multiple observed
dirs or symlinks appears once; order families deterministically.

**Rationale**: Verified that `--git-common-dir` can be returned **relative** (`.git`)
for the main worktree and absolute for a linked worktree, so it must be resolved
against the working dir and `realpath`'d before comparison — otherwise
symlinked/relative paths would defeat dedup. The own git-dir comes from
`--absolute-git-dir` (not an assumed `<dir>/.git`, which breaks under `GIT_DIR` /
separate-git-dir / a worktree's `.git`-file layout). This is the concrete basis the
spec's "Canonical identity" assumption already names.

**External-primary rule (Finding 1 resolution)**: If a discovered worktree's primary
common-dir resolves to a path **outside every observed directory**, the app does NOT
render the external primary as a row or stat its separate working-tree files. The
in-scope worktree is shown and flagged "primary outside observed directories."
Caveat: probing the in-scope worktree still reads the *shared* common git dir
(objects/refs/config live there), so a slow/inaccessible external mount is not fully
shielded — the per-inspection timeout (R3) is what bounds that. What the rule
guarantees is no external *working tree* is discovered, statted, or displayed
(FR-026(c)).

**Alternatives considered**: keying on the remote slug (breaks two independent
clones of the same slug — must stay separate rows); keying on inode (fragile
across volumes). Rejected.

## R3 — Concurrency + per-repo timeout (FR-027, SC-007)

**Decision**: Inspect working trees through a bounded promise pool (default
concurrency ~8). Each **family inspection** (the whole P1..P4 + per-worktree probe
sequence) runs under one **per-inspection deadline** (default **5 s**, tunable) via
`Promise.race` against a timer; on expiry all in-flight children for that family are
killed and the family is marked `unavailable/stale`. Each individual spawn also
carries a `spawn` `timeout`/`killSignal` as a per-process backstop. Refresh resolves
when all families settle or time out — so it always terminates in bounded time.

**Rationale**: The authoritative budget is **per inspection**, not per subprocess
(spec.md assumption): a family with N worktrees issues ~5+3N sequential spawns, so a
per-call ceiling alone would let worst-case time grow with N. `child_process.spawn`'s
`timeout` is per-process only, so the per-inspection bound needs the explicit
`Promise.race` family timer above; the spawn timeout remains as defense in depth. A
pool caps concurrent git processes so 50 repos don't spawn 50+ processes at once
(keeps the UI responsive, SC-006). Isolation is
per repo, so one hung repo can't block the others (SC-007).

**Alternatives considered**: unbounded `Promise.all` (process storm, no
isolation); a worker-thread pool (unneeded — the work is I/O-bound subprocess
waiting, not CPU). Rejected.

## R4 — Electron security posture

**Decision**: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`; the renderer reaches the main process only through a typed API
exposed via `contextBridge` in `preload.ts`. All git/filesystem work stays in
main; the renderer only renders and sends intent.

**Rationale**: This is the standard, non-negotiable Electron hardening (an
"accessibility/security basics" area the ponytail rules say never to simplify
away). It also enforces the clean seam the spec's modularity goal wants: the
renderer cannot touch git directly.

**Alternatives considered**: `nodeIntegration: true` for convenience — rejected
outright (renders the app trivially exploitable by any malicious repo content
that reaches the DOM).

## R5 — Settings storage

**Decision**: One JSON file (`settings.json`) in `app.getPath('userData')`,
holding observed directories and sort dimension/direction. Written atomically
(temp file + rename).

**Rationale**: Constitution V allows local user configuration only; a JSON file is
the minimal footprint. `userData` is the OS-correct per-user location Electron
already resolves. No DB (YAGNI for a handful of settings).

**Alternatives considered**: `electron-store` dependency (unjustified for ~3
fields); OS keychain (only for secrets — we store none). Rejected.

## R6 — Renderer: no UI framework

**Decision**: Plain TypeScript + DOM with small render functions
(`view/table.ts`, `view/sort.ts`, `view/empty.ts`). CSS classes carry both the
background color and the redundant non-color cue (icon/badge).

**Rationale**: A single sortable/filterable list of ~50 rows (each with a few
grouped worktrees) is squarely within vanilla DOM. Constitution V requires
justifying new deps against "a few lines of code" — a framework isn't justified
yet. Clean module boundaries provide the "modularity" the spec wants without the
weight.

**Upgrade path (ponytail)**: if the deferred per-repository action UI grows
complex, adopt a lightweight view lib (e.g., Preact/lit) behind the same
`view/` seam — no data-layer change required.

## R7 — Git version floor + fail-safe (Finding 3 resolution)

**Decision**: Assume system git **>= 2.15** (introduces `--no-optional-locks`;
`--porcelain=v2` is 2.11, `worktree list --porcelain` is 2.7, so 2.15 is the
binding floor). Detect git version once at startup; if git is missing, older, or a
required capability is absent, report clearly and mark affected repos
unavailable — never fall back to a mutating command path (FR-011, FR-019).

**Rationale**: 2.15 shipped in 2017 and is effectively universal, so no runtime
capability-probing subsystem is warranted — a version read + fail-safe covers the
skew case named by the adversarial review without ceremony.

**Alternatives considered**: per-command capability probing (over-engineered);
silent fallback to `git status` without the flag (would write the index —
violates the read-only guarantee). Rejected.
