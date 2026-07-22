# Contract: Settings Modal Tab Strip + Panels

This is a UI application, not a library/API — the "contract" here is the
DOM/ARIA shape `settings.ts` must produce, since that's the interface
between the tab strip (control) and the two settings sections (content).

## Before

```html
<div class="modal-body">
  <div class="settings-section"><h2>Observed directories</h2> …dir list/add form… </div>
  <div class="settings-section"><h2>Actions</h2> …action list/add form… </div>
</div>
```

## After

```html
<div class="modal-body">
  <div class="tab-strip" role="tablist" aria-label="Settings sections">
    <button type="button" role="tab" id="tab-btn-directories"
            aria-selected="true" aria-controls="tab-directories" class="tab-btn active">
      Directories
    </button>
    <button type="button" role="tab" id="tab-btn-actions"
            aria-selected="false" aria-controls="tab-actions" class="tab-btn">
      Actions
    </button>
  </div>

  <div class="settings-section" id="tab-directories" role="tabpanel" aria-labelledby="tab-btn-directories">
    <h2>Observed directories</h2> …dir list/add form… <!-- unchanged content -->
  </div>

  <div class="settings-section" id="tab-actions" role="tabpanel" aria-labelledby="tab-btn-actions" hidden>
    <h2>Actions</h2> …action list/add form… <!-- unchanged content -->
  </div>
</div>
```

Clicking a tab button toggles `aria-selected`/`.active` on the two buttons
and the `hidden` attribute on the two panels — no other change to the panel
contents, no re-render, no handler callback (FR-012: the Actions panel's
`<input>` elements are never removed from the DOM, so any in-progress typed
value survives untouched).

## Behavioral guarantees (unchanged, verified by inspection — not new code)

- `renderActionsSection`'s existing list/add-form logic, event wiring, and
  `ACTION_LIMIT` handling are untouched — only its return value changes
  (now returns the `HTMLElement` it builds, so the caller can attach
  `id="tab-actions"`/`role="tabpanel"`/`aria-labelledby` to it).
- The directories section's list/add-form logic is untouched — same
  `id="tab-directories"`/`role="tabpanel"`/`aria-labelledby` attributes are
  attached where the section is already built.
- `.modal-head` (title + close ✕) and `.modal-foot` (Done button) are
  unmoved and unchanged (FR-007, FR-011).
- Reopening the Settings window rebuilds this DOM from scratch via
  `renderSettingsModal`, always with `activeTab === 'directories'`
  (`openSettingsModal()` resets it) — so `tab-directories` starts visible
  and `tab-actions` starts `hidden` on every fresh open, satisfying FR-004.
