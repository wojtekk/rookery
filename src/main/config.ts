// Settings load/save (atomic temp-file + rename JSON in userData) + settings IPC handlers. See research R5.

import { app, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Action, Settings } from '../shared/types';
import { ACTION_LIMIT, DEFAULT_ACTIONS } from '../shared/actions';

const DEFAULT_SETTINGS: Settings = {
  observedDirectories: [],
  sortDimension: 'slug',
  sortDirection: 'asc',
  showWorktrees: true,
  defaultHost: 'github.com',
  actions: [],
};

/** Defense-in-depth for `setActions` (ipc-api.md): structurally valid, non-empty, within the limit. */
function isValidActionList(value: unknown): value is Action[] {
  if (!Array.isArray(value) || value.length > ACTION_LIMIT) return false;
  return value.every(
    (a) =>
      a &&
      typeof a.id === 'string' &&
      typeof a.iconId === 'string' &&
      typeof a.name === 'string' &&
      a.name.length > 0 &&
      typeof a.command === 'string' &&
      a.command.length > 0,
  );
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

let cached: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  let settings: Settings;
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    settings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // First-run seed: only when the file never carried an `actions` key. An intentionally-emptied
      // list (`actions: []`) is preserved so the menu stays hidden (FR-009, FR-012, research R5).
      actions: 'actions' in parsed ? parsed.actions : [...DEFAULT_ACTIONS],
    };
  } catch {
    settings = { ...DEFAULT_SETTINGS, actions: [...DEFAULT_ACTIONS] };
  }
  cached = settings;
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  cached = settings;
  const target = settingsPath();
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

export function registerSettingsIpc(): void {
  ipcMain.handle('getSettings', () => loadSettings());

  ipcMain.handle(
    'setSort',
    async (_e, dimension: Settings['sortDimension'], direction: Settings['sortDirection']) => {
      const settings = await loadSettings();
      await saveSettings({ ...settings, sortDimension: dimension, sortDirection: direction });
    },
  );

  ipcMain.handle('setShowWorktrees', async (_e, show: boolean) => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, showWorktrees: show });
  });

  ipcMain.handle('setDefaultHost', async (_e, host: string) => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, defaultHost: host });
  });

  ipcMain.handle('getActions', async () => (await loadSettings()).actions);

  ipcMain.handle('setActions', async (_e, actions: Action[]) => {
    if (!isValidActionList(actions)) throw new Error('Invalid actions list');
    const settings = await loadSettings();
    await saveSettings({ ...settings, actions });
  });
}
