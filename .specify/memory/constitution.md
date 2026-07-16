<!--
Sync Impact Report
==================
Version change: (uninitialized template) → 1.0.0
Rationale: Initial ratification of the project constitution (MAJOR baseline).

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

Background and scheduled activity (startup scan, periodic refresh, fetch) MUST be
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

Repository state MUST be continuously visible and honestly colour-coded:
uncommitted local changes MUST be highlighted (yellow) and failed autostash pulls
MUST be highlighted (light red). Each repo row MUST surface at minimum its short
path (`~`-relative), remote slug, current branch, and local/remote change counts.
Long or blocking operations MUST NOT freeze the UI, and refresh MUST run on a
user-defined interval.

Rationale: The tool's entire value is at-a-glance truth about many repos. State
that is stale, hidden, or misleading defeats the purpose.

### V. Local-Only, Minimal Footprint

The application MUST run entirely on the user's machine. It MUST NOT send
telemetry or make network calls of its own; the only outbound activity permitted
is git talking to its configured remotes and opening user-invoked external targets
(GitHub in a browser, IntelliJ, VS Code, Finder, terminal). New runtime
dependencies MUST be justified against reuse of the platform, the system git, or a
few lines of code (YAGNI).

Rationale: This is a personal local tool. Keeping it offline-by-design removes an
entire class of privacy and security concerns and keeps the surface small enough
to trust.

## Technical Constraints

- Platform: desktop application (Electron) targeting the user's local OS.
- External integrations are launch-only: the app resolves and invokes GitHub URLs,
  IntelliJ, VS Code, Finder, and the default terminal; it does not embed them.
- Observed directories are user-configured, scanned at startup, and refreshed on a
  user-defined interval; discovery MUST tolerate non-repo directories gracefully.
- Git interaction is via subprocess to the system `git`; parse porcelain/plumbing
  output rather than screen-scraping human-formatted output where a stable format
  exists.
- No persistent data store beyond local user configuration (observed directories,
  refresh interval, and equivalent settings).

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

**Version**: 1.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
