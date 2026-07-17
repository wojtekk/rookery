import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { registerSettingsIpc, loadSettings, saveSettings } from './config';
import { getGitVersion } from './git/probe';
import { scanAll } from './scan';
import type { AddDirectoryResult, Row } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let lastSnapshot: Row[] = [];

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#0F1218',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
