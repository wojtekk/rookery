# Developing Rookery

This document covers building, architecture, contributing, and releasing.
For what the app does and how to install a prebuilt version, see the
[README](../README.md).

## Running it locally

```bash
pnpm install          # Electron + TypeScript only; no runtime deps beyond Electron
pnpm run build        # tsc (main/preload/renderer, two separate module targets) + copy static assets
pnpm start            # build, then launch Electron
pnpm test             # build, then run node:test over the pure-logic modules + read-only probe assertion
```

Requires system `git >= 2.15` on `PATH` (needed for `--no-optional-locks`) and
Node.js 24 (pinned in `.nvmrc`; run `nvm use` first).

You can seed observed directories from the Settings modal, or by editing the
settings file the app reads on launch:

```jsonc
// macOS: ~/Library/Application Support/Rookery/settings.json
{
  "observedDirectories": ["/absolute/path/to/a/folder/of/repos"],
  "sortDimension": "slug",
  "sortDirection": "asc",
  "showWorktrees": true,
  "defaultHost": "github.com"
}
```

## Architecture

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
[`specs/001-repo-dashboard/contracts/ipc-api.md`](../specs/001-repo-dashboard/contracts/ipc-api.md)).
All git/filesystem work lives in `main/`. Within `main/git/`, the actual
subprocess calls (`probe.ts`) are kept separate from the pure parsing
(`parse.ts`) and identity/grouping logic (`identity.ts`) — same for
`renderer/view/sort.ts` and `filter.ts` — so the core logic is unit-testable
with `node:test` without spinning up Electron at all (see `tests/`).

Data flow for a refresh: `renderer.ts` calls `refresh()` over IPC → `scan.ts`
walks the observed directories and probes each working tree
(`git/probe.ts` → `git/parse.ts` → `git/identity.ts`, exact commands documented in
[`contracts/git-probe.md`](../specs/001-repo-dashboard/contracts/git-probe.md)) → the
resulting `Row[]` snapshot returns to the renderer, which sorts
(`view/sort.ts`), filters (`view/filter.ts`), and renders (`view/table.ts`,
`view/summary.ts`) it — all client-side, so switching sort/filter never
re-probes git.

## Contributing

This project is developed with GitHub's [Spec Kit](https://github.com/github/spec-kit)
workflow — every feature has a spec, a plan, and a task breakdown before code
is written. Contributions are expected to follow the same process rather than
landing as an unplanned pull request:

1. `specs/<NNN-feature-name>/` holds `spec.md` (requirements), `plan.md`
   (architecture/tech decisions), `tasks.md` (the checklist), and supporting
   docs (`data-model.md`, `contracts/`, `research.md`, `quickstart.md`).
2. Work happens in a git worktree under `.worktrees/`, never on `main`
   directly — `main` stays clean and checked out at all times.
3. [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) is
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

For a large change, open an issue first to agree on the approach before
writing code — small fixes can go straight to a pull request. Every push and
pull request runs the test suite automatically (see the Test badge in the
README); a pull request should have a green check before it's considered for
merge.

## Releasing it

Pushing a `v<major>.<minor>.<patch>` tag (e.g. `v1.2.0`) triggers
[`.github/workflows/release.yml`](../.github/workflows/release.yml): it builds
unsigned macOS, Windows, and Linux artifacts with
[`electron-builder`](https://www.electron.build/) in parallel, and only if
**all three** platforms succeed does it publish a single GitHub Release for
that tag with all three attached (`rookery-<version>.dmg`,
`rookery-<version>-setup.exe`, `rookery-<version>.AppImage`) — if any
platform fails, no release is created or updated. Re-pushing the same tag
replaces that release's assets rather than duplicating them.

To cut a release, run one command from `main`:

```bash
pnpm version 1.2.0        # or: patch / minor / major / prerelease --preid=alpha
```

This runs the test suite first and aborts if it fails (`preversion`), then
bumps `package.json`, commits (`vX.Y.Z`), tags, and pushes both the commit
and the tag (`postversion`) — which is what actually triggers the workflow
above.
