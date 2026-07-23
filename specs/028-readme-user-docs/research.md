# Research: User-Facing README & Extracted Developer Docs

Phase 0 output. No `NEEDS CLARIFICATION` markers remained in Technical Context; the
items below are the substantive decisions taken during this documentation work.

## 1. Diagram format: ASCII text blocks vs a diagramming library

- **Decision**: Author every diagram as hand-drawn ASCII inside fenced code blocks.
- **Rationale**: The README must render identically everywhere it is read — GitHub web,
  plain editors, terminal previews — with no plugin or renderer dependency (Principle V,
  minimal footprint). ASCII code fences satisfy this unconditionally. This overturns an
  intermediate Mermaid attempt made earlier in the session.
- **Alternatives considered**:
  - *Mermaid fenced blocks* — GitHub renders them, but plain Markdown viewers and many
    editors show raw source; drafted and then reverted for that inconsistency.
  - *Committed SVG/PNG images* — render everywhere but go stale silently and can't be
    diffed/reviewed as text; rejected as higher maintenance for a docs-only feature.

## 2. Ensuring ASCII diagram alignment

- **Decision**: Generate the more complex diagrams (Pull all, Rebase worktrees, launcher
  security boxes) by computing column positions rather than nudging characters by hand.
- **Rationale**: Hand-drawn ASCII repeatedly produced unmatched box corners and ragged
  right edges. Position-computed generation eliminated the alignment defects that manual
  editing kept reintroducing.
- **Alternatives considered**: Manual character alignment — tried first, abandoned after
  repeated corner/edge mismatches.

## 3. Behavioral-accuracy verification against source (SC-002)

- **Decision**: Verify every behavioral claim and diagram against the current `main`
  implementation before considering the docs done — treating any mismatch as a defect.
- **Rationale**: SC-002 ("100% of diagrams/claims match implementation") is the gate that
  turns "nicer docs" into a verifiable outcome. A diagram that contradicts the code is
  worse than no diagram — it misleads readers evaluating trust.
- **Key finding**: In `src/main/update.ts` the autostash-rebase spine restores the stash
  **unconditionally** — on both the clean-rebase path and the conflict-abort path
  (`updateRepoInner` control flow). Earlier draft diagrams showed restoration only on the
  clean path; corrected so Pull all and Rebase worktrees both depict restore-on-both-paths
  (FR-004, Principle III).

## 4. Safety-claim wording under constitution v5.0.0

- **Decision**: Phrase the safety posture as "the app itself originates no network traffic
  of its own — all outbound activity is your own `git`/`gh` talking to your remotes with
  your credentials; no telemetry, no stored tokens."
- **Rationale**: Constitution v5.0.0 narrowed Principle V: the app now MAY invoke the
  system `gh` CLI for read-only clone discovery. A flat "zero network" claim would be
  inaccurate (FR-006 accuracy). Attributing all traffic to the user's own delegated
  `git`/`gh` keeps the claim both true and reassuring.
- **Alternatives considered**: "Makes no network calls, ever" — factually wrong after
  feature 027 (Clone); rejected.

## 5. Settings-file path in developer docs

- **Decision**: Reference the settings file under the `Rookery` application-support
  folder, matching `productName` in `package.json`.
- **Rationale**: Electron derives the userData path from `productName`. Documenting the
  pre-rename `git-manager` path would send developers to a nonexistent folder. Verified
  against `package.json` and `src/main/config.ts`.

## 6. Third deliverable: dedicated workflow document (FR-013)

- **Decision**: Capture the domain-driven, worktree-isolated, layered-`CLAUDE.md` method
  in its own `docs/workflow.md`, linked briefly from the README rather than inlined.
- **Rationale**: The methodology is long and serves a narrow audience; inlining it would
  bloat the user-facing README (FR-009's separation-of-concerns intent). A brief README
  mention plus a link keeps the front door lean while making the method discoverable.
- **Alternatives considered**: Folding it into `docs/development.md` — rejected; the
  working method is orthogonal to build/architecture/release reference material and
  deserves its own discoverable document.

## 7. Avoiding tool-artifact leakage into committed docs

- **Decision**: Grep generated docs for stray closing tags (`</content>`, `</invoke>`,
  etc.) before finalizing.
- **Rationale**: Assistant tooling that wraps output in XML can leak closing tags into
  committed Markdown. A grep-for-closing-tags pass is a cheap, reliable guard; it caught
  and removed real leaked tags during review.
