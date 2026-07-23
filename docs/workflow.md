# Working Style: Domain-Driven Context & Worktree Isolation

A methodology for managing many repositories at once with AI coding agents: group
repositories into **business domains**, give each layer its own `CLAUDE.md` so an
agent only ever ingests context that's relevant, and make every change in a
**Git worktree** so the `main` checkout stays pristine.

This is the workflow [Rookery](../README.md) is built to support. Rookery watches
your domain directories, lists every repository grouped by family, and shows the
worktrees you create nested under their primary repo — so the organizing principle
below and the tool reinforce each other.

## 1. Core Principles

1. **Domain isolation ("island architecture")** — Repositories are grouped into
   high-level business domains (e.g. `privacy-account`, `compliance`,
   `pro-account`). Services may talk to each other over the network, but each
   domain is treated as an autonomous platform with its own architecture and rules.
2. **Hierarchical context cascading** — Context lives in the file tree next to the
   code it describes. An agent working inside a domain ingests the global rules, that
   domain's rules, and the specific service's rules — and nothing from unrelated
   domains. This keeps the context window small and accuracy high.
3. **Zero-mutation `main` checkout** — The `main` branch of every repository stays
   clean and untouched. All edits, features, and refactors happen in ephemeral Git
   worktrees, then land on `main` through a pull request.

## 2. Directory Layout & Context Tree

Each domain is a directory you point Rookery at. The `CLAUDE.md` files form a
three-level context tree:

```text
📁 ~/Developer/
 ├── 📄 CLAUDE.md                     ← Global: baseline rules + domain map
 │
 ├── 📁 privacy-account/              ← Domain (a watched directory)
 │    ├── 📄 CLAUDE.md                ← Domain: architecture + rules
 │    ├── 📦 auth-service/            ← Primary checkout (main, never edited directly)
 │    │    ├── 📄 CLAUDE.md           ← Service: build/test/run commands
 │    │    └── 📁 .worktrees/         ← Worktrees for in-progress work
 │    └── 📦 user-data-service/
 │
 ├── 📁 compliance/                   ← Domain (a watched directory)
 │    ├── 📄 CLAUDE.md
 │    ├── 📦 audit-logger/
 │    └── 📦 gdpr-exporter/
 │
 └── 📁 pro-account/                  ← Domain (a watched directory)
      ├── 📄 CLAUDE.md
      ├── 📦 billing-engine/
      └── 📦 subscription-api/
```

## 3. Context Hierarchy (`CLAUDE.md` Layering)

Context is split into three operational layers. An agent reads them from the top
down, so the most specific instructions win.

### Layer 1 — Global (`~/Developer/CLAUDE.md`)

- **Purpose**: Rules every session inherits, regardless of which folder it's in.
- **Contains**:
  - The mandatory worktree directive (never edit `main` directly).
  - Global conventions (commit message format, preferred package manager).
  - A **domain map**: one line per domain saying what it is — the minimum an agent
    should always know before it knows anything else.

### Layer 2 — Domain (`~/Developer/<domain>/CLAUDE.md`)

- **Purpose**: The architecture and boundaries shared across a domain's services.
- **Contains**:
  - A platform overview and the list of services in the domain.
  - Shared contracts (event schemas, shared data models, inter-service protocols).
  - Domain-specific guardrails (e.g. strict PII/GDPR handling in `compliance`).

### Layer 3 — Service (`~/Developer/<domain>/<repo>/CLAUDE.md`)

- **Purpose**: How to operate one repository.
- **Contains**:
  - Build, test, and lint commands (`pnpm test`, `make run`, …).
  - Repository structure notes and entry points.
  - Local environment setup and mock servers.

> **Why this works**: an agent editing `billing-engine` never loads the
> `compliance` domain's rules or `auth-service`'s build commands. Less irrelevant
> context means fewer wrong assumptions and less hallucination.

## 4. Git Worktree Safety Protocol

To keep `main` clean and avoid accidental commits on the primary checkout, every
change follows the same worktree lifecycle:

```text
        ┌──────────────────────────┐
        │ Agent receives a task    │
        │  for <domain>/<service>  │
        └────────────┬─────────────┘
                     │
                     ▼
        Create a dedicated worktree
        `git worktree add .worktrees/<feature> -b <feature>`
                     │
                     ▼
        Edit, test, and commit —
        all inside the worktree
                     │
                     ▼
        Push branch → open a Pull Request → merge into `main`
                     │
                     ▼
        Remove the worktree
        `git worktree remove .worktrees/<feature>`
```

### Worked example

Task: add rate limiting to `billing-engine` in the `pro-account` domain.

```bash
cd ~/Developer/pro-account/billing-engine

# 1. Create an isolated worktree (main checkout stays untouched)
git worktree add .worktrees/rate-limiting -b feat/rate-limiting

# 2. Do all work inside it
cd .worktrees/rate-limiting
# ...edit, then:
pnpm test
git add -A && git commit -m "Add per-tenant rate limiting"
git push -u origin feat/rate-limiting

# 3. Open a PR, merge, then clean up
cd ~/Developer/pro-account/billing-engine
git worktree remove .worktrees/rate-limiting
```

In Rookery, the `rate-limiting` worktree appears nested under `billing-engine`
while it exists, and disappears from the family once you remove it — so the table
mirrors your actual in-flight work.

> **Placement note**: keeping worktrees in a repo-local `.worktrees/` directory
> (gitignored) keeps them tidy and easy to find. Placing them as siblings of the
> repo works too; Rookery groups linked worktrees under their primary either way.

## 5. Ready-to-Use `CLAUDE.md` Templates

### Global (`~/Developer/CLAUDE.md`)

```markdown
# Global Workspace Guidelines

## Mandatory Worktree Rule
NEVER modify files directly in the primary checkout of a repository (`main`).
Before any file edit, commit, or destructive command, create and switch to a
worktree:

1. Identify the repository: `<domain>/<service>`.
2. Create a feature worktree inside it:
   `git -C <domain>/<service> worktree add .worktrees/<feature> -b feat/<feature>`
3. Do all editing, testing, and committing inside
   `<domain>/<service>/.worktrees/<feature>`.

## Domain Map
- **privacy-account**: user identity, authentication, privacy settings, data isolation.
- **compliance**: audit logging, legal reporting, regulatory exports, retention policies.
- **pro-account**: premium subscriptions, usage limits, enterprise invoicing, seat management.
```

### Domain (`~/Developer/privacy-account/CLAUDE.md`)

```markdown
# Privacy Account Domain

## Overview
The core identity and security boundary of the platform. Services here handle
sensitive user data, auth tokens, and encryption keys.

## Services
- `auth-service`: OAuth2/OIDC provider and session manager.
- `user-data-service`: PII storage and user-profile CRUD.

## Domain Rules
- PII is never logged to stdout in plain text.
- Internal service-to-service traffic uses mutual TLS.
```

### Service (`~/Developer/privacy-account/auth-service/CLAUDE.md`)

```markdown
# auth-service

## Commands
- Install: `pnpm install`
- Test: `pnpm test`
- Run locally: `pnpm dev` (needs the local mock IdP — see below)

## Structure
- `src/oauth/`  — OAuth2/OIDC flows
- `src/session/` — session issuing and revocation

## Local Setup
Start the mock identity provider with `docker compose up mock-idp` before `pnpm dev`.
```
