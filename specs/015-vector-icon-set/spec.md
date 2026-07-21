# Feature Specification: Upgrade to a Unified Vector Icon Set

**Feature Branch**: `015-vector-icon-set`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "upgrade icons based on discussion"

## Context (from design discussion)

The repository dashboard renders small monochrome icons in two places: the
per-row action launchers (open in GitHub, IntelliJ, VS Code, Finder, terminal,
etc.) and the per-row delete affordance. The current launcher icons are
hand-drawn glyphs that mix two drawing styles — some are **solid fills**
(GitHub, VS Code, Git, IntelliJ's inner marks) and some are **thin outlines**
(Finder, terminal, folder, browser, code, launch, settings). Because a filled
glyph paints far more of its box than a thin stroke does, the filled ones read
as visibly heavier/brighter and the outlined ones as fainter, even though every
icon inherits the same text colour. The result is an uneven, unpolished row of
icons.

The delete affordance is a plain `×` text character, visually unrelated to the
icon set.

The agreed direction is to replace all these glyphs with a single, consistent
outline vector icon set so every icon reads at equal visual weight, and to
replace the `×` delete affordance with a trash icon drawn in the same set.

## Clarifications

### Session 2026-07-21

- Q: Which glyph systems are in scope? → A: The per-row action launchers, the
  per-row delete affordance, AND the Settings/Cleanup overlay control glyphs
  (close, remove-directory, reorder up/down, and the "also removes worktree"
  indicator). The git-state indicator glyphs (clean/dirty dots, out-of-sync
  `↑↓`, unavailable `?`), the update-warning `⚠`, and the empty-state
  decorative art are OUT of scope and kept exactly as-is.
- Q: IntelliJ icon (the chosen set has no IntelliJ brand glyph)? → A: Keep the
  application's **current bespoke IntelliJ glyph** (do not substitute a Tabler or
  new custom mark), but redraw its strokes at the set's weight (stroke-width 2)
  so it does not read lighter than its neighbours.
- Q: VS Code icon? → A: Use the chosen set's **outline** VS Code glyph.
- Q: Overlay control glyphs? → A: Replace with the set's equivalents — close →
  `x`, remove-directory → trash, reorder → chevron up / chevron down, and the
  "also removes worktree" indicator → a **git-branch** icon (the current house
  `⌂` is a weak metaphor; a worktree is a git working tree tied to a branch).
- Q: Update-warning `⚠` indicator? → A: Keep the current warning glyph and its
  existing (yellow) colour; it carries meaning (feature 013) and is a state cue.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Icons read at equal visual weight (Priority: P1)

A user scanning the dashboard sees the row of action icons (and the toolbar/
header icons) as a uniform, evenly-weighted set: no single icon jumps out as
bolder, darker, or fainter than its neighbours.

**Why this priority**: This is the reported problem and the core value of the
feature — the whole point is visual consistency. Fixing it delivers the feature's
value on its own.

**Independent Test**: Open the app with several repositories and at least the
seeded launcher actions configured; visually confirm no icon appears heavier or
lighter than the others across a row and across rows.

**Acceptance Scenarios**:

1. **Given** a repository row showing multiple launcher icons, **When** the user
   looks at the row, **Then** every icon appears at the same visual weight (no
   icon is noticeably bolder/heavier or fainter than the others).
2. **Given** the same row, **When** the user compares a brand icon (e.g. GitHub)
   with a generic icon (e.g. terminal), **Then** both share the same stroke
   style and weight.
3. **Given** any icon, **When** it is shown in its normal, hover, and
   disabled/dimmed states, **Then** it continues to inherit the row's text
   colour (it stays monochrome and consistent with the other icons).

---

### User Story 2 - Delete affordance is a trash icon (Priority: P2)

A user identifying how to remove a repository row sees a recognizable trash
icon, consistent with the rest of the icon set, in place of the previous `×`.

**Why this priority**: A clear, consistent delete affordance improves
recognizability and completes the visual unification, but the row can still be
deleted today, so it ranks below the core weight fix.

**Independent Test**: View a repository row and confirm the delete control shows
a trash icon in the same visual style as the launcher icons; confirm it still
triggers the existing delete flow.

**Acceptance Scenarios**:

1. **Given** a repository row, **When** the user looks at the delete control,
   **Then** it shows a trash icon (not a `×` character) in the same outline
   style and weight as the launcher icons.
2. **Given** the trash delete control, **When** the user activates it, **Then**
   the existing delete confirmation/flow behaves exactly as before (only the
   glyph changed).

---

### User Story 3 - Icons stay recognizable at a glance (Priority: P3)

A user can still tell what each icon means — brand launchers (GitHub, VS Code,
Git, Finder, IntelliJ) remain identifiable, and generic launchers (terminal,
folder, browser, code, launch, settings) still read clearly.

**Why this priority**: Consistency must not come at the cost of legibility;
unrecognizable icons would trade one usability problem for another. It ranks
last because it is a guardrail on the first two stories rather than new value.

**Independent Test**: Show the full set of icons to a user and confirm each is
identifiable as its intended target.

**Acceptance Scenarios**:

1. **Given** the unified icon set, **When** the user views the seeded brand
   launchers, **Then** GitHub, VS Code, Git, and Finder are each recognizable.
2. **Given** the icon set has no native brand glyph for IntelliJ, **When** the
   IntelliJ launcher is shown, **Then** it displays the application's existing
   bespoke IntelliJ glyph, redrawn at the set's stroke weight so it is
   recognizable AND reads at the same weight as its neighbours.

---

### Edge Cases

- **Unknown / missing icon id**: a launcher configured with an icon id that has
  no matching glyph MUST still render a sensible fallback glyph, consistent in
  style with the set (no blank/broken image).
- **Disabled / dimmed state**: while a long operation runs (existing UI-lockout
  behavior), row action icons dim per the existing rules; the new icons MUST
  follow the same dimming and not introduce a colour of their own.
- **Icon picker in Settings**: the set of icons a user can choose for a custom
  launcher MUST remain available; the trash/delete glyph MUST NOT appear as a
  selectable launcher icon (it is a fixed affordance, not a user action).
- **Layout**: icons MUST occupy the same footprint as today so rows and the
  toolbar do not shift or reflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All action-launcher icons and header/toolbar icons MUST render at a
  single, consistent visual weight, such that no icon appears noticeably heavier,
  darker, or fainter than the others.
- **FR-002**: All these icons MUST share one consistent visual style (a uniform
  outline/stroke treatment rather than a mix of filled and outlined glyphs).
- **FR-003**: Icons MUST remain monochrome and inherit the surrounding text
  colour in their normal, hover, and disabled/dimmed states.
- **FR-004**: Each launcher glyph — GitHub, VS Code, Finder, terminal, Git,
  Folder, Browser, Code, Launch, Settings — MUST use the new set's recognizable
  outline icon (VS Code specifically uses the set's outline VS Code glyph).
- **FR-005**: The repository delete affordance MUST be represented by a trash
  icon drawn in the same set and weight, replacing the current `×` character;
  the delete behavior itself MUST be unchanged.
- **FR-006**: The IntelliJ launcher MUST retain the application's current bespoke
  IntelliJ glyph (not a substitute from the set nor a newly invented mark), but
  redrawn at the set's stroke weight so it reads at the same visual weight as the
  rest of the icons (it MUST NOT appear lighter than its neighbours).
- **FR-013**: The Settings and Cleanup overlay control glyphs MUST use the new
  set's equivalents: close → an "x" icon, remove-directory → a trash icon,
  reorder up/down → chevron-up / chevron-down icons, and the "also removes a
  worktree" indicator → a git-branch icon (replacing the current `⌂`).
- **FR-014**: The git-state indicator glyphs (clean and dirty dots, out-of-sync
  `↑↓`, unavailable `?`), the update-warning `⚠` indicator (including its current
  yellow colour), and the empty-state decorative art MUST remain unchanged — they
  are out of scope for this feature.
- **FR-007**: Icons MUST keep their current on-screen size and placement in rows
  and the toolbar; the change MUST NOT cause layout shift or reflow.
- **FR-008**: Icons MUST be bundled with the application and render fully offline,
  with no network request to display them.
- **FR-009**: The chosen icon set's license MUST permit redistribution within
  this public, source-available project, and any license text or attribution the
  license requires MUST be included in the repository.
- **FR-010**: The Settings icon picker MUST continue to offer the same set of
  selectable launcher icons; the trash/delete glyph MUST NOT be offered as a
  selectable launcher icon.
- **FR-011**: The change MUST NOT introduce a new runtime dependency; icons MUST
  remain static, bundled assets.
- **FR-012**: A configured launcher MUST launch the same external target as
  before — only its icon changes, never its command or behavior.

### Key Entities

- **Icon catalog**: the fixed, bundled collection of named monochrome glyphs the
  app can render; each entry has an id, a human label, and a vector glyph.
- **Launcher action**: a user-configured per-repository action that references an
  icon from the catalog by id (unchanged except for which glyph the id maps to).
- **Delete affordance**: the fixed per-row control for removing a repository row;
  gains a trash glyph from the same catalog/style.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a side-by-side view of all icons, zero icons are identifiable as
  heavier/darker or fainter than the rest — they read as one uniform-weight set.
- **SC-002**: A user can correctly identify the purpose of each of the 11
  launcher icons (the 10 enumerated in FR-004 plus IntelliJ, per FR-006) and the
  delete (trash) icon on sight.
- **SC-003**: The delete affordance shows a trash icon; the `×` character no
  longer appears in any repository row, nor as the close/remove control in the
  Settings or Cleanup overlays.
- **SC-004**: No layout shift occurs versus the previous icons — rows and the
  toolbar occupy the same space and alignment.
- **SC-005**: The application renders all icons with the network disabled (no
  outbound request is made to display any icon).

## Assumptions

- **Icon set decision**: Per the design discussion, the selected set is **Tabler
  Icons (MIT-licensed)** — a single uniform outline family (24px grid, consistent
  stroke, round caps) that also provides outline brand glyphs for GitHub, VS Code,
  Git, and Finder. Tabler has no IntelliJ brand glyph, so the app's **existing
  bespoke IntelliJ glyph is retained**, redrawn at the set's stroke weight
  (FR-006). Lucide (no brand icons), Font Awesome Free (solid/heavy, attribution),
  and Streamline "Regular" (paid / non-redistributable) were evaluated and
  rejected against the constraints.
- **Bundling**: The chosen glyphs are copied into the app as inline vector assets
  (no icon package added), satisfying the offline and no-new-dependency
  constraints (Principle V).
- **Scope boundary**: This feature changes which glyphs are drawn for the row
  launchers, the row delete affordance, and the Settings/Cleanup overlay control
  glyphs (close, remove-directory, reorder, worktree indicator). It does NOT
  change the git-state indicator glyphs, the update-warning `⚠`, or the
  empty-state art; nor does it change launcher commands, the delete flow, the
  Cleanup/Settings workflows (beyond the glyphs shown), row layout, or state
  colour semantics.
- **Licensing**: Tabler Icons is MIT; its license text/copyright is added to the
  repository to satisfy redistribution terms (FR-009).

## Governance Alignment

- **Principle V (Local-Only, Minimal Footprint)**: icons are bundled static
  assets rendered offline, with no new runtime dependency (FR-008, FR-011).
- **Principle IV (Always-Observable State)**: icons are neutral affordances that
  inherit text colour; they do not introduce a colour that could be mistaken for
  the row's state indicator, and they follow the existing dim-on-lock behavior
  (FR-003, edge cases).
- **Development Workflow (surgical changes)**: the change is limited to glyph data
  and the delete affordance's glyph; no adjacent refactors.
