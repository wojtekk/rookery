# Quickstart / Validation: Clone a Repository

End-to-end validation for feature 027. Automated checks run in CI (`pnpm test`); the
scenario walkthrough (A–L) must be driven by a human against the live Electron window
(an agent cannot drive real mouse/keyboard/dialog interaction — same "still owed"
caveat as prior features).

## Prerequisites

- Node 24 (`nvm use`), then `pnpm install`.
- System `git` on PATH (already required by the app).
- System `gh` on PATH, authenticated on ≥1 host (`gh auth status` shows success). For
  the manual-URL and gh-unavailable scenarios, no gh auth is needed.
- At least one observed directory already configured in Settings.

## Automated checks

```bash
nvm use
pnpm test          # builds, then runs node --test dist/tests/*.test.js
```

Expected: the existing suite plus the two new files pass —
- `tests/clone-search.test.ts`: `deriveRepoName` (ssh/https/.git/garbage → name|null),
  `rankCloneCandidates` (prefix>substring>owner ranking, ≤50 cap, empty-query head),
  `buildDestination` (single-separator join with/without trailing slash).
- `tests/clone-engine.test.ts`: `parseGhHosts` (success-account filter, malformed→[]),
  `parseGhRepoList` (JSONL parse, bad-line skip, host stamping), and real-`file://`-
  fixture `cloneRepository` outcomes: success, existing-non-empty-destination failure,
  invalid-URL failure. No network is used (a local bare repo is the clone source).

## Scenario walkthrough (manual, against `pnpm start`)

### A — Open the modal
Click **Clone** in the header. The modal opens; the search box shows an in-modal
loading state, then a ranked list of accessible repos. The app is **not** locked (you
can see the table behind the scrim; no loader over the table).

### B — Search & rank (P1, FR-002/003)
Type part of a repo name. Results narrow live; a name-prefix match sorts above a
mid-string match above an owner-only match; no more than 50 rows show.

### C — Pick a result fills URL + path (P1)
Select a result. The URL field fills with its **SSH** URL; the destination path
auto-fills as `<selected observed dir>/<repo-name>`.

### D — SSH/HTTPS toggle
Flip the scheme toggle to **HTTPS**; the URL field switches to the https clone URL.
Flip back to SSH.

### E — Change destination directory
Change the destination dropdown to a different observed directory; the path re-derives
to `<new dir>/<repo-name>` (because you haven't hand-edited the path yet).

### F — Hand-edit the path stops auto-fill (Edge Case)
Edit the destination path by hand. Now change the selected repo or the directory —
your hand-edited path is **not** overwritten.

### G — Successful clone (P1, FR-007/009/010)
With a valid selection and a fresh destination, click **Clone**. The app locks like
Pull all (table + sort-header dim, "Cloning…" loader; Refresh/Pull all/Cleanup/Rebase
and Settings all non-interactive). On success the modal closes, a notice confirms, and
the new repo appears in the table. If its parent directory wasn't observed before, it
is now (check Settings → Directories).

### H — Clone by pasted URL, no selection (P2, FR-004)
Reopen Clone. Without touching search, paste a full `git@…`/`https://…` URL into the
URL field. The path auto-fills from the URL's repo name. Clone succeeds.

### I — Failure keeps the modal open (P3, FR-011)
Attempt a clone into a destination that already exists and is non-empty (or paste a
bogus URL). The clone fails; the modal **stays open**, shows the specific git reason,
and your URL/destination input is intact. Fix the path and retry successfully.

### J — Mutual exclusion (FR-008)
Start a Pull all (or have one running), then observe the **Clone** button is disabled
(cursor `not-allowed`, no colour change). Conversely, while a clone runs, Pull all /
Cleanup / Rebase / Refresh / Settings are all blocked.

### K — Partial host availability (FR-013)
With two gh hosts configured, disconnect from one host's network (e.g. off-VPN for
`github.schibsted.io`) and hit the modal's **Refresh list**. Results from the reachable
host still appear; a dismissible note names the skipped host.

### L1 — gh not found → manual URL only (FR-012)
Temporarily rename/remove `gh` from PATH, then open Clone. The search area shows a clear
"GitHub CLI (gh) not found on PATH" reason instead of an empty list; the URL field and
destination remain fully usable and a URL clone still works.

### L2 — gh present but not signed in → actionable message (FR-012)
Restore `gh` to PATH but sign out of every host (`gh auth logout` on each, so
`gh auth status` shows no success), then open Clone. The search area shows a **distinct,
actionable** reason — "GitHub CLI is installed but not signed in — run `gh auth login` …" —
**not** the "gh not found" text from L1. URL + destination remain fully usable.

## Constitution re-check (post-implementation)

- Principle I: only `gh`/`git` subprocesses; no bundled binary, no token handling. ✅
- Principle II: discovery read-only; clone explicit, additive, never on a timer. ✅
- Principle IV: Clone is the 5th long op; same lock/dim rules. ✅
- Principle V (v5.0.0): the only new outbound activity is `gh`-to-GitHub for discovery,
  via the user's own auth; no app HTTP, no telemetry, no new runtime dependency. ✅
