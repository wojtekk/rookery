# Phase 0 Research: Custom Per-Repository Action Launchers

All Technical Context items were resolvable from the spec, the constitution
(v1.4.0, amended this session), and the existing 001-repo-dashboard artifacts. No
open NEEDS CLARIFICATION remain. The spec's three clarify sessions plus the Codex
adversarial review already settled behavior (`${2}` semantics, no-confirmation
launch, seeded defaults, reorder mechanism, `${2}`-empty-value disable); this
research resolves the *how*.

## R1 — Launching a user command: shims resolve AND values stay argument-safe

**Decision**: In the main process, launch via the user's **login shell** with the
repository values bound as **shell positional parameters**, never concatenated into
the command text:

```
const shell = process.env.SHELL || '/bin/sh'
spawn(
  shell,
  ['-l', '-c', 'set -f; IFS=; ' + template, shell, pathValue, remoteUrl ?? ''],
  { detached: true, stdio: 'ignore' }
)
```

- The user's `template` (e.g. `code ${1}`, `open ${2}`) is passed verbatim as the
  shell script. `${1}`/`${2}` are *literally* shell positional-parameter syntax, so
  no token rewriting is needed — the shell binds `$1 = pathValue`, `$2 = remoteUrl`
  from the trailing argv.
- `pathValue` and `remoteUrl` are separate `argv` entries, so repository-derived
  data **never enters the command string**. This is exactly the Constitution v1.4.0
  argument-safe mandate and spec FR-005 ("intact argument, not text-splicing").
- `-l` runs a login shell so the user's profile `PATH` (nvm, Homebrew, VS Code's
  `code`, IntelliJ's `idea`) resolves the same as in a terminal (spec Assumption).
- `set -f; IFS=;` makes even an **unquoted** `${1}` word-split-safe and glob-safe,
  so a path like `/Users/me/my repo/*weird` reaches the command as one argument
  regardless of whether the user quoted the token in their template.
- `detached + stdio:'ignore'` so the launched GUI/CLI tool outlives the click and
  never blocks or ties its I/O to the dashboard (FR-006).

**Rationale**: This is the single construction that satisfies both spec assumptions
at once — *run through the user's shell* (shims) and *argument-safe substitution*
(injection-proof) — with no bespoke quoting/escaping code to get wrong. Because a
malicious or unusual value (a repo whose `.git/config` origin contains shell
metacharacters) arrives as a positional parameter, it cannot be interpreted as
command text. The command *template* is user-authored and therefore trusted — it is
their own config, equivalent to a line they'd type in a terminal — so arbitrary
shell there is intended, not a vulnerability.

**Alternatives considered**:
- *Regex-transform `${1}` → `"$1"` then run through the shell*: breaks when the
  token already sits inside the user's own quotes (`echo "at ${1}"` → an unquoted
  inner `$1`). The `set -f; IFS=` prefix is context-independent and needs no
  transform. Rejected.
- *Parse the template into argv ourselves and `spawn` without a shell*: loses shim
  and `PATH`/env resolution (the whole point of the shell assumption) and forces us
  to reimplement shell tokenization. Rejected.
- *`shell.openPath` / `shell.openExternal` (Electron) for the defaults*: clean for
  Finder/GitHub but would make the defaults special, non-editable primitives —
  contradicting FR-012 ("each default is an ordinary action the user can edit or
  remove"). Uniform command-string launch keeps one code path. Rejected as the
  primary mechanism (though `openExternal` remains the natural thing a user *writes*
  cross-platform; we simply seed `open`/`open -a` on macOS).
- *`child_process.exec(fullString)`*: would require splicing values into the string
  — the exact injection footgun the constitution forbids. Rejected outright.

**Ceiling (ponytail)**: `set -f; IFS=;` also disables word-splitting/globbing for
the rest of the template. Launch commands don't rely on those; a template that
does is out of scope. Documented in `contracts/launch.md`.

## R2 — Detecting launch failure without blocking (FR-007, SC-004)

**Decision**: Attach `error` and `exit` listeners before `unref()`, and resolve the
`runAction` IPC call after a short **grace window** (default ~500 ms, ≤ 2 s per
SC-004):
- `spawn` `error` event (e.g. shell itself missing → `ENOENT`) → failure.
- shell exits within the window with **127** (command not found) or **126** (found
  but not executable) → failure, reported as "‹action name› failed on ‹row›".
- otherwise → treat as launched (resolve success) and `unref()`.

**Rationale**: A successfully-launched GUI editor does not exit promptly (and a
terminal never does), so "process still alive" cannot mean success. But the two
failure modes users actually hit — *misspelled command* and *tool not installed* —
make the **shell** exit almost immediately with 127/126. Sampling the exit code for
a brief window catches those without waiting on long-lived children and without
blocking the UI (the IPC call is async and returns within the window). This is a
heuristic, not a guarantee — a command that fails *after* the window (e.g. the tool
launches then errors internally) is the tool's own concern, consistent with
"launch-only".

**Alternatives considered**: waiting for full process exit (never resolves for a
terminal); no failure detection at all (violates FR-007 / US3). Rejected.

## R3 — Where `${2}` comes from: retain the raw origin URL (don't re-probe)

**Decision**: 001's probe already runs `git config --get remote.origin.url` (P5) and
then parses it into `{host, slug}`, **discarding the raw string**. Retain the raw
URL on the `Remote` shape (`rawUrl`) so `${2}` has a verbatim value. No new git
call.

**Rationale**: The clarified `${2}` semantics are "the raw remote URL, verbatim"
(may be SSH- or HTTPS-form) — which is precisely P5's input before normalization.
Reusing it is a one-line "stop throwing it away," not a new probe (ponytail rung 2:
reuse what's already here).

**Key distinction (FR-013 correctness)**: "no remote" for the `${2}` disable rule
means **no origin URL configured at all**, *not* "URL present but unparseable".
001's `Remote` becomes `null` for *both* no-origin and unparseable-origin (e.g. a
local-filesystem remote). A repo with an unparseable-but-present origin still has a
valid `${2}`. Therefore `${2}`-enablement keys on "is a raw origin URL present",
tracked independently of whether `{host, slug}` parsed. See data-model.md.

**Alternatives considered**: running `git remote get-url origin` again at launch
time (redundant subprocess, and could disagree with the displayed row); deriving a
browsable web URL (explicitly rejected in clarify — `${2}` is raw). Rejected.

## R4 — Icon catalog: fixed, bundled, offline (FR-011)

**Decision**: Ship a small fixed set of SVG glyphs (devicon-inspired) under
`renderer/view/icons/`, indexed by a `catalog.ts` manifest (`id → svg`). An Action
stores the icon **id** (a reference), not image data. No network, no user uploads.

**Rationale**: FR-011 requires offline, no-network, no-uploads. Static bundled SVGs
referenced by id is the minimal footprint (Constitution V) and keeps `Action` a
small serializable record. devicon provides permissively-licensed glyphs for the
common tools; we vendor only the handful the defaults need plus a few extras.

**Alternatives considered**: a devicon npm/CDN dependency (network + a runtime dep
for a dozen glyphs — violates V); an icon-font (heavier, worse a11y than inline
SVG). Rejected.

## R5 — Seeding the five defaults on first run (FR-012)

**Decision**: `config.ts` seeds the actions list with the five defaults **only when
the settings file has never had an `actions` key** (true first run), so a user who
deliberately removes all actions (FR-009) is not re-seeded on next launch. Seeded
commands are macOS-form and ordinary/editable:

| Name | Icon id | Command (seeded) |
|------|---------|------------------|
| GitHub | `github` | `open ${2}` |
| IntelliJ | `intellij` | `idea ${1}` |
| VS Code | `vscode` | `code ${1}` |
| Finder | `finder` | `open ${1}` |
| Terminal | `terminal` | `open -a Terminal ${1}` |

**Rationale**: "First run" must be distinguishable from "user emptied the list", or
FR-009 (hide the menu when zero actions) would be defeated by re-seeding. Presence
of the `actions` key (even `[]`) is the sentinel — cheaper and clearer than a
separate "seeded" flag. Commands target the macOS dev platform (consistent with
001's macOS-first, OS-launchers-deferred stance); each is an editable action, so
adapting to another OS is data, not code.

**Alternatives considered**: a boolean `seeded` flag (redundant with key presence);
seeding whenever the list is empty (re-seeds after intentional removal — breaks
FR-009). Rejected.

## R6 — Reorder, limit, and `${2}`-enablement as pure logic

**Decision**: Put all non-UI decision logic in `shared/actions.ts` as pure
functions over the actions array: `moveUp/moveDown` (one position, clamped at ends,
FR-014), `canAdd` (length < `ACTION_LIMIT`, FR-003), `add/edit/remove`, and
`isActionEnabledForRow(action, row)` (`false` iff the command contains the literal
`${2}` token and the row has no raw origin URL, FR-013). `ACTION_LIMIT = 6` is a
single exported constant (FR-003).

**Rationale**: These are the testable invariants (limit never exceeded, order
changes are exact, `${2}` disable is correct) and the constitution's "one runnable
check" targets. Keeping them pure and Electron-free mirrors 001's `sort.ts` /
`filter.ts` and makes `actions.test.ts` trivial. The renderer and IPC layers stay
thin wrappers that persist and render the result.

**Alternatives considered**: embedding this logic in the settings view / IPC
handlers (untestable without Electron, and easy to drift between the Settings list
and the menu). Rejected.
