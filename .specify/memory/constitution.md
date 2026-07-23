<!--
Sync Impact Report
==================
Version change: 4.1.0 → 5.0.0
Rationale: Amend Principles V, IV, and II to reconcile with Feature 027
(specs/027-clone-repository/spec.md) — a new "Clone" action clones a remote repository onto
disk, with autocomplete over the repositories the user can access. Discovering that set
(1,000+ repos across the user's configured hosts) requires the app to enumerate them from
GitHub, which it does by shelling out to the user's already-authenticated system `gh` CLI —
new app-initiated outbound activity. Principle V previously stated the app "MUST NOT ... make
network calls of its own; the only outbound activity permitted is git talking to its configured
remotes and opening user-invoked external targets." That hard guarantee is NARROWED: the app
MAY now additionally invoke the system `gh` CLI for read-only repository discovery, using the
user's existing `gh` authentication, never storing or handling a token. Narrowing a Principle
guarantee is backward-incompatible → MAJOR, mirroring the 4.0.0 precedent (which removed
Principle III's "diverged repo left untouched" guarantee). The clone itself needs no new
latitude — `git clone` is already "git talking to its configured remotes." Principle IV's
long-operation enumeration gains "Clone" as a fifth member (same mutual-exclusion, table/
sort-header-only dim, no-colour-change-elsewhere rules); Principle II's mutating-operation list
names "clone" (an additive mutation — it creates a new working tree and adds an observed
directory, never deletes/overwrites, so it does not reach the repository-deletion confirmation
tier). No new runtime dependency is introduced (the `gh` CLI is a system tool, delegated exactly
as `git` is). See specs/027-clone-repository/{spec.md,plan.md,research.md} (research §1–§2).

Prior change (4.0.0 → 4.1.0): Amend Principles III and IV to reconcile with Feature 025
(specs/025-rebase-worktrees/spec.md) — a new "Rebase worktrees" action replays each linked
worktree's branch onto its repository's freshly-fetched default branch, using the identical
non-interactive, abort-on-first-conflict, restore-to-exact-prior-state rebase spine Principle
III already permitted, but names only "Pull-all" by name and only the tracked upstream as a
target. Principle III's latitude is generalised from "Pull-all rebasing onto its tracked
upstream" to "any deliberate update action rebasing onto its own resolved target" — Pull-all's
tracked upstream, or Rebase worktrees' freshly-fetched default branch — with every existing
guarantee (non-interactive, conflict aborts and restores exactly, no auto-merge, `--autostash`
mandatory) carried over unchanged and unweakened. Principle IV's long-operation enumeration
gains "Rebase worktrees" as a fourth member alongside Refresh/Pull all/Cleanup, so the same
mutual-exclusion and dim/lockout rules apply to it. No guarantee is removed or narrowed —
this only recognises a second action performing the same already-permitted class of rebase —
so this is classified MINOR (expanded guidance). See
specs/025-rebase-worktrees/{spec.md,plan.md,research.md} (Decision 1, Decision 5).

Prior change (3.0.0 → 4.0.0): Amend Principle III to reconcile with Feature 014
(specs/014-pull-all-rebase/spec.md) — "Pull all" now brings a *diverged* repository up to
date by a non-interactive rebase of local commits onto the upstream, matching the user's
proven `git pull --autostash` workflow (their global `pull.rebase=true`). This was a
backward-incompatible redefinition (MAJOR): Principle III previously *guaranteed* that a
diverged repository is left untouched and marked `failed`, never rewritten. That guarantee
was removed. The principle's core was preserved intact: the app still MUST NOT resolve
conflicts, MUST NOT perform interactive merge/rebase resolution, and MUST NOT create a
merge commit on the user's behalf. The added latitude is narrow and reversible — the rebase
is non-interactive, aborts on the first conflict, restores the repository to its exact prior
state (no rebase left in progress, uncommitted work preserved), and hands off to a merge
tool. `--autostash` remains mandatory; the fail-loud/hand-off rule for push is unchanged.
See specs/014-pull-all-rebase/{spec.md,plan.md,research.md} (Decision 6).

Prior change (2.0.0 → 3.0.0): Re-expand Principle IV's UI-lockout mandate to reconcile with Feature
009's further-revised design (specs/009-block-ui-during-operations/spec.md,
Revision 2026-07-19e). Live feedback after implementing the 2.0.0-narrowed design
made the actual intent explicit: while a long operation (Refresh, Pull all,
Cleanup) runs, the application MUST block essentially every control that operates
on repositories — not just the other two long-operation triggers. This reinstates,
in substance, most of what 2.0.0 had just relaxed (Settings, the Worktrees toggle,
filter chips, sort, and row-level actions are blocked again), while keeping 2.0.0's
two genuine improvements: no whole-viewport dim overlay, and no native `inert`
blanket lockout. Instead: the repository table rows AND the sort-header row dim to
barely-visible (the only two things that visually dim); every other blocked
control (Settings, Worktrees toggle, filter chips, row-level actions) MUST NOT
change colour/opacity at all — blocked feedback for them is limited to becoming
non-interactive with an inactive ("not-allowed") mouse cursor. Because this removes
2.0.0's previously-required MUSTs that those controls "stay interactive," it is a
backward-incompatible redefinition — MAJOR. See
specs/009-block-ui-during-operations/spec.md (Revision 2026-07-19e).

Prior change (1.6.0 → 2.0.0): Narrow Principle IV's UI-lockout mandate to reconcile
with Feature 009's revised design (Revision 2026-07-19b). The v1.6.0 mandate to
"block every control that could start another operation or mutate the
observed-directory set" and to dim "the underlying content" was relaxed: while a
long operation ran, only the OTHER long-operation triggers were blocked, only the
repository table rows dimmed, and Settings, the Worktrees toggle, filter chips,
sort, and row-level actions stayed interactive. (Superseded by 3.0.0, which
reinstates most of what this relaxed.)

Prior change (1.5.0 → 1.6.0): Codify UI-blocking behavior for long/blocking
operations under Principle IV. Long operations (refresh, pull-all, branch cleanup)
MUST block the controls that could start a conflicting operation or mutate the
observed-directory set, MUST show the loader/progress indicator while visibly dimming
the underlying content, and MUST run one-at-a-time (no concurrent long operations).
This tightened the pre-existing "MUST NOT freeze the UI" mandate from merely "stay
responsive" to "actively lock out conflicting input and show progress." (Superseded
in part by 2.0.0, which narrows what is blocked and what is dimmed.)

Prior change (1.4.0 → 1.5.0): Extend Principle II beyond git-ref mutations (pull,
branch deletion, worktree removal) to name push, branch cleanup, and
filesystem-level repository deletion explicitly, ahead of a planned
destructive-actions feature. Repository deletion is codified as a distinct,
higher-severity mutation tier (named confirmation + an uncommitted/unpushed-work
warning) because it destroys the directory itself, not just a git ref, and has no
git-native recovery path. Principle III is extended so a rejected push is treated
the same as a failed pull: stop and surface, never force or auto-resolve.

Prior change (1.3.0 → 1.4.0): Reconcile Principle V + Technical Constraints with the custom
per-repository action launchers feature (MINOR: the local-only, no-telemetry, and
launch-not-embed intent is retained; the external-target set is reframed from a
fixed enumeration to user-configured launch commands, with the original five —
GitHub, IntelliJ, VS Code, Finder, terminal — kept as seeded, editable defaults).
Adds an argument-safe-substitution mandate: repository-derived values (the row's
path and remote URL) MUST be passed to launch commands as intact arguments, never
spliced into command text. See specs/002-custom-action-launchers/spec.md (FR-005,
FR-012, FR-013).

Prior change (1.2.0 → 1.3.0): reconciled Principle IV with the approved UI design
(the always-observable intent and colour semantics retained; the surfacing
mechanism refined and extended) — a per-row coloured leading-edge indicator paired
with a mandatory redundant non-colour cue (status glyph + text), NOT a full-row
background fill; clean/in-sync gained green and unavailable/timed-out gained grey;
dirty (blue) still wins over out-of-sync (amber). See
specs/001-repo-dashboard/design/README.md and FR-028.

Prior change (1.1.0 → 1.2.0): reconciled Principle IV with the redesigned row model —
colour scheme "uncommitted = yellow" → "dirty = blue, out-of-sync = yellow" (dirty
wins), and minimum row fields → slug (primary identifier) + directory name +
branch-with-tracking + local/ahead/behind counts, full path on demand.

Prior change (1.0.0 → 1.1.0): reconciled the constitution with the ratified feature
decision to remove automatic/interval refresh (Principle IV's always-observable
intent retained; refresh mechanism narrowed from a timed interval to startup +
explicit on-demand). Principle II and Technical Constraints dropped "periodic
refresh" and the "refresh interval" setting.

Principles defined:
  I.   System-Native Delegation
  II.  Read-Only by Default, Destructive by Explicit Action
  III. Never Resolve Conflicts — Fail Loud, Hand Off
  IV.  Always-Observable State
  V.   Local-Only, Minimal Footprint

Added sections:
  - Core Principles (5)
  - Technical Constraints
  - Development Workflow
  - Governance

Removed sections: none (template placeholders replaced).

Amendments (5.0.0):
  - Principle V: the guarantee that the app "MUST NOT ... make network calls of its own"
    (outbound activity limited to git-to-remotes and launch targets) is NARROWED. The app MAY
    now additionally invoke the system `gh` CLI for read-only repository discovery, using the
    user's existing `gh` authentication and never storing or handling a token. Narrowing a
    Principle guarantee is backward-incompatible → MAJOR. The clone action itself adds no new
    latitude (`git clone` is already permitted git-to-remote activity). No new runtime
    dependency is added — `gh` is a system tool delegated exactly as `git` is (Principle I).
    See specs/027-clone-repository/spec.md (FR-002, FR-014).
  - Principle IV: the long-operation enumeration gains a fifth member, "Clone", alongside
    Refresh/Pull all/Cleanup/Rebase worktrees — same at-most-one-at-a-time mutual exclusion,
    same table/sort-header-only dim, same no-colour-change-elsewhere rule. See
    specs/027-clone-repository/spec.md (FR-008).
  - Principle II: the mutating-operation list names "clone". Clone is an additive mutation (it
    creates a new working tree on disk and appends an observed directory); it never deletes or
    overwrites, so it does not reach the repository-deletion confirmation tier. It remains a
    deliberate, explicit action, never on a timer. See specs/027-clone-repository/spec.md
    (FR-007, FR-009, FR-010).

Amendments (4.1.0):
  - Principle III: the non-interactive-rebase latitude is generalised from "Pull-all rebasing
    onto its tracked upstream" to any deliberate update action rebasing onto its own resolved
    target — naming Pull-all's tracked upstream and Rebase worktrees' freshly-fetched default
    branch as the two current examples. Every existing guarantee (non-interactive,
    abort-and-restore-exactly on the first conflict, no auto-merge, mandatory `--autostash`)
    is carried over unchanged. Expanded guidance, no guarantee removed → MINOR. See
    specs/025-rebase-worktrees/spec.md (FR-002–FR-010).
  - Principle IV: the long-operation enumeration gains a fourth member, "Rebase worktrees",
    alongside Refresh/Pull all/Cleanup — it participates in the same at-most-one-at-a-time
    mutual exclusion, the same table/sort-header-only dim, and the same
    no-colour-change-elsewhere rule as the other three. MINOR (materially expanded guidance).
    See specs/025-rebase-worktrees/spec.md (FR-013).

Amendments (4.0.0):
  - Principle III: the guarantee that a diverged repository is left untouched and marked
    `failed` (never rewritten) is REMOVED. "Pull all" MAY now bring a diverged repository
    up to date by a non-interactive rebase of its local commits onto the upstream, but
    ONLY when that rebase completes without conflict. On the first conflict it MUST abort
    the rebase, restore the repository to its exact prior state (no rebase in progress,
    uncommitted work preserved), mark it `failed` (light red), and hand off to a dedicated
    merge tool. The unchanged core: still MUST NOT resolve conflicts, MUST NOT perform
    interactive merge/rebase resolution, and MUST NOT create a merge commit on the user's
    behalf (no auto-merge). `--autostash` remains mandatory. Backward-incompatible
    (removes a prior guarantee) → MAJOR. See specs/014-pull-all-rebase/spec.md.

Amendments (3.0.0):
  - Principle IV: the 2.0.0 narrowing is substantially reversed. While a long
    operation (Refresh, Pull all, Cleanup) runs, the app MUST block every control
    that operates on repositories: the OTHER long-operation triggers, Settings, the
    Worktrees toggle, filter chips, the sort-header row, and row-level actions
    (delete, custom launches) — nothing besides the loader and the running
    trigger's own busy indicator stays active. Visual treatment is split
    deliberately: the repository table rows AND the sort-header row dim to
    barely-visible (the only two things that dim); every other blocked control
    (Settings, Worktrees toggle, filter chips, row-level actions) MUST NOT change
    colour or opacity — blocked feedback for them is limited to becoming
    non-interactive with an inactive ("not-allowed") mouse cursor. A repository
    row's directory-path tooltip MUST NOT appear while a long operation runs. The
    2.0.0 improvements are retained: still no whole-viewport dim overlay and no
    native `inert` blanket lockout — each control is blocked individually by its
    own render logic, preserving per-control settlement-based release (FR-013).
    The empty-list rule is unchanged: bulk actions with nothing to act on stay
    blocked; Refresh stays available.

Amendments (2.0.0):
  - Principle IV: the UI-lockout scope introduced in 1.6.0 is narrowed. While a long
    operation (Refresh, Pull all, Cleanup) runs, the app MUST (a) prevent only the
    OTHER long-operation triggers from starting a second operation (still at most one
    at a time), each showing its own busy/non-interactive state; (b) show the loader
    over the repository table and dim only the table's rows (repository and, when
    shown, nested worktree rows) to barely-visible as a visual cue — NOT the whole
    interface; and (c) keep every other control interactive (Settings, the Worktrees
    toggle, filter chips, sort, row-level delete/launch actions), with the row dim
    being a visual cue only, never an input barrier. The empty-list rule is retained:
    bulk actions with nothing to act on stay blocked; Refresh stays available. This
    removes the 1.6.0 requirements to block observed-directory-set-mutating controls
    (e.g., Settings) and to dim the whole content, so it is a MAJOR
    (backward-incompatible) redefinition.

Amendments (1.6.0):
  - Principle IV: the "MUST NOT freeze the UI" mandate is expanded into an active
    UI-lockout requirement for long/blocking operations. While such an operation
    runs, the app MUST (a) block every control that could start a conflicting
    operation or mutate the observed-directory set, (b) show the loader/progress
    indicator while visibly dimming the underlying content so it is barely visible,
    and (c) permit at most one long operation at a time (no concurrency). Controls
    that are inapplicable because there is nothing to act on (e.g., bulk actions
    when no repositories are listed) MUST also be blocked, while controls that can
    still make progress (e.g., refresh on an empty list) MUST stay available.

Amendments (1.5.0):
  - Principle II: the mutating-operation list now names push, branch cleanup, and
    repository deletion explicitly (previously: pull, branch deletion, worktree
    removal, pull-all). Repository deletion is called out as a distinct,
    higher-severity tier requiring confirmation that names the repository and an
    explicit warning when uncommitted or unpushed work exists, since it removes
    the directory itself rather than a git ref.
  - Principle III: scope extended from pull to pull and push — a push rejected as
    non-fast-forward MUST stop and surface the failure, not force-push or
    auto-merge.
  - Development Workflow: the mutating-operation runnable-check bullet now names
    push and repository deletion alongside pull/delete/remove.

Amendments (1.4.0):
  - Principle V: the external-target set is reframed from a fixed enumeration
    (GitHub, IntelliJ, VS Code, Finder, terminal) to user-configured launch
    commands; those five are retained as seeded, editable defaults. The
    local-only, no-telemetry, no-app-network, and launch-not-embed constraints
    are unchanged.
  - Principle V: added an argument-safe-substitution mandate — repository-derived
    values (path, remote URL) MUST be passed to launch commands as intact
    arguments, never spliced into command text (prevents command injection from
    unusual paths/URLs).
  - Technical Constraints: the "external integrations are launch-only" bullet now
    names user-configured launch commands (five seeded defaults) and the
    argument-safe substitution of path + remote URL.

Amendments (1.3.0):
  - Principle IV: state surfacing redefined from a full-row background fill to a
    per-row coloured leading-edge indicator PLUS a mandatory redundant non-colour cue
    (status glyph + row text), so state is distinguishable without colour.
  - Principle IV: colour set extended — clean/in-sync = green (new), unavailable/
    timed-out = grey (new); dirty = blue, out-of-sync = amber/yellow, failed autostash
    pull = light red retained; dirty (blue) still wins over out-of-sync.

Amendments (1.2.0):
  - Principle IV: colour mapping redefined (dirty = blue; out-of-sync = yellow;
    failed autostash pull = light red; dirty wins when both dirty and out-of-sync).
  - Principle IV: minimum surfaced row fields redefined to slug (primary
    identifier), directory name, branch with tracking status, and
    local/ahead/behind counts; full path available on demand (tooltip).

Amendments (1.1.0):
  - Principle II: "periodic refresh" → "on-demand refresh" in read-only activity list.
  - Principle IV: interval-refresh mandate replaced with startup + explicit on-demand.
  - Technical Constraints: refresh is on explicit demand; "refresh interval" setting
    replaced with "sort order" as the persisted example.

Templates reviewed (re-verified for 4.1.0):
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic
     (reads from this file); no hardcoded principle names to update.
  ✅ .specify/templates/spec-template.md — no constitution-specific references.
  ✅ .specify/templates/tasks-template.md — no constitution-specific references.
  ✅ .specify/templates/checklist-template.md — no constitution-specific references.
  ✅ specs/014-pull-all-rebase/{plan.md,research.md,contracts/update-engine.md} — already
     written against the 4.0.0 amendment (Principle III rebase latitude); no rework needed.
  ✅ specs/025-rebase-worktrees/{plan.md,research.md,contracts/rebase-engine.md} — already
     written against this amendment (generalised Principle III latitude, Principle IV's
     fourth long operation); no rework needed.

Follow-up TODOs:
  ⚠ specs/009-block-ui-during-operations/{plan.md,research.md,data-model.md,
    contracts/ui-lockout.md,quickstart.md,tasks.md} MUST be regenerated against the
    revised spec (Revision 2026-07-19e) to reflect the re-expanded lockout scope,
    and the already-implemented code (T001–T008, per the 2.0.0-scoped design) MUST
    be extended to match before this feature is considered done.
-->

# Git Manager Constitution

## Core Principles

### I. System-Native Delegation

The application MUST use the system-installed `git` client for all repository
operations and MUST rely on the system's existing credential mechanism (git
credential helpers, SSH agent, OS keychain). The application MUST NOT bundle its
own git binary, store credentials, prompt for passwords, or reimplement git
plumbing (parsing git's own porcelain output being the sole permitted exception).

Rationale: Users already have a trusted, configured git. Re-inventing it invites
credential-handling risk and behavioral drift from the tool users verify against
on the command line. Shelling out keeps behavior identical to the terminal.

### II. Read-Only by Default, Destructive by Explicit Action

Background and on-demand activity (startup scan, manual refresh, fetch) MUST be
read-only and MUST NOT alter working trees, branches, history, or the filesystem.
Every mutating operation — pull, push, branch deletion, branch cleanup, worktree
removal, pull-all, repository deletion, repository clone — MUST be triggered by a
deliberate user action, never on a timer. Bulk and irreversible actions (branch
cleanup, deleting multiple items) MUST be presented one item at a time or require
explicit per-item confirmation.

Repository clone is an additive mutation: it creates a new working tree on disk (and
may begin observing its parent directory) but never deletes or overwrites existing
work — an existing non-empty destination MUST be refused, not merged into. It
therefore requires a deliberate action but not the named-confirmation tier reserved
for deletion.

Repository deletion is a distinct, higher-severity tier: it removes the directory
from disk, not just a git ref, and can destroy uncommitted or unpushed work. It
MUST require confirmation that names the repository being deleted (not a generic
"are you sure?") and MUST warn explicitly when the repository has uncommitted
changes or unpushed commits at the time of deletion.

Rationale: A repo dashboard that silently mutates state is a footgun. The user's
requirements draw a firm line between observing (automatic) and changing
(explicit); disk deletion sits above other mutations because, unlike a branch or
worktree, a deleted repository with unpushed work has no git-native recovery path.

### III. Never Resolve Conflicts — Fail Loud, Hand Off

The application MUST NOT attempt to resolve merge conflicts or perform interactive
merge/rebase resolution, and MUST NOT create a merge commit on the user's behalf
(no auto-merge). Pull-all MUST use `--autostash`. A deliberate update action (e.g.
Pull-all, Rebase worktrees) MAY bring a repository or worktree up to date by a
**non-interactive rebase** of its local commits onto its own resolved target —
Pull-all's tracked upstream, or Rebase worktrees' freshly-fetched default branch —
but ONLY when that rebase completes without conflict; on the first conflict it
MUST abort the rebase and restore the working tree to its exact prior state (no
rebase left in progress, uncommitted work preserved). When such an update cannot
complete cleanly by fast-forward or by such a conflict-free rebase, the operation
MUST stop for that repository or worktree, leave it in a state the user can
inspect, mark it as failed (light red), and direct the user to a dedicated merge
tool. The same fail-loud rule applies to push: a push rejected as non-fast-forward
(remote has diverged) MUST stop and surface the failure, never force-push or
attempt to auto-merge/rebase on the user's behalf.

Rationale: Conflict resolution is a high-stakes, context-dependent task. A
management dashboard that guesses will corrupt work. A non-interactive rebase that
aborts on the first conflict never guesses — it either replays local commits
cleanly (exactly what the user does by hand with `git pull --autostash`) or restores
the prior state untouched and hands off. Rewriting local history this narrowly is
safe and reversible; fabricating a merge commit is not, and remains forbidden.
Stopping and signalling on any conflict is both safer and simpler.

### IV. Always-Observable State

Repository state MUST be continuously visible and honestly colour-coded via a
per-row state indicator — a coloured leading-edge marker paired with a redundant
non-colour cue (a status glyph and the row's own text/counts) so state is
distinguishable without relying on colour. The state colours are: clean and in sync
= green, dirty working tree = blue, out of sync with upstream (commits to push or
pull) = amber/yellow, unavailable (unreadable or timed-out) = grey, and a failed
autostash pull = light red; when a repository is both dirty and out of sync, the
dirty (blue) indicator takes precedence. The indicator MUST NOT be a full-row
background fill, and colour MUST NOT be the sole signal of state. Each repo row MUST
surface at minimum its remote slug (its primary identifier), directory name, current
branch with tracking status (remote-tracked or local-only), and its local/ahead/behind
change counts; the full path MUST be available on demand (e.g., tooltip), except while a
long operation is running (below). Long or blocking operations MUST NOT freeze the UI.
While a long operation (Refresh, Pull all, Cleanup, Rebase worktrees, Clone) runs, the application MUST: (a)
prevent the *other* long-operation triggers from starting a second operation — at most
one long operation runs at a time — with each of those triggers showing its own busy or
non-interactive state; (b) block every other control that operates on repositories or
reconfigures what is shown — Settings, the Worktrees toggle, filter chips, the sort-header
row, and row-level actions (delete, custom launches) — so that nothing besides the loader
and the running trigger's own busy indicator remains active; (c) show the loader/progress
indicator over the repository table and dim the table's rows (repository rows and, when
shown, nested worktree rows) AND the sort-header row to barely-visible — these are the
only two things that visually dim; every other control blocked by (b) MUST NOT change
colour or opacity, showing only an inactive ("not-allowed") mouse cursor as feedback; and
(d) suppress a repository row's directory-path tooltip for the duration. This scope is
deliberate: the app still does NOT apply a whole-viewport dim and does NOT use a native
`inert` blanket lockout — each blocked control is blocked individually by its own render
logic, which is what keeps release settlement-based and per-control (Development
Workflow). Controls that have nothing to act on (e.g., bulk actions when no repositories
are discovered) MUST be blocked, while controls that can still make progress (e.g.,
Refresh on an empty list) MUST remain available. State MUST be refreshed at startup and
be re-derivable on explicit user demand; the application MUST NOT rely on automatic or
timed refresh to stay honest.

Rationale: The tool's entire value is at-a-glance truth about many repos. State that
is stale, hidden, misleading, or perceivable only by colour defeats the purpose; a
compact edge indicator plus a non-colour cue keeps the list dense, honest, and
accessible.

### V. Local-Only, Minimal Footprint

The application MUST run entirely on the user's machine. It MUST NOT send
telemetry or make HTTP/API calls of its own. Permitted outbound activity is limited
to: (1) git talking to its configured remotes; (2) opening user-invoked external
targets; and (3) the system `gh` CLI performing read-only repository discovery on the
user's explicit action (e.g., opening the Clone dialog), using the user's existing
`gh` authentication. In all three cases the app delegates to a system tool that holds
its own credentials — the app itself MUST NOT store, read, prompt for, or transmit any
token or password. `gh` is used exactly as `git` is: a system-native subprocess, never
bundled, never a source of credential handling. External targets are user-configured
launch commands — the app ships GitHub (in a browser), IntelliJ, VS Code, Finder, and
the terminal as seeded, editable defaults — which the app launches (never embeds) and
runs only on an explicit per-row user action, never on a timer. Repository-derived
values passed to launch or clone commands (the row's path, remote URL, and a clone
URL/destination) MUST be substituted as intact arguments, never spliced into command
text, so repository data can never be interpreted as executable command text. New
runtime dependencies MUST be justified against reuse of the platform, the system git
or gh, or a few lines of code (YAGNI).

Rationale: This is a personal local tool. Keeping it offline-by-design removes an
entire class of privacy and security concerns and keeps the surface small enough
to trust.

## Technical Constraints

- Platform: desktop application (Electron) targeting the user's local OS.
- External integrations are launch-only: the app resolves and invokes
  user-configured launch commands — seeded with GitHub URLs, IntelliJ, VS Code,
  Finder, and the default terminal as editable defaults — passing the repository
  path and remote URL as argument-safe substitutions; it does not embed the
  launched tools.
- Observed directories are user-configured, scanned at startup, and refreshed on
  explicit user demand; discovery MUST tolerate non-repo directories gracefully.
- Git interaction is via subprocess to the system `git`; parse porcelain/plumbing
  output rather than screen-scraping human-formatted output where a stable format
  exists.
- Repository discovery for clone autocomplete is via subprocess to the system `gh`
  CLI (`gh auth status`, `gh api`), requesting machine-readable JSON; it is read-only,
  uses the user's existing `gh` auth, and degrades gracefully to manual-URL clone when
  `gh` is unavailable.
- No persistent data store beyond local user configuration (observed directories,
  sort order, and equivalent settings).

## Development Workflow

- Changes MUST be surgical and match existing style; no unrequested refactors of
  adjacent code.
- Any code that mutates repository state (pull, push, delete, remove, clone) MUST
  leave at least one runnable check that fails if the guard or safety behavior breaks.
- A change that touches a mutating operation MUST be manually exercised against a
  real repository (including at least one conflict/failure path) before it is
  considered done.
- Simplicity is the default: prefer platform features and the system git over new
  dependencies; deliberate simplifications SHOULD be marked in-code as intent.

## Governance

This constitution supersedes ad-hoc practices for this project. Amendments MUST be
recorded by updating this file, bumping the version per the policy below, and
updating the Sync Impact Report at the top.

Versioning policy (semantic):
- MAJOR: removal or backward-incompatible redefinition of a principle or governance
  rule.
- MINOR: a new principle/section or materially expanded guidance.
- PATCH: clarifications, wording, and non-semantic refinements.

Compliance: every change to a mutating operation, background/scheduled behavior,
credential handling, or network activity MUST be reviewed against Principles I–V
before merge. Deviations MUST be justified in the plan's Complexity Tracking or
rejected.

**Version**: 5.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-23
