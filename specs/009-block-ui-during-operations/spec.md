# Feature Specification: Block UI During Long Operations

**Feature Branch**: `009-block-ui-during-operations`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Block interface during long operation or when options are not available. Block cleanup and pull when there is no repos on the list. Refresh need to stay active when list is empty. When any long action is perform other buttons should be blocked refresh, pull, cleanup (and settings as we don't want to modify list of services then). When long operation is happening loader should be visible - dim table (repositories should be barely visible), reuse loader we used previously."

**Revision input** (2026-07-19, same day): "I want to change implementation. dimmed should be rows with repositories in the table and each button separately only. No dim for the whole UI."

**Revision input** (2026-07-19, same day, post-implementation): "table headers should be inactive and dimmed too."

**Revision input** (2026-07-19, same day, continued): "Users shouldn't be able to use filters too when such operations happens - not dimmed, but mouse change to inactive. Mouse should change cursor to inactive too for buttons. Buttons should be disabled it means should not interact, no color change like now. tooltip with directory over repositories should not be shown too." ... "the intention is to block all operations on repositories, when long actions is happening - loader is shown."

## Clarifications

### Session 2026-07-19

- Q: How should the loader appear during a long operation (SC-002 "full duration" vs the existing 150ms show-delay)? → A: Reuse the existing loader's show-delay and minimum-visible timing; a very short operation may complete before the loader paints, so the loader is guaranteed only for operations long enough to cross the show threshold.
- Q: During a long operation, what becomes non-interactive besides the four named toolbar controls? → A: Full lockout — the dim also blocks all pointer/keyboard input to everything behind it, so row-level buttons (delete, launch actions) and the remaining toolbar controls (Worktrees toggle, filter chips, sort) all go inert for the operation's duration. **Superseded by the 2026-07-19b revision below, then substantially reinstated (minus the whole-viewport dim) by 2026-07-19e.**

**Adversarial review resolutions (2026-07-19):** three spec contradictions were surfaced by an adversarial review and resolved directly:
- Restore semantics: FR-006 reworded from "restore full interactivity to all controls" (which could re-enable controls that should stay disabled) to restoring each control's *pre-operation eligibility* (empty-list rules still apply to bulk actions).
- Recovery guarantee: added FR-013 — lock release is bound to operation *settlement* (resolve, failure-result, or rejection), owned by one always-executed path, so a rejected inter-process call can never leave the global lockout stuck. Grounded in the existing per-repo deadline; no new watchdog.
- Gating source: split the ambiguous "Repository list" entity into **Discovered repository set** (authoritative for FR-007/FR-010 gating) and **Visible repository view** (filtered/sorted projection), so gating can never be implemented against filtered visibility.

### Revision 2026-07-19b — Scope narrowed from whole-UI lockout to per-row/per-button (superseded by 2026-07-19e)

The "Full lockout" answer above (whole app made `inert`, one dim overlay covering everything) was **replaced** at this point in the day: no application-wide dim, the repository table rows dim in place, the three action buttons block each other, and everything else (Settings, Worktrees toggle, filter chips, sort, row-level actions) stayed fully interactive. **This narrowing is largely reversed by Revision 2026-07-19e below** — only the "no whole-viewport dim overlay" and "no native `inert`" decisions survive; almost everything else this revision opened back up is closed again, with a different (non-dimming, cursor-only) visual treatment for what wasn't already covered by the row/header dim.

### Session 2026-07-19c (post-revision clarification)

- Q: Does the table-area loader still appear during a long operation, alongside each button's own busy state? → A: Keep both — the loader over the dimmed table (FR-005) and the acting button's own busy state (FR-003) are independent, simultaneous cues.
- Q: Does the row dim (FR-004) apply to nested worktree rows as well as top-level repository rows? → A: All visible rows dim together, repository and worktree alike.

### Revision 2026-07-19d — Sort-header row joins the dim + lock

- Q: Should the sort-header row also become inactive and dimmed while a long operation runs? → A: Yes — dims to barely-visible like the table rows, and becomes non-interactive to pointer and keyboard. This is the first control 2026-07-19b had opened up that closes back down. See FR-014.

### Revision 2026-07-19e — Scope re-expanded: block (almost) all repository operations, cursor-only for controls that must not dim

Immediately after implementing 2026-07-19b/c/d, further live feedback made the actual intent explicit: **while a long operation is running (i.e., its loader is shown), the application MUST block all operations on repositories** — not just the three toolbar buttons and, now, the sort header. This is a near-full reinstatement of the original "Full lockout" answer, but implemented without a whole-viewport dim or native `inert`, and with an explicit split between controls that dim and controls that must NOT change appearance at all:

- **Settings and the Worktrees toggle are blocked again** — the original input's reasoning ("we don't want to modify list of services then") applies to Settings, and is extended to the Worktrees toggle (it reconfigures what's rendered mid-operation). This reinstates FR-011 in substance and removes the Worktrees-toggle carve-out from FR-012.
- **Filter chips are blocked.** Unlike the table rows/sort header, filter chips MUST NOT dim or otherwise change colour — only the mouse cursor indicates inactivity (`not-allowed`), and they stop responding to click/keyboard.
- **Row-level actions (delete, custom launch buttons) are blocked**, with the same non-dimming, cursor-only treatment as filter chips.
- **The directory-path tooltip on a repository row's name MUST NOT appear** while a long operation is running (no other row tooltip is affected).
- **Table rows become fully inert, not just visually dimmed**: in addition to the existing barely-visible dim (FR-004), a row is removed from the tab order and none of its interactive elements respond, for the duration.
- **The three action buttons' own "blocked" state (the two NOT running) MUST NOT change colour/opacity either** — this replaces the button styling used since the feature's original implementation (`opacity: 0.45`) with the same non-dimming, cursor-only treatment used for filter chips and row actions. The **running** button's own busy indicator is unchanged (still shows its own state, e.g. dimmed spin icon) — this revision only touches the *blocked* (non-running) button styling.
- **What is still explicitly out of scope**: there is still no whole-viewport dim and no native `inert` on the whole app — the loader stays table-scoped, and every "blocked" control is blocked individually, by its own render logic, not by a single global input barrier. This keeps FR-013's settlement-based release working per-control, exactly as before.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which action is running and can't start a conflicting one (Priority: P1)

While one of Refresh, Pull all, or Cleanup is running, the user cannot start
either of the other two, cannot open Settings, cannot toggle Worktrees, cannot
change the filter or sort, and cannot run a row-level action (delete, custom
launch) — the button that is running shows a busy indicator, the other two
buttons and every other blocked control show they are unavailable (the table
rows and the sort-header row dim to barely-visible; every other blocked
control keeps its normal appearance and only shows a "not-allowed" cursor).
The directory-path tooltip does not appear on rows for the duration.

**Why this priority**: This is the core of the request and the highest-risk
gap. Today Refresh only disables itself, so a user can kick off a Refresh
mid-Pull-all and get confusing, overlapping table updates; changing the
observed-directory set, the sort order, the visible filter, or deleting/
launching against a row mid-operation is exactly the kind of "operation on a
repository while another one is already touching it" the feature exists to
prevent.

**Independent Test**: Start each long operation (Refresh, Pull all, Cleanup)
on a non-empty list and confirm that, for its full duration: the other two
buttons, Settings, the Worktrees toggle, every filter chip, the sort-header
row, and every row-level action are all non-interactive (by pointer and by
keyboard); the table rows and sort-header row are dimmed; the loader is
visible over the table; the running button shows its busy indicator; no row's
directory-path tooltip appears; and — apart from the row/header dim — nothing
else changes colour. After the operation ends (including a forced failure),
every control returns to its pre-operation eligibility (FR-006) and no dim,
loader, or lock remains.

**Acceptance Scenarios**:

1. **Given** repositories are listed and idle, **When** the user starts Pull all, **Then** Refresh and Cleanup individually show they are non-interactive, Pull all shows a busy indicator, the table rows and the sort-header row dim to barely-visible, and the loader appears over the table until Pull all completes.
2. **Given** repositories are listed and idle, **When** the user starts Cleanup, **Then** Refresh and Pull all individually show they are non-interactive, Cleanup shows a busy indicator, the table rows and the sort-header row dim, and the loader appears until Cleanup completes.
3. **Given** repositories are listed and idle, **When** the user starts Refresh, **Then** Pull all and Cleanup individually show they are non-interactive, Refresh shows a busy indicator, the table rows and the sort-header row dim, and the loader appears until Refresh completes.
4. **Given** a long operation is running, **When** the user clicks or presses Enter/Space on either of the other two buttons, on Settings, on the Worktrees toggle, on any filter chip, on the sort-header row, or on a row's delete/launch button, **Then** nothing happens in every case.
5. **Given** a long operation is running, **When** the user hovers Settings, the Worktrees toggle, a filter chip, or a row's delete/launch button, **Then** the cursor shows as inactive (not-allowed) and none of these controls change colour or opacity.
6. **Given** a long operation is running, **When** the user hovers a repository row's name, **Then** no directory-path tooltip appears.
7. **Given** a long operation is running, **When** the operation ends (including in failure), **Then** the row dim, the sort-header dim, and the loader are removed, and every control (the three buttons, Settings, the Worktrees toggle, filter chips, sort header, row-level actions) returns to its normal (list-appropriate) interactivity.

---

### User Story 2 - Disable bulk actions when there is nothing to act on (Priority: P2)

When the discovered repository set is empty, Pull all and Cleanup are disabled
because there is nothing to pull or clean up, while Refresh stays enabled so the
user can rescan and (re)populate the set.

**Why this priority**: Prevents dead-end actions and clarifies the one control that
is still meaningful on an empty list. It builds on the same disabled-control
mechanism as US1 but is independently valuable and testable.

**Independent Test**: With an empty discovered repository set, confirm Pull all
and Cleanup are non-interactive while Refresh is interactive; then populate the
set (via Refresh or configuring a directory) and confirm Pull all and Cleanup
become interactive again.

**Acceptance Scenarios**:

1. **Given** the discovered repository set is empty, **When** the user views the toolbar, **Then** Pull all and Cleanup are non-interactive and Refresh is interactive.
2. **Given** the discovered repository set is empty, **When** the user activates Refresh and the scan finds repositories, **Then** Pull all and Cleanup become interactive.
3. **Given** the discovered repository set is non-empty, **When** the user removes all observed directories (or a scan yields zero repositories), **Then** Pull all and Cleanup become non-interactive while Refresh stays interactive.

---

### Edge Cases

- **Refresh on an empty list**: Refresh is allowed; while it runs it is itself the long operation (busy), so the table rows and the sort-header row dim, the loader shows over the table, and every other control (including Pull all/Cleanup, subject to their own empty-list gating) is blocked exactly as it would be for any other long operation.
- **Operation errors, rejects, or times out**: every visual and interactive lock (row dim, sort-header dim/lock, Settings, Worktrees toggle, filter chips, row-level actions, the loader, and the acting button's busy state) MUST be restored via the single always-executed release path (FR-013), including when the underlying inter-process call *rejects* rather than resolving with a failure result. No control may ever be left permanently stuck blocked.
- **Empty-list semantics**: Pull all and Cleanup are gated on whether *any* repository is discovered, not on the filtered view. A filter that hides all rows (repositories exist but none match the active chip) leaves Pull all and Cleanup enabled — they act on the full set — see FR-010. (This is independent of, and unaffected by, the long-operation lock in FR-001/FR-014–FR-018.)
- **Keyboard access**: every control blocked by a running operation MUST NOT be activatable via Enter/Space, not just via pointer.
- **Rapid double-activation**: a second activation of the same button before its first operation registers as running MUST NOT start a second operation.
- **Visual treatment differs by control**: the table rows and the sort-header row dim to barely-visible (a visible cue, since they are read-focused surfaces); Settings, the Worktrees toggle, filter chips, and row-level actions do NOT dim or otherwise change colour when blocked — only the cursor changes to indicate inactivity. This split is deliberate: dimming the whole interface was rejected (2026-07-19b), and now that (almost) everything is blocked again (2026-07-19e), most of it still must not visually change beyond the cursor.
- **Row tooltip suppression**: the directory-path tooltip on a row's name MUST NOT appear while a long operation runs; no other row tooltip (failed-pull glyph, action name) is required to be suppressed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While one of Refresh, Pull all, or Cleanup is running, the system MUST prevent activation of every other control that operates on repositories: the *other two* of those three buttons, Settings, the Worktrees toggle, every filter chip, the sort-header row, and every row-level action (delete, custom launch). Nothing besides the loader and the running button's own busy indicator remains active.
- **FR-002**: At most one of Refresh, Pull all, or Cleanup MUST run at a time; the system MUST NOT allow a second of these three to start while one is in progress.
- **FR-003**: The running button MUST visibly indicate its own busy state (unchanged from prior revisions — e.g. its existing busy/spin styling). The other two buttons, while blocked, MUST NOT change colour or opacity; blocked-state feedback for them (and for every other control blocked under FR-001) is limited to becoming non-interactive and showing an inactive (`not-allowed`) mouse cursor.
- **FR-004**: While one of Refresh, Pull all, or Cleanup is running, the system MUST dim every row currently rendered in the table — repository rows and, when visible, nested worktree rows alike — to barely-visible, AND MUST make each such row fully inert (removed from the tab order; no interactive element within it responds) for the duration. This is the only place besides FR-014 where dimming happens.
- **FR-005**: While one of Refresh, Pull all, or Cleanup is running, the system MUST display the previously-used loader indicator over the table, reusing that loader's existing show-delay and minimum-visible timing, alongside the acting button's own busy indicator (FR-003) — both shown together. Once shown, the loader MUST remain visible until the operation completes (subject to the minimum-visible time); an operation finishing before the show-delay need not paint the loader at all.
- **FR-006**: When a long operation ends, the system MUST remove the row dim, the sort-header dim/lock, and the loader, and restore every control (the three buttons, Settings, the Worktrees toggle, filter chips, sort header, and row-level actions) to its *pre-operation eligibility*, rather than blanket-enabling everything: Pull all and Cleanup return to the state dictated by the empty-list rules (FR-007/FR-010); everything else returns to enabled.
- **FR-007**: When the discovered repository set is empty, the system MUST disable Pull all and Cleanup.
- **FR-008**: When the discovered repository set is empty, the system MUST keep Refresh enabled.
- **FR-009**: Every control blocked by a running operation (per FR-001) MUST NOT be activatable by pointer click or by keyboard (Enter/Space).
- **FR-010**: The empty-list rule (FR-007/FR-008) MUST be evaluated against the full set of discovered repositories, not the filtered view: Pull all and Cleanup MUST be disabled only when zero repositories exist at all. This is independent of, and unaffected by, the long-operation lock.
- **FR-011** (reinstated, Revision 2026-07-19e): Settings MUST be blocked while a long operation is running — the observed-directory list MUST NOT be editable mid-operation.
- **FR-012** (reinstated in part, Revision 2026-07-19e): The Worktrees toggle MUST be blocked while a long operation is running. (Row-level actions and filter chips are separately covered by FR-001/FR-017/FR-016; there is still no single whole-app input barrier — see Revision 2026-07-19e.)
- **FR-013**: Lock release MUST be bound to the operation's *settlement*, not to its success path: every lock and dim covered by FR-001/FR-004/FR-005/FR-014 MUST be cleared whether the operation resolves successfully, resolves with a failure result, or rejects/throws. A single always-executed release path MUST own the unlock so that no unhandled rejection can leave any control permanently stuck blocked. This relies on the existing per-repo deadline (currently 60 s), so no additional watchdog is introduced.
- **FR-014** (added, Revision 2026-07-19d): While one of Refresh, Pull all, or Cleanup is running, the system MUST dim the table's sort-header row to barely-visible (the same treatment as the table rows, FR-004) and MUST prevent sort activation via pointer click or keyboard (Enter/Space) for the operation's duration.
- **FR-015** (added, Revision 2026-07-19e): Filter chips MUST be blocked (non-interactive) while a long operation is running. Unlike FR-004/FR-014, filter chips MUST NOT dim or otherwise change colour — the mouse cursor changing to inactive (`not-allowed`) is the only visible cue.
- **FR-016** (added, Revision 2026-07-19e): Row-level actions (delete, custom launch buttons) MUST be blocked while a long operation is running, with the same non-dimming, cursor-only treatment as FR-015.
- **FR-017** (added, Revision 2026-07-19e): The directory-path tooltip on a repository row's name MUST NOT appear while a long operation is running. No other row tooltip is required to be suppressed.

### Key Entities

- **Action button**: Refresh, Pull all, or Cleanup — the running one shows its own busy state; the other two show they are blocked without any colour/opacity change (FR-003); Pull all and Cleanup are additionally gated by the empty-list rule (FR-007/FR-010), independent of the long-operation lock.
- **Long operation**: a running Refresh, Pull all, or Cleanup; at most one of these three exists at a time and drives every lock/dim in this spec.
- **Table rows**: repository rows and, when the Worktrees toggle has them visible, nested worktree rows — dimmed to barely-visible AND made fully inert (not just visual) for the duration of any long operation (FR-004).
- **Sort-header row**: the column-header controls used to change sort dimension/direction. Dims to barely-visible alongside the table rows and becomes non-interactive for the duration (FR-014); returns to normal on settlement.
- **Filter chips, Settings, Worktrees toggle, row-level actions**: all blocked (non-interactive) while a long operation runs, but explicitly MUST NOT dim or change colour — only the cursor communicates inactivity (FR-011/FR-012/FR-015/FR-016).
- **Row directory-path tooltip**: suppressed entirely while a long operation runs (FR-017); resumes on settlement.
- **Discovered repository set**: the full set of repositories found by the last scan, independent of any active filter or sort. This is the *authoritative* set for gating: Pull all and Cleanup are disabled only when this set is empty (FR-007/FR-010), and they act on this whole set when run.
- **Visible repository view**: the filtered/sorted projection of the discovered set that is currently rendered as rows. It governs what the user sees but MUST NOT gate Pull all/Cleanup — a filter that hides every row does not disable them (FR-010).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During any long operation, exactly one of the three buttons (Refresh, Pull all, Cleanup) is interactive/busy (the one running); every other control that operates on repositories — the other two buttons, Settings, the Worktrees toggle, every filter chip, the sort-header row, and every row-level action — cannot be activated by pointer or keyboard, 100% of the time.
- **SC-002**: During any long operation that lasts long enough to cross the loader's show-delay, the repository table's rows and the sort-header row are dimmed to barely-visible and the loader is visible over the table for the remainder of the operation; no other control changes colour or opacity.
- **SC-003**: When the discovered repository set is empty, Pull all and Cleanup cannot be triggered and Refresh can be triggered, 100% of the time; when the set is non-empty but a filter hides every row, Pull all and Cleanup remain triggerable (subject to no long operation being in progress).
- **SC-004**: After every long operation ends — including failures, timeouts, and inter-process rejections/errors — every control returns to its list-appropriate interactivity (per FR-006), and no dim, lock, or loader remains, in 100% of runs.
- **SC-005**: No two of Refresh, Pull all, or Cleanup ever run concurrently.

## Assumptions

- The three "long operations" are the existing header/toolbar actions Refresh, Pull all, and Cleanup; no new operation type is introduced.
- "Reuse the loader we used previously" refers to the existing loader indicator; it is scoped to sit over the table rather than the whole viewport.
- As of Revision 2026-07-19e, the only controls that remain fully unaffected by a long operation are: none at the toolbar/table level — every control that can start another operation, reconfigure the view, or act on a repository is blocked while one is running. The distinguishing design choice is *how*: the table rows and sort-header row dim (a visible cue, since they are read surfaces); everything else (Settings, Worktrees toggle, filter chips, row-level actions) is blocked without any colour change, cursor-only.
- "Empty list" for gating Pull all and Cleanup means zero repositories discovered at all; a filter that hides every row does not count as empty (FR-010). This gating is independent of the long-operation lock.
- Existing mutual exclusivity between Pull all and Cleanup is retained and generalized to include Refresh, scoped to just these three buttons; no existing safety behavior is weakened.
- There is still no whole-viewport dim and no native `inert` on the whole application — every blocked control is blocked individually by its own render logic, which is what keeps FR-013's settlement-based release correct per-control.
- No new persisted setting and no new runtime dependency are introduced.
