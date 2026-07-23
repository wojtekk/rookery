<img src="src/assets/icon.png" width="72" align="left">

# Rookery — Local Git Organizer

[![Test](https://github.com/wojtekk/rookery/actions/workflows/test.yml/badge.svg)](https://github.com/wojtekk/rookery/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-blue)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/wojtekk/rookery)](https://github.com/wojtekk/rookery/releases/latest)

**Manage all your local git repositories from one window.** Rookery lists every
repository across the folders you point it at, shows the state of each one at a
glance — branch, tracking, uncommitted changes, ahead/behind — and lets you
update, rebase, tidy, clone, and open them without a single `cd` or `git status`
in a terminal.

<br clear="left">

![Rookery](docs/assets/rookery-screen-1.png)

## Requirements

Rookery drives your **system `git`** (≥ 2.15) for everything it does — listing,
pulling, rebasing, and cleaning up — so that must be installed and on your
`PATH`.

The **Clone** feature also leans on the [**GitHub CLI (`gh`)**](https://cli.github.com/)
for its headline convenience: type-ahead search across every repository your
GitHub accounts can reach. Rookery calls `gh` with its own existing login and
never touches a token. Install it and run `gh auth login` once to unlock search;
without `gh` you can still clone any repository by pasting its HTTPS/SSH URL.

## Who it's for

If you juggle a dozen checkouts — microservices, forks, client projects, a pile
of side repos — you know the daily tax: which ones are behind, which have
uncommitted work, which branch am I even on, which have dead `[gone]` branches
piling up. Rookery answers all of that in one table and turns the routine
maintenance into single clicks. **One button pulls every repository. One button
rebases every worktree. One button cleans up the cruft.**

## What it does

### See every repository's state at a glance

Point Rookery at one or more directories and it lists every repository inside
them, colour-coded by state: clean, uncommitted changes, out of sync with the
upstream, or unavailable. Linked worktrees appear grouped under their primary
repository. **Search** narrows the list as you type (by slug, folder, remote
URL, or branch); **filter chips** show only the repositories that need attention
— uncommitted, out of sync, failed, gone-upstream, or local-only.

Linked worktrees nest under the primary repository they belong to — the
"family" that "Rebase worktrees" (below) operates on as a unit:

```text
📁 ~/Developer/projects/
 ├── 📦 primary-app/ (Primary Repo — main)
 │    ├── 🌿 feature/login (Linked Worktree)
 │    └── 🌿 fix/auth-bug  (Linked Worktree)
 │
 └── 📦 payment-service/ (Primary Repo — main)
      └── 🌿 feature/stripe-v2 (Linked Worktree)
```

### Update many repositories at once — "Pull all"

**Pull all** brings every eligible repository and worktree up to date with its
tracked upstream in one pass, and it is careful about your work:

- Uncommitted changes are **autostashed** first and restored afterward, so a
  dirty checkout never blocks the update.
- A repository that only needs to move forward is **fast-forwarded**.
- A repository with local commits *and* new upstream commits is **rebased**
  non-interactively onto the upstream. A clean rebase replays your commits on
  top; a rebase that would conflict is **aborted and the repository restored
  exactly as it was** — Rookery never resolves a conflict for you or invents a
  merge commit.

Anything that can't be updated is reported, not swallowed: hover the warning
icon on a row to see *why* — diverged, unreachable remote, stash failed, timed
out, detached HEAD, and so on.

```text
                                    ┌──────────┐
                                    │ Pull all │
                                    └────┬─────┘
                                         │
                            [ Autostash dirty changes ]
                                         │
                                         ▼
                                Compare to upstream
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               ▼                         ▼                         ▼
          (Up to date)                (Behind)                 (Diverged)
               │                    Fast-forward          Rebase onto upstream
               │                         │                         │
                                                         ┌─────────┴─────────┐
               │                         │               ▼                   ▼
               │                         │            (Clean)            (Conflict)
               │                         │        Replayed on top       Abort rebase
               │                         │               │          (restored as before)
               │                         │               │                   │
               └─────────────────────────┼───────────────┴───────────────────┘
                                         │
                               [ Restore autostash ]
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               ▼                         ▼                         ▼
      ┌─────────────────┐           ┌─────────┐        ┌────────────────────────┐
      │ Already current │           │ Updated │        │ Reported with a reason │
      └─────────────────┘           └─────────┘        └────────────────────────┘
```

### Rebase every worktree onto the default branch — "Rebase worktrees"

**Rebase worktrees** replays each linked worktree's branch onto its family's
freshly-fetched default branch (`origin/main` or equivalent). This closes the
gap Pull all leaves: feature-branch worktrees with no upstream, and worktrees
that track their own branch rather than `main`. It reuses the same
non-destructive spine — autostash, rebase, restore, and abort-and-restore on the
first conflict — so nothing is lost and nothing is force-merged. Because it
rewrites history, Rookery warns you once before the first run (with a
"don't remind me again" option you can re-enable in Settings).

```text
                    ┌──────────────────┐
                    │ Rebase worktrees │
                    └────────┬─────────┘
                             │
             [ Fetch origin default branch ]
                             │
                  For each linked worktree
                             │
                  [ Autostash if dirty ]
                             │
                Rebase branch onto default
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
                (Clean)            (Conflict)
            Replayed on top       Abort rebase
                   │                   │
                   └─────────┬─────────┘
                             │
                  [ Restore autostash ]
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
           ┌──────────────┐  ┌──────────────────────┐
           │   Rebased    │  │ Reported with reason │
           └──────────────┘  └──────────────────────┘
```

A repository with no linked worktree is skipped, and a failed `fetch` marks
that family's worktrees as reported rather than rebasing them.

### Clean up gone branches and stale worktrees — "Cleanup"

**Cleanup** finds branches whose upstream is gone (merged-and-deleted pull
requests) and worktrees that no longer belong, then removes them — but only
after showing you a **review list of exactly what will be deleted**, per
repository, for you to confirm. Nothing is removed without your say-so.

```text
  ┌─────────┐      ┌───────────────────┐      ┌───────────────────────────┐
  │ Cleanup ├─────►│ Scan repositories ├─────►│ Find gone branches        │
  └─────────┘      └───────────────────┘      │ + stale worktrees         │
                                              └─────────────┬─────────────┘
                                                            │
                                                            ▼
                                              ┌───────────────────────────┐
                                              │ Review list you approve   │
                                              └─────────────┬─────────────┘
                                                            │
                                           ┌────────────────┴────────────────┐
                                           ▼                                 ▼
                                       (Confirm)                         (Cancel)
                                    ┌─────────────┐                 ┌────────────────┐
                                    │   Deleted   │                 │ Nothing removed│
                                    └─────────────┘                 └────────────────┘
```

### Open each repository in your preferred apps

Every row has a **⋮ menu of launchers you configure**: open the repo in your
editor, on its GitHub page, in Finder, in a terminal — whatever you use. Add,
name, and icon your own actions in Settings; sensible defaults are seeded on
first run. Commands run through your login shell with the repository's path and
remote URL passed as **shell arguments, never spliced into the command text**,
so a repository's own values can't be mistaken for commands:

```text
❌ Spliced into command text (vulnerable)
┌──────────────────────────────────────────────────────────────────────────┐
│ Command: code my-repo; rm -rf ~                                          │
│ Result : Shell parses `;` and runs BOTH `code` AND the injected command  │
└──────────────────────────────────────────────────────────────────────────┘

✔ Passed as positional parameters (Rookery's method)
┌──────────────────────────────────────────────────────────────────────────┐
│ Template: code $1                                                        │
│ Param   : $1 = "my-repo; rm -rf ~"  (literal string)                     │
│ Result  : `;` is a plain character in the path name, NEVER run           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Clone a new repository

The header **Clone** action clones a remote onto disk. Start typing and it
autocompletes across every repository you can access — discovered through the
optional `gh` CLI using its own existing login (Rookery never handles a token) —
or paste any HTTPS/SSH URL, which works even without `gh`. Choose a destination
from your watched folders or browse to a new one; on success the new repo
appears in the table right away.

### Watch multiple directories, and drop the ones you don't want

Manage the set of watched directories in Settings — add a folder of repos, or
remove one you no longer care about. To hide a single repository from the table,
delete its row (this removes only the row from Rookery's view; deleting a
worktree runs the proper `git worktree remove`).

Watched directories pair naturally with a **domain-driven workflow**: group your
repositories into business domains (one watched folder each), keep `main`
pristine and do all work in Git worktrees, and give each level its own
`CLAUDE.md` so AI coding agents get exactly the context they need. Worktrees you
create show up nested under their primary repo in the table. The full
methodology, with directory layouts and ready-to-use `CLAUDE.md` templates, is in
[`docs/workflow.md`](docs/workflow.md).

## Local-only and safe by design

Rookery makes **no network calls of its own**. It shells out to the system `git`
you already have, using your existing credentials, and every background
inspection is **read-only**. Nothing is uploaded, no telemetry is collected, and
every action that changes your repositories is one you clicked. The
non-negotiable rules the app is built against live in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

The only traffic that ever leaves your machine is your own `git` reaching your
remotes and the optional `gh` CLI reaching the GitHub API — each with *your*
existing credentials, never anything Rookery originates:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Your Machine — Rookery originates NO network traffic                        │
│                                                                             │
│   ┌──────┐         ┌─────────────────────────┐                              │
│   │ You  ├────────►│   Rookery (Local UI)    │                              │
│   └──────┘         └──┬────────────────────┬─┘                              │
│                       │                    │                                │
│    Read probes /      │                    │ Clone search (Optional)        │
│    Pull / Rebase      ▼                    ▼                                │
│                 ┌────────────┐         ┌────────┐                           │
│                 │ System git │         │ gh CLI │                           │
│                 └─────┬──────┘         └───┬────┘                           │
│                       │                    │                                │
│                       ▼                    │                                │
│         ┌───────────────────────────┐      │                                │
│         │ Watched repos & worktrees │      │                                │
│         └─────────────┬─────────────┘      │                                │
└───────────────────────┼────────────────────┼────────────────────────────────┘
                        │                    │
             Fetch/Pull │                    │ GitHub API
       (Your SSH/HTTPS) │                    │ (Its own login/token)
                        ▼                    ▼
              ┌───────────────────┐  ┌────────────────┐
              │    Git Remotes    │  │  GitHub Host   │
              └───────────────────┘  └────────────────┘
```

## Download

Prebuilt macOS, Windows, and Linux builds are published on the
[GitHub Releases page](https://github.com/wojtekk/rookery/releases/latest) for
every tagged version. Builds are unsigned, so your OS warns you the first time
you open one:

- **macOS**: Gatekeeper blocks the `.dmg`'s app with "cannot verify developer."
  Right-click (or Control-click) the app → **Open** → **Open** again. Only
  needed the first time.
- **Windows**: SmartScreen shows "Windows protected your PC." Click
  **More info** → **Run anyway**.

Requires system `git >= 2.15` on your `PATH`.

## Build from source

Rookery builds with `pnpm` and Node.js 24 (`nvm use`). For the exact
commands plus the architecture, contributing guidelines, and release
process, see [`docs/development.md`](docs/development.md).

## License

Rookery is licensed under the **MIT License, modified by the Commons Clause
License Condition 1.0** — see [`LICENSE`](LICENSE) for the full text. In plain
language: anyone, including businesses, is free to use, run, modify, and
contribute to the project; what's **not** permitted is selling the software
itself, or a product or service whose value comes substantially from it, for a
fee. This makes Rookery **source-available** rather than OSI-approved open
source — the sales restriction is exactly what the Open Source Definition
disallows.
