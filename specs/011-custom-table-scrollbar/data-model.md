# Phase 1 Data Model: Custom Modern Table Scrollbar

This feature adds no persisted data, no IPC payload, and no new domain entity.
The only "model" is a small piece of ephemeral, in-memory UI state that
determines whether the scrollbar is currently revealed. It lives entirely in
`src/renderer/renderer.ts` and `src/renderer/styles.css`; nothing here is
serialized, stored, or sent across the IPC boundary.

## Entities

### ScrollbarRevealState (derived, ephemeral)

Corresponds to the spec's Key Entity "Scrollbar visibility state."

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `.scrolling` (CSS class on `#list`) | presence/absence | toggled by event listeners | Sole driver of thumb visibility in CSS |
| `revealHideTimer` | `timeout handle \| undefined` | new module var in `renderer.ts` | Pending "remove `.scrolling`" timer; same shape as the existing `busyShowTimer` |
| `REVEAL_HIDE_DELAY_MS` | `~1000` | new constant | How long after the last activity the class is removed (SC-003) |

**Triggers that add `.scrolling` and (re)start `revealHideTimer`**:
- `scroll` event on `#list` (covers wheel, trackpad, drag-thumb, and —
  pending Phase 1 empirical check per research.md Decision 5 — likely also
  keyboard-driven scrolling)
- `mouseenter` on `#list` (hover reveal, per FR-005 / User Story 3)
- `keydown` on `#list` for navigation keys, if research.md Decision 5's check
  shows the plain `scroll` listener doesn't already cover it

**What removes `.scrolling`**: `revealHideTimer` firing after
`REVEAL_HIDE_DELAY_MS` of no further trigger events. `mouseleave` does **not**
remove it directly — it only stops hover from being a reason to *keep* it
present; the timer is the single removal path, so a mouse-leave right after a
scroll doesn't cut the reveal short before the timer's delay elapses (User
Story 3, Acceptance Scenario 2).

**Invariant**: `.scrolling`'s presence is the *only* signal the CSS reads —
there is no separate "is hovering" vs. "is scrolling" state, because the spec
requires identical visible behavior for every trigger (see research.md
Decision 2).

### Reduced-motion mode (read-only, not owned by this feature)

Not app state — read directly by CSS via the
`@media (prefers-reduced-motion: no-preference)` query already used elsewhere
in `styles.css` (line 1175). No JS reads or stores this; it only changes
whether the opacity change on `.scrolling` is transitioned or instant.

## State transitions

```text
idle (no .scrolling)
  --scroll | mouseenter | qualifying keydown-->  revealed (.scrolling present)
                                                    │
                                                    │ (any of the above again)
                                                    │ resets the hide timer
                                                    ▼
                                             revealed (.scrolling present)
                                                    │
                                                    │ REVEAL_HIDE_DELAY_MS
                                                    │ elapses with no new trigger
                                                    ▼
                                             idle (no .scrolling)
```

No other states exist — this is a two-state (idle/revealed) machine with a
single debounce timer, matching the simplicity already established by the
`busyShowTimer` pattern for the table loader.
