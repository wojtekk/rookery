// Fixed, bundled, offline icon catalog (FR-011, research R4). `Action.iconId` references an entry here.
// Simple monochrome SVG glyphs using `currentColor` (inherit row text color); no brand assets, no network.

interface IconEntry {
  id: string;
  label: string;
  svg: string;
}

// ponytail: hand-drawn simple glyphs, not full devicon brand art — enough to distinguish launchers offline.
const ENTRIES: readonly IconEntry[] = [
  {
    id: 'github',
    label: 'GitHub',
    svg: '<path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.52.1.71-.23.71-.5v-1.96c-2.9.63-3.52-1.24-3.52-1.24-.48-1.2-1.16-1.52-1.16-1.52-.95-.65.07-.64.07-.64 1.05.08 1.6 1.08 1.6 1.08.93 1.6 2.45 1.14 3.05.87.09-.68.36-1.14.66-1.4-2.32-.26-4.76-1.16-4.76-5.16 0-1.14.4-2.07 1.08-2.8-.1-.27-.47-1.33.1-2.77 0 0 .88-.28 2.88 1.07a10 10 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.44.2 2.5.1 2.77.68.73 1.08 1.66 1.08 2.8 0 4-2.45 4.9-4.78 5.16.38.32.71.95.71 1.92v2.85c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z"/>',
  },
  {
    id: 'intellij',
    label: 'IntelliJ IDEA',
    svg: '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 6.6h4v1.2H8.7v6.6H10V15.6H6v-1.2h1.3V7.8H6Z"/><rect x="6" y="17" width="7" height="1.4"/>',
  },
  {
    id: 'vscode',
    label: 'VS Code',
    svg: '<path d="M17 2.2 8.9 9.7 4.7 6.5 3 7.4l3.3 3.1L3 13.6l1.7.9 4.2-3.2 8.1 7.5L21 17V4l-4-1.8Zm.4 3.8v9l-6-4.5 6-4.5Z"/>',
  },
  {
    id: 'finder',
    label: 'Finder',
    svg: '<rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 8v3M15.5 8v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 15c1 1 5 1 6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    svg: '<rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 9l3 3-3 3M12 15h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: 'git',
    label: 'Git',
    svg: '<path d="M21.6 11.1 12.9 2.4a1.3 1.3 0 0 0-1.9 0L9.2 4.2l2.3 2.3a1.6 1.6 0 0 1 2 2l2.2 2.2a1.6 1.6 0 1 1-1 .9L12.6 9.5v5.7a1.6 1.6 0 1 1-1.3 0V9.4a1.6 1.6 0 0 1-.9-2.1L8.2 5.1 2.4 11a1.3 1.3 0 0 0 0 1.9l8.7 8.7a1.3 1.3 0 0 0 1.9 0l8.6-8.6a1.3 1.3 0 0 0 0-1.9Z"/>',
  },
  {
    id: 'folder',
    label: 'Folder',
    svg: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  },
  {
    id: 'globe',
    label: 'Browser',
    svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  },
  {
    id: 'code',
    label: 'Code',
    svg: '<path d="M8.5 8 4 12l4.5 4M15.5 8 20 12l-4.5 4M13.5 5l-3 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: 'rocket',
    label: 'Launch',
    svg: '<path d="M5 14c-1 1-1.5 4-1.5 4s3-.5 4-1.5m9.5-11.5c-3 0-6 1.5-8 3.5l-2 2 3 3 2-2c2-2 3.5-5 3.5-8Zm-2.5 4.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  },
  {
    id: 'gear',
    label: 'Settings',
    svg: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
];

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

const FALLBACK_SVG =
  '<rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

/** Ordered ids for the picker. */
export const ICON_IDS: readonly string[] = ENTRIES.map((e) => e.id);

/** Human label for an icon id (accessible name); falls back to the id itself. */
export function iconLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Returns an inline `<svg>` string for the icon id (fallback glyph for an unknown id). */
export function iconSvg(id: string): string {
  const inner = BY_ID.get(id)?.svg ?? FALLBACK_SVG;
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`;
}
