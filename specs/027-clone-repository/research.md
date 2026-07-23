# Research: Clone a Repository

Phase 0 decisions for feature 027. Each entry: Decision · Rationale · Alternatives
rejected. The bulk of the product decisions were resolved with the user in a
brainstorming session before `/speckit-specify`; this document records the
*technical* choices behind them and grounds them against the actual `gh`/`git`
behaviour observed on this machine (`gh` 2.96.0, `git` system).

## 1. Repository discovery: shell out to `gh` (constitution amendment)

**Decision**: Discover accessible repositories by shelling out to the system `gh`
CLI, exactly as the app shells out to system `git` (`git/probe.ts`, `update.ts`).
Two calls: `gh auth status --json hosts` to enumerate configured hosts, then
`gh api --paginate` per host to list accessible repos. No token is ever read or
stored by the app; `gh` uses the user's own keyring auth. This requires amending
Constitution Principle V (see §2).

**Rationale**: FR-002 needs the set of repos the user "has access to" — 1,000+
across many orgs, most not cloned locally. Only the user's authenticated GitHub
session knows that set. `gh` already holds that session (per `CLAUDE.local.md`,
multi-account). Delegating to it mirrors Principle I one-for-one with how `git` is
already trusted, and keeps the app free of any credential handling. The clone action
*itself* needs no amendment — `git clone` is "git talking to its configured remotes,"
already permitted by Principle V.

**Alternatives rejected**:
- *Direct GitHub REST/GraphQL from the app* (managing its own token): the app would
  handle credentials and make its own HTTP — a far deeper cut against Principles I/V
  than delegating to `gh`. Rejected in brainstorming.
- *No live list* (autocomplete only from already-cloned orgs/paths): fails FR-002 for
  repos not yet cloned — the whole point of the feature. Rejected in brainstorming.

## 2. Constitution amendment (Principle V) → v5.0.0 (MAJOR)

**Decision**: Amend Principle V to permit the system `gh` CLI as a second read-only,
system-native delegation for repository discovery, using the user's existing `gh`
auth, never storing a token; and add "Clone" to Principle IV's long-operation
enumeration and Principle II's mutating-operation list. Bump to **v5.0.0 (MAJOR)**.

**Rationale**: Principle V today permits outbound activity *only* from git-to-remotes
and launch targets, and states the app "MUST NOT make network calls of its own."
Discovery adds `gh`-to-GitHub. Narrowing that guarantee is backward-incompatible →
MAJOR, precisely as removing Principle III's "diverged repo left untouched" guarantee
was MAJOR in v4.0.0. The change is minimal (one delegated tool, read-only, no stored
credential, no new runtime dependency) and reversible.

**Alternatives rejected**: framing it as MINOR — rejected because the existing "no
network calls of its own" wording is a hard guarantee this removes, and the project's
own versioning policy classifies removing a guarantee as MAJOR.

## 3. Enumerating accessible repos: `gh api --paginate /user/repos`

**Decision**: Per host, run
`gh api --hostname <host> --paginate "user/repos?per_page=100&sort=full_name" --jq '.[] | {host:"<host>", owner:.owner.login, name:.name, sshUrl:.ssh_url, httpsUrl:.clone_url}'`.
Parse the newline-delimited JSON objects (one per repo, streamed across pages).

**Rationale**: `gh repo list` only lists a *single* owner's repos (`gh repo list
[owner]`), so covering 1,000+ repos across many orgs would require first enumerating
every org and issuing a call per org. The REST endpoint `/user/repos` returns, in one
paginated stream, every repo the authenticated user can access — owned, org-member,
and collaborator — which is exactly "repos I have access to" (FR-002). `--jq` shapes
each page into compact JSONL, so parsing is a robust line-by-line `JSON.parse` (easy
to unit-test with a captured fixture) rather than holding a giant array. `--paginate`
handles the ~10+ pages for 1k repos transparently.

**Alternatives rejected**:
- `gh repo list <owner> --limit N` per owner: needs a prior org-enumeration call and
  N× the requests; misses collaborator repos outside an org.
- One big `--json` array without `--jq`: larger buffer, and a single malformed byte
  fails the whole parse; JSONL degrades to "skip the one bad line."

## 4. Which hosts/accounts: all configured hosts, active account per host

**Decision**: `gh auth status --json hosts` returns `{ hosts: { <host>: [ { state,
active, login, host }, ... ] } }` (verified on this machine: `github.com` and
`github.schibsted.io`, each with an account). Query every host that has at least one
account with `state === "success"`. For a host with multiple accounts, the `gh api
--hostname <host>` call uses that host's **active** account.

**Rationale**: The clarified scope is "all configured gh hosts" (not just the active
one). Enumerating hosts from `auth status` and issuing one discovery call per host
covers `github.com` + `github.schibsted.io` in one refresh, no manual host-picking.
Querying a *non-active* second account on the same host would require `gh auth switch`
(a global side effect we must not trigger during a read-only discovery) — so the
active account per host is the pragmatic, side-effect-free scope.

**Limitation (documented, acceptable)**: repos visible only to a non-active account on
a host that has multiple accounts (e.g. `wojtekk` vs `wojciech-krawczyk_sch` both on
`github.com`) won't appear until the user makes that account active and hits the
modal's "Refresh list". Noted in `quickstart.md`. Manual URL clone (FR-004) always
works regardless. ponytail: per-account discovery via `GH_TOKEN` could be added later
if this limitation bites; not built now (YAGNI).

## 5. Caching: once per app session, in-memory, with explicit refresh

**Decision**: `listCloneableRepos()` caches its result in a module-level variable in
`clone-discovery.ts` for the app's lifetime (mirrors `config.ts`'s `cached`). A
`forceRefresh` argument (wired to a "Refresh list" control in the modal) bypasses and
replaces the cache. No disk persistence, no timer.

**Rationale**: The accessible set changes rarely within a working session; a first
fetch of 1k+ repos across hosts costs a couple of seconds and shouldn't be repaid on
every dialog open (clarified). In-memory matches the existing settings-cache pattern
and stays clear of Principle II's "never on a timer" (a disk cache refreshed in the
background would have needed a bigger amendment — rejected in brainstorming).

## 6. Pure/DOM module split for testability

**Decision**: Put the pure decision logic — `rankCloneCandidates`, `deriveRepoName`,
`buildDestination` — in a new DOM-free `src/renderer/view/clone-model.ts` (type-only
imports). The DOM modal (`view/clone.ts`) imports it. Main-side pure parsers
(`parseGhHosts`, `parseGhRepoList`) live in `clone-discovery.ts` (node builtins only,
no top-level side effects).

**Rationale**: `tests/` compiles as CommonJS (`tsconfig.json`) and can import a
renderer module only when that module has no DOM access and no runtime sibling imports
— which is exactly why `filter.ts`/`loadstate.ts`/`sort.ts` are unit-tested directly
but `table.ts`/`cleanup.ts` are not. Co-locating the pure helpers in the DOM modal
would make them untestable. This split is the established project convention.

**Alternatives rejected**: testing the modal via a DOM shim (jsdom) — adds a dev
dependency and a test style the project doesn't use. Rejected (Principle V / YAGNI).

## 7. The clone itself: `git clone` with the existing non-interactive env

**Decision**: `cloneRepository(url, destination)` runs
`git clone -- <url> <destination>` via the existing `runGit` helper, with
`update.ts`'s exported `NON_INTERACTIVE_ENV` (`GIT_TERMINAL_PROMPT=0`,
`GIT_SSH_COMMAND=ssh -oBatchMode=yes …`). `url` and `destination` are passed as
**separate argv entries** (never concatenated into a string), and `--` terminates
options so a hostile-looking URL/path can't be read as a flag. A longer timeout than
the 5 s probe default is used (clone can legitimately take a while).

**Rationale**: Reuses the app's proven git spine and its credential-prompt-disabling
env so a missing credential fails loud instead of hanging (Principle I). argv-not-string
substitution is the same argument-safety rule Principle V already mandates for launch
commands. `git clone` refuses a non-empty existing destination on its own, so no
app-side pre-check is needed — its stderr becomes the shown failure reason (FR-011).

**Alternatives rejected**: `gh repo clone` — would route the clone through `gh` and its
protocol preference rather than the exact URL/scheme the user chose in the modal;
`git clone` honours the user's SSH/HTTPS choice directly. Rejected.

## 8. Post-clone visibility: add the destination's parent to observed dirs

**Decision**: On a successful clone, if `dirname(destination)` is not already in
`observedDirectories`, the clone IPC handler adds it (via the existing settings write
path) before the renderer re-scans. The renderer then reloads settings and calls the
existing `doRefresh()`.

**Rationale**: `scan.ts` (`listChildDirs`) scans observed directories exactly **one
level deep** — each *child* of an observed dir is a candidate repo. So a clone at
`<dir>/<name>` is only discoverable if `<dir>` is observed. Watching the parent (the
clarified answer) makes the new repo appear as a child and surfaces future siblings
placed there; watching the clone directory itself would make it invisible (the scanner
would look *inside* the repo). This reuses the exact refresh-after-mutation pattern
that Pull all / Cleanup / Rebase already use.

**Alternatives rejected**: watch the clone dir itself (invisible under the 1-deep
scan — would need a scanner change); require the user to add the directory manually
(a confusing "where did my clone go" moment — rejected in brainstorming).

## 9. `gh` binary resolution / PATH

**Decision**: Invoke `gh` via `execFile('gh', …)` with `process.env`. If it fails with
`ENOENT` (not found), `listCloneableRepos` returns `searchAvailable: false` with the
reason "GitHub CLI (gh) not found on PATH", and the modal falls back to manual-URL-only
(FR-012).

**Rationale**: In development (`pnpm start` from a terminal) the app inherits the
shell PATH, so `gh` at `/opt/homebrew/bin/gh` resolves — same as `git` does today. A
*packaged* GUI app on macOS may not inherit a login-shell PATH (a known Electron
gotcha that already affects `git`); the graceful degradation to manual URL means a
missing `gh` never breaks the feature. ponytail: if the packaged app can't find `gh`,
resolve it through a login shell (`$SHELL -lc 'command -v gh'`) as `launch.ts` already
does for user commands — deferred until it's an observed problem, not a hypothetical.

**Alternatives rejected**: bundling `gh` — violates "no bundled binaries" (Principle I)
and adds tens of MB. Rejected.
