# Phase 1 Data Model: Custom Per-Repository Action Launchers

Additive to 001's `src/shared/types.ts`. New shapes are `Action`; changed shapes
are `Settings` (gains `actions`) and `Remote` (gains `rawUrl`). Everything crosses
the IPC boundary, so all fields are plain serializable data.

## Action (new)

A user-defined ⋮-menu entry. Order is positional (its index in `Settings.actions`),
so there is no stored `order` field to drift out of sync (spec Key Entities:
"user-controlled display order").

```
type Action = {
  id: string        // stable opaque id (generated on add); identifies the action for
                    //   runAction and for keying UI — NOT the name/icon (those are labels)
  name: string      // non-empty display label (FR-002); duplicates allowed (Edge Cases)
  iconId: string    // reference into the bundled Icon Catalog (FR-011); duplicates allowed
  command: string   // non-empty command template; may contain ${1} (path) and/or ${2} (raw remote URL)
}
```

- `id` exists because `name`/`iconId` are labels, not identifiers (spec Edge Cases:
  same name/icon allowed). `runAction` and reorder/edit target the `id`.
- `command` is stored **verbatim** as the user typed it. `${1}`/`${2}` are not
  expanded or rewritten at rest — expansion happens only at launch, as shell
  positional parameters (research R1, `contracts/launch.md`).
- Validation (on add/edit, FR-002): `name` non-empty (trimmed), `command` non-empty
  (trimmed), `iconId` present in the catalog. No validation of *what* the command
  does — that is user-owned (Constitution II rationale in plan).

### Derived: is this action enabled for a given row? (FR-013)

Not stored — a pure function of the action and the row, computed where the menu is
built (`shared/actions.ts`, consumed by `view/table.ts`):

```
isActionEnabledForRow(action, row):
  if command contains the literal token "${2}"  and  row has no raw origin URL:
      → disabled (render with a tooltip explaining "no remote", FR-013)
  else → enabled
```

"Row has no raw origin URL" ⇒ `row.remote === null || row.remote.rawUrl == null`.
Actions whose command does **not** reference `${2}` are always enabled regardless of
remote status (FR-013). The limit-reached disable of the *add* control (FR-003) is a
separate, list-level state, not per-row.

## Remote (changed)

001's `Remote` is `{ host, slug } | null`, where `null` conflates *no origin* and
*unparseable origin*. `${2}` needs the raw string, and FR-013's disable must key on
*origin present at all* — not on parse success. So retain the raw URL:

```
type Remote =
  | { host: string; slug: string; rawUrl: string }   // parsed identity + verbatim origin
  | { host: null;   slug: null;   rawUrl: string }    // origin present but unparseable (e.g. local path remote)
  | null                                              // no origin configured at all → ${2} actions disabled (FR-013)
```

- `rawUrl` is the verbatim `git config --get remote.origin.url` value (research R3).
  It is the substitution value for `${2}` (spec clarify: raw, not normalized).
- The `{host:null, slug:null, rawUrl}` variant is the important correctness case:
  a repo with a present-but-unparseable origin still supplies `${2}` and its
  `${2}` actions stay **enabled**. Only the fully-`null` (no origin) case disables
  them. This keeps FR-013 honest.
- 001's render rule (host shown only when `host !== defaultHost`) is unaffected: it
  reads `host`, which is `null` in the unparseable variant (row falls back to
  `directoryName`, unchanged from 001 / FR-006).

**Migration note**: this widens 001's `Remote`. `parse.ts` (P5) already computes the
raw URL as its input; it now returns it instead of dropping it. No new probe.

## Settings (changed)

001's `Settings` gains one field:

| Field | Type | Notes |
|-------|------|-------|
| `observedDirectories` | string[] | unchanged (001). |
| `sortDimension` / `sortDirection` | … | unchanged (001). |
| `showWorktrees` | boolean | unchanged (001). |
| `defaultHost` | string | unchanged (001). |
| `actions` | Action[] | **new.** Ordered list; index = display order. Bounded by `ACTION_LIMIT`. Persisted with the rest of settings (FR-010). |

**Seeding sentinel (FR-012 / research R5)**: first run = the persisted settings have
**no `actions` key**. On first run, `config.ts` seeds the five defaults. Once the key
exists (even as `[]`), it is never re-seeded — so intentionally emptying the list
(FR-009) sticks across restarts. `actions: []` is a valid, respected state.

## ACTION_LIMIT (constant, not data)

`ACTION_LIMIT = 6`, a single exported constant in `shared/actions.ts` (FR-003 —
"governed by a single constant … might change in the future"). `canAdd(actions)` =
`actions.length < ACTION_LIMIT`. The add control is disabled with an explanation
when `!canAdd` and re-enables on removal (FR-003).

## Icon Catalog (static, not persisted)

A fixed manifest `catalog.ts`: `Record<iconId, svgMarkup|assetPath>`. Not user
data, not persisted — bundled with the app (FR-011). An `Action.iconId` that is not
in the catalog fails add/edit validation (and, defensively, renders a neutral
fallback glyph if a stale id ever appears).

## Invariants (→ tests, `actions.test.ts`)

1. `actions.length` never exceeds `ACTION_LIMIT` via any add path.
2. `moveUp`/`moveDown` change exactly one adjacent pair and are no-ops at the ends
   (FR-014); the set of actions is otherwise preserved.
3. `isActionEnabledForRow`: `${2}` command + `remote===null` → disabled; `${2}`
   command + `{host:null,slug:null,rawUrl}` → **enabled**; non-`${2}` command →
   always enabled (FR-013).
4. The seed set is exactly the five defaults of research R5, in that order, and is
   applied only when the `actions` key is absent (FR-012).
