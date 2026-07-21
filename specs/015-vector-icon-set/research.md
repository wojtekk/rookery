# Phase 0 Research: Unified Vector Icon Set

All open questions from the spec were resolved during the design discussion and
the visual comparison pages (`/tmp/.../compare.html`, `inventory.html`). This
document records the decisions that drive the implementation.

## R1 — Icon set selection

- **Decision**: **Tabler Icons** (https://tabler.io/icons), MIT-licensed.
- **Rationale**: Only set evaluated that satisfies all four hard constraints at
  once — (a) a single uniform outline family (24px grid, `stroke-width:2`, round
  caps/joins) so every glyph reads at equal weight; (b) **outline brand glyphs**
  for GitHub, VS Code, Git, and Finder (the launcher brands the app seeds); (c)
  `currentColor`-driven monochrome, so icons inherit row text colour with no
  per-icon colour; (d) MIT license permits redistribution in a public,
  source-available project.
- **Alternatives considered**:
  - *Lucide* (ISC): uniform outline, but **no brand icons** (no GitHub/VS
    Code/Git/Finder) — fails constraint (b).
  - *Font Awesome Free* (CC-BY): brand coverage, but the free tier is
    **solid/heavy**, not a matching thin outline — reintroduces the exact
    weight-mismatch this feature removes; also requires prominent attribution.
  - *Streamline "Regular"*: paid / **not redistributable** in a bundled app —
    fails constraint (d).

## R2 — SVG wrapper recipe & the fill-vs-stroke conflict

- **Decision**: Change `iconSvg()`'s wrapper from `fill="currentColor"` to the
  Tabler recipe:
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  (keep `viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false"`).
- **Rationale**: Tabler source SVGs carry **no per-path paint attributes** — every
  path inherits `fill`/`stroke`/`stroke-width` from the `<svg>` element. Pasting
  the inner `<path>`s and letting the wrapper drive paint is the smallest, most
  uniform change and guarantees equal weight (SC-001).
- **Consequence / the one exception**: with the wrapper set to `fill="none"`, any
  glyph that relies on *filled* shapes disappears. Only the bespoke **IntelliJ**
  glyph does (its letter marks + underline bar are fills). Resolution in R3.
- **Cleanup**: the current glyphs' per-path `fill="none" stroke="currentColor"
  stroke-width="1.6"` attributes are removed when replaced — they become
  redundant (and 1.6 is the old, lighter weight). The `FALLBACK_SVG` is likewise
  restated as stroke-only so it inherits the weight-2 wrapper.

## R3 — IntelliJ glyph (kept bespoke, redrawn at set weight) — FR-006

- **Decision**: **Keep** the application's current bespoke IntelliJ mark (rounded
  square + "IJ"-style marks + underline bar); do **not** substitute a Tabler icon
  (Tabler has no IntelliJ brand glyph — confirmed: the repo returns 404 for it)
  and do **not** invent a new mark. Redraw it so it (a) survives the `fill="none"`
  wrapper and (b) reads at the set's weight.
- **Rationale**: User decision, recorded in spec Clarifications. Validated at
  stroke-width 2 in the `inventory.html` mock (`intellijBumped`).
- **Implementation note**: the IntelliJ entry is **self-contained** — every element
  carries its own explicit paint so it is immune to the wrapper's `fill="none"`:
  the border rect at `stroke-width:2`, and its marks drawn to read at the same
  ink weight as the neighbouring stroke-2 glyphs (either as `stroke-width:2`
  strokes, or as `fill="currentColor"` shapes — whichever reproduces the current
  design at the heavier weight). This is the sole entry that overrides the
  wrapper; every other entry is bare Tabler path data.

## R4 — Fixed-affordance glyphs (not user-pickable)

- **Decision**: Add five Tabler glyphs to the catalog that are **not** offered in
  the Settings icon picker: `trash`, `x`, `chevron-up`, `chevron-down`,
  `git-branch`. Introduce an optional `pickable?: boolean` on `IconEntry`
  (default true); `ICON_IDS` filters to `pickable !== false`.
- **Rationale**: These are fixed UI affordances, not launcher actions a user can
  assign to a repo. FR-010 requires the trash/delete glyph MUST NOT appear as a
  selectable launcher icon; the same reasoning covers close/reorder/worktree. One
  catalog + one `iconSvg()` keeps rendering uniform; the flag is the minimal way
  to keep them out of the picker without a second module. (Chosen over a separate
  `AFFORDANCE` map: same uniformity, fewer moving parts.)
- **Glyph → id mapping** (Tabler source name → catalog id):
  | Affordance | Site | Tabler glyph | catalog id |
  |---|---|---|---|
  | Row delete | `table.ts:228` | `trash` | `trash` |
  | Overlay close (Settings) | `settings.ts:235` | `x` | `x` |
  | Overlay close (Cleanup) | `cleanup.ts:76` | `x` | `x` |
  | Remove observed dir (Settings) | `settings.ts:266` | `trash` | `trash` |
  | Reorder action up (Settings) | `settings.ts:80` | `chevron-up` | `chevron-up` |
  | Reorder action down (Settings) | `settings.ts:88` | `chevron-down` | `chevron-down` |
  | "Also removes a worktree" (Cleanup) | `cleanup.ts:185` | `git-branch` | `git-branch` |

## R5 — Delete affordance sizing (text → SVG)

- **Decision**: `.row-delete-ico` currently centers a text `×`. After the swap it
  holds a 16px `<svg>`. Verify/adjust `styles.css:642` so the SVG is centered and
  occupies the same footprint the `×` did (FR-007, no reflow). Reuse the existing
  `.menu` action-icon sizing pattern (those buttons already hold `iconSvg`
  output), so the delete icon matches the launcher icons exactly.
- **Rationale**: The launcher `.menu` icons are already SVG at the right size;
  aligning the delete button to the same rule is the smallest change and
  guarantees the delete icon reads at identical weight/size to its row-mates.

## R6 — Worktree indicator: git-branch (not folder-x) — FR-013

- **Decision**: `git-branch`, confirmed after a side-by-side `git-branch` vs
  `folder-x` duel in a styled mock Cleanup overlay.
- **Rationale**: `folder-x` is literally correct ("a folder gets deleted") but in
  the Cleanup overlay it sits beside the `trash` (remove-directory) and `x`
  (close) controls and reads as a *third delete button* — visual collision.
  `git-branch` is distinct from every delete affordance and semantically apt (a
  worktree is a git working tree tied to a branch); the "also removes" meaning is
  carried by the existing tooltip. Cost accepted: slightly more abstract.

## R7 — Licensing (FR-009)

- **Decision**: Add a top-level `THIRD_PARTY_LICENSES` file containing the Tabler
  Icons MIT license text and copyright (© Paweł Kuna) plus a one-line note that
  only SVG path data is vendored inline. No attribution UI required by MIT.
- **Rationale**: MIT requires the license + copyright notice accompany
  redistributed portions; a repo-root `THIRD_PARTY_LICENSES` is the conventional,
  lowest-friction home and keeps the app's own `LICENSE` (MIT + Commons Clause)
  untouched.

## R8 — Explicit scope boundary (what is NOT touched)

Confirmed out of scope (FR-014 + surgical-change rule), left exactly as-is:
git-state dots (clean/dirty), out-of-sync `↑↓`, unavailable `?`, update-warning
`⚠` (incl. yellow), empty-state decorative art, and the **table sort-direction
arrow** (`table.ts:408`, a header `↑`/`↓` that is not a launcher, the delete
affordance, or an overlay control). Launcher commands, the delete flow, and the
Cleanup/Settings workflows are unchanged apart from the glyphs drawn.
