# Contract: Delete Orchestration — Missing-Directory Worktree Amendment

Amends `specs/004-delete-repository-row/contracts/delete.md`'s `deleteRow`
sequence with one new early branch. Everything else in that contract
(confirmation ordering, at-most-two-dialogs rule, error surfacing) is
unchanged and still normative.

## Amended sequence

```
deleteRow(target):
  choice1 = dialog.showMessageBox(...)               // unchanged (004)
  if choice1.response !== 1: return { outcome: 'cancelled' }

  missingDir = target.isWorktree && !(await pathExists(target.path))   // NEW

  if missingDir:
    if !target.familyPath:
      return { outcome: 'failed', reason: 'Cannot remove: worktree directory is missing and its family repository is unknown.' }
    try:
      await runGit(['-C', target.familyPath, 'worktree', 'remove', target.path, '--force'], target.familyPath)
      return { outcome: 'deleted' }
    catch (err):
      return { outcome: 'failed', reason: err.message }

  // unchanged (004) from here down:
  hasRemote = (await probeRemoteUrl(target.path)) !== null
  risk = await computeDeleteRisk(target.path, hasRemote)
  if risk.atRisk:
    choice2 = dialog.showMessageBox(...)
    if choice2.response !== 1: return { outcome: 'cancelled' }
  try:
    if target.isWorktree:
      await runGit(['-C', target.path, 'worktree', 'remove', target.path, '--force'], dirname(target.path))
    else:
      try: await shell.trashItem(target.path)
      catch: await fs.rm(target.path, { recursive: true, force: true })
    return { outcome: 'deleted' }
  catch (err):
    if !(await pathExists(target.path)): return { outcome: 'deleted' }
    return { outcome: 'failed', reason: err.message }
```

## Normative rules (additions to 004's contract)

- **The missing-directory check runs once, right after the first
  confirmation, before any risk-check probe fires.** This is what fixes the
  bug (research R1): today, the risk-check probes are what throw on a
  missing directory, and that throw is indistinguishable (by the time it's
  caught) from any other failure — an explicit `pathExists` check up front
  removes the ambiguity entirely.
- **A missing-directory worktree target gets exactly one confirmation**,
  never two — `computeDeleteRisk` is not called on this branch at all
  (research R5), not merely called-and-ignored.
- **`familyPath` absence on this branch is a failure, not a silent
  success.** Per data-model.md's decision table, an `isWorktree` target with
  a missing directory and no `familyPath` must surface
  `{ outcome: 'failed' }` and leave any (already-absent) row state alone,
  rather than falling back to the old "can't tell, so report deleted"
  behavior this feature is fixing.
- **The existing missing-directory fallback in the unchanged lower branch
  (`if !(await pathExists(target.path)): return { outcome: 'deleted' }`)
  still exists but can no longer be reached by a worktree target** — the
  new `missingDir` branch above intercepts that case first. It remains
  reachable only for non-worktree targets, where it is already correct
  (004, unaffected by this feature).

## Failure / edge cases (→ quickstart.md)

| Scenario | Behavior |
|---|---|
| Nested worktree row, directory deleted externally, user clicks delete | Single confirmation → `git -C familyPath worktree remove target.path --force` → `{ outcome: 'deleted' }` → row does not reappear on next refresh |
| Same, but the family repository itself has since become unreadable (e.g. its `.git` is corrupted) | `runGit` rejects → `{ outcome: 'failed', reason: <git stderr> }`; row stays visible (FR-004) |
| Directory exists at click time but is deleted externally between dialog 1 and the `pathExists` check | Falls into the new `missingDir` branch exactly as if it had always been missing — no race window, since the check happens fresh, not from a cached scan |
| Directory exists throughout the whole flow | Entirely unchanged 004 behavior (two-confirmation-capable path) |
