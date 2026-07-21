# Feature Specification: Explain Why a Repository Wasn't Updated by Pull All

**Feature Branch**: `013-pull-warn-reasons`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "When I click pull all two repos still stay as outdated: tf-auth0-pro, mb-pro-customer-frontend-api, identity-web-bff. Investigate why. Could we add warn icon with explanation why were not update"

## Investigation Summary *(context for this spec — see research.md for detail)*

The three reported working trees stayed behind their upstream after "Pull all" while emitting a `git` fsmonitor daemon error (`fsmonitor_ipc__send_query: unspecified error on '.git/fsmonitor--daemon.ipc'`). That error prints to **stderr** but does not, by itself, make git exit non-zero — so it is a symptom, not the direct blocker. The direct problem is a **product gap**: "Pull all" records only four outcomes (`updated`, `already-current`, `skipped`, `failed`), and a working tree that isn't brought current is surfaced only as a faint red row tint (feature 007's "Failed" state) with **no explanation of the cause**. Every distinct reason — a diverged history, an unreachable remote, dirty work that couldn't be safely set aside, a timeout, no tracked upstream — collapses into one opaque state. The user cannot tell *why* a repo stayed outdated.

This feature closes that gap: capture the reason a working tree was not brought current and surface it on the row as a warning icon with a hover explanation.

## Clarifications

### Session 2026-07-20

- Q: How much detail should the warn tooltip show? → A: A short human-readable **category** (e.g. "Diverged from upstream — fast-forward not possible") **plus** the **underlying git error text** when one is available. The combination makes obscure environmental causes (such as the fsmonitor daemon error) visible while still leading with a plain-language summary.

### Session 2026-07-21

- Q: Which working trees should show the warn icon after Pull all? → A: Trees whose update was **attempted and failed** (diverged, remote unreachable, stash failed, timed out), **plus** trees that were **skipped because they are genuinely stuck** — directory unavailable or on a detached HEAD. A tree with **no tracked upstream is never warned**: it has nothing to be out of date against and cannot be "outdated".
- Q: Should a tree's warning survive an app restart? → A: **In-memory only** — warnings persist until the next Pull all or an app restart; nothing new is persisted (mirrors feature 007's in-memory failed-state tracking). After a restart, icons are absent until the next Pull all reproduces the outcome.
- Q: How does the warn affordance relate to Principle IV's per-row state indicator, and where does it live? → A: A **distinct, reusable warning-icon affordance** in the **first (slug) column, nested to the slug and positioned below the existing state indicator** (not in the right-side row-action icon area). It is a **generic, source-agnostic row-warning surface** — not coupled to "Pull all" — so other producers (e.g. a future "Refresh"-detected warning) can populate the same icon. This feature wires "Pull all" reasons into it; populating it from other operations is out of scope here but MUST NOT require redesigning the affordance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See why a repository stayed outdated (Priority: P1)

A user runs "Pull all" and one or more working trees are not brought up to date. Instead of silently staying "outdated" (or only turning a faint red), each such row shows a warning icon. Hovering the icon reveals a plain-language reason the update did not happen, followed by the underlying git error text when git produced one.

**Why this priority**: This is the core of the request. Without it, a working tree that can't be updated is indistinguishable from a transient glitch — the user has no way to know whether to retry, resolve a conflict, reconnect to the network, or ignore the repo entirely.

**Independent Test**: Run "Pull all" against a set of working trees where at least one cannot be fast-forwarded (e.g. a diverged branch and an unreachable remote). Confirm each un-updated working tree shows a warning icon whose tooltip states a category reason and, where present, the underlying git message; confirm working trees that were successfully updated or were already current show no warning icon.

**Acceptance Scenarios**:

1. **Given** a working tree whose branch has diverged from its upstream, **When** the user runs "Pull all", **Then** that row shows a warning icon whose tooltip identifies the cause as a divergence that cannot be fast-forwarded.
2. **Given** a working tree whose remote cannot be reached (offline, auth failure, or the fetch otherwise fails), **When** the user runs "Pull all", **Then** that row shows a warning icon whose tooltip identifies the cause as an inability to reach/fetch the remote and includes the underlying git error text.
3. **Given** a working tree that was successfully fast-forwarded, **When** the user runs "Pull all", **Then** that row shows **no** warning icon.
4. **Given** a working tree that was already current, **When** the user runs "Pull all", **Then** that row shows **no** warning icon.

---

### User Story 2 - Understand a repository that was skipped because it is stuck (Priority: P2)

A working tree could not even be attempted by "Pull all" because it is genuinely stuck — its directory is unavailable, or it is on a detached HEAD (no branch to fast-forward). The user hovers the warning icon and learns the working tree was skipped and why, rather than assuming it was quietly up to date.

**Why this priority**: Distinguishes "we couldn't even attempt this" from "we tried and it failed", which changes what the user should do next (restore the directory / check out a branch vs. resolve a conflict or retry). Lower priority than P1 because these are a smaller, more static set. A tree with no tracked upstream is deliberately excluded — it has nothing to be out of date against, so warning on it would be persistent noise (e.g. login-only brands that legitimately never pull).

**Independent Test**: Run "Pull all" with (a) a working tree whose directory has been removed and (b) a working tree on a detached HEAD, and confirm each shows a warning icon whose tooltip explains the specific stuck reason; confirm a tree with no tracked upstream shows no warning icon.

**Acceptance Scenarios**:

1. **Given** a working tree whose directory is unavailable, **When** the user runs "Pull all", **Then** its warning icon tooltip states it was skipped because the working tree is unavailable.
2. **Given** a working tree on a detached HEAD, **When** the user runs "Pull all", **Then** its warning icon tooltip states it was skipped because it is not on a branch.
3. **Given** a working tree with no tracked upstream (whether or not it has local commits), **When** the user runs "Pull all", **Then** that row shows **no** warning icon.

---

### Edge Cases

- **fsmonitor / stderr-only git noise**: when git prints an error to stderr (e.g. the fsmonitor daemon error) but still succeeds and the working tree is brought current, no warning icon appears — success is success. The underlying-error text is surfaced only for working trees that were actually not updated.
- **A working tree becomes current between the pull and the follow-up rescan**: the warning reflects the outcome of the "Pull all" attempt itself; the reason is tied to that run's result, not re-derived from a later local state.
- **No tracked upstream**: a working tree with no tracked upstream is never warned, even if the user expected it to update — it has no upstream to be out of date against.
- **After an app restart**: warning icons are absent (reasons are in-memory only) until the next "Pull all" reproduces the outcome.
- **Nested worktrees**: a repository row and each of its worktree rows are independent working trees — each carries its own outcome and its own (or no) warning icon.
- **The reason text is long or multi-line** (git errors often are): the tooltip must remain readable and must not be clipped by the table edges (consistent with the tooltip-positioning behavior established in feature 012).
- **A subsequent successful "Pull all" (or a local fix)**: a previously shown warning icon clears when the working tree is next brought current or no longer reports the failing outcome (consistent with feature 007's failed-state pruning).
- **Manual "Refresh" after a warning**: because Refresh is local-only, it clears a warning only when the cause is locally visible as resolved (same limitation as feature 007 — a purely environmental/network failure on an otherwise-clean tree may also be cleared, and only a re-run of "Pull all" truly reconfirms).
- **A warned tree that was skipped as stuck vs. one that failed**: the stuck tree (unavailable / detached) shows the warning icon but is not red-tinted and does not appear under the "Failed" filter; a failed tree shows the icon *and* the existing red tint and appears under "Failed".
- **While "Pull all" is running**: rows are dimmed and their tooltips suppressed (feature 009); warning icons reflect only a completed run, so they appear/refresh after the operation settles, not mid-run.
- **Timeout**: a working tree whose update exceeds the per-operation time bound shows a warning icon indicating the operation timed out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record, for each working tree in the warned set (defined in FR-004), a reason describing why it was not brought current.
- **FR-002**: The recorded reason MUST distinguish at least the following categories: diverged (fast-forward not possible), remote unreachable / fetch failed, local changes could not be safely set aside, operation timed out, detached HEAD, and working tree unavailable — plus a catch-all for any other unexpected git failure during the attempt (which still carries the underlying error text per FR-003).
- **FR-003**: When git produces error output for a failed attempt, the system MUST capture that underlying error text and associate it with the working tree's reason.
- **FR-004**: A working tree MUST display a warning icon on its row when the most recent "Pull all" either (a) attempted to update it and failed, or (b) skipped it because its directory is unavailable or it is on a detached HEAD. Working trees that were updated, were already current, or were skipped solely for lack of a tracked upstream MUST NOT display a warning icon.
- **FR-005**: A working tree with no tracked upstream MUST NOT display a warning icon, regardless of whether it is current, because it has no upstream against which "out of date" could be defined.
- **FR-006**: Hovering (or otherwise focusing) the warning icon MUST reveal an explanation that leads with the plain-language category and, when available, includes the underlying git error text.
- **FR-007**: The warning explanation MUST remain fully readable and MUST NOT be clipped by the table's edges, consistent with existing row-icon tooltip behavior.
- **FR-008**: A working tree's warning icon MUST clear once the tree leaves the warned set — either the next "Pull all" brings it current / no longer fails, or a manual "Refresh" finds the cause locally resolved (a merged divergence, a restored directory, a reattached branch), reusing feature 007's existing prune-on-refresh rule so stale warnings do not persist.
- **FR-009**: The warning icon and its explanation MUST NOT trigger any network activity on hover or display; they reflect only the result already captured by the last "Pull all" run.
- **FR-010**: Introducing the warning icon MUST NOT change the behavior of "Pull all" itself — the same working trees are updated, skipped, or left untouched as before; only the reporting of reasons is added.
- **FR-011**: Captured reasons and their warning icons MUST be held only for the current application session (in memory); they MUST NOT be persisted, MUST be cleared on restart, and reappear only if a subsequent "Pull all" reproduces the outcome.
- **FR-012**: The warning icon MUST be additive to feature 007's existing failed-state UI, not a replacement: the faint-red row tint and the "Failed" filter chip keep their current meaning (a failed update attempt). A warned tree that was skipped as stuck (unavailable / detached HEAD) therefore shows a warning icon without being red-tinted or included in the "Failed" filter.
- **FR-013**: The warning MUST NOT be conveyed by color alone — the icon itself (and its accessible name / on-focus text) MUST identify the row as having an unresolved reason, so the state is perceivable without relying on the red tint or on color perception.
- **FR-014**: The warning icon MUST render in the branch/tracking column, at the end of the branch name (first line of that column) — not in the right-side row-action icon area — so it reads as part of the row's git state, not its identity. It MUST remain visible when the branch name is long: the branch name truncates before the icon, never the reverse. (Revised 2026-07-21 twice, per live-testing feedback: first from the slug column to a fixed position on the branch-tracking column's right edge — whose tooltip also collapsed to an unreadably narrow width because the icon's own tiny box was its tooltip's positioning container; then from that fixed corner position to inline at the end of the branch name, which reads more naturally as "this branch has a warning" and lets the tooltip grow rightward into open row space instead of leftward back over the branch text.)
- **FR-015**: The warning icon MUST be a reusable, source-agnostic row-warning affordance: its presence and tooltip are driven by a warning associated with the row, independent of which operation produced it. This feature populates that warning from "Pull all" outcomes; enabling other producers (e.g. "Refresh"-detected conditions) is out of scope here but MUST NOT require redesigning the affordance.

### Key Entities *(include if feature involves data)*

- **Update outcome**: the per-working-tree result of a "Pull all" run. Extends today's flat result with an associated **reason** — a category identifying why the working tree was not brought current, plus optional underlying git error text — present for working trees in the warned set (FR-004).
- **Warning indicator**: a reusable, source-agnostic per-row affordance (icon in the first/slug column + on-hover/on-focus explanation) driven by a warning associated with the row. In this feature it is derived from an update outcome's reason and present only for working trees in the warned set of the most recent run; session-scoped and cleared on restart. Its design admits other future producers without change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a "Pull all" run, 100% of working trees in the warned set (failed attempts plus unavailable/detached-HEAD skips) display a warning icon, and 0% of working trees that were updated, were already current, or have no tracked upstream display one.
- **SC-002**: For any working tree that shows a warning icon, the user can determine the reason it wasn't updated within a single hover, without opening any external tool, log, or terminal.
- **SC-003**: For failures where git emitted an error (including obscure environmental ones such as the fsmonitor daemon error), the underlying git message is visible in the warning explanation.
- **SC-004**: A working tree's warning icon disappears on the next "Pull all" that brings it current, in 100% of cases.
- **SC-005**: Displaying or hovering a warning icon produces zero network requests.
- **SC-006**: A warned row is identifiable without relying on color — the warning icon (and its accessible name) marks the row even for a user who cannot perceive the red tint.

## Assumptions

- The warning surface reuses the existing per-row hover-tooltip mechanism (as used for the delete and custom-action icons), not a modal, a log panel, or a separate view — the user asked specifically for a "warn icon with explanation". The warning icon lives in the branch-tracking column, inline at the end of the branch name (FR-014, revised twice from an initial slug-column placement, then a fixed branch-cell-corner placement, per live-testing feedback).
- The warning icon is built as a reusable, source-agnostic affordance (FR-015). Only the "Pull all" producer is implemented in this feature; wiring other producers (e.g. "Refresh"-detected warnings, which the user anticipates) is explicitly out of scope here.
- A working tree is a warning candidate when the most recent "Pull all" either failed to update it or skipped it as stuck (directory unavailable or detached HEAD). Working trees with no tracked upstream are never warned. Warnings are session-scoped (in memory) and cleared on restart.
- Reason categories are derived from the outcome of the "Pull all" attempt (fetch / classify / fast-forward / stash steps), reusing the existing per-operation time bound; no new git probes beyond what "Pull all" already runs are required to categorize a reason.
- This feature is renderer + "Pull all" reporting only: it extends the result data already returned by "Pull all" and the row rendering. It introduces no new persisted setting and does not change what "Refresh" *does* (still local-only and network-free) — it only lets Refresh's existing prune-on-refresh step (feature 007) clear a resolved warning alongside the failed-state it already prunes.
- Feature 007's failed-state UI (faint-red row tint + "Failed" filter chip) is reused as-is and keeps its current meaning; this feature layers a warning icon on top rather than redefining or widening that filter (per FR-012). Widening the "Failed" filter to also match stuck/skipped trees is explicitly out of scope.
- The fsmonitor daemon error observed during investigation is an environmental git-state issue, not something this feature fixes; this feature only makes such underlying errors *visible* when they coincide with a failed update.
