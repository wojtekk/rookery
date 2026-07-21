# Quickstart: Rebase Diverged Repositories on Pull All

Validation guide. Automated checks prove the engine; the manual scenario proves the
end-to-end "Pull all" behavior the user reported (constitution: a mutating change MUST be
exercised against a real repo, including a conflict path).

## Prerequisites

```sh
nvm use            # Node.js 24 from .nvmrc
pnpm install
```

## Automated validation

```sh
pnpm test          # node:test — real-git fixtures in tests/update.test.ts
pnpm build         # tsc type/compile check
```

Expected: all tests pass, including the retargeted diverged-clean test and the new
`rebase-conflict` test. See `contracts/update-engine.md` → "Runnable checks" for the exact
cases and `data-model.md` → "Invariants" for what they assert.

## Manual end-to-end validation (real repo)

Reproduces the original bug against a real diverged repository, then the conflict path.

### Scenario A — diverged repo updates via rebase (the bug)

1. Pick (or create) a clone where you have **one local un-pushed commit** and the
   **upstream has advanced** with a commit that touches *different* files (i.e. genuinely
   diverged, no overlap). Optionally leave an uncommitted edit + an untracked file.
2. Confirm the manual baseline in a terminal on a throwaway copy: `git pull --autostash`
   updates it cleanly (this is what the user does today).
3. In the app (`pnpm start`), add the repo's parent directory, **Refresh**, then **Pull
   all**.
4. **Expected**: the row ends **updated** (not light-red). `git log --oneline` shows your
   local commit rebased on top of the upstream commit; **no merge commit**; your
   uncommitted edit and untracked file are back in the working tree.

### Scenario B — conflicting repo fails safely and explains itself

1. Make a clone diverge with a **conflict**: local commit and upstream commit edit the
   **same lines** of the same file. Optionally add a dirty edit + untracked file.
2. Record `git rev-parse HEAD` and the file contents.
3. In the app: **Pull all**.
4. **Expected**:
   - The row is **light-red** and appears under the **"Failed"** filter chip.
   - Hovering the ⚠ icon shows *"Update blocked — rebase hit a conflict; resolve it in your
     merge tool."*
   - `git rev-parse HEAD` is unchanged; local commits intact; the file has your original
     content (no conflict markers); `git status` shows **no rebase in progress**
     (`.git/rebase-merge` absent); your dirty edit and untracked file are restored.

### Scenario C — no regressions

1. A repo that is simply **behind** (no local commits) → **Pull all** → **updated**
   (fast-forward, as before).
2. A repo with only **local commits** (upstream unchanged) → **Pull all** → **up-to-date**,
   not failed.
3. A repo with **no tracked upstream** / **detached HEAD** → still skipped, no warn icon
   for no-upstream; detached shows its existing skip reason.

## Governance gate (blocking before merge)

Confirm the **Principle III amendment** has been recorded (run `/speckit-constitution` with
research.md Decision 6 wording; verify `.specify/memory/constitution.md` version bumped and
Sync Impact Report updated). FR-012 makes this a merge blocker.
