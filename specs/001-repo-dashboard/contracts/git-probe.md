# Contract: Git Probe (main process → system git)

Defines the exact git invocations and how their output maps to model fields. Every
invocation is **non-mutating** and prefixed with `--no-optional-locks` where it
touches status, so the git index/stat cache is never rewritten (FR-011, SC-005;
verified: plain `git status` rewrites `.git/index` when there is stale stat info to
flush, `--no-optional-locks` does not — see the read-only test note below). Each
call runs with `cwd = <workingTreeDir>` (`-C <dir>`).

**Timeout model (FR-027, authoritative):** the 5 s default budget is **per
working-tree inspection**, not per subprocess. A primary's inspection is P1+P2+P3+P5
plus P4 plus P1–P3 for each worktree — potentially many sequential spawns — so a
per-call `spawn` timeout alone (which is per-process) would let worst-case time grow
with worktree count. The inspection MUST therefore be wrapped in a single
family-level deadline (e.g. `Promise.race` against a 5 s timer) that, on expiry,
kills every in-flight child for that family and marks it `unavailable`. Each spawn
additionally carries a `spawn` `timeout`/`killSignal` as a per-process backstop.
Inspections run in a bounded concurrency pool so families are isolated (SC-007).

## P1 — Validity + identity
```
git -C <dir> rev-parse --is-inside-work-tree --absolute-git-dir --git-common-dir --show-toplevel
```
- line 1 `true` → it is a working tree (else: not a repo, skip — FR-004).
- line 2 ownGitDir — the working tree's **own** git-dir (absolute). Use
  `--absolute-git-dir` rather than assuming `<dir>/.git`, so non-standard layouts
  (`GIT_DIR`, separate git dir, a linked worktree whose `.git` is a *file*) are
  handled correctly.
- line 3 gitCommonDir — **may be relative** (e.g. `.git`); resolve against `<dir>`
  then `realpath` before use.
- line 4 topLevel (absolute).
- Canonical identity = `(realpath(resolve(dir, gitCommonDir)), realpath(topLevel))`.
- Primary iff `realpath(ownGitDir) == realpath(resolve(dir, gitCommonDir))` (own
  git-dir equals the common git-dir). A linked worktree's own git-dir is
  `<common>/worktrees/<name>`, so this is false for worktrees — matching the
  identity definition in research R2 / spec.md.

## P2 — Branch, tracking, ahead/behind, dirty count (the linchpin)
```
git -C <dir> --no-optional-locks status --porcelain=v2 --branch
```
Parse header lines and entries:
| Output | Field |
|--------|-------|
| `# branch.head <name>` | `branch` (name); `(detached)` → `detached=true`, `branch=null` |
| `# branch.upstream <ref>` present | `tracking='tracked'`; **absent** → `tracking='local-only'`, `ahead/behind=null` |
| `# branch.ab +<x> -<y>` | `ahead=x`, `behind=y`; **absent** (no upstream) → `null`/`null` |
| count of `1`/`2`/`u`/`?` entry lines | `local` (dirty count; untracked `?` included, gitignored excluded) |

Verified: with no upstream, `# branch.upstream` and `# branch.ab` are omitted —
their absence is the authoritative local-only / unavailable signal.

## P3 — Last change time (sort key)
```
git -C <dir> --no-optional-locks log -1 --format=%cI
```
- ISO commit date of HEAD → `lastChange`.
- Non-zero exit / empty (unborn HEAD) → `lastChange=null` (sorts last).

## P4 — Linked worktrees (primary only)
```
git -C <dir> worktree list --porcelain
```
- Emits `worktree <path>` / `HEAD <oid>` / `branch <ref>` blocks. Enumerates the
  family; each linked worktree is then probed with P1–P3 for its own fields —
  worktrees get full branch/tracking/local/ahead/behind (see research R2 findings
  note; FR-023).

## P5 — Slug + host
```
git -C <dir> config --get remote.origin.url
```
Normative parse strategy — cover all standard git remote URL syntaxes, extract
`host` + `owner/repo`, strip a trailing `.git`, drop any `user@`/userinfo and
`:port`:
| Form | Example | host / slug |
|------|---------|-------------|
| scp-like SSH | `git@github.com:owner/repo.git` | `github.com` / `owner/repo` |
| `ssh://` (opt. user/port) | `ssh://git@github.schibsted.io:22/owner/repo.git` | `github.schibsted.io` / `owner/repo` |
| `git://` | `git://github.com/owner/repo.git` | `github.com` / `owner/repo` |
| `http(s)://` (opt. userinfo/port) | `https://user@github.com:443/owner/repo.git` | `github.com` / `owner/repo` |

- `slug` = the path with leading slash and trailing `.git` removed (may contain more
  than two segments for nested groups, e.g. GitLab subgroups — keep the full path).
- Only when the URL matches **none** of these (e.g. a local filesystem path remote)
  → `slug=host=null` (row falls back to `directoryName`, FR-006/FR-018). A valid but
  unlisted URL scheme MUST NOT silently degrade to null identity.
- Contract tests MUST include a fixture per scheme above plus a genuinely
  unparseable remote, asserting correct host/slug (or null only for the last).

## Read-only assertion (test hook)
A contract test asserts that running the full probe sequence leaves `.git/index`
unchanged (SC-005). **The fixture MUST force the racy-stat condition**, otherwise
the test passes trivially: git's index rewrite is *opportunistic* — plain
`git status` only flushes the index when a tracked file's stat-cache is stale, so on
a pristine fixture even a mutating (flag-less) command path would leave the index
untouched and the test would give false confidence.

Required fixture setup (so the check actually fails if `--no-optional-locks` is
dropped):
1. Create a repo, commit a tracked file.
2. Rewrite that file with identical content but a new mtime (e.g. `touch` then
   overwrite) so the stat-cache is stale but the diff is empty.
3. Record `.git/index` mtime + size.
4. Run the full probe sequence.
5. Assert `.git/index` mtime + size are unchanged.

A control assertion (running plain `git status` on the same staged fixture *does*
change the index) documents that the fixture genuinely triggers the write.
