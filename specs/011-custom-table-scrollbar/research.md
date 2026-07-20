# Phase 0 Research: Custom Modern Table Scrollbar

No `NEEDS CLARIFICATION` markers remain in the Technical Context (all
clarified during `/speckit-clarify` or resolved by reasonable defaults already
recorded in the spec's Assumptions). This document records the technical
decisions needed to move from spec to design.

## Decision 1: Styling mechanism for the thin scrollbar

**Decision**: Style the thumb/track via the `::-webkit-scrollbar`,
`::-webkit-scrollbar-thumb`, and `::-webkit-scrollbar-track` pseudo-elements on
`.list`, not the standard `scrollbar-width`/`scrollbar-color` properties.

**Rationale**: Electron 40 bundles a recent Chromium that supports both. The
standard properties only let you pick a thumb/track *color* and a `thin`/`auto`
*width keyword* — they can't express "fully transparent at rest, opaque while
active," because they have no notion of an idle vs. active state. The
webkit-prefixed pseudo-elements are plain CSS selectors, so their computed
background/color can be driven off a parent class (`.list.scrolling
::-webkit-scrollbar-thumb`) exactly like any other CSS rule, which is what the
idle-hidden/active-revealed behavior needs. Since Electron ships a fixed,
known Chromium version (unlike a public website that must support arbitrary
browsers), the vendor-prefix concern that normally motivates the standard
properties doesn't apply here.

**Alternatives considered**:
- `scrollbar-width: thin` + `scrollbar-color` alone — rejected: can't express
  idle-hidden/active-revealed, only a static thin+colored appearance.
- A JS-rendered custom scrollbar component (fake thumb `<div>` synced to
  `scrollTop`) — rejected per the ladder: the user's ask explicitly prefers
  "just style it" over a component, Electron's Chromium already supports the
  pseudo-elements needed, and a synced-fake-thumb component would need to
  reimplement drag-to-scroll, wheel deltas, and resize observation that the
  native scrollbar already gives for free (FR-008/FR-010's "preserve all
  existing scroll interactions" is trivially satisfied by styling the real
  scrollbar, not by rebuilding one).
- A third-party scrollbar library (e.g. a "ready to use component" as the user
  suggested as a fallback) — rejected: would be the first new runtime
  dependency in the project and Principle V requires justifying that against
  a few lines of code; the pseudo-element approach *is* the few lines of code.

## Decision 2: Reveal/hide state mechanism

**Decision**: A single boolean-ish state expressed as a `.scrolling` CSS class
on `#list`, toggled from `renderer.ts` via event listeners
(`scroll`, `mouseenter`, `mouseleave`, `keydown`) plus a debounce timer that
removes the class after ~1s of inactivity. All visual consequences (thumb
opacity, fade transition) live in CSS keyed off `.list.scrolling`; the JS only
owns *when* that class is present.

**Rationale**: CSS alone can do the hover case (`.list:hover
::-webkit-scrollbar-thumb`) but not the scroll-triggered or keyboard-triggered
cases — there is no CSS selector for "was scrolled/key-pressed in the last N
seconds." A single shared class (rather than separate hover/scroll/keyboard
classes) keeps the CSS simple and matches the spec's requirement that all
three triggers produce the identical visible result. This mirrors the
project's existing `busyShowTimer`/`setTimeout`+`clearTimeout` debounce
pattern in `renderer.ts` (used for the table loader's show-delay), so the
timer bookkeeping shape is already established in this codebase rather than
newly invented.

**Alternatives considered**:
- Pure CSS `:hover`-only reveal — rejected: doesn't satisfy FR-004 (reveal on
  scroll) or the clarified keyboard-reveal requirement; scrolling via mouse
  wheel without the pointer resting over the thumb wouldn't reveal it.
  `overlay-scrollbars`-style browser-native auto-hide isn't controllable via
  CSS in Chromium for non-macOS platforms.
- Separate classes per trigger (`.hovering`, `.was-scrolled`, `.key-scrolled`)
  — rejected: no behavioral difference between triggers per the spec (each
  just reveals the same thumb), so separate classes would only add branching
  for no visible benefit.

## Decision 3: Reduced-motion handling

**Decision**: Wrap the `.list ::-webkit-scrollbar-thumb` opacity `transition`
declaration in `@media (prefers-reduced-motion: no-preference)`, matching the
existing pattern at `styles.css:1175`. Outside that media query (i.e. when
reduced motion is requested), the thumb still switches between hidden/visible
based on `.scrolling`, just without a `transition`, so the change is instant.

**Rationale**: This is the standard way to make an animation
reduced-motion-aware in CSS — gate the `transition` property itself rather
than branching in JS — and the codebase already has a working precedent for
exactly this pattern to copy.

**Alternatives considered**: A JS `matchMedia('(prefers-reduced-motion:
reduce)')` check that skips adding the `.scrolling` class's animation — 
rejected: more code than the CSS-only gate, and inconsistent with the existing
in-repo precedent.

## Decision 4: Fallback when the styling technique is unsupported (FR-012)

**Decision**: No explicit fallback code path is needed. `::-webkit-scrollbar`
pseudo-elements degrade silently in any engine that doesn't support them —
unstyled rules are simply ignored and the browser/OS renders its native
scrollbar, which remains fully scrollable. Electron's bundled Chromium version
is fixed per release and known to support these pseudo-elements, so this is a
defensive fallback for the CSS engine, not a runtime feature-detection branch.

**Rationale**: FR-012 asks for graceful degradation, and CSS's "unknown
pseudo-element = no-op" behavior already provides that for free — adding a JS
capability check would be speculative code for a condition that can't occur
in this app's actual shipping environment (Electron pins its own Chromium).

**Alternatives considered**: `@supports selector(::-webkit-scrollbar)`
feature-query guard — rejected as unnecessary ceremony; CSS's normal
unknown-selector handling already achieves the same outcome.

## Decision 5: Keyboard scroll reveal (clarified requirement)

**Decision**: Add a `keydown` listener on `#list` that adds `.scrolling` (and
(re)starts the same hide-timer) when the pressed key is one of the
navigation keys the browser uses for native scroll (arrow keys, Page Up/Down,
Home/End) while `#list` or a descendant has focus.

**Rationale**: The browser already scrolls the container natively on these
keys when a focusable descendant (a row) has focus — no new scroll-handling
logic is needed, only a class toggle synced to the same keys so the reveal
matches mouse-scroll behavior, per the clarified FR-004.

**Alternatives considered**: Relying on the `scroll` event alone to also catch
keyboard-driven scrolling — this actually works today (a `scroll` event fires
regardless of *what* triggered the scroll) — but a small note is warranted: no
separate keydown-based logic is even strictly required if the existing
`scroll` listener from Decision 2 already fires for keyboard-driven scrolling
too. This is left for Phase 1's `quickstart.md` to verify empirically (arrow
key scrolling reveals the bar via the plain `scroll` listener); a dedicated
`keydown` listener is only added if verification shows the `scroll` event does
not fire for some keyboard-driven case (e.g. Home/End jumping without a
`scroll` event in some edge case). Either way the observable behavior (FR-004)
is identical from the user's perspective.
