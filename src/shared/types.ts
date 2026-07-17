// Shapes that cross the renderer <-> main IPC boundary. See specs/001-repo-dashboard/data-model.md.

export type Head =
  | { detached: true }
  | {
      detached: false;
      branch: string;
      upstream:
        | { tracking: 'local-only' }
        | { tracking: 'tracked'; ahead: number; behind: number };
    };

export type WorkingTree =
  | { availability: 'unavailable' }
  | { availability: 'ok'; head: Head; local: number; lastChange: string | null };

export type WorkingTreeEntry = WorkingTree & {
  directoryName: string;
  fullPath: string;
  collisionFragment: string | null;
};

export type RowState = 'clean' | 'dirty' | 'out-of-sync' | 'unavailable';

export type Remote = { host: string; slug: string } | null;

export type Repository = WorkingTreeEntry & {
  remote: Remote;
  worktrees: WorkingTreeEntry[];
};

export type OrphanWorktree = WorkingTreeEntry & {
  remote: Remote;
};

export type Row = ({ kind: 'repository' } & Repository) | ({ kind: 'orphan-worktree' } & OrphanWorktree);

export interface ObservedDirectory {
  path: string;
  readable: boolean;
}

export interface Settings {
  observedDirectories: string[];
  sortDimension: 'slug' | 'directoryName' | 'lastChange' | 'localCount';
  sortDirection: 'asc' | 'desc';
  showWorktrees: boolean;
  defaultHost: string;
}

export type GitStatus =
  | { available: true; version: string }
  | { available: false; version: null; reason: string };

export type AddDirectoryResult = { ok: true } | { ok: false; reason: string };

// The typed surface exposed via contextBridge as `window.repoDashboard`. See contracts/ipc-api.md.
export interface RepoDashboardApi {
  listRepositories(): Promise<Row[]>;
  refresh(): Promise<Row[]>;
  addObservedDirectory(path: string): Promise<AddDirectoryResult>;
  removeObservedDirectory(path: string): Promise<void>;
  getSettings(): Promise<Settings>;
  setSort(dimension: Settings['sortDimension'], direction: Settings['sortDirection']): Promise<void>;
  setShowWorktrees(show: boolean): Promise<void>;
  setDefaultHost(host: string): Promise<void>;
  getGitStatus(): Promise<GitStatus>;
  pickDirectory(): Promise<string | null>;
  onScanProgress(cb: (done: number, total: number) => void): void;
}
