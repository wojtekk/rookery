# Local Repository Dashboard (git-manager)

A local, single-user Electron app that lists the git repositories you've cloned
on your own machine and shows their state at a glance — branch, tracking,
uncommitted changes, ahead/behind — without running `git status` in a terminal
across every folder yourself.

It is **read-only and local-only by design**: it shells out to your
already-installed system `git` (using your existing credentials) to inspect
repositories, never mutates a working tree, branch, or history, and makes no
network calls of its own. See [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
for the non-negotiable rules this project is built against.

Full requirements live in
[`specs/001-repo-dashboard/spec.md`](specs/001-repo-dashboard/spec.md); the
approved visual design is in
[`specs/001-repo-dashboard/design/README.md`](specs/001-repo-dashboard/design/README.md)
(with a static [interactive mockup](specs/001-repo-dashboard/design/dashboard-mockup.html)).
[`idea-box.md`](idea-box.md) is the original brain-dump this feature grew from —
several items there (pull, branch/worktree deletion, fetch-all, external-tool
launchers) are deliberately out of scope for this feature and deferred to later
ones.

## Current status

The MVP (point the app at a directory, see every repo grouped with worktrees,
sort and filter by state) is implemented. Managing observed directories from
the UI and an on-demand refresh button are the next increments — see
[`specs/001-repo-dashboard/tasks.md`](specs/001-repo-dashboard/tasks.md) for
the full task breakdown and what's done vs. pending.

Until directory management ships, observed directories are configured by
hand in the settings file (see [Running it locally](#running-it-locally)).

### Custom action launchers (feature 002)

Each repository row has a **⋮ menu of configurable launchers** — open the repo in
your editor, on its GitHub page, in Finder or a terminal, etc. Actions are managed
in Settings (icon + name + command) and seeded with sensible defaults on first run.
A command is a template run through your login shell, with the row's path (`${1}`)
and raw remote URL (`${2}`) passed as **shell positional parameters** — never spliced
into the command text — so repository values can't be interpreted as commands
(Constitution v1.4.0). See
[`specs/002-custom-action-launchers/`](specs/002-custom-action-launchers/).

## Top-level architecture

Standard Electron three-context split, plus a `shared/` module for the types
that cross the IPC boundary:

```text
src/
├── shared/
│   └── types.ts        # Row, Repository, WorkingTree(Entry), Head, Remote, Settings, RowState
├── main/                # Node context — the only place that touches git or the filesystem
│   ├── main.ts          # BrowserWindow, IPC handlers
│   ├── config.ts        # settings.json load/save (atomic write) in Electron's userData dir
│   ├── scan.ts          # walks observed dirs (1 level), bounded-concurrency + per-family timeout
│   └── git/
│       ├── probe.ts     # shells out to system git (--no-optional-locks, read-only)
│       ├── parse.ts     # pure: porcelain v2 / worktree-list / remote-url parsing
│       └── identity.ts  # pure: canonical identity, dedup, primary/worktree family grouping
├── preload/
│   └── preload.ts       # contextBridge: exposes a typed API as window.repoDashboard
└── renderer/             # Chromium context — no Node access, no filesystem, no git
    ├── renderer.ts       # bootstrap; owns view state (sort, state filter, worktree toggle)
    ├── index.html / styles.css
    └── view/
        ├── sort.ts       # pure: sort dimensions + deterministic tie-break
        ├── filter.ts     # pure: RowState derivation + state/worktree filtering
        ├── table.ts      # renders rows (state indicator, branch/tracking, counts, tooltip)
        ├── summary.ts    # fleet composition bar + state-filter chips
        └── toolbar.ts    # command bar controls
```

**Why it's split this way**: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true` — the renderer can only reach the system through the typed
`window.repoDashboard` API in `preload.ts` (contract:
[`specs/001-repo-dashboard/contracts/ipc-api.md`](specs/001-repo-dashboard/contracts/ipc-api.md)).
All git/filesystem work lives in `main/`. Within `main/git/`, the actual
subprocess calls (`probe.ts`) are kept separate from the pure parsing
(`parse.ts`) and identity/grouping logic (`identity.ts`) — same for
`renderer/view/sort.ts` and `filter.ts` — so the core logic is unit-testable
with `node:test` without spinning up Electron at all (see `tests/`).

Data flow for a refresh: `renderer.ts` calls `refresh()` over IPC → `scan.ts`
walks the observed directories and probes each working tree
(`git/probe.ts` → `git/parse.ts` → `git/identity.ts`, exact commands documented in
[`contracts/git-probe.md`](specs/001-repo-dashboard/contracts/git-probe.md)) → the
resulting `Row[]` snapshot returns to the renderer, which sorts
(`view/sort.ts`), filters (`view/filter.ts`), and renders (`view/table.ts`,
`view/summary.ts`) it — all client-side, so switching sort/filter never
re-probes git.

## Running it locally

```bash
pnpm install          # Electron + TypeScript only; no runtime deps beyond Electron
pnpm run build        # tsc (main/preload/renderer, two separate module targets) + copy static assets
pnpm start            # build, then launch Electron
pnpm test             # build, then run node:test over the pure-logic modules + read-only probe assertion
```

Requires system `git >= 2.15` on `PATH` (needed for `--no-optional-locks`).

Until the directory-management UI exists, seed the observed directories by
creating the settings file the app reads on launch:

```jsonc
// macOS: ~/Library/Application Support/git-manager/settings.json
{
  "observedDirectories": ["/absolute/path/to/a/folder/of/repos"],
  "sortDimension": "slug",
  "sortDirection": "asc",
  "showWorktrees": true,
  "defaultHost": "github.com"
}
```

## Contributing

This project is developed with the [Spec Kit](specs/) workflow — every
feature has a spec, a plan, and a task breakdown before code is written:

1. `specs/<NNN-feature-name>/` holds `spec.md` (requirements), `plan.md`
   (architecture/tech decisions), `tasks.md` (the checklist), and supporting
   docs (`data-model.md`, `contracts/`, `research.md`, `quickstart.md`).
2. Work happens in a git worktree under `.worktrees/`, never on `main`
   directly — `main` stays clean and checked out at all times.
3. [`.specify/memory/constitution.md`](.specify/memory/constitution.md) is
   non-negotiable: system git only (no bundled git/credentials), read-only
   background activity, no silent conflict resolution, always-observable
   state, local-only with no telemetry. Any change touching a mutating
   operation, background behavior, or network activity must be checked
   against it.
4. Pure logic (parsing, identity/grouping, sort, filter) stays
   dependency-free and gets a `node:test` in `tests/`; a change to a
   mutating or safety-relevant code path should leave at least one runnable
   check that fails if the guard breaks.
5. Keep diffs surgical — match existing style, don't refactor adjacent code
   you didn't need to touch, and don't add a dependency where a few lines of
   platform/stdlib code will do.

Before opening a change: `pnpm run build && pnpm test` must pass, and if it
touches the UI, exercise it against a real directory of repos (there's no
automated UI test suite by design — `quickstart.md` in each feature's spec
folder has the manual validation scenarios).

## Releasing it

There's no packaged distribution yet — this is a personal, single-user tool
run from source (`pnpm start`). If packaging ever becomes worth it (a signed,
double-clickable app instead of `pnpm start`), the natural next step is adding
[`electron-builder`](https://www.electron.build/) or
[Electron Forge](https://www.electronforge.io/) behind a new `package` script;
per the constitution's minimal-footprint principle, that's a dependency to add
only when actually needed, not preemptively.

Until then, "releasing" is just: merge the feature branch to `main`, bump
`version` in `package.json` if it's meaningful to you, and run it with
`pnpm start`.
