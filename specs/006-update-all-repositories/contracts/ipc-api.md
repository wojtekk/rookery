# Contract amendment: `RepoDashboardApi` gains `updateAll`

Extends 001's `contracts/ipc-api.md`. Additive only — no existing method
signature changes.

## Added method

```ts
updateAll(): Promise<RepoUpdateOutcome[]>;
```

Wired through the three existing layers, exactly like `deleteRow`:

| Layer | Change |
|-------|--------|
| `src/shared/types.ts` | add `UpdateResult`, `RepoUpdateOutcome`; add `updateAll` to `RepoDashboardApi` |
| `src/preload/preload.ts` | `updateAll: () => ipcRenderer.invoke('updateAll')` |
| `src/main/main.ts` | `ipcMain.handle('updateAll', () => updateAll(lastSnapshot))` |

Full semantics: [update.md](./update.md).

## Unchanged

`refresh()` stays the re-scan-only method the header **Refresh** control uses;
`updateAll()` is the separate mutating method behind the new **Pull all**
control. The renderer calls `refresh()` itself after `updateAll()` resolves, so
`updateAll` does not re-scan internally (keeps the two concerns separable and the
return payload minimal).
