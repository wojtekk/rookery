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

// Three real cases (002 widens 001's `{host,slug}|null`): a parsed origin (host is a string),
// a present-but-unparseable origin (host null, but rawUrl still supplies `${2}`), and no origin at all.
// `rawUrl` is the verbatim `git remote.origin.url` — the value `${2}` substitutes (data-model.md, FR-005).
export type Remote =
  | { host: string; slug: string; rawUrl: string }
  | { host: null; slug: null; rawUrl: string }
  | null;

// A user-configured launcher shown in the per-row ⋮ menu. `iconId` references the bundled
// icon catalog (no image data stored); `command` is the shell template with `${1}`/`${2}`. See data-model.md.
export interface Action {
  id: string;
  name: string;
  iconId: string;
  command: string;
}

export type RunActionResult = { ok: true } | { ok: false; reason: string };

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
  actions: Action[];
}

export type GitStatus =
  | { available: true; version: string }
  | { available: false; version: null; reason: string };

export type AddDirectoryResult = { ok: true } | { ok: false; reason: string };

// What the renderer sends to identify exactly which row to delete (004 data-model.md).
// `isWorktree` alone selects the removal path — no "primary path" needed (research R2).
export interface DeleteTarget {
  path: string;
  isWorktree: boolean;
}

export type DeleteOutcome = { outcome: 'deleted' } | { outcome: 'cancelled' } | { outcome: 'failed'; reason: string };

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
  getActions(): Promise<Action[]>;
  setActions(actions: Action[]): Promise<void>;
  runAction(actionId: string, target: { path: string; remoteUrl: string | null }): Promise<RunActionResult>;
  deleteRow(target: DeleteTarget): Promise<DeleteOutcome>;
}
