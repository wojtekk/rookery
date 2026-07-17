# Quickstart: Custom Per-Repository Action Launchers

Validation guide for the feature. Assumes the 001-repo-dashboard app runs (see
[001 quickstart](../001-repo-dashboard/quickstart.md) for `npm install` / `npm
start`). This feature adds no new dependency.

## Run

```bash
npm start            # launch Electron; the ⋮ menu is now populated
```

## Test (pure logic + launch safety)

```bash
npm test             # node:test: existing 001 suites + actions.test.ts + launch.test.ts
```

Covers: action-list ops (add/edit/remove/move within `ACTION_LIMIT`),
`${2}`-enabled-for-row (FR-013), the seed set (FR-012), and the launch
argument-safety contract (values with spaces/quotes/`$`/backticks reach the command
intact; a missing command is classified as failure).

## Validation scenarios (→ Success Criteria)

1. **Defaults on first run (SC-001, FR-012)** — with no prior settings (or a fresh
   `userData`), launch the app. Every row's ⋮ menu already lists GitHub, IntelliJ,
   VS Code, Finder, Terminal. Selecting VS Code / Finder opens the repo. → the four
   `${1}` launchers work out of the box; GitHub opens the row's raw origin URL.

2. **Add a custom action in < 30 s (SC-001, US1-2)** — Settings → add: icon, name
   "VS Code Insiders", command `code-insiders ${1}`. Save. Without leaving Settings,
   the list shows it immediately (FR-008); open any row's ⋮ menu — it appears.

3. **Launch uses the row's own path (SC-003, US1-3/4)** — from a primary row and one
   of its worktree rows (distinct paths), run the same `${1}` action. Each opens its
   **own** path. Try a repo whose directory has a space in its name — it still opens
   correctly (argument-safe substitution, FR-005).

4. **`${2}` raw remote (SC-003, clarify)** — run GitHub on a row whose origin is
   HTTPS-form → a browsable page opens. On an SSH-form origin (`git@…`) it opens the
   raw value verbatim (expected per the clarified raw-`${2}` decision).

5. **`${2}` disabled on remote-less rows (FR-013)** — find/create a repo row with no
   `origin`. Its ⋮ menu shows the GitHub (and any `${2}`) action **disabled** with a
   "no remote" explanation; `${1}` actions stay enabled. It never launches with an
   empty value.

6. **Edit / remove / reorder (US2, FR-014)** — edit an action's name+command; the ⋮
   menu reflects it on next open. Move an action up/down in Settings; the ⋮ menu
   order matches immediately. Remove one; it disappears from every menu.

7. **Limit reached (FR-003)** — add actions until `ACTION_LIMIT` (6) is hit. The add
   control disables with an explanation; remove one → it re-enables.

8. **Empty state hides the menu (FR-009)** — remove every action. The ⋮ menu no
   longer appears on any row (no empty affordance). Restart → still empty (not
   re-seeded, research R5).

9. **Failure is visible and isolated (SC-004, US3, FR-007)** — add an action
   `not-a-real-cmd ${1}` and run it. A non-blocking, action-and-row-specific error
   appears within 2 s; the rest of the dashboard stays scrollable and interactive.

10. **Non-blocking launch (SC-002, FR-006)** — run a slow-to-appear GUI action and
    immediately scroll/sort the list. No freeze; no confirmation dialog precedes the
    launch.

## Constitution spot-check (v1.4.0)

- No network call originates from the app during any of the above (only git and the
  user-invoked launches). Principle V.
- Launches happen only on explicit ⋮ selection, never during scan/refresh or on a
  timer. Principle II/V.
- Substituted path/URL never appear as command text (verified by
  `tests/launch.test.ts`, not just by eye). Principle V argument-safe mandate.
