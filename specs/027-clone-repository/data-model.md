# Data Model: Clone a Repository

Types and state for feature 027. New shapes live in `src/shared/types.ts` (cross the
IPC boundary) unless noted as renderer-only.

## 1. `RemoteRepoSummary` (shared)

One discoverable remote repository the user can access. The unit the search box
matches and ranks over.

```ts
export interface RemoteRepoSummary {
  host: string;      // e.g. "github.com", "github.schibsted.io"
  owner: string;     // org/user login, e.g. "finn", "m10s-green", "wojtekk"
  name: string;      // repo name, e.g. "some-repo"
  sshUrl: string;    // git@github.com:finn/some-repo.git  (from REST ssh_url)
  httpsUrl: string;  // https://github.com/finn/some-repo.git (from REST clone_url)
}
```

- **Identity**: `host` + `owner` + `name` uniquely identify a repo. `owner/name` is
  the display label; `host` disambiguates same-named repos across hosts.
- **Derivation**: produced by `parseGhRepoList` from the JSONL emitted by
  `gh api --paginate user/repos --jq …` (research §3). Both URL forms come straight
  from the REST payload — the app never synthesizes a URL.

## 2. `CloneableReposResult` (shared)

Return of `listCloneableRepos`. Carries partial-success information so the modal can
honour FR-012 (search unavailable) and FR-013 (some hosts down) without conflating
them.

```ts
export type CloneableReposResult =
  | { searchAvailable: true; repos: RemoteRepoSummary[]; unavailableHosts: string[] }
  | { searchAvailable: false; reason: string };
```

A discriminated union (like `GitStatus`/`DeleteOutcome` in the same file) so the illegal
combinations the flat struct once admitted — `searchAvailable:true` with a `reason`, or
`searchAvailable:false` with populated `repos` — are simply unrepresentable. The success arm
carries `repos` (union across all hosts that succeeded, may be empty) and `unavailableHosts`
(hosts that errored while ≥1 other host succeeded, FR-013); the failure arm carries only the
human `reason` shown when search is unavailable (FR-012).

State combinations:

| Arm                      | Meaning (modal behaviour)                                        |
|--------------------------|------------------------------------------------------------------|
| `{ searchAvailable: true; unavailableHosts: [] }`   | Full success — search over `repos`.       |
| `{ searchAvailable: true; unavailableHosts: [...] }`| Partial — search over what loaded; note skipped hosts (FR-013). |
| `{ searchAvailable: false; reason }`                | No search — show `reason`, manual URL only (FR-012). |

`searchAvailable: false` is reserved for "no host could be queried at all" (e.g. `gh`
not found, or every host failed). If *any* host returns repos, `searchAvailable` is
`true` and the failures (if any) are listed in `unavailableHosts`.

## 3. `CloneOutcome` (shared)

Result of one `cloneRepository` attempt. Mirrors the `RunActionResult` shape already
used for launch results.

```ts
export type CloneOutcome =
  | { ok: true }
  | { ok: false; reason: string };  // trimmed git stderr/stdout (FR-011)
```

- `ok: true` ⇒ the clone succeeded; the handler has already ensured the parent dir is
  observed (§6). The renderer reloads settings and refreshes.
- `ok: false` ⇒ the modal stays open, `reason` shown, input preserved (FR-011).

## 4. `Settings` addition (shared, persisted)

```ts
export interface Settings {
  // …existing fields…
  lastCloneDirectory: string;   // NEW — remembers the destination dropdown default; '' until first clone
  excludedCloneOwners: string[];// NEW — owner/org logins hidden from Clone's search results; [] by default
}
```

- `lastCloneDirectory` default `''` (falls back to the first observed directory in the modal).
- `excludedCloneOwners` default `[]`; applied at read time in `filterExcludedOwners` so editing the
  list takes effect without a fresh `gh` call.
- Persisted via new `setLastCloneDirectory` / `setExcludedCloneOwners` IPC + `config.ts` handlers,
  following the exact pattern of `setDefaultHost` / `setRebaseReminderSuppressed` / `setActions`.
- `observedDirectories` (existing) is mutated as a side effect of a successful clone
  (§6) — no shape change, an appended entry.

## 5. `RepoDashboardApi` additions (shared)

```ts
export interface RepoDashboardApi {
  // …existing methods…
  listCloneableRepos(forceRefresh?: boolean): Promise<CloneableReposResult>;
  cloneRepository(url: string, destination: string): Promise<CloneOutcome>;
  setLastCloneDirectory(dir: string): Promise<void>;
  setExcludedCloneOwners(owners: string[]): Promise<void>;
  isCloneDestinationOccupied(destination: string): Promise<boolean>; // proactive occupied-dir warning
}
```

## 6. Post-clone observed-directory rule (behaviour, not a type)

On `cloneRepository` success, in the main-process IPC handler:

```
parent = dirname(expandTilde(destination))
if (!settings.observedDirectories.includes(parent))
    observedDirectories ← [...observedDirectories, parent]   // persisted
```

Grounded in `scan.ts`'s one-level-deep discovery (research §8, spec Clarifications):
watching the **parent** is what makes the clone visible. Idempotent — a clone into an
already-observed directory adds nothing.

## 7. Renderer-only modal state (`view/clone.ts`)

Not persisted, not crossing IPC. Mirrors `cleanup.ts`'s module-level pattern
(`isOpen` + open/render/close).

| Field                | Type                       | Notes |
|----------------------|----------------------------|-------|
| `isOpen`             | `boolean`                  | Modal visibility. |
| `loading`           | `boolean`                  | Discovery in flight (in-modal spinner; never the app loader). |
| `result`             | `CloneableReposResult\|null` | Cached discovery for this open session. |
| `query`              | `string`                   | Live search text (client-side filter). |
| `selected`           | `RemoteRepoSummary\|null`  | Chosen search result (drives URL + default path). |
| `urlValue`           | `string`                   | The URL field — free text; overwritten by `selected`, then hand-editable. |
| `scheme`             | `'ssh' \| 'https'`         | URL-form toggle; default `'ssh'` (spec Assumptions). |
| `destDir`            | `string`                   | Chosen observed directory (dropdown). |
| `destPath`           | `string`                   | Full destination; auto-filled `buildDestination(destDir, name)` … |
| `destPathEdited`     | `boolean`                  | …until `true`, after which auto-fill stops overwriting it (Edge Cases). |
| `cloneError`         | `string\|null`             | Last failure reason, shown in-modal (FR-011). |

## 8. Pure helpers (contracts in `clone-engine.md`)

Renderer-side (`view/clone-model.ts`):
- `deriveRepoName(url: string): string | null` — last path segment of an SSH or HTTPS
  URL, `.git` stripped; `null` if no plausible name (empty/garbage) → Clone disabled.
- `rankCloneCandidates(repos, query, limit = 50): RemoteRepoSummary[]` — case-insensitive
  substring filter on `owner/name`, ranked (name-prefix > name-substring > owner match),
  truncated to `limit` (spec Clarifications: 50).
- `buildDestination(dir: string, repoName: string): string` — `dir` + separator +
  `repoName` (no trailing-slash duplication).

Main-side (`clone-discovery.ts`):
- `parseGhHosts(authStatusJson: string): string[]` — host keys whose account list has
  ≥1 `state === "success"`.
- `parseGhRepoList(jsonl: string, host: string): RemoteRepoSummary[]` — one repo per
  non-empty line; malformed lines skipped (research §3).
