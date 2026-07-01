# Phase 1: Index Foundation - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver deterministic git and doc ingestion into a trustworthy `.gitchange/` derived cache on a local clone — no network access. Phase 1 establishes the index schema, incremental checkpointing, privacy controls (secret redaction, `.gitchangeignore`), freshness warnings for unreliable history, and golden fixture tests for ingestion output and evidence-link integrity. Semantic artifacts (eras, tours, decisions) and dashboard UI are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Index artifact shape
- **D-01:** SQLite is the primary ingestion store from day one (commits, authors, file changes, doc snapshots metadata). Path: `.gitchange/index.sqlite`.
- **D-02:** Human-readable output in Phase 1 is limited to `manifest.json` (schema version, `lastIndexedCommit`, `indexedAt`, repo head, freshness warnings, index completeness). No full JSON sidecar dumps of commit history.
- **D-03:** JSON artifact files for semantic layers (eras, tours, decisions) are deferred to later phases; Phase 1 schema must not block their addition.

### Freshness and history integrity (INGX-05)
- **D-04:** On shallow clone or incomplete history: **warn and continue** — index available commits, set `indexCompleteness: partial` in manifest, surface degraded badge in `gitchange status` output.
- **D-05:** On force-push / rewritten history detected during incremental update: **warn and halt incremental merge** — do not silently append to a stale index. Require explicit `gitchange index --full` (or equivalent) to rebuild. Cold-start indexing on a shallow clone is allowed.
- **D-06:** Freshness warnings are persisted in `manifest.json` and echoed to CLI stdout on index completion.

### Privacy and sensitive data (PRIV-02, PRIV-03)
- **D-07:** For paths matched by `.gitchangeignore`: record that the path changed in a commit (path + change type) but **do not store file content or diff hunks**.
- **D-08:** For secret-pattern matches in diff content or commit messages: **redact sensitive substrings**, retain commit SHA, author, timestamp, and file path metadata.
- **D-09:** Do **not** exclude whole commits from the index solely because they touch secrets — authorship graph integrity matters more than dropping commits.
- **D-10:** Ship a default `.gitchangeignore` template covering common patterns (`.env*`, `**/secrets/**`, `*credentials*`, `*.pem`, `*.key`) — user can extend.

### Golden fixtures and TDD (EVD-04, SCALE-03)
- **D-11:** **Both** fixture strategies: tiny synthetic repos (3–8 commits covering merges, renames, conventional commits, ignored paths, simulated secrets) for fast CI golden tests; GitChange's own repository as a slower integration/dogfood fixture (required locally before milestone, optional in CI initially).
- **D-12:** Golden tests validate Zod schema conformance **and** evidence-link integrity (every indexed claim traceable to commit SHA + file path).

### Doc ingestion scope (INGX-03)
- **D-13:** Default doc paths: `README*`, `CHANGELOG*`, `docs/**`, `**/adr/**`, and `*.md` at repository root. Configurable extension via `.gitchangeignore` inverse patterns or future config — not in Phase 1 CLI surface beyond defaults.
- **D-14:** Store doc content snapshots at commit boundaries where matched paths changed; link snapshots to commit SHA in index.

### Evidence contract at index layer (EVD-01)
- **D-15:** Phase 1 evidence refs are **commit SHA + file path** granularity. Diff hunk offsets and excerpt spans are deferred to Phase 5 drill-down; schema must reserve fields for hunk-level evidence without requiring it in Phase 1 ingestion.
- **D-16:** Every narrative-ready record written in Phase 1 (doc snapshot, file change summary) includes a mandatory `evidence[]` array with at least one `{ type: "commit", sha }` or `{ type: "file", path, commitSha }` entry — validated by Zod at write boundary.

### `.gitchange/` version control policy
- **D-17:** `.gitchange/` is **gitignored by default** (entire directory). Document opt-in to commit `manifest.json` only for teams that want onboarding without re-indexing — never require committing the SQLite DB or intermediate artifacts.
- **D-18:** Default `.gitignore` entry added by `gitchange init` (or first index) if not present.

### Claude's Discretion
- Exact SQLite table layout and Drizzle migration numbering
- es-git revwalk batch sizes and optional piscina worker pool activation threshold (enable workers when commit count exceeds a sensible default, e.g., 10k+)
- Specific secret redaction regex set beyond the default template
- Synthetic fixture repo layout under `tests/fixtures/` vs `fixtures/`
- `manifest.json` field naming (`lastIndexedCommit` vs `analyzedUpTo`) — prefer `lastIndexedCommit` per ROADMAP/REQUIREMENTS

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and requirements
- `.planning/PROJECT.md` — Five core questions, local-first constraints, `.gitchange/` pattern, evidence-over-narrative product spine
- `.planning/REQUIREMENTS.md` — INGX-01–05, PRIV-01–03, SCALE-03, EVD-01, EVD-04 requirement definitions and traceability
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, requirement mapping

### Research (architecture, stack, pitfalls)
- `.planning/research/SUMMARY.md` — Recommended 8-phase order, Phase 1 deliverables, pitfall mitigations
- `.planning/research/STACK.md` — es-git, better-sqlite3, Drizzle, Zod, pnpm monorepo layout, packages/core structure
- `.planning/research/ARCHITECTURE.md` — Deterministic-first pipeline, manifest/checkpoint pattern, artifact store layout, ingestion ↔ intelligence boundary
- `.planning/research/PITFALLS.md` — Full-history rescan trap (Pitfall 4), stale index (Pitfall 7), secret leakage — architectural commitments for Phase 1

### Runtime project context
- `CLAUDE.md` — Stack table and monorepo conventions embedded for agent sessions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repository. Planning artifacts only; no `packages/` implementation yet.

### Established Patterns
- IDE plugin pattern referenced in PROJECT.md — copy packaging ideas later (Phase 3), not plugin codebase fork
- Research prescribes `packages/core` with `ingestion/`, `schema/`, `artifacts/`, `privacy/` subdirs — adopt when scaffolding monorepo in this phase

### Integration Points
- Phase 1 delivers library surface (`@gitchange/core`) consumed by Phase 3 CLI and Phase 5 server — design exports accordingly (Node-only; no browser imports of es-git/better-sqlite3)
- `manifest.json` + SQLite index are the read API contract for all downstream phases

</code_context>

<specifics>
## Specific Ideas

- User delegated area selection ("whatever") then confirmed four core decisions explicitly; follow-up questions on doc scope, git policy, and evidence granularity were skipped — recommended defaults applied (D-13 through D-18)
- Align with agent-analyzer / plugin patterns for `lastIndexedCommit` incremental checkpoints and force-push full-rebuild semantics

</specifics>

<deferred>
## Deferred Ideas

- JSON sidecar exports of full commit index for human grep/inspection — revisit if maintainers need inspectability without SQLite tools
- Hunk-level evidence storage — Phase 5 dashboard drill-down
- `gitchange index --watch` / chokidar auto-reindex — Phase 8 hardening
- Multi-repo index merge — Phase 8

</deferred>

---

*Phase: 1-Index Foundation*
*Context gathered: 2026-06-30*
