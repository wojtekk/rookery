# UI Design: Local Repository Dashboard

Concrete visual/interaction design for the feature, agreed via iteration on the
interactive mockup. **Mockup:** [`dashboard-mockup.html`](./dashboard-mockup.html)
(self-contained, no build — open in a browser). This document is the source of
truth for *how* the spec's requirements are presented; the spec remains the source
of truth for *what* is required.

## Design thesis

An instrument panel for a developer watching ~50 local clones across two hosts.
Chrome is monochrome graphite; **color is reserved for repository state**. A
calm/healthy fleet reads as a run of green edges; anything needing attention
breaks the pattern in blue or amber.

## Tokens

| Role | Value | Notes |
|------|-------|-------|
| Background | `--void #0F1218`, `--surface #171B24` | top ~300px slightly darker for header depth |
| Text | `--fg #E7EBF3`, `--muted #7C8698`, `--faint #545E70` | |
| **State — ok** | `--ok #37A876` (green) | clean & in sync |
| **State — dirty** | `--dirty #4C8DFF` (blue) | uncommitted working-tree changes |
| **State — out-of-sync** | `--sync #E7B23C` (amber) | ahead > 0 or behind > 0 |
| **State — unavailable** | `--dead #5A6472` (grey) | timed out / unreadable |
| UI font | **Space Grotesk** | chrome, labels, buttons (Title Case) |
| Data font | **JetBrains Mono** | every git datum: paths, slugs, branches, counts |

Edge-bar colors use the same hue at ~0.6 alpha (`--ok-edge`, `--dirty-edge`,
`--sync-edge`) — matches the existing blue/amber edge convention.

## Layout

```
┌ command bar ───────────────────────────────────────────────┐
│ ~ Local Repository Dashboard        Worktrees  ↻ Refresh  ⚙ Settings │
├ fleet summary ─────────────────────────────────────────────┤
│ Fleet — 48 repositories    [All][clean][uncommitted][sync][unavail] │
│ ▂▂▂▂▂ proportional composition bar ▂▂▂▂▂                     │
├ table header (sortable) ───────────────────────────────────┤
│ · │ directory·slug │ branch·tracking │ uncommitted │ ahead/behind │ last change │ ⋮ │
├ rows ───────────────────────────────────────────────────────┤
│▎● aurora-account        feat/consent-sync   7 changed  ↑1 ↓0  4 min ago  ⋮ │
│▎  finn/aurora-account                                                       │
│ …                                                                          │
└─────────────────────────────────────────────────────────────┘
```

### Command bar (right-aligned controls)
- **Worktrees** — toggle to show/hide linked worktrees (FR-024), default on.
- **Refresh** — mono circular-arrow icon that **spins** while refreshing (FR-014).
- **Settings** — gear, far right; opens the settings modal.

### Fleet summary
- **Composition bar** — one proportional segment per state (green/blue/amber/grey),
  widths from live counts. At-a-glance health; not per-repo (replaced an earlier
  per-repo tick strip that wasn't wired to data).
- **State filter chips** — `All / clean / uncommitted / out of sync / unavailable`
  filter the list (see FR-029). Each shows its count. Doubles as the legend.

### Table
- **Sortable headers** — click a header to sort by it; click the active header
  again to reverse (mechanism for FR-020). Active header shows ↑/↓. No separate
  sort control.
- **Row name cell (three tiers, specificity gradient):**
  1. **directory name** — bright, primary label; collision fragment (`…/.worktrees/x`)
     inline when another visible row shares slug+dir (FR-005).
  2. **slug** — `owner/repo`, muted mono.
  3. **host** — own line, shown **only when it differs from the default host**
     (default `github.com`, configurable) — see FR-006. Reduces noise; a missing
     host line means "the usual host".
  - Full path is tooltip-only, `~`-shortened (FR-005).
- **Branch cell** — branch name; beneath it the upstream `origin/<branch>` as one
  connected, single-color token, or a `local-only` / `detached` tag (FR-007).
- **Counts** — uncommitted (blue, only when > 0), ahead/behind `↑x ↓y` (amber) (FR-008/009).
- **Last change** — relative commit time of HEAD.

### State indicator (supersedes full-row background)
State is shown by a **colored left-edge bar** on every row (green/blue/amber/grey)
**plus a git-porcelain status glyph** in the leftmost column — **no full-row
background wash**. Precedence: dirty (blue) wins over out-of-sync (amber) (FR-028).

Status glyph set (the required non-color cue — git-native vocabulary):

| State | Glyph | Edge |
|-------|-------|------|
| clean / ok | grey solid dot `●` | green |
| uncommitted | blue solid dot `●` (larger) | blue |
| out-of-sync | amber `↑↓` | amber |
| unavailable | grey `?` + dimmed text | grey |

**Accessibility (FR-028 / SC-008):** the non-color cue is the glyph **plus the
numeric text** ("clean" / "N changed" / `↑x ↓y` / "—"), so state is identifiable in
grayscale even though the edge bar itself is color. Verified layered redundancy.

### Per-repo actions — DEFERRED (future feature)
A persistent **⋮ kebab** on the right of each row opens a popover with launchers:
**GitHub · IntelliJ · VS Code · Finder · Terminal**. These actions are **out of
scope for this feature** (per spec Assumptions) — the mockup shows the slot to
prove the layout reserves room, matching the constitution's forward vision. Icons:
devicon (GitHub, VS Code, Apple/Finder) + inline monochrome SVG (IntelliJ,
Terminal — devicon's multicolor `original` glyphs don't render in the icon font).
Neutral at rest → brand color on hover.

### Settings modal
Opened by the gear. Lists observed directories (scales to many) — each with its
repo count and an "unreadable" flag for a missing/inaccessible path (FR-002/004/016),
plus "Add directory…". Home for observed dirs + preferences (sort, worktree
toggle, default host).

## Interaction notes / gotchas
- **Row elevation:** the entrance animation (`fill: both`) leaves a retained
  transform on each row → each row is a stacking context. Hovered/focused rows get
  `z-index` bumped so their kebab popover/tooltips paint above neighbours (otherwise
  the next row's separator line shows through the tooltip).
- **Tooltips near the right edge** open leftward (`right:0`) to stay on-screen.
- Keyboard: sortable headers and kebab are focusable; menus open on hover, focus,
  and click (touch).
- `prefers-reduced-motion` respected for row entrance + refresh spin.

## Constitution note
Constitution Principle IV currently mandates blue/amber **background** fills.
This design uses a **left-edge indicator + glyph** and adds **green for OK**. FR-028
supersedes the background wording; the constitution should be amended to match via
`/speckit-constitution` (equivalent-indicator + ok-state color).
