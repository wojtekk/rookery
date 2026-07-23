import { contextBridge, ipcRenderer } from 'electron';
import type { Action, CleanupSelection, DeleteTarget, RepoDashboardApi, Settings } from '../shared/types';

const api: RepoDashboardApi = {
  listRepositories: () => ipcRenderer.invoke('listRepositories'),
  refresh: () => ipcRenderer.invoke('refresh'),
  addObservedDirectory: (path: string) => ipcRenderer.invoke('addObservedDirectory', path),
  removeObservedDirectory: (path: string) => ipcRenderer.invoke('removeObservedDirectory', path),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSort: (dimension: Settings['sortDimension'], direction: Settings['sortDirection']) =>
    ipcRenderer.invoke('setSort', dimension, direction),
  setShowWorktrees: (show: boolean) => ipcRenderer.invoke('setShowWorktrees', show),
  setDefaultHost: (host: string) => ipcRenderer.invoke('setDefaultHost', host),
  setRebaseReminderSuppressed: (value: boolean) => ipcRenderer.invoke('setRebaseReminderSuppressed', value),
  getGitStatus: () => ipcRenderer.invoke('getGitStatus'),
  pickDirectory: () => ipcRenderer.invoke('pickDirectory'),
  onScanProgress: (cb: (done: number, total: number) => void) => {
    ipcRenderer.on('scanProgress', (_event, done: number, total: number) => cb(done, total));
  },
  getActions: () => ipcRenderer.invoke('getActions'),
  setActions: (actions: Action[]) => ipcRenderer.invoke('setActions', actions),
  runAction: (actionId: string, target: { path: string; remoteUrl: string | null }) =>
    ipcRenderer.invoke('runAction', actionId, target),
  deleteRow: (target: DeleteTarget) => ipcRenderer.invoke('deleteRow', target),
  updateAll: () => ipcRenderer.invoke('updateAll'),
  scanCleanup: () => ipcRenderer.invoke('scanCleanup'),
  executeCleanup: (selection: CleanupSelection[]) => ipcRenderer.invoke('executeCleanup', selection),
  rebaseWorktrees: () => ipcRenderer.invoke('rebaseWorktrees'),
  confirmRebaseWorktrees: () => ipcRenderer.invoke('confirmRebaseWorktrees'),
  listCloneableRepos: (forceRefresh?: boolean) => ipcRenderer.invoke('listCloneableRepos', forceRefresh),
  cloneRepository: (url: string, destination: string) => ipcRenderer.invoke('cloneRepository', url, destination),
  setLastCloneDirectory: (dir: string) => ipcRenderer.invoke('setLastCloneDirectory', dir),
  setExcludedCloneOwners: (owners: string[]) => ipcRenderer.invoke('setExcludedCloneOwners', owners),
  isCloneDestinationOccupied: (destination: string) => ipcRenderer.invoke('isCloneDestinationOccupied', destination),
};

contextBridge.exposeInMainWorld('repoDashboard', api);
