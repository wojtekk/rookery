# Feature Specification: Debounced Repository Search Filter

**Feature Branch**: `016-repo-search-filter`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Implement a debounced search filter for the repository table to dynamically filter visible items across key metadata fields. Search scope: match query against repository slug, name, origin, and current branch. Debounce: trigger the filter update 150 ms after the user stops typing. Table UI: update the repository table in real time to show only matching results."

## Clarifications

### Session 2026-07-21

- Q: When a worktree's branch matches but its parent repository does not, what shows? → A: Parent row + only the matching worktree row(s); non-matching sibling worktrees are hidden.
- Q: How should the user clear the search field? → A: A dedicated clear (×) button (shown when the field has text) plus normal delete-to-clear.
- Q: How should the search input appear in the toolbar? → A: An expandable search icon that opens into an input when activated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Narrow a long list by typing (Priority: P1)

A user watching many repositories wants to jump to the few they care about right now. They type a fragment of a repository's identity — part of its slug, its directory name, a piece of its remote URL, or its current branch name — into a search field above the table. The table narrows to only the repositories whose visible identity contains that text, and keeps narrowing/widening as they refine the text.

**Why this priority**: This is the entire value of the feature — turning a scroll-and-scan chore over a large list into a direct lookup. Every other story is a refinement of this one; without it there is nothing to ship.

**Independent Test**: With several repositories discovered, type a fragment that appears in exactly one repository's slug and confirm only that repository (and, per FR-008, its worktrees) remains; clear the field and confirm the full list returns. Delivers immediate lookup value on its own.

**Acceptance Scenarios**:

1. **Given** a list of many repositories, **When** the user types a fragment contained in one repository's slug, **Then** only repositories whose slug, name, origin, or current branch contains that fragment remain visible.
2. **Given** a search fragment is already applied, **When** the user types one more character that further narrows the match, **Then** the visible list shrinks to only the still-matching repositories.
3. **Given** a search fragment is already applied, **When** the user deletes characters so the fragment is shorter, **Then** the visible list grows back to include the newly-matching repositories.
4. **Given** the user types "FINN" and a repository's slug is "finn-no", **Then** that repository matches (matching ignores letter case).

---

### User Story 2 - Recover the full list and understand "no matches" (Priority: P2)

After filtering, the user needs an obvious way back to the complete list, and clear feedback when their text matches nothing so they don't mistake an empty result for a broken app.

**Why this priority**: Filtering is only trustworthy if the user can always get back to "show everything" and can tell the difference between "no repositories match" and "no repositories exist / something is wrong." Important, but the P1 lookup is usable without it.

**Independent Test**: Apply a fragment that matches nothing and confirm a clear "no matching repositories" indication (not a blank table that looks broken); then clear the field via a visible affordance and confirm the full list returns.

**Acceptance Scenarios**:

1. **Given** a fragment that matches no repository, **When** the debounce settles, **Then** the table shows a clear empty-result message distinguishing "no matches for this search" from "no repositories discovered."
2. **Given** a non-empty search fragment, **When** the user clears the field (deletes all text or uses a clear affordance), **Then** the full list — as constrained by any other active filters — returns.
3. **Given** the search field contains only whitespace, **When** the debounce settles, **Then** it is treated as an empty query and no repositories are filtered out.

---

### User Story 3 - Search composes with existing filters and view controls (Priority: P3)

The search must behave as one more filter layered on top of the controls the app already has (the "Failed" state filter chip and the Worktrees visibility toggle), and it must obey the same rules those controls obey while a long operation is running.

**Why this priority**: The dashboard already has filtering/view controls; a search that ignored them or fought the existing long-operation lockout would produce confusing or inconsistent results. Valuable for correctness, but the core lookup ships without it.

**Independent Test**: Enable the "Failed" chip, then type a fragment — confirm the result is the intersection (failed AND matching text). Separately, start a long operation (Refresh / Pull all / Cleanup) and confirm the search field is non-interactive for the duration, consistent with the other view controls.

**Acceptance Scenarios**:

1. **Given** the "Failed" filter chip is active, **When** the user also types a search fragment, **Then** only repositories that are both failed and match the fragment remain visible.
2. **Given** the Worktrees toggle is on and a search fragment is applied, **When** a repository matches the fragment, **Then** its nested worktree rows are shown under it consistent with FR-008.
5. **Given** the Worktrees toggle is on and a fragment that matches one worktree's branch but not its parent repository (nor the parent's other worktrees), **When** the debounce settles, **Then** the parent row is shown with only that matching worktree row, and the parent's non-matching sibling worktrees are hidden.
3. **Given** a long operation (Refresh, Pull all, or Cleanup) is running, **When** the user attempts to type in the search field, **Then** the field is non-interactive for the operation's duration, matching how the app blocks its other view-reconfiguring controls.
4. **Given** an active search fragment, **When** a Refresh completes and the discovered set changes, **Then** the same fragment is re-applied to the new set without the user retyping it.

---

### Edge Cases

- **Rapid typing**: the filter must not visibly recompute on every keystroke; it settles a short, fixed moment after the user stops typing (see FR-002).
- **Whitespace-only / leading-trailing spaces**: whitespace-only is treated as empty (FR-006); surrounding spaces around a real term are ignored so " main " matches "main".
- **No matches**: distinct empty-state message vs. the "no repositories discovered" state (FR-005).
- **Match on a field that isn't the primary label**: a fragment appearing only in the origin URL or only in the branch name still matches, even if it doesn't appear in the slug or directory name.
- **Worktree branches**: when a worktree's own branch is what matches the query, the behavior follows FR-008's stated worktree rule rather than being left ambiguous.
- **List changes underneath an active search**: after a refresh, delete, pull-all, or cleanup changes the underlying set, the current search fragment stays applied to the updated set (FR-009).
- **Special characters in the query** (e.g. `/`, `.`, `-`): treated as literal text to match, never as pattern/wildcard syntax.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide, alongside the table's existing view controls, a search affordance that filters the repository table to only entries matching the entered text. The affordance MUST be an expandable search icon that opens into a text input when activated. It collapses back to the icon only on explicit dismissal: pressing Esc while the field is already empty (Esc while non-empty clears the text first, leaving the field open). An active (non-empty) query MUST NOT collapse on its own.
- **FR-002**: The system MUST wait a short fixed idle period after the user stops typing before recomputing the filtered result (debounce), so intermediate keystrokes do not each trigger a recompute. The target idle period is 150 ms (see Assumptions).
- **FR-003**: The system MUST match the query as a case-insensitive substring against each repository entry's remote slug, directory name, origin (remote URL), and current branch name; an entry matches if the query is contained in ANY of these fields.
- **FR-004**: The system MUST treat the query as literal text — punctuation and symbols in the query match those same characters and are never interpreted as wildcards or pattern syntax.
- **FR-005**: When a non-empty query matches no entries, the system MUST show a message that clearly indicates "no repositories match the search," visibly distinct from the existing "no repositories discovered" empty state.
- **FR-006**: The system MUST treat an empty or whitespace-only query as "no search active" and show the full list (as constrained by other active filters), and MUST ignore leading/trailing whitespace around a real query term.
- **FR-007**: The system MUST let the user return to the unfiltered list by clearing the field. It MUST provide a dedicated clear (×) button, shown while the field contains text, that empties the query in one action, and MUST also support clearing by deleting the text manually.
- **FR-008**: The system MUST define worktree-row behavior explicitly. When the repository row itself matches the query, its parent row and all of its worktree rows are shown — subject to the Worktrees toggle and to any other active filter (search composes with the state/"Failed" filter as an AND per FR-010, so a matching repo shows only those worktrees that also pass the active state filter). When the repository row does NOT match but one or more of its worktrees' current branch matches, the system MUST show the parent row together with ONLY the matching worktree row(s), hiding the non-matching sibling worktrees. A worktree is never orphaned from its parent. When neither the repository nor any of its worktrees matches, the entire group is hidden.
- **FR-009**: The system MUST keep the active query applied across list changes (refresh, row deletion, pull-all, cleanup) without the user re-entering it.
- **FR-010**: The system MUST compose the search with the existing "Failed" state filter and the Worktrees visibility toggle as a logical AND — an entry is shown only if it satisfies the search AND the other active view controls.
- **FR-011**: The system MUST make the search field non-interactive while a long operation (Refresh, Pull all, Cleanup) is running, consistent with how the app blocks its other view-reconfiguring controls (filter chips, sort), and MUST restore it when the operation settles.
- **FR-012**: The search state MUST be session-only (in-memory) and MUST NOT be persisted across application restarts, and MUST NOT trigger any git operation or network activity — filtering operates purely on already-observed repository data.

### Key Entities *(include if data involved)*

- **Search query**: the current text the user has entered; drives filtering. Session-only, not persisted. Empty/whitespace = inactive.
- **Repository entry (searchable fields)**: the already-surfaced identity of a repository row — remote slug, directory name, origin (remote URL), current branch — that the query is matched against. No new data is collected for this feature.
- **Worktree row**: a nested child of a repository row with its own current branch, which participates in matching per FR-008.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a list of at least 50 repositories, a user can isolate a specific repository by typing a distinguishing fragment in a single continuous action (no scrolling required) and see only matching rows.
- **SC-002**: After the user stops typing, the filtered result is visible within roughly a quarter-second (the debounce idle period plus render), and does not visibly flicker or recompute on every intermediate keystroke.
- **SC-003**: 100% of matches are correct: every displayed row contains the query text (case-insensitively) in at least one of slug, name, origin, or current branch, and no row lacking the text in all four is displayed (subject to the FR-008 worktree rule).
- **SC-004**: A query that matches nothing produces a clear "no matches" message in 100% of cases, and clearing the query restores the exact list the user would see with no search active (given the same other filters), every time.
- **SC-005**: While any long operation runs, the search field cannot be edited, and it becomes editable again once the operation settles, with the prior query preserved.

## Assumptions

- **Debounce period**: 150 ms as specified in the request — long enough to coalesce fast typing, short enough to feel immediate. Treated as the target; the exact value is an implementation tuning knob, not a hard contract.
- **Match semantics**: case-insensitive substring ("contains"), not fuzzy/prefix/regex matching — the simplest behavior that satisfies "find the repo whose identity contains this text."
- **Field set is exactly the four named fields** (slug, name, origin, current branch). Other row data (ahead/behind counts, state glyph, full path tooltip) is intentionally out of search scope.
- **Worktree matching rule (FR-008)**: decided in clarification (2026-07-21) — a matching repository shows all its worktrees, but a repository that matches only via a worktree branch shows just the matching worktree row(s) under its parent; non-matching siblings are hidden and a worktree is never orphaned from its parent.
- **Composition with existing filters is AND** (search ∩ Failed chip ∩ Worktrees toggle), matching how stacked filters conventionally behave.
- **Search is session-only** and reuses the existing observed-repository data already loaded in the view — consistent with Principle V (local-only, minimal footprint) and Principle II (read-only): no persistence, no new git calls, no network.
- **Lockout during long operations** follows the existing Principle IV behavior for view-reconfiguring controls (filter chips, sort): non-interactive with a "not-allowed" cursor, no colour/opacity change required for the field itself.
- **Scope is the single repository table** in the main window; there is no separate search surface or global command palette in scope.
