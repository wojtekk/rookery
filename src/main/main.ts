import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { registerSettingsIpc, loadSettings, saveSettings } from './config';
import { getGitVersion, probeRemoteUrl, runGit } from './git/probe';
import { scanAll } from './scan';
import { launchCommand } from './actions/launch';
import { computeDeleteRisk } from './delete';
import type { AddDirectoryResult, DeleteOutcome, DeleteTarget, Row, RunActionResult } from '../shared/types';

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

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Owns the entire user-facing delete flow (contracts/delete.md): at most two native
 * confirmations, a fresh risk check between them (computeDeleteRisk, delete.ts), then removal.
 * A worktree whose directory is already missing skips the risk check entirely (005: nothing
 * local left to lose) and deregisters directly against its family repository. Otherwise,
 * everything from the first confirmation onward is one try/catch — a target that vanishes at
 * any point (risk check or removal) resolves as a successful deletion rather than a stale-state
 * error (spec.md Edge Case "Row disappears during confirmation" / "Directory already gone").
 */
async function deleteRow(rawTarget: DeleteTarget): Promise<DeleteOutcome> {
  if (!mainWindow) return { outcome: 'failed', reason: 'No window available' };
  // Every path crossing the IPC boundary is tilde-shortened for display (scan.ts). Expand BOTH the
  // target and its familyPath: the latter becomes `git -C <cwd>`, and child_process treats `~` as a
  // literal dir (only a shell expands it), so an unexpanded familyPath makes git fail with exit 128.
  const target: DeleteTarget = {
    ...rawTarget,
    path: expandTilde(rawTarget.path),
    familyPath: rawTarget.familyPath ? expandTilde(rawTarget.familyPath) : undefined,
  };
  const dirName = path.basename(target.path);

  const choice1 = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
    message: `Delete "${dirName}"?`,
    detail: target.isWorktree
      ? 'This removes the worktree and its files.'
      : 'This moves the directory to the trash (or deletes it permanently if trash is unavailable).',
  });
  if (choice1.response !== 1) return { outcome: 'cancelled' };

  // 005: a worktree whose directory is already gone has nothing left to lose locally, so the
  // live risk-check probes (which need the directory to exist) are skipped entirely — single
  // confirmation, deregister directly against the family repository (contracts/delete.md).
  if (target.isWorktree && !(await pathExists(target.path))) {
    if (!target.familyPath) {
      return {
        outcome: 'failed',
        reason: 'Cannot remove: worktree directory is missing and its family repository is unknown.',
      };
    }
    try {
      await runGit(['-C', target.familyPath, 'worktree', 'remove', target.path, '--force'], target.familyPath);
      return { outcome: 'deleted' };
    } catch (err) {
      return { outcome: 'failed', reason: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    const hasRemote = (await probeRemoteUrl(target.path)) !== null;
    const risk = await computeDeleteRisk(target.path, hasRemote);

    if (risk.atRisk) {
      const choice2 = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Delete Anyway'],
        defaultId: 0,
        cancelId: 0,
        message: 'This action is destructive and cannot be reversed.',
        detail: risk.reasons.map((r) => `• ${r}`).join('\n'),
      });
      if (choice2.response !== 1) return { outcome: 'cancelled' };
    }

    if (target.isWorktree) {
      await runGit(['-C', target.path, 'worktree', 'remove', target.path, '--force'], path.dirname(target.path));
    } else {
      try {
        await shell.trashItem(target.path);
      } catch {
        await fs.rm(target.path, { recursive: true, force: true });
      }
    }
    return { outcome: 'deleted' };
  } catch (err) {
    if (!(await pathExists(target.path))) return { outcome: 'deleted' };
    return { outcome: 'failed', reason: err instanceof Error ? err.message : String(err) };
  }
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
  ipcMain.handle('deleteRow', (_e, target: DeleteTarget) => deleteRow(target));
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
