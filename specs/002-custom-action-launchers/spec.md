# Feature Specification: Custom Per-Repository Action Launchers

**Feature Branch**: `002-custom-action-launchers`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "The per-row ⋮ kebab menu (GitHub/IntelliJ/VS Code/Finder/Terminal launchers). Commands and icons should be configurable in settings. User could define up to 6 icons (the number should be configurable in app as constant - might change in the future). When user configure new app he need to pick icon (a set of predefined icons, e.g. from devicon.dev), set the name, and set the command - path passed as a variable (${1})."

## Clarifications

### Session 2026-07-17

- Q: Should an action's command have access to the repository's remote URL as a second substitution value, or is this feature strictly local-path-only? → A: Add a second placeholder for the remote URL (`${2}`) alongside `${1}` for the local path — rows with no remote leave it empty.
- Q: Should the app add any confirmation/warning step before running a configured action? → A: No — actions run immediately on selection, like a desktop shortcut; no confirmation dialog at any point.
- Q: Should the actions list start pre-populated with 001-repo-dashboard's originally-envisioned five launchers (GitHub, IntelliJ, VS Code, Finder, Terminal), or start empty? → A: Pre-populate with those five as editable/removable defaults on first run.
- Q: How should a user reorder actions in Settings? → A: Up/down move buttons on each row in the actions list, one position at a time.
- Q: What value does the `${2}` placeholder substitute — a normalized browsable web URL or the raw remote URL? → A: The raw remote URL, verbatim (the value `git` reports for the row's origin, e.g. `git@github.com:owner/repo.git` or `https://github.com/owner/repo.git`) — not a normalized web URL; an action needing a browser URL is responsible for whatever transform it requires.
- Q: Now that `${2}` is the raw remote URL, how should the pre-populated GitHub default behave? → A: Keep GitHub as an ordinary `${2}`-based default that opens the raw remote URL verbatim (HTTPS remotes open a browsable page; SSH-form remotes open as-is and the user can edit the command). No web-URL normalization is introduced.
- Q: The above left SSH-form remotes opening as raw `git@host:owner/repo.git` strings, which `open` cannot resolve to a page (silent no-op on click) — should the GitHub default now convert SSH-form remotes to a browsable HTTPS URL itself? → A: Yes — the GitHub default's own command now strips a trailing `.git` and rewrites `git@host:owner/repo` / `ssh://git@host/owner/repo` to `https://host/owner/repo` before opening; `${2}` itself still substitutes the raw remote URL verbatim (unchanged for any other action), per the "responsible for whatever transform it requires" principle from the prior clarification.
- Q: The kebab (⋮) + dropdown pattern reused from 001-repo-dashboard's visual reservation turned out to have real problems — the dropdown could be clipped by the scrollable row list near the bottom, and the kebab itself was only visible on row hover. Should the presentation be redesigned instead of patched? → A: Yes — replace the hover-triggered kebab and its popup with the row's configured action icons rendered inline and always visible in the row (no click-to-reveal step, nothing that can be clipped by list scrolling); this supersedes the prior assumption that 001-repo-dashboard's hover-triggered visual reservation would be reused unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure and launch a custom action (Priority: P1)

A user wants to jump from a repository row straight into their own tools —
opening it in VS Code, IntelliJ, a terminal, or a browser at its GitHub page —
without leaving the dashboard. Today this menu is an empty, reserved slot; this
story lets the user define what appears in it, starting from a working set of
defaults (GitHub, IntelliJ, VS Code, Finder, Terminal) they can adjust from
day one.

**Why this priority**: This is the entire point of the feature — without at
least one configurable action, the row has no action icons to show and
there's no value delivered.

**Independent Test**: From Settings, add one action (icon: VS Code, name: "VS
Code", command: `code ${1}`). Its icon appears inline among any repository
row's action icons — no click to reveal it — and selecting it opens that
repository in VS Code.

**Acceptance Scenarios**:

1. **Given** a first run with no prior settings, **When** the dashboard loads,
   **Then** the actions list is already pre-populated with the five default
   actions (GitHub, IntelliJ, VS Code, Finder, Terminal) and their icons
   appear inline on every row without any setup.
2. **Given** the actions list, **When** the user adds a new action with an
   icon, a name, and a command containing `${1}`, **Then** the action is
   saved and its icon immediately appears inline on every row.
3. **Given** a configured action, **When** the user selects its icon on a
   row, **Then** the application runs the action's command with that row's
   own full path substituted for `${1}`, without freezing the dashboard.
4. **Given** a worktree row and its primary repository row have different
   paths, **When** the user runs the same action from each, **Then** each run
   uses that row's own path, not the other's.

---

### User Story 2 - Edit, reorder, and remove actions (Priority: P2)

A user's toolset changes over time — they switch editors, rename an action,
fix a typo in a command, or want their most-used action higher in the menu.
They need to manage the list they already built, not just add to it.

**Why this priority**: Without edit/reorder/remove, a mistake, a change of
tools, or an inconvenient order means throwing away and re-adding everything
below it in the list; this is a natural extension of P1's storage, not new
plumbing.

**Independent Test**: With one existing action, open Settings, change its name
and command, save, and confirm the row's icons reflect the new command
(tooltip name updates, click runs the new command). Then move an action up or
down and confirm the icon order changes to match. Then remove an action and
confirm its icon no longer appears on any row.

**Acceptance Scenarios**:

1. **Given** an existing action, **When** the user edits its icon, name, or
   command and saves, **Then** every row's inline icons reflect the change
   immediately.
2. **Given** an existing action, **When** the user removes it, **Then** its
   icon no longer appears on any row, and the remaining actions keep their
   relative order.
3. **Given** two or more configured actions, **When** the user moves one up or
   down using that row's move controls in Settings, **Then** the Settings list
   reflects the new order immediately, and every row's inline icons appear in
   that same new order.

---

### User Story 3 - Clear feedback when an action fails to launch (Priority: P3)

A user configures an action for a tool that isn't installed, or mistypes a
command. They need to know it didn't work — silently doing nothing is
indistinguishable from a slow launch.

**Why this priority**: Valuable but not blocking for the MVP — P1 already
requires *running* an action, and this story only refines what happens on the
uncommon failure path.

**Independent Test**: Configure an action with a command that doesn't exist
(e.g. `not-a-real-command ${1}`), run it, and confirm a clear error appears
naming the action, while the rest of the dashboard stays usable.

**Acceptance Scenarios**:

1. **Given** an action whose command cannot be launched (executable not
   found), **When** the user runs it, **Then** the application shows a
   non-blocking error identifying which action failed, and the row list
   remains fully interactive.

---

### Edge Cases

- What happens when the user has configured zero actions? No action icons
  MUST appear at all on any row (no empty affordance) — see FR-009.
- What happens when the user tries to add an action beyond the configured
  limit (default 6)? The "add action" control MUST be disabled with an
  explanation, rather than silently rejecting the save.
- What happens when the repository's path contains spaces or shell-special
  characters (`$`, `"`, `` ` ``, etc.)? The path MUST reach the command intact
  as a single argument — see FR-005's substitution rule — never string-spliced
  into the command text.
- What happens if the user deletes an action while it's rendered inline on
  rows elsewhere in the list? Since action icons are rendered inline (not a
  click-to-open popup), there is no separate "already open" state to go
  stale — every row's icons already reflect the current list on next render
  (FR-008).
- What happens when two actions are given the same name or icon? Both are
  allowed — name and icon are labels, not identifiers, and this feature does
  not need to disambiguate them beyond what the user typed.
- What happens when a command uses `${2}` (remote URL) on a row with no
  remote? That action MUST be disabled for that row instead of running with
  an empty value — see FR-013.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a Settings section where the user
  can view, add, edit, remove, and reorder (FR-014) custom actions.
- **FR-002**: Adding or editing an action MUST require the user to choose an
  icon from a predefined, bundled set (see FR-011), enter a non-empty display
  name, and enter a non-empty command.
- **FR-003**: The application MUST enforce a maximum number of configured
  actions, governed by a single constant (default value: 6). The add-action
  control MUST become disabled, with an explanation, once the limit is
  reached, and MUST re-enable when an action is removed.
- **FR-004**: Each row MUST show the user's configured actions as inline,
  always-visible icons, in the order the user arranged them, on every row —
  primary repositories and worktrees alike — with no click-to-reveal step.
- **FR-005**: Running an action MUST substitute the target row's own full path
  for the `${1}` placeholder, and its raw remote URL — the verbatim value of
  the row's configured origin as reported by `git` (which may be SSH-form,
  e.g. `git@github.com:owner/repo.git`, or HTTPS-form; not a normalized
  browsable web URL) when it has one — for the `${2}` placeholder, in its
  command — each as a single, intact argument (not
  by splicing the value into the command text), so paths or URLs containing
  spaces or shell-special characters cannot break or be interpreted as part of
  the command. A row with no remote (e.g. no configured origin) MUST NOT run
  any action whose command contains the literal `${2}` token — see FR-013 for
  the required disabled state.
- **FR-006**: Running an action MUST NOT block or freeze the dashboard; the
  user MUST be able to keep browsing, sorting, and launching other actions
  while a previously-launched action is starting up. Selecting an action MUST
  run it immediately, with no confirmation dialog beforehand — equivalent to
  double-clicking a desktop shortcut.
- **FR-007**: If an action fails to launch (e.g., the target program is not
  installed or the command is invalid), the application MUST show a clear,
  non-blocking error identifying which action failed and on which row, rather
  than failing silently or crashing — so two concurrent launches of the same
  action from different rows remain distinguishable.
- **FR-008**: The application MUST NOT require the user to leave the Settings
  view to verify an action was saved — the actions list shown in Settings MUST
  reflect adds, edits, and removals immediately.
- **FR-009**: When zero actions are configured — including after the user
  removes every pre-populated default (FR-012) — the application MUST show no
  action icons at all on any row (no empty or disabled affordance shown).
- **FR-010**: The list of configured actions MUST persist across application
  restarts, using the same settings persistence as the rest of the
  application's preferences.
- **FR-011**: Icon choices MUST come from a fixed set bundled with the
  application; the application MUST NOT require a network connection to
  display or choose icons, and MUST NOT accept arbitrary user-uploaded icon
  images in this feature.
- **FR-012**: On first run — before the user has ever added, edited, or
  removed an action — the application MUST pre-populate the actions list with
  five default actions: GitHub (opens the row's remote URL via `${2}` — `${2}`
  itself is still the verbatim `git` origin, but the GitHub default's own
  command converts an SSH-form origin to a browsable `https://` page before
  opening it, since `${2}` is not otherwise normalized for any other action),
  IntelliJ, VS Code, Finder, and Terminal (each opens the row's local path via
  `${1}`). Each default MUST be an ordinary action the user can edit or remove
  like any other (FR-001) — pre-population only seeds the initial list, it
  does not create a protected or special category of action. The default
  GitHub action is disabled on rows without a remote, per FR-013, like any
  other `${2}`-dependent action.
- **FR-013**: Before running an action, the application MUST check whether its
  command contains the literal `${2}` token; if it does and the target row has
  no remote, the application MUST disable that action's icon on that row
  (with a tooltip or equivalent explanation) rather than running it with an
  empty value — mirroring the disabled-with-explanation pattern used when the
  action limit is reached (FR-003). Actions whose command does not reference
  `${2}` are unaffected and remain enabled regardless of the row's remote
  status.
- **FR-014**: The application MUST provide up/down move controls on each
  action's row in the Settings list to reorder it one position at a time;
  each move MUST be reflected immediately in the Settings list (FR-008) and
  in every row's inline icons (FR-004).

### Key Entities *(include if feature involves data)*

- **Action**: A user-defined row-menu entry — an icon (reference into the
  predefined icon set), a display name, and a command template that may
  contain a `${1}` path placeholder and/or a `${2}` raw-remote-URL placeholder
  (the verbatim `git` origin value, not a normalized web URL — see FR-005).
  Actions have a user-controlled display order. An action referencing `${2}`
  is disabled on any row that has no remote (FR-013).
- **Action Settings**: The ordered list of the user's configured Actions,
  bounded by the action-limit constant (FR-003), persisted alongside the
  application's existing settings (observed directories, sort, worktree
  filter, default host).
- **Icon Catalog**: The fixed, bundled set of icon choices offered when
  configuring an Action (FR-011) — not user-extensible in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user has five actions available with zero
  configuration (FR-012) — the four local-path launchers (IntelliJ, VS Code,
  Finder, Terminal) launch out of the box, and the GitHub action opens the
  row's remote as a browsable page for both HTTPS- and SSH-form origins; a
  user can additionally add a new custom action (icon + name + command) and
  see its icon working inline on rows in under 30 seconds, without leaving
  the Settings view.
- **SC-002**: From any row, launching a configured action takes exactly one
  click on its inline icon — no separate step to reveal it first — and the
  row list remains scrollable and interactive while the action starts.
- **SC-003**: 100% of launched actions receive the correct row's own full path
  (`${1}`) and, for commands referencing `${2}`, the correct raw remote URL
  (the verbatim `git` origin value) — with
  such actions disabled rather than launched on rows without a remote
  (FR-013) — verified across primary-repository and worktree rows with
  distinct paths.
- **SC-004**: When an action fails to launch, a visible, action-specific error
  appears within 2 seconds, and no other row or action is affected.

## Assumptions

- **Substitution is argument-safe, not text-splicing**: `${1}` (path) and
  `${2}` (remote URL) behave like shell positional parameters — each value is
  passed as one intact argument to the command, never concatenated into the
  command string before it is parsed. This is the interpretation of the
  user's own `${1}` hint that avoids broken commands or shell injection from
  unusual paths/URLs (spaces, quotes, `$`, backticks), and keeps the
  substitution rule identical regardless of which shell or launcher ends up
  implementing it.
- **Commands run through the user's own shell environment**: so that CLI
  shims installed via the user's shell profile (e.g. VS Code's `code`,
  IntelliJ's `idea`, nvm/homebrew-managed tools) resolve the same way they
  would from a terminal, rather than a minimal environment that only knows
  the OS default `PATH`.
- **Actions are global, not per-repository**: the configured list applies
  uniformly to every row; this feature does not support a different action
  set per repository.
- **Icon catalog is a small, fixed, offline set bundled with the app**
  (inspired by common toolkits like devicon.dev for the glyphs), covering
  common editors/tools/launchers; expanding it later is a separate concern
  from this feature.
- **This feature supersedes the placeholder ⋮ menu reserved by
  001-repo-dashboard**: that feature reserved the layout slot and named a
  fixed launcher set (GitHub, IntelliJ, VS Code, Finder, Terminal) as a future
  feature; this feature turns that fixed set into the user-configurable,
  editable/removable defaults described in FR-012, rather than a hardcoded
  menu. 001-repo-dashboard's hover-triggered kebab + popup presentation was
  initially reused, but was replaced during this feature with the row's
  action icons rendered inline and always visible — see the final
  Clarifications entry.
- **No action runs automatically**: actions only run when explicitly selected
  from a row's inline action icons; nothing in this feature executes a
  configured command without a direct user action.
