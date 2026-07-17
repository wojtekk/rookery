// Settings load/save (atomic temp-file + rename JSON in userData) + settings IPC handlers. See research R5.

import { app, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Settings } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  observedDirectories: [],
  sortDimension: 'slug',
  sortDirection: 'asc',
  showWorktrees: true,
  defaultHost: 'github.com',
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

let cached: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  let settings: Settings;
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
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
}
