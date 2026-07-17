import { contextBridge, ipcRenderer } from 'electron';
import type { RepoDashboardApi, Settings } from '../shared/types';

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
  getGitStatus: () => ipcRenderer.invoke('getGitStatus'),
  pickDirectory: () => ipcRenderer.invoke('pickDirectory'),
  onScanProgress: (cb: (done: number, total: number) => void) => {
    ipcRenderer.on('scanProgress', (_event, done: number, total: number) => cb(done, total));
  },
};

contextBridge.exposeInMainWorld('repoDashboard', api);
