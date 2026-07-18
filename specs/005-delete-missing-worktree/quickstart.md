# Quickstart: Delete a Worktree Whose Directory Is Already Missing

Manual validation guide. Prerequisites: a repository with a linked worktree,
both observed by the dashboard; system `git` ≥ 2.15 (existing app
requirement).

## Setup

```sh
mkdir -p /tmp/qs-family && cd /tmp/qs-family && git init -q
git commit -q --allow-empty -m init
git worktree add ../qs-linked -b qs-linked-branch
```

Add `/tmp/qs-family`'s parent as an observed directory in the app (or reuse
an existing observed repo with a linked worktree). Refresh the dashboard and
confirm the nested worktree row (`qs-linked`) renders normally (green/clean).

## Scenario 1 — directory removed externally, then deleted from the dashboard

1. Outside the app: `rm -rf /tmp/qs-linked`.
2. Refresh the dashboard. The nested worktree row now renders as
   `unavailable` ("?").
3. Click its delete ("x") icon.
4. **Expected**: exactly one confirmation dialog appears ("Delete
   'qs-linked'? This removes the worktree and its files."). No second,
   "destructive action" dialog appears.
5. Confirm.
6. **Expected**: the row disappears immediately.
7. From a terminal, in `/tmp/qs-family`: `git worktree list` — **expected**:
   the `qs-linked` entry is gone (no `prunable` line for it).
8. Click Refresh in the dashboard again. **Expected**: the row does not
   reappear.

## Scenario 2 — family repository itself is unreadable

1. Repeat setup, then externally corrupt the family repo in a way that makes
   git commands against it fail (e.g. `rm -rf /tmp/qs-family/.git`), leaving
   the worktree directory itself also missing.
2. Click delete on the (already-unavailable) worktree row and confirm once.
3. **Expected**: an error is surfaced (`{ outcome: 'failed', ... }`
   reflected in the UI's error state) and the row remains visible — it is
   not silently treated as deleted.

## Scenario 3 — regression check: directory present throughout

1. With a normal, present, clean nested worktree row, click delete and
   confirm once.
2. **Expected**: unchanged 004 behavior — single confirmation, worktree
   removed via the existing `-C target.path` path, row disappears and does
   not reappear.

## Cleanup

```sh
rm -rf /tmp/qs-family
```
