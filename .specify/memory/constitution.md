<!--
Sync Impact Report
==================
Version change: 1.3.0 → 1.4.0
Rationale: Reconcile Principle V + Technical Constraints with the custom
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

Templates reviewed:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic
     (reads from this file); no hardcoded principle names to update.
  ✅ .specify/templates/spec-template.md — no constitution-specific references.
  ✅ .specify/templates/tasks-template.md — no constitution-specific references.
  ✅ .specify/templates/checklist-template.md — no constitution-specific references.

Follow-up TODOs: none.
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
read-only and MUST NOT alter working trees, branches, or history. Every mutating
operation — pull, branch deletion, worktree removal, pull-all — MUST be triggered
by a deliberate user action, never on a timer. Bulk and irreversible actions
(delete branch, remove worktree) MUST be presented one item at a time or require
explicit per-item confirmation.

Rationale: A repo dashboard that silently mutates state is a footgun. The user's
requirements draw a firm line between observing (automatic) and changing
(explicit); the constitution makes that line non-negotiable.

### III. Never Resolve Conflicts — Fail Loud, Hand Off

The application MUST NOT attempt to resolve merge conflicts or perform interactive
merge/rebase resolution. Pull-all MUST use `--autostash`; when a pull cannot
complete cleanly, the operation MUST stop for that repository, leave the repo in a
state the user can inspect, mark it as failed (light red), and direct the user to a
dedicated merge tool.

Rationale: Conflict resolution is a high-stakes, context-dependent task. A
management dashboard that guesses will corrupt work. Stopping and signalling is
both safer and simpler.

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
change counts; the full path MUST be available on demand (e.g., tooltip). Long or
blocking operations MUST NOT freeze the UI. State MUST be refreshed at startup and be
re-derivable on explicit user demand; the application MUST NOT rely on automatic or
timed refresh to stay honest.

Rationale: The tool's entire value is at-a-glance truth about many repos. State that
is stale, hidden, misleading, or perceivable only by colour defeats the purpose; a
compact edge indicator plus a non-colour cue keeps the list dense, honest, and
accessible.

### V. Local-Only, Minimal Footprint

The application MUST run entirely on the user's machine. It MUST NOT send
telemetry or make network calls of its own; the only outbound activity permitted
is git talking to its configured remotes and opening user-invoked external targets.
External targets are user-configured launch commands — the app ships GitHub (in a
browser), IntelliJ, VS Code, Finder, and the terminal as seeded, editable defaults
— which the app launches (never embeds) and runs only on an explicit per-row user
action, never on a timer. Repository-derived values passed to these commands (the
row's path and remote URL) MUST be substituted as intact arguments, never spliced
into command text, so repository data can never be interpreted as executable
command text. New runtime dependencies MUST be justified against reuse of the
platform, the system git, or a few lines of code (YAGNI).

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
- No persistent data store beyond local user configuration (observed directories,
  sort order, and equivalent settings).

## Development Workflow

- Changes MUST be surgical and match existing style; no unrequested refactors of
  adjacent code.
- Any code that mutates repository state (pull, delete, remove) MUST leave at least
  one runnable check that fails if the guard or safety behavior breaks.
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

**Version**: 1.4.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-17
