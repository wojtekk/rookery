# Quickstart / Validation: Unified Vector Icon Set

Prerequisites: `nvm use` (Node 24), `pnpm install`.

## Automated check

```bash
pnpm test          # includes the catalog contract test (contracts/icon-catalog.md)
pnpm build         # TypeScript compiles; no unresolved icon ids
```

Expected: all tests pass (prior suite + the new catalog test); build clean.

## Manual visual walkthrough (`pnpm start`)

Drive the live Electron window and confirm each scenario. (An agent cannot drive
real mouse/hover here — this section is owed as a pre-merge human check.)

| # | Scenario | Expected | Requirement |
|---|----------|----------|-------------|
| A | Open the app with several repos + seeded launcher actions. | Every launcher icon in a row reads at the **same visual weight** — none heavier/darker/fainter. | FR-001/002, SC-001 |
| B | Compare a brand icon (GitHub) with a generic one (terminal) in the same row. | Same stroke style and weight. | FR-002 |
| C | Look at the IntelliJ launcher. | Bespoke IntelliJ mark, visibly rendered, at the **same weight** as neighbours (not lighter). | FR-006, SC-002 |
| D | Look at the row delete control. | A **trash** icon (no `×`), same outline style/weight as launchers. | FR-005, SC-003 |
| E | Activate delete. | Existing delete confirmation/flow behaves exactly as before. | FR-005/012 |
| F | Hover an icon (colour follows text, no colour of its own), then trigger a long op (Pull all) so rows dim. | Icons stay monochrome in normal, hover, and dimmed states, inheriting text colour per existing rules. | FR-003, edge cases |
| G | Open Settings → icon picker for a custom action. | Same selectable launcher icons as before; **no trash/x/chevron/git-branch** offered. | FR-010 |
| H | Settings overlay: close button + a remove-directory button. | Close = **x** icon; remove-dir = **trash** icon. | FR-013, SC-003 |
| I | Settings overlay: reorder an action up/down. | Up = **chevron-up**, down = **chevron-down**. | FR-013 |
| J | Cleanup overlay: close button. | **x** icon. | FR-013, SC-003 |
| K | Cleanup overlay: a candidate that also removes a worktree. | **git-branch** icon (not `⌂`); its "also removes a worktree" tooltip unchanged. | FR-013 |
| L | Compare row/toolbar footprint before vs after. | No layout shift or reflow — icons occupy the same space. | FR-007, SC-004 |
| M | Disable the network, reload. | All icons still render (no outbound request to display any icon). | FR-008, SC-005 |
| N | Confirm `THIRD_PARTY_LICENSES` exists with Tabler MIT text. | Present at repo root. | FR-009 |

## Done when

- `pnpm test` + `pnpm build` green.
- Scenarios A–N pass in the live window.
- `THIRD_PARTY_LICENSES` committed.
