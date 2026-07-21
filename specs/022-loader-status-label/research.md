# Phase 0 Research: Label the Loader With the Active Operation

No `NEEDS CLARIFICATION` markers remained in the Technical Context — the two
real ambiguities (screen-reader treatment, Pull all's exact wording) were
already resolved during `/speckit-clarify` and are recorded in `spec.md`'s
Clarifications section. This document records the implementation decisions
made while designing the fix.

## Where the loader is built and shown

`#tableLoader` (`index.html:47`) is a single, persistent, empty `<div
class="table-loader" hidden>` — never removed from the DOM, only toggled via
`hidden`. `view/loader.ts`'s `setLoaderVisible(container, visible)` lazily
appends three `.loader-dot` children the first time it's shown
(`childElementCount === 0` guard) and thereafter only flips `hidden`. It has
exactly one call site: `renderer.ts`'s `beginBusyLock()`/`endBusyLock()`
pair, which is itself the single choke point for all four operations that
ever show this loader — `doRefresh()`, `doUpdateAll()` ("Pull all"),
`doCleanup()`, and the startup IIFE's initial load. Each of those four call
sites already unambiguously knows which operation it is (it's the one
calling `beginBusyLock()`), so no new "which operation is active" decision
function is needed — each site can simply pass its own literal label string
through the existing choke point.

## Decision 1: Thread the label through `beginBusyLock`/`setLoaderVisible`, not a new lookup

**Decision**: Add a required `label: string` parameter to `beginBusyLock`,
and an optional `label?: string` parameter to `setLoaderVisible`. Each of
the four `beginBusyLock(...)` call sites passes its own literal string
("Loading…", "Refreshing…", "Pulling…", "Cleaning up…").

**Rationale**:
- `beginBusyLock`/`setLoaderVisible` are already the exact choke point
  shared by all four operations — extending their signature is the smallest
  possible diff, and keeps the "which operation" fact where it's already
  known (the call site) instead of re-deriving it from renderer state flags
  (`refreshing`/`updating`/`cleaning`/`loadState`) a second time.
- No new branch or lookup table is introduced — this is four one-line call
  sites passing a literal, not a decision function. Per the constitution's
  Development Workflow, a dedicated runnable check is required for code that
  "mutates repository state" or breaks a "guard or safety behavior"; this
  change touches neither — it's a purely cosmetic label on an existing,
  unchanged busy/lock mechanism. This matches the precedent set by features
  017/018/020 (renderer/CSS-only changes with no new branching logic get no
  new test file).

**Alternatives considered**:
- *Derive the label inside `beginBusyLock` from the renderer's own
  `refreshing`/`updating`/`cleaning`/`loadState` flags* — rejected: this
  would add a real branch (a decision function worth its own test), for no
  benefit over letting each already-distinct call site say what it is
  directly.
- *A separate `view/operation.ts` label lookup keyed by an `Operation`
  union type* — rejected as premature structure for four literal strings
  used at four call sites; nothing else in the codebase needs to know "which
  operation is running" as a shared concept.

## Decision 2: DOM structure — wrap the dots so the label can sit above them

**Decision**: `setLoaderVisible`'s one-time build step now creates a
`.loader-label` element first, then a `.loader-dots` wrapper containing the
existing three `.loader-dot` children (previously appended directly to
`.table-loader`). `.table-loader` becomes a column flex container; the new
`.loader-dots` becomes the row flex container that `.table-loader` used to
be, carrying the existing `gap: 16px` between dots.

**Rationale**: The request asks for the label "above" the dots. `.loader-dot`'s
existing pulse-stagger animation selectors (`.loader-dot:nth-child(2)`,
`:nth-child(3)`) are `nth-child` *within their immediate parent* — moving the
three dots into a new immediate parent (`.loader-dots`) as children 1–3
leaves those selectors matching exactly as before; no animation rule needs
to change.

**Alternatives considered**:
- *`flex-direction: column` directly on `.table-loader` with no wrapper* —
  rejected: the three dots would stack vertically under the label instead of
  staying in a row, which isn't what "above the dots" (plural, in their
  existing side-by-side arrangement) asks for.

## Decision 3: Accessibility — `role="status"` on the persistent label element

**Decision** (from `/speckit-clarify`): the `.loader-label` element gets
`role="status"` at creation time (once, like the dots), so its later
`textContent` mutations are announced to assistive technology as a polite,
non-interruptive update.

**Rationale**: `role="status"` implies `aria-live="polite"` +
`aria-atomic="true"` without extra attributes. Because `.loader-label` is
created once and only ever has its `textContent` mutated (never removed and
re-inserted), it follows the standard, reliable pattern for a persistent
live region — the same shape already used by this app's toast notices
(`role="alert"`), just the polite variant since a routine "Refreshing…" is
status, not an alert.

## Decision 4: No new test file

**Decision**: No new file under `tests/`.

**Rationale**: Every changed line is either a literal string passed at an
existing call site, DOM element creation/text assignment with no branching,
or CSS. There is no new predicate, no new outcome mapping, and no mutating
git operation touched — the constitution's runnable-check mandate targets
exactly those, and none apply here. This mirrors features 017/018/020,
each of which shipped renderer/CSS-only changes with "no new pure/branching
logic... so no new test file was required."
