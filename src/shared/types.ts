// Shapes that cross the renderer <-> main IPC boundary. See specs/001-repo-dashboard/data-model.md.

export type Head =
  | { detached: true }
  | {
      detached: false;
      branch: string;
      upstream:
        | { tracking: 'local-only' }
        | { tracking: 'tracked'; ahead: number; behind: number }
        | { tracking: 'gone' };
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
  rebaseReminderSuppressed: boolean;
  lastCloneDirectory: string;
  // Owner/org logins hidden from Clone's search results (e.g. an archive org nobody clones from).
  excludedCloneOwners: string[];
}

// Clone (027 data-model.md §1): one discoverable remote repository the user can access, produced
// by parseGhRepoList from `gh api user/repos` JSONL. Both URL forms come straight from the REST
// payload — the app never synthesizes a URL.
export interface RemoteRepoSummary {
  host: string;
  owner: string;
  name: string;
  sshUrl: string;
  httpsUrl: string;
}

// Return of listCloneableRepos (027 data-model.md §2). A discriminated union like the file's other
// multi-state shapes (GitStatus, DeleteOutcome, …): the success arm carries repos + unavailableHosts
// (a host down while >=1 other succeeded, FR-013); the failure arm carries only a human reason —
// "no host could be queried at all" (gh not found or every host failed, FR-012).
export type CloneableReposResult =
  | { searchAvailable: true; repos: RemoteRepoSummary[]; unavailableHosts: string[] }
  | { searchAvailable: false; reason: string };

// Result of one cloneRepository attempt (027 data-model.md §3) — mirrors RunActionResult.
export type CloneOutcome = { ok: true } | { ok: false; reason: string };

export type GitStatus =
  | { available: true; version: string }
  | { available: false; version: null; reason: string };

export type AddDirectoryResult = { ok: true } | { ok: false; reason: string };

// What the renderer sends to identify exactly which row to delete (004 data-model.md).
// `familyPath` is the worktree's family/primary repository — only known (and only needed) when
// the target's own directory is missing, since `-C <path>` can't anchor on a path that's gone
// (005 data-model.md/research R2/R3). `undefined` for non-worktree targets and orphan worktrees.
export interface DeleteTarget {
  path: string;
  isWorktree: boolean;
  familyPath?: string;
}

export type DeleteOutcome = { outcome: 'deleted' } | { outcome: 'cancelled' } | { outcome: 'failed'; reason: string };

// Per-working-tree result of a "pull all" run (006 data-model.md). `path` is the tilde-shortened
// `fullPath` (matches Row.fullPath) so the renderer can key its failed-path overlay directly on it.
export type UpdateResult = 'updated' | 'already-current' | 'skipped' | 'failed';

// Why a working tree wasn't brought current (013 data-model.md). Failed-attempt categories carry
// `detail` (the underlying git error text, FR-003) when git produced one; skip categories
// (unavailable/detached) are derived from the entry itself and carry no detail.
export type UpdateReasonCategory =
  | 'diverged'
  | 'fetch-failed'
  | 'stash-failed'
  | 'timed-out'
  | 'update-failed'
  | 'rebase-conflict'
  | 'unavailable'
  | 'detached'
  | 'upstream-gone'
  | 'default-branch-unknown'
  | 'orphan-worktree';

export interface UpdateReason {
  category: UpdateReasonCategory;
  detail?: string;
}

export interface RepoUpdateOutcome {
  path: string;
  result: UpdateResult;
  // Present iff the tree is in the warned set: every `failed` result, plus `skipped` only for
  // unavailable/detached (013 data-model.md invariant). Absent for updated/already-current/no-upstream skips.
  reason?: UpdateReason;
}

// Cleanup (008 data-model.md): why a candidate was surfaced by the scan. Exactly one reason per
// candidate; precedence gone-branch > missing-worktree > merged-worktree avoids double-listing.
export type CleanupReason = 'gone-branch' | 'missing-worktree' | 'merged-worktree';

// Output of the read-only scan phase (`scanCleanup`) — one removal candidate. `id` is the stable
// overlay checkbox key and dedupe key: `${repoPath}::${branch ?? worktreePath}`.
export interface CleanupCandidate {
  repoPath: string;
  repoSlug: string | null;
  reason: CleanupReason;
  branch: string | null;
  worktreePath: string | null;
  worktreeDirMissing: boolean;
  id: string;
}

// The subset of scanned candidates the user left checked in the review overlay.
export type CleanupSelection = CleanupCandidate;

export type CleanupResult = 'removed' | 'skipped' | 'failed';

export interface CleanupOutcome {
  id: string;
  result: CleanupResult;
}

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
  updateAll(): Promise<RepoUpdateOutcome[]>;
  scanCleanup(): Promise<CleanupCandidate[]>;
  executeCleanup(selection: CleanupSelection[]): Promise<CleanupOutcome[]>;
  rebaseWorktrees(): Promise<RepoUpdateOutcome[]>;
  confirmRebaseWorktrees(): Promise<{ proceed: boolean; suppress: boolean }>;
  setRebaseReminderSuppressed(value: boolean): Promise<void>;
  listCloneableRepos(forceRefresh?: boolean): Promise<CloneableReposResult>;
  cloneRepository(url: string, destination: string): Promise<CloneOutcome>;
  setLastCloneDirectory(dir: string): Promise<void>;
  setExcludedCloneOwners(owners: string[]): Promise<void>;
  isCloneDestinationOccupied(destination: string): Promise<boolean>;
}
