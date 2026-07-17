# Phase 0 Research: Startup Loading Indicator

No `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`. The open items
below are design/technique choices; each is resolved against the existing codebase
and the constitution (v1.4.0).

## Decision 1 — Where the load state lives

**Decision**: Add a renderer-local `loadState` (`'loading' | 'ready'`) plus the
already-known `hasDirectories` (`settings.observedDirectories.length > 0`) and drive
a single "which screen" decision from them. No main/IPC/storage changes.

**Rationale**: The blank/flash defect is entirely a renderer paint-ordering bug.
`renderer.ts` currently calls `render()` with `rows = []` *before* `api.refresh()`
resolves, and `render()` shows the empty/add-directory screen for any zero-row state
(`renderer.ts:107-114`, `empty.ts`). The scan itself already exists and works. Fixing
it in the renderer is the smallest correct change (Principle V, YAGNI).

**Alternatives considered**:
- *Emit a "scanStarted/scanFinished" IPC event from main* — rejected: adds IPC surface
  for information the renderer already has (it initiates the scan). `preload.ts` even
  exposes `onScanProgress`, but per-item progress is out of scope (spec: indeterminate).
- *Keep logic inline in `render()`* — rejected: not unit-testable; the decision has
  three branches and timing, which the constitution wants covered by a runnable check.

## Decision 2 — State-first startup (no add-directory flash)

**Decision**: Restructure the boot IIFE so it reads `settings` first, decides the
initial screen, and only *then* paints. If directories are configured, initial screen
is the loader; the add-directory/empty screen is withheld until the scan resolves.

**Rationale**: FR-006 / FR-010 / SC-006 require the config evaluation to gate the first
meaningful paint. Today the first `render()` happens before we know scan results, so
the empty screen leaks. Reading settings is a fast local JSON read, so gating on it is
imperceptible.

**Alternatives considered**:
- *Render add-directory then swap to loader* — rejected outright by SC-006 (no transient
  flash allowed).
- *Hide everything until scan done* — rejected: that reintroduces the blank screen the
  feature exists to remove.

## Decision 3 — Anti-flicker timing (delay + minimum visible)

**Decision**: Loader is scheduled, not shown immediately. Start a ~150 ms delay timer
when the scan begins; if the scan finishes first, the loader never appears. Once shown,
keep it visible for a ~400 ms minimum before allowing it to be replaced by results.

**Rationale**: Matches the clarified answer (Session 2026-07-17). The delay suppresses a
flash on fast scans; the minimum-visible window prevents a just-appeared loader from
blinking out. Both thresholds are constants, centralized in `loadstate.ts`.

**Technique**: The pure module exposes helpers that compute *when* transitions may occur
(`remainingMinVisibleMs(shownAt, now)`), while `renderer.ts` owns the two `setTimeout`s.
Keeping the arithmetic pure makes the tricky "did it stay long enough" branch testable
without fake timers.

**Alternatives considered**:
- *CSS-only fade-in delay* — rejected: CSS can delay the *appearance* but cannot cancel a
  loader for a scan that already finished, nor enforce a minimum-visible floor once results
  are ready. Logic must own the schedule.

## Decision 4 — Loader visual (flat, indeterminate, centered)

**Decision**: A CSS-only flat indeterminate indicator (a thin sliding/pulsing bar or a
minimal ring) centered in the content area where the list renders. Reuse existing CSS
conventions in `styles.css` (there is already a `@keyframes spin` and a
`@media (prefers-reduced-motion: no-preference)` block).

**Rationale**: "Flat, minimal, non-skeuomorphic" (FR-002) and no new dependency
(Principle V). GPU-friendly `transform`/`opacity` animation keeps it 60 fps and never
blocks the main thread (Principle IV: must not freeze UI). The referenced Image #6 is
visual direction, not a pixel spec (spec Assumptions).

**Alternatives considered**:
- *Spinner icon reuse from the refresh button* — acceptable but the spec calls for a
  content-area loader distinct from the toolbar's in-progress affordance; a dedicated
  centered element reads more clearly as "the list is loading."
- *Skeleton rows* — rejected: heavier, implies known row count, contradicts "flat/minimal."

## Decision 5 — Accessibility scope

**Decision**: Purely visual loader this iteration; no reduced-motion branch or
screen-reader announcement (per clarification). Recorded as a tracked deviation in
`plan.md` Complexity Tracking.

**Rationale**: Explicit user scope decision. Noted so `/speckit-analyze` surfaces it as a
known, low-severity item rather than an oversight. Upgrade path is cheap (the
`prefers-reduced-motion` idiom already exists in `styles.css`).

## Decision 6 — Refresh reuse (US2)

**Decision**: The existing `doRefresh()` already flips a `refreshing` flag and re-renders;
the toolbar shows a busy spinner. US2 is satisfied by keeping that behavior. The new
loader is for the *startup* content-area state; refresh continues to use the toolbar
affordance over the already-rendered list.

**Rationale**: FR-009 asks that an explicit refresh "surface a loading affordance" — the
toolbar busy state already does. Reusing it avoids covering an already-useful list with a
full-content loader (better UX) and keeps the change minimal.

**Alternatives considered**:
- *Show the full content-area loader on every refresh* — rejected: it would blank an
  already-rendered, still-valid list; worse UX and larger change than needed.
