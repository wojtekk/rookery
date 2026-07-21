# Feature Specification: Duplicate-Clone Indicator

**Feature Branch**: `017-duplicate-clone-indicator`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "solve duplicate-clone indicator based on the performed research" — following an interactive brainstorming session (2026-07-21) that clarified scope and interaction before this spec was written.

## Clarifications

### Session 2026-07-21 (brainstorming)

- Q: Should this also detect duplicates where the two clones' folder names differ (same remote, different local directory name)? → A: No — presentation-only. Keep the existing detection (same remote identity AND same directory name) exactly as is; only how a detected duplicate is *shown* changes.
- Q: What should the user be able to do once they notice a duplicate? → A: Awareness plus a one-click way to isolate all copies — clicking the indicator opens/fills the existing repository search with the repository's identity so only the colliding rows remain visible.
- Q: What should the indicator itself look like? → A: A dedicated icon next to the repository name (not just making the existing plain-text path fragment clickable), so the signal reads as "this is a duplicate" without requiring a hover to discover it.

### Session 2026-07-21

- Q: Should the duplicate indicator's tooltip name the sibling's actual location, or stay limited to today's own-parent-folder fragment? → A: Keep it cheap — the tooltip states the generic "cloned in more than one place" fact plus this row's own parent-folder name (today's existing fragment, unchanged), without threading any new sibling-location data between rows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize a duplicate clone at a glance (Priority: P1)

A user scanning the repository table has two rows that are the same remote repository cloned into two different local folders. Today the only signal is a small grey "…/parent-folder" text fragment next to the repository name — easy to mistake for ordinary path information, and not self-explanatory (this is exactly the confusion that prompted this feature). With this feature, a dedicated icon appears next to the name on every row involved in the duplication, and hovering it explains what's going on in plain language.

**Why this priority**: This is the entire problem being solved — the underlying detection already exists and is correct, but its current presentation doesn't communicate "these are duplicates" to the user.

**Independent Test**: With two local working trees that are clones of the same remote repository, sharing the same directory name but living under different parent folders, open the app and confirm both rows show the new indicator; confirm a repository with no duplicate shows nothing extra.

**Acceptance Scenarios**:

1. **Given** two working trees that are clones of the same remote origin with the same directory name but different parent folders, **When** the table renders, **Then** both rows show the duplicate indicator next to their name.
2. **Given** a repository row with no colliding sibling, **When** the table renders, **Then** no duplicate indicator is shown for that row.
3. **Given** a row showing the duplicate indicator, **When** the user hovers it, **Then** a tooltip explains the repository is cloned in more than one place and includes this row's own parent-folder name (the same information already conveyed by today's plain-text fragment, now paired with an explanatory sentence) — it does not reveal the sibling copy's location.

---

### User Story 2 - Jump straight to all the copies (Priority: P2)

Once a user notices a duplicate, they want to see every clone of that repository together, without manually typing anything into the existing search field.

**Why this priority**: Awareness alone doesn't help the user compare the copies or decide what to do about them; this closes the loop using a control (search) the app already has, rather than introducing a new one.

**Independent Test**: Click a duplicate indicator and confirm the table narrows to exactly the rows that are clones of that repository, using the existing search field.

**Acceptance Scenarios**:

1. **Given** a row showing the duplicate indicator, **When** the user clicks it, **Then** the search field opens (if currently collapsed) and is populated with a value that identifies the repository, and the table narrows to the matching rows immediately (no waiting for the normal typing debounce).
2. **Given** the duplicate indicator's click has populated the search field, **When** the user clears the field, **Then** the full list returns exactly as it would after clearing any manually typed search.
3. **Given** a duplicate pair where neither row has a parsed remote (so they collide on directory name alone), **When** one row's duplicate indicator is clicked, **Then** the search still narrows correctly to the colliding rows (falling back to matching by directory name).

---

### User Story 3 - Behaves like every other row control (Priority: P3)

The new indicator and its click action follow the same rules already established for other row-level controls: it goes inert during a long operation, it never relies on colour alone, and its tooltip never clips off-screen.

**Why this priority**: Consistency avoids shipping a one-off control that behaves differently from the delete icon, the custom-action icons, or the existing warning icon users already know.

**Independent Test**: Start a long operation (Refresh, Pull all, or Cleanup) and confirm the duplicate indicator is non-interactive for its duration; separately, confirm its tooltip never clips regardless of which row it's on.

**Acceptance Scenarios**:

1. **Given** a long operation (Refresh, Pull all, or Cleanup) is running, **When** the user attempts to click a duplicate indicator, **Then** nothing happens and the cursor shows a not-allowed state.
2. **Given** a duplicate indicator on the last visible row of a scrolled or short window, **When** the user hovers it, **Then** its tooltip flips upward instead of clipping, consistent with the app's other row icon tooltips.

---

### Edge Cases

- Three or more clones of the same repository: every involved row shows the indicator; clicking any one of them narrows the search to all of them together, not just a pair. Per the tooltip clarification above, hovering any one of the three+ rows still only names that row's own parent folder, never the other siblings' locations — clicking remains the only way to see every copy together.
- A colliding pair where **both** repositories have no parsed remote (e.g. neither has `origin` configured) but share a directory name: they still collide on the empty-slug + directory-name key, and the click's search falls back to matching by directory name instead of remote identity. (A no-remote row and a *has*-remote row never collide — the detection key includes the remote slug — so a mixed pair produces no indicator on either row.)
- The user clicks the indicator while a different, manually-typed search is already active: the click replaces the current search text rather than appending to it.
- The colliding pair is split by the existing "Failed" state filter or the Worktrees toggle so that one of the pair is currently hidden: clicking still updates the search, but the hidden row stays hidden per the existing AND-composition between search and the other view controls (016 FR-010) — the user may need to also adjust those filters to see every copy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a distinct visual indicator on every row that shares its existing duplicate-detection key (same remote identity AND same directory name — unchanged) with at least one other row, replacing or accompanying today's plain "…/parent-folder" text.
- **FR-002**: The indicator MUST NOT rely on being noticed by shape/position alone — hovering it MUST show tooltip text that explicitly states the row is cloned in more than one place.
- **FR-003**: The system MUST NOT change the existing criteria used to detect a duplicate (same remote identity and same directory name); this feature changes only how an already-detected duplicate is presented and acted on.
- **FR-004**: Clicking the indicator MUST open the repository search if it is currently collapsed, populate it with a value that identifies the repository (its remote identity when known, otherwise its directory name), and apply that search immediately — without waiting for the normal typing debounce — so the table narrows to the matching rows.
- **FR-005**: A search populated by clicking the indicator MUST behave exactly like a manually typed search afterward: it remains editable and clearable through the existing search controls, with no separate or hidden state.
- **FR-006**: The indicator MUST be non-interactive while a long operation (Refresh, Pull all, or Cleanup) is running, consistent with how the app's other row-level actions (delete, custom launches) behave during that lockout.
- **FR-007**: The indicator's tooltip MUST use the app's existing upward-flip behavior when there isn't room to grow downward, consistent with the app's other row icon tooltips.
- **FR-008**: The indicator MUST NOT appear on a row with no detected duplicate (unchanged gating from today's behavior).

### Key Entities *(include if feature involves data)*

- **Duplicate group**: two or more rows (repositories and/or worktrees) sharing the same existing detection key. No new data model — the existing per-row "has a duplicate" signal continues to gate the indicator; this feature does not add new fields to what's tracked per repository.
- **Search query**: the existing session-only search state introduced by the repository search filter feature. This feature adds one more way to populate it (a click) — it does not introduce a new kind of state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user looking at a duplicated row can correctly state, from the indicator and its tooltip alone — without asking anyone or reading documentation — that the repository is cloned in more than one place.
- **SC-002**: From any duplicate indicator, a user reaches an isolated view of every copy of that repository in a single click, with no typing required.
- **SC-003**: The indicator shows on 100% of rows with an actual detected duplicate and on 0% of rows without one, matching the existing detection exactly.
- **SC-004**: The indicator produces no click effect and shows a not-allowed cursor during 100% of long-operation windows.

## Assumptions

- Detection logic (same remote identity and same directory name) is unchanged; only presentation and one added click action are in scope, per the Clarifications above.
- "Identifies the repository" for the search population means the remote's slug (host + owner + repo) when a remote is known; the directory name is used only as a fallback when no remote could be parsed for that row.
- The existing repository search field is reused as-is — no new filter control, chip, or view mode is introduced.
- The indicator's icon reuses the app's existing icon system (the uniform outline style already in place); the exact glyph is a planning/implementation choice, not specified further here.
- No new IPC, main-process change, dependency, or persisted setting — this remains a renderer-only presentation change built entirely on data the app already observes.
- Per clarification (2026-07-21), the tooltip does not reveal a sibling copy's actual filesystem location — it reuses today's own-parent-folder fragment text, now paired with an explanatory sentence, so no sibling-location data needs to be threaded between rows in the scan/render pipeline.
