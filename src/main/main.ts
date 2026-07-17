import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { registerSettingsIpc, loadSettings, saveSettings } from './config';
import { getGitVersion } from './git/probe';
import { scanAll } from './scan';
import { launchCommand } from './actions/launch';
import type { AddDirectoryResult, Row, RunActionResult } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let lastSnapshot: Row[] = [];

const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#0F1218',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
    },
  });
  // Renderer builds to its own ESM tree (dist/renderer) so its shared runtime modules don't collide
  // with the CommonJS copies used by main/tests. From dist/src/main → dist/renderer/src/renderer.
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'src', 'renderer', 'index.html'));
}

async function refresh(): Promise<Row[]> {
  const settings = await loadSettings();
  lastSnapshot = await scanAll(settings.observedDirectories);
  return lastSnapshot;
}

async function addObservedDirectory(dirPath: string): Promise<AddDirectoryResult> {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) return { ok: false, reason: 'Not a directory' };
  } catch {
    return { ok: false, reason: 'Directory does not exist or is not readable' };
  }
  const settings = await loadSettings();
  if (!settings.observedDirectories.includes(dirPath)) {
    await saveSettings({ ...settings, observedDirectories: [...settings.observedDirectories, dirPath] });
  }
  return { ok: true };
}

async function removeObservedDirectory(dirPath: string): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    observedDirectories: settings.observedDirectories.filter((d) => d !== dirPath),
  });
}

// Rows carry a tilde-shortened path for display (scan.ts); reverse it so `${1}` is a real absolute path.
function expandTilde(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

async function runAction(
  actionId: string,
  target: { path: string; remoteUrl: string | null },
): Promise<RunActionResult> {
  const settings = await loadSettings();
  const action = settings.actions.find((a) => a.id === actionId);
  if (!action) return { ok: false, reason: 'Action not found' };
  return launchCommand(action.command, expandTilde(target.path), target.remoteUrl);
}

async function pickDirectory(): Promise<string | null> {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

function registerIpc(): void {
  registerSettingsIpc();
  ipcMain.handle('listRepositories', () => lastSnapshot);
  ipcMain.handle('refresh', () => refresh());
  ipcMain.handle('addObservedDirectory', (_e, dirPath: string) => addObservedDirectory(dirPath));
  ipcMain.handle('removeObservedDirectory', (_e, dirPath: string) => removeObservedDirectory(dirPath));
  ipcMain.handle('pickDirectory', () => pickDirectory());
  ipcMain.handle('getGitStatus', () => getGitVersion());
  ipcMain.handle('runAction', (_e, actionId: string, target: { path: string; remoteUrl: string | null }) =>
    runAction(actionId, target),
  );
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
