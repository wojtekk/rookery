# Contract: Icon Catalog Module (`src/renderer/view/icons/catalog.ts`)

The catalog is the app's one internal "interface" for glyphs. Its exported API
shape is unchanged; this contract pins the behavior the rest of the renderer
relies on, and gives the runnable check for the mutating-free portion.

## Exported API (shape unchanged)

```ts
export const ICON_IDS: readonly string[];
export function iconLabel(id: string): string;
export function iconSvg(id: string): string;   // returns an inline <svg>…</svg> string
```

## Behavioral contract

| # | Requirement | Ties to |
|---|-------------|---------|
| C1 | `iconSvg(id)` returns a well-formed `<svg …>…</svg>` string for **every** `ICON_IDS` entry and for the fixed affordances (`trash`, `x`, `chevron-up`, `chevron-down`, `git-branch`). | FR-004, FR-005, FR-013 |
| C2 | The `<svg>` wrapper uses `fill="none" stroke="currentColor" stroke-width="2"` (uniform weight); no entry hard-codes a colour. | FR-001, FR-002, FR-003, SC-001 |
| C3 | `iconSvg(unknownId)` returns the fallback glyph (never empty / never throws). | Edge case: unknown icon id |
| C4 | `ICON_IDS` contains all launcher ids and **excludes** `trash`, `x`, `chevron-up`, `chevron-down`, `git-branch`. | FR-010 |
| C5 | Existing launcher ids are unchanged (`github`, `intellij`, `vscode`, `finder`, `terminal`, `git`, `folder`, `globe`, `code`, `rocket`, `gear`). | FR-012 |
| C6 | Output contains no `http`/`https` reference and no external asset URL (fully offline). | FR-008, SC-005 |
| C7 | The IntelliJ entry renders visible ink under the `fill="none"` wrapper (self-contained paint). | FR-006 |

## Runnable check (satisfies the constitution's runnable-check habit)

A pure unit test over the catalog module (node:test) — no Electron, no DOM:

- For each `ICON_IDS` id: `iconSvg(id)` starts with `<svg` and ends with `</svg>`,
  and contains `stroke="currentColor"` (C1, C2).
- `iconSvg('trash')`, `iconSvg('x')`, `iconSvg('chevron-up')`,
  `iconSvg('chevron-down')`, `iconSvg('git-branch')` each return a valid `<svg>` (C1).
- `ICON_IDS` includes `github` and `gear`; `ICON_IDS` does **not** include `trash`
  or `x` (C4, C5).
- `iconSvg('__nope__')` returns a non-empty `<svg>` (C3).
- No `iconSvg(id)` output contains the substring `http` (C6).

> Rationale: the delete/launch *handlers* are untouched (glyph-only change), so no
> mutating-operation path is modified. This check guards the presentation contract
> the swap depends on — the smallest thing that fails if the catalog rewrite breaks.

## Call-site contract (glyph swaps, behavior unchanged)

| Site | Before | After | Behavior |
|------|--------|-------|----------|
| `table.ts:228` | `btn.textContent = '×'` | `btn.innerHTML = iconSvg('trash')` | delete flow unchanged (FR-005/012) |
| `settings.ts:80` | `up.textContent = '↑'` | `iconSvg('chevron-up')` | reorder unchanged |
| `settings.ts:88` | `down.textContent = '↓'` | `iconSvg('chevron-down')` | reorder unchanged |
| `settings.ts:235` | `close.textContent = '×'` | `iconSvg('x')` | close unchanged |
| `settings.ts:266` | `rm.textContent = '×'` | `iconSvg('trash')` | remove-dir unchanged |
| `cleanup.ts:76` | `closeBtn.textContent = '×'` | `iconSvg('x')` | close unchanged |
| `cleanup.ts:185` | `glyph.textContent = '⌂'` | `iconSvg('git-branch')` | tooltip/title unchanged |

> `table.ts:408` (sort-direction arrow) is intentionally **not** in this table — out of scope (research R8).
