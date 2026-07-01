---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 06-04-PLAN.md — decisions browse, open threads, migration drill-down
last_updated: "2026-07-01T11:44:20.407Z"
last_activity: 2026-07-01
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 36
  completed_plans: 34
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-30)

**Core value:** Anyone onboarding or maintaining a codebase can answer five evidence-backed questions — who changed what, how the project evolved, what decisions/migrations were made, what's still in flight, and current progress.
**Current focus:** Phase 6 — Decisions, Status & Open Work

## Current Position

Phase: 6 of 8 in progress (Decisions, Status & Open Work)
Plan: 4 of 6 complete in Phase 6 (06-01, 06-02, 06-03, 06-04)
Status: Ready to execute 06-05
Last activity: 2026-07-01
Stopped at: Completed 06-04-PLAN.md — decisions browse, open threads, migration drill-down

Progress: [█████████░] 94%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Generated drizzle migration applied via migrate() in openDb for fresh .gitchange dirs
- Shared processCommit step used by both indexFull and indexIncremental
- Out-of-order inversion counts when older revwalk commit has newer committer timestamp than descendant
- Force-push detection walks HEAD ancestry; revparse existence alone is insufficient
- Ignored doc paths store content null but contentHash from raw blob bytes
- Gray-matter body trimmed before storage and hashing
- Golden tests use verify helpers in packages/core to avoid drizzle-orm imports from tests/golden
- BASIC_SCENARIO fixture secrets aligned to SECRET_RULES pattern lengths
- Dogfood golden test gated behind GITCHANGE_DOGFOOD env flag
- All intelligence Drizzle tables in single migration 0001_intelligence
- computeIntelligence separate pass after indexFull; attributionConfidence degraded on partial index
- es-git blame hot path; simple-git when .git-blame-ignore-revs present
- Era ownership uses commit-touch proxy per era_boundaries window; full per-era blame deferred to Phase 8
- Expertise export uses topics[] with suggestedContributors and evidence min 1
- Merge commits remapped to origCommitId before ownership aggregation

- Ownership file evidence uses last indexed touch commit, not HEAD, for referential integrity
- rebuildIntelligence defaults false for backward-compatible index-only flows
- CLI always calls computeIntelligence after index (P3-D-02)
- resolveGitChangeRoot walks up from module path when cwd discovery fails (P3-D-04 step 4)
- Installer pins official GitHub URL with warning on custom GITCHANGE_REPO_URL
- First-run integration test uses GITCHANGE_PORT for ephemeral serve binding; Node 22.x required for native sqlite in CI

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Doc evidence type added additively with 500-char excerpt cap per P4-D-07
- Named eras capped at 8 at writeErasArtifact boundary
- Era synthesis context reads intelligence.json + doc_snapshots only (no live git)
- bindBasicScenarioErasTemplate in core avoids drizzle resolution failures from tests/fixtures
- erasSummary truncates summaries to 200 chars for snapshot API disclosure control
- gitchange validate exits 1 when eras.json missing without faking semantic pass

- Roadmap: Evidence contract (EVD-01) established in Phase 1 schema; confidence UI in Phase 5; honest gaps in Phase 6
- Roadmap: Phase 3 delivers First Run UX (UA pattern: marketplace install → `/gitchange` → `/gitchange-dashboard`); Phase 5 expands minimal dashboard into full drill-down
- Cursor pagination uses committedAt desc + sha tiebreaker with base64url cursor tuple
- Dashboard API types duplicated locally — no @gitchange/core in client bundle
- Per-file hunk capture via es-git pathspecs + print(Patch) at index time; 20 hunks / 32KB cap per file
- Commit detail API reads hunks_json from SQLite only — no es-git in server (SCALE-02)
- Existing .gitchange directories need re-index for hunks_json data
- after/before API params are unix seconds; core multiplies by 1000 to match indexed committedAt ms
- Path filter uses Drizzle exists subquery on file_changes.path with prefix LIKE
- Era drill store holds SelectedEra object with window timestamps for after/before commit filters
- vis-timeline mounted imperatively; vis-data added explicitly for Vite bundle
- File history API uses Hono :path{.+} for slash-containing repo paths
- File history ordered newest-first; cursor includes fileChangeId tiebreaker

- Phase 5 confidence UI uses evidence-count heuristic; full decision model deferred to Phase 6
- Attribution badge downgrades to Degraded when manifest.warnings is non-empty
- PRIV-04 tests assert 127.0.0.1 default bind and 0.0.0.0 stderr warning

- Interview evidence paths restricted to interviews/ prefix under .gitchange
- EVD-03 floor at confidence 0.35 with literal gap message in threshold.ts
- Deterministic candidate mining reads SQLite only; merge/chore/lockfile noise filtered

- Docs-vs-code divergence checks any indexed doc snapshot for completion keywords against recent code path touches
- Stale threshold 90 days; docs-vs-code recent window 30 days
- Intelligence tab switcher: Timeline | Decisions | Open work in dashboard main column
- getDecisionById returns gap-only response when below evidence threshold — no summary leak
- Thread event paths sanitized via validateFilePath at read boundary

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-01T11:44:20.396Z
Stopped at: Completed 06-04-PLAN.md — decisions browse, open threads, migration drill-down
Resume file: None
