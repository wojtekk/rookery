// Fixed, bundled, offline icon catalog (FR-008/FR-011). `Action.iconId` references a pickable entry here.
// Monochrome vector glyphs from Tabler Icons (MIT, see /THIRD_PARTY_LICENSES), redrawn to inherit
// `currentColor` from the wrapper below — no brand assets fetched at runtime, no network (FR-003, R1).
//
// Weight model (research R2): every entry is bare Tabler <path> data with NO paint attributes; it
// inherits `fill:none; stroke:currentColor; stroke-width:2` from iconSvg()'s wrapper, so all glyphs
// read at one uniform weight (FR-001/FR-002). The sole exception is `intellij`, a bespoke glyph kept
// per FR-006: its elements carry explicit paint so it survives the `fill="none"` wrapper.

interface IconEntry {
  id: string;
  label: string;
  svg: string;
  // Offered in the Settings icon picker? Fixed affordances (trash/x/chevrons/git-branch) set false
  // so they never appear as a selectable launcher icon (FR-010). Defaults to true when omitted.
  pickable?: boolean;
}

const ENTRIES: readonly IconEntry[] = [
  {
    id: 'github',
    label: 'GitHub',
    svg: '<path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/>',
  },
  {
    // Bespoke glyph — Tabler has no IntelliJ brand mark (FR-006, R3). Rounded square + "IJ" + underline,
    // redrawn as strokes at the set's weight (2). Self-contained paint so it survives fill="none".
    id: 'intellij',
    label: 'IntelliJ IDEA',
    svg: '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 7v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 7v4.2a2.2 2.2 0 0 1 -4.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 17.3h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    id: 'vscode',
    label: 'VS Code',
    svg: '<path d="M16 3v18l4 -2.5v-13l-4 -2.5"/><path d="M9.165 13.903l-4.165 3.597l-2 -1l4.333 -4.5m1.735 -1.802l6.932 -7.198v5l-4.795 4.141"/><path d="M16 16.5l-11 -10l-2 1l13 13.5"/>',
  },
  {
    id: 'finder',
    label: 'Finder',
    svg: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -14"/><path d="M7 8v1"/><path d="M17 8v1"/><path d="M12.5 4c-.654 1.486 -1.26 3.443 -1.5 9h2.5c-.19 2.867 .094 5.024 .5 7"/><path d="M7 15.5c3.667 2 6.333 2 10 0"/>',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    svg: '<path d="M8 9l3 3l-3 3"/><path d="M13 15l3 0"/><path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12"/>',
  },
  {
    id: 'git',
    label: 'Git',
    svg: '<path d="M15 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 8a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 15v-6"/><path d="M15 11l-2 -2"/><path d="M11 7l-1.9 -1.9"/><path d="M13.446 2.6l7.955 7.954a2.045 2.045 0 0 1 0 2.892l-7.955 7.955a2.045 2.045 0 0 1 -2.892 0l-7.955 -7.955a2.045 2.045 0 0 1 0 -2.892l7.955 -7.955a2.045 2.045 0 0 1 2.892 0"/>',
  },
  {
    id: 'folder',
    label: 'Folder',
    svg: '<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/>',
  },
  {
    id: 'globe',
    label: 'Browser',
    svg: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/>',
  },
  {
    id: 'code',
    label: 'Code',
    svg: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>',
  },
  {
    id: 'rocket',
    label: 'Launch',
    svg: '<path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3"/><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3"/><path d="M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  },
  {
    id: 'gear',
    label: 'Settings',
    svg: '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  },
  // --- Fixed affordances: rendered by the app, never user-selectable (pickable: false, FR-010/FR-013) ---
  {
    id: 'trash',
    label: 'Delete',
    pickable: false,
    svg: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  },
  {
    id: 'x',
    label: 'Close',
    pickable: false,
    svg: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  },
  {
    id: 'chevron-up',
    label: 'Move up',
    pickable: false,
    svg: '<path d="M6 15l6 -6l6 6"/>',
  },
  {
    id: 'chevron-down',
    label: 'Move down',
    pickable: false,
    svg: '<path d="M6 9l6 6l6 -6"/>',
  },
  {
    id: 'git-branch',
    label: 'Also removes a worktree',
    pickable: false,
    svg: '<path d="M5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M7 8l0 8"/><path d="M9 18h6a2 2 0 0 0 2 -2v-5"/><path d="M14 14l3 -3l3 3"/>',
  },
];

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

// Fallback for an unknown icon id: a stroke "help" box, inherits the wrapper's weight (no broken image).
const FALLBACK_SVG = '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v5"/><path d="M12 16h.01"/>';

/** Ordered ids offered in the picker — pickable launchers only (excludes fixed affordances, FR-010). */
export const ICON_IDS: readonly string[] = ENTRIES.filter((e) => e.pickable !== false).map((e) => e.id);

/** Human label for an icon id (accessible name); falls back to the id itself. */
export function iconLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Returns an inline `<svg>` string for the icon id (fallback glyph for an unknown id). */
export function iconSvg(id: string): string {
  const inner = BY_ID.get(id)?.svg ?? FALLBACK_SVG;
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}
