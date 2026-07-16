# Quickstart & Validation: Local Repository Dashboard

A run + validation guide. Implementation detail lives in `tasks.md` (next phase)
and the source; this proves the feature works end to end and maps checks to the
spec's Success Criteria.

## Prerequisites

- Node.js (LTS) and npm.
- System `git` **>= 2.15** on `PATH` (`git --version`).
- macOS/Linux/Windows desktop session (Electron).

## Setup & run

```bash
npm install          # Electron + TypeScript (dev only); no runtime deps beyond Electron
npm run build        # tsc: compile main/preload/renderer/shared
npm start            # launch Electron
```

## Test (pure logic)

```bash
npm test             # node:test over compiled parse / identity / sort modules
```

Covers: porcelain v2 parsing (incl. no-upstream ⇒ tracking/ahead/behind absent),
canonical-identity dedup + family grouping, external-primary-in-scope handling,
and deterministic sort/tie-break.

## Validation scenarios (→ Success Criteria)

1. **List at a glance (SC-001, SC-003)** — point the app at a directory with
   several clones and launch. Each repo appears once with slug (+host), directory
   name, branch + tracking indicator, dirty count (only when > 0), and `x/y`
   ahead/behind. Cross-check a couple against `git status -sb` in a terminal.
2. **Path in tooltip (US1-2)** — hover a home-dir repo row; the full path shows
   `~`-shortened, untruncated, and is not its own column.
3. **State colors + non-color cue (FR-028, SC-008)** — make a repo dirty → blue
   row + dirty cue; make one ahead/behind (no dirty) → yellow + out-of-sync cue;
   confirm both states are distinguishable in a **grayscale screenshot** (color
   not the sole signal). Dirty + out-of-sync → blue (dirty wins).
4. **Worktree rows (Finding 2)** — a repo with a linked worktree on a different
   branch shows the worktree grouped beneath, with its **own** branch/tracking/
   dirty/ahead-behind and its own row color.
5. **External primary kept in scope (Finding 1)** — observe a directory that
   contains only a *worktree* whose primary lives elsewhere; the worktree appears
   flagged "primary outside observed directories" and no external path is shown.
6. **Manage directories persist (US2, SC — FR-015)** — add/remove a directory,
   restart; the observed set persists.
7. **On-demand refresh only (US3, FR-012)** — change a repo outside the app; the
   list updates only after a manual refresh, never on its own.
8. **Isolation under a hung repo (SC-007)** — simulate a stalled repo (e.g., a
   working tree on a stalled network mount); refresh completes for all others
   within normal time and the hung one shows `unavailable`.
9. **Read-only guarantee (SC-005)** — record `.git/index` mtime of a fixture,
   run a full refresh, confirm mtime unchanged.
10. **Git missing/old (FR-019, R7)** — run with git absent or < 2.15; the app
    reports it clearly instead of showing empty/misleading data.

## Non-goals to verify absent

No network traffic during scan/refresh (no fetch); no mutating actions (pull,
branch delete, worktree remove) — those are out of scope for this feature.
