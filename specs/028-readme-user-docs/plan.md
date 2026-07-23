# Implementation Plan: User-Facing README & Extracted Developer Docs

**Branch**: `028-readme-user-docs` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-readme-user-docs/spec.md`

## Summary

Rewrite `README.md` into a user-facing front door (value proposition in the first
screenful, a screenshot, plain-language explanations of every core workflow backed by
ASCII diagrams, prerequisites, safety posture, download/first-launch, license summary)
and extract all developer content into a dedicated `docs/development.md`, plus a
`docs/workflow.md` capturing the author's domain-driven, worktree-isolated, layered-
`CLAUDE.md` working style. **Documentation only** — no application source, dependency,
persisted setting, or IPC surface changes. The load-bearing constraint is accuracy:
every diagram and behavioral claim MUST match the current `main` implementation
(SC-002), verified against `src/main/update.ts`, `cleanup.ts`, `clone-discovery.ts`,
`launch.ts`, and the constitution.

## Technical Context

**Language/Version**: Markdown (GitHub-flavored) — no programming language involved

**Primary Dependencies**: None. Diagrams are hand-authored ASCII fenced code blocks
(resolved decision — see research), so they render everywhere GitHub renders Markdown
with no diagramming library or renderer dependency.

**Storage**: N/A (documentation files on disk)

**Testing**: No automated test framework applies. Validation is manual verification of
each behavioral claim against the source of truth (implementation code + constitution),
per `quickstart.md`.

**Target Platform**: Any Markdown viewer (GitHub web, editors) — the docs must not
depend on a renderer plugin.

**Project Type**: Documentation for an existing Electron desktop application.

**Performance Goals**: N/A (static documents). The only human-facing target is
SC-001: a first-time reader states what the app does + one benefit within 30 seconds.

**Constraints**: Diagrams/claims must be 100% accurate to the current implementation
(SC-002); developer detail must not leak back into the README (FR-009); the optional
`gh` CLI must never read as required (FR-005); the safety claim must be worded so it
stays true under constitution v5.0.0 (the app itself originates no network traffic —
all outbound activity is the user's own `git`/`gh` with the user's credentials).

**Scale/Scope**: Three deliverables — `README.md` (rewrite), `docs/development.md`
(new, extracted), `docs/workflow.md` (new). ~13 functional requirements, 5 success
criteria.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature writes no code and performs no repository mutation, so most principles are
not exercised. The relevant obligation is that the documentation must **describe** the
principles accurately:

- **Principle I (System-Native Delegation)** — N/A to author; the README must state the
  app uses the system `git`/`gh`, never bundling its own or handling credentials.
- **Principle II (Read-Only by Default)** — N/A to author; the README's safety section
  must reflect that background/on-demand scanning is read-only and mutations are
  explicit user actions.
- **Principle III (Never Resolve Conflicts)** — **accuracy gate.** The Pull all and
  Rebase worktrees diagrams MUST show autostashed work restored on **both** the clean
  and the conflict/abort paths, and must never depict auto-merge or conflict resolution
  (FR-004). Verified against `src/main/update.ts`.
- **Principle IV (Always-Observable State)** — N/A to author (no UI change).
- **Principle V (Local-Only, Minimal Footprint)** — **accuracy gate.** Post-v5.0.0 the
  app MAY invoke the system `gh` CLI for read-only clone discovery. The README's safety
  claim (FR-006) MUST NOT overclaim "zero network" in a way that contradicts this; it
  must frame outbound activity as the user's own `git`/`gh` with the user's credentials,
  the app storing/handling no token.

No new runtime dependency, no mutating operation, no network origination by the app
itself. **Gate: PASS** — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/028-readme-user-docs/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

No `contracts/` directory: this feature exposes no machine interface (API, CLI schema,
IPC surface). Its "contract" is human-readable accuracy, captured as validation steps in
`quickstart.md` instead.

### Source Code (repository root)

This feature changes only documentation files at the repository root and under `docs/`:

```text
README.md                # Rewritten: user-facing front door
docs/
├── development.md       # New: build/run/test, architecture, contributing, release
└── workflow.md          # New: domain-driven, worktree-isolated, layered-CLAUDE.md method
```

The following existing source files are **read-only references** for accuracy
verification (never modified by this feature):

```text
src/main/update.ts           # Pull all / Rebase worktrees autostash-rebase-restore spine
src/main/cleanup.ts          # Gone-branch / stale-worktree cleanup behavior
src/main/clone-discovery.ts  # gh-CLI clone type-ahead + graceful fallback
src/main/launch.ts           # Argument-safe launcher parameter passing
src/main/probe.ts            # Read-only git probe, timeouts, version floor
src/main/config.ts           # Settings file path (must match productName)
.specify/memory/constitution.md  # Principles the safety section paraphrases
```

**Structure Decision**: Documentation-only. The user-facing README lives at the repo
root (GitHub's default landing document); developer and workflow docs live under the
existing `docs/` directory, consistent with the repository's layout (spec Assumptions).

## Complexity Tracking

No constitution violations — table intentionally omitted.
