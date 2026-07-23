# Quickstart / Validation Guide: User-Facing README & Extracted Developer Docs

This is a documentation feature, so "validation" means verifying the finished docs against
their success criteria and against the source of truth (the implementation + constitution).
No app build or test run is required. Each scenario below is a manual check with an
explicit expected outcome.

## Prerequisites

- The three deliverables exist: `README.md`, `docs/development.md`, `docs/workflow.md`.
- A checkout of `main` for accuracy comparisons (source files listed in `plan.md`).

## Scenario A — First-time-reader comprehension (SC-001, FR-001)

1. Ask a person unfamiliar with the project to read only the first screenful of `README.md`.
2. After 30 seconds, ask "what does this do, who's it for, and why use it?"
- **Expected**: correct one-sentence answer + at least one concrete benefit, no other file
  opened.

## Scenario B — Core-workflow explanations + diagram accuracy (FR-003, FR-004, SC-002)

For each of Pull all, Rebase worktrees, Cleanup, Clone, launchers, watching directories:
1. Read the section's plain-language explanation and its ASCII diagram.
2. Compare the described behavior against the implementation:
   - Pull all / Rebase worktrees → `src/main/update.ts`. **Critical**: the diagram must
     show autostashed work restored on **both** the clean and the conflict/abort paths,
     and must never depict auto-merge or conflict resolution.
   - Cleanup → `src/main/cleanup.ts` (gone branches, stale/missing worktrees, confirmation).
   - Clone → `src/main/clone-discovery.ts` (`gh` type-ahead + graceful manual-URL fallback).
   - Launchers → `src/main/launch.ts` (arguments passed positionally, never spliced).
- **Expected**: every claim/diagram matches the code; zero contradictions.

## Scenario C — Safety posture accurate under constitution v5.0.0 (FR-006)

1. Read the README safety section.
- **Expected**: it states the app itself originates no network traffic and collects no
  telemetry, while attributing all outbound activity to the user's own `git`/`gh` with the
  user's credentials — consistent with Principle V (which permits system-`gh` clone
  discovery). It must NOT make a flat "zero network, ever" claim.

## Scenario D — Prerequisites: required vs optional (FR-005, SC-004)

1. Read the requirements section.
- **Expected**: system `git` reads as required; `gh` CLI reads as optional (enables Clone
  type-ahead), with pasted-URL clone as the fallback. `gh` never reads as mandatory.

## Scenario E — Download & first-launch bypass (FR-007)

1. Read the download section.
- **Expected**: macOS Gatekeeper and Windows SmartScreen first-launch bypass steps present.

## Scenario F — License summary (FR-008)

1. Read the license summary.
- **Expected**: plain-language summary present + link to the full license text.

## Scenario G — Developer extraction complete & non-duplicated (FR-009, FR-011, SC-003, SC-005)

1. Open `docs/development.md`.
- **Expected**: contains build/run/test commands + prerequisites, architecture overview,
  contributing conventions, and release process.
2. Search `README.md` for build/architecture/release detail.
- **Expected**: none inline beyond a one-line pointer to `docs/development.md`.
3. Compare pre-rewrite README developer content against `docs/development.md`.
- **Expected**: nothing lost (SC-005).
4. Verify the settings-file path in `docs/development.md`.
- **Expected**: matches `productName` (`Rookery`) — not the pre-rename `git-manager`.

## Scenario H — Workflow document present & linked (FR-013)

1. Open `docs/workflow.md`.
- **Expected**: documents the domain-driven, worktree-isolated, layered-`CLAUDE.md` method
  with concrete examples and copy-ready templates.
2. Check the README.
- **Expected**: a brief mention + link to `docs/workflow.md` (not the full method inline).

## Scenario I — Cross-links and hygiene

1. Follow every README link to `docs/development.md` and `docs/workflow.md`.
- **Expected**: all resolve.
2. `grep` all three files for stray tool-artifact closing tags (`</content>`, `</invoke>`,
   `</parameter>`) and unbalanced code fences.
- **Expected**: none found; all code fences balanced; ASCII diagrams display square.
