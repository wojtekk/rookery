# Quickstart & Validation: Update All Repositories

Runnable validation for the feature. Assumes the repo builds (`pnpm build`) and
the app launches (`pnpm start` / the project's run skill). System `git` ≥ 2.15.

## Automated: engine unit tests

The `update.ts` engine is tested with real temp-git-repo fixtures (pattern:
`tests/delete-risk.test.ts`). Run:

```bash
pnpm test            # or: node --test tests/update.test.ts
```

Required cases (map 1:1 to the state machine in data-model.md):

| Fixture setup | Expected `UpdateResult` | Asserts |
|---------------|-------------------------|---------|
| clean, local behind upstream | `updated` | HEAD == upstream after; no stash left |
| dirty (tracked+untracked), local behind | `updated` | fast-forwarded AND working-tree changes restored (SC-002) |
| local == upstream | `already-current` | no commits created |
| local ahead only | `already-current` | HEAD unchanged (push out of scope) |
| **diverged (both advanced)** | `failed` | HEAD unchanged, no merge commit, stash restored (Principle III, mandatory failure path) |
| fetch fails (bogus/unreachable remote) | `failed` | HEAD unchanged; run continues |
| detached HEAD / no upstream / unavailable | `skipped` | never invoked git merge |

> Constitution Development Workflow: a mutating operation MUST leave a runnable
> check that fails if the safety behavior breaks, and MUST be manually exercised
> against a real repo including a failure path. The diverged→`failed` test is
> that check; the manual scenario below is that exercise.

## Manual: full UX flow

**Setup** — create a few observed repos in a scratch dir:

1. A repo behind its remote (commit on remote, not pulled) — expect **updated**.
2. A repo behind its remote **with uncommitted edits** — expect **updated**, edits intact.
3. A repo with **no remote** (`git init` only) — expect **skipped**, untouched.
4. A repo on a **local-only branch** (no `--set-upstream`) — expect **skipped**.
5. A **diverged** repo (local commit + different remote commit on same branch) — expect **failed**, light-red edge.

**Steps & expected outcomes**

1. Launch the app; let the startup scan settle.
2. Click the new **Pull all** control in the header.
   - Its icon **animates** (spins) for the whole run (FR-009).
   - Clicking it again while spinning does **nothing** (re-entry guard).
   - The UI stays responsive (no freeze — Principle IV).
3. When it finishes:
   - A one-line summary toast appears, e.g. `Updated 2 · 1 already current · 2 skipped · 1 failed`.
   - Repos (1) and (2) show clean/in-sync (green); repo (2)'s edits are still present.
   - Repos (3) and (4) are unchanged.
   - Repo (5) shows the **light-red** failed edge **plus a non-colour failed cue**
     (a status glyph and a "pull failed — open in your merge tool" tooltip, so it
     is distinguishable from an ordinary amber out-of-sync row without relying on
     colour) and is left in its original state (no merge commit; `git log`
     unchanged) — you can open it in your editor via the row's ⋮ launcher to
     resolve manually (handoff).
4. Click **Refresh** (the existing control) — ahead/behind counts reflect the new
   state; the light-red overlay on (5) persists until the next Pull all run.

**Hang/termination check (FR-013/SC-007)**: point one repo at an unreachable
remote (e.g. `git remote set-url origin https://10.255.255.1/x.git`). Pull all
must finish within the per-repo deadline, marking that repo **failed**, without
hanging the run or prompting for credentials.

## Non-goals to verify are absent

- No password/credential prompt ever appears (Principle I).
- No repository is auto-merged or rebased (no merge commits on diverged repos).
- No per-repo reason text or console panel (counts-only summary).
