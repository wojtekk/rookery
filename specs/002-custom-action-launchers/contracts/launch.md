# Contract: Action Launch (main process → user command)

Defines exactly how `runAction` turns an `Action.command` template + a row's
`(path, remoteUrl)` into a running process. This is the feature's only new
trust-boundary crossing, so the substitution rule is normative and test-backed.

## Invocation

```
shell   = process.env.SHELL || '/bin/sh'
script  = 'set -f; IFS=; ' + action.command      // action.command verbatim; NOT modified per value
argv    = ['-l', '-c', script, shell, path, remoteUrl ?? '']
child   = spawn(shell, argv, { detached: true, stdio: 'ignore' })
```

The shell binds `$0 = shell`, `$1 = path`, `$2 = remoteUrl`. The template's `${1}` /
`${2}` are ordinary shell positional-parameter references, resolved by the shell to
the exact argv values.

## Normative substitution rule (FR-005, Constitution v1.4.0)

- `path` and `remoteUrl` are passed **only** as `argv` elements — they are **never**
  concatenated into `script`. Repository-derived data therefore cannot become
  executable command text, regardless of its contents.
- `set -f` (noglob) + `IFS=` (no word-splitting) make an **unquoted** `${1}`/`${2}`
  in the template safe: a value containing spaces, `*`, quotes, `$`, or backticks
  still reaches the command as a single intact argument.
- `-l` (login shell) sources the user's profile so CLI shims (`code`, `idea`, nvm/
  Homebrew tools) resolve exactly as in a terminal (spec Assumption).
- The command *template* is user-authored and trusted (their own config); arbitrary
  shell there is intended. The guarantee is only about the *substituted values*.

## `${2}` precondition (FR-013)

Before launching, if `action.command` contains the literal token `${2}` and
`remoteUrl` is `null`, `runAction` MUST NOT launch — it returns/rejects rather than
running with an empty value. (The renderer already disables such entries per row;
this is the main-side guard.)

## Failure detection (FR-007, SC-004 — research R2)

Non-blocking, via a grace window (default ~500 ms, ≤ 2 s):

| Signal within window | Result |
|----------------------|--------|
| `spawn` `error` event (e.g. shell `ENOENT`) | `{ok:false, reason}` |
| shell `exit` code `127` (command not found) | `{ok:false, reason}` |
| shell `exit` code `126` (found, not executable) | `{ok:false, reason}` |
| no early exit / error | `{ok:true}`, then `child.unref()` |

`reason` is suitable for a user-facing, action-and-row-specific message. Failures
after the window (the tool launched, then erred internally) are the tool's concern,
consistent with launch-only.

**Ceiling (ponytail)**: `set -f; IFS=` also disables globbing/word-splitting for the
rest of the template; launch commands don't depend on those. A template that needs
in-command word-splitting is out of scope. Grace-window classification is a
heuristic tuned to the two real failure modes (typo, tool-not-installed); it is not
a general command-success oracle.

## Tests (`tests/launch.test.ts`)

Pure/argument-safety assertions that need no real editor:
1. For `path` values containing space, `"`, `$(…)`, backtick, `;`, and `*`, the
   value observed by a stub command (e.g. template `printf '%s' ${1}` capturing
   argv/stdout) equals the input exactly — proving intact, no splicing, no
   interpretation. Same for `${2}`.
2. A template whose command does not exist (`no-such-cmd-xyz ${1}`) yields
   `{ok:false}` within the grace window (exit 127 path).
3. The `${2}`-with-null-remote precondition returns `{ok:false}`/rejects without
   spawning (FR-013 guard).
