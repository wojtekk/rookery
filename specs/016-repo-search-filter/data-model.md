# Data Model: Debounced Repository Search Filter

This feature introduces no persisted or IPC-crossing data. It adds one piece of renderer-only session state and a derived visibility rule over the existing `Row` model (`src/shared/types.ts`).

## Entities

### SearchQuery (session state)

| Attribute | Type | Notes |
|-----------|------|-------|
| value | `string` | Module-level variable in `renderer.ts`. Raw text the user typed. |
| (normalized) | `string` | Derived on use: `value.trim().toLowerCase()`. Empty ⇒ search inactive (FR-006). |

- **Lifecycle**: created empty at startup; updated by the debounced input handler and reset to `''` by the × button / Esc; discarded on app exit. **Not persisted** (FR-012), **not sent over IPC**.
- **Debounce handle**: a module-level `ReturnType<typeof setTimeout> | null` used to coalesce keystrokes (150 ms).

### Searchable fields (derived from existing `Row` / `WorkingTreeEntry` / `Remote`)

No new fields are added to any type. The query is matched against already-present data:

| Row kind | Searched text |
|----------|---------------|
| `repository` (primary) | `remote.slug` (if present) · `directoryName` · `remote.rawUrl` (if remote present) · `head.branch` (if not detached) |
| `worktree` (nested) | `directoryName` · `head.branch` (its own, if not detached) |
| `orphan-worktree` | same as primary (carries its own `remote`) |

`Remote` is `{host,slug,rawUrl} | {host:null,slug:null,rawUrl} | null` — slug is searched only when non-null; rawUrl whenever a remote exists; a `null` remote contributes no slug/origin but the row is still matchable by name/branch.

## Visibility rule (combined state × search filter)

Let `q` = normalized query, `stateMatch(e)` = existing state/failed predicate, `repoHit = (q === '' ) || searchMatchesRepo(primary)`.

**Worktree `w` is shown** iff:
```
showWorktrees AND stateMatch(w) AND (repoHit OR searchMatchesWorktree(w))
```

**Primary row is shown** iff:
```
(stateMatch(primary) AND repoHit) OR (at least one worktree shown)
```
When shown, it carries only its shown worktrees.

**Orphan-worktree row is shown** iff:
```
stateMatch(row) AND (q === '' OR searchMatchesRepo(row))
```

### Truth table (search dimension only; `stateMatch` assumed true, worktrees on)

| Repo text matches `q` | A worktree branch matches `q` | Primary shown? | Worktrees shown |
|:---:|:---:|:---:|:---|
| — (`q` empty) | — | yes | all |
| yes | any | yes | all |
| no | yes (some) | yes | only the matching worktree(s) |
| no | no | no | none (family hidden) |

The `q` empty row proves backward compatibility: identical to pre-feature `filterRows` output (regression-guarded by the existing tests).

## Empty-result presentation state (derived, not stored)

| Condition | UI |
|-----------|----|
| `rows.length === 0` | existing "no repositories discovered" empty state |
| `rows.length > 0` and `visible.length === 0` | new "No repositories match your search." message (FR-005) |
| `visible.length > 0` | normal table |
