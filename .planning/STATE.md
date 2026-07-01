---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 9 UI-SPEC approved
last_updated: "2026-07-01T18:57:27.265Z"
last_activity: 2026-07-01
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 50
  completed_plans: 49
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-30)

**Core value:** Anyone onboarding or maintaining a codebase can answer five evidence-backed questions — who changed what, how the project evolved, what decisions/migrations were made, what's still in flight, and current progress.
**Current focus:** Phase 09 — dashboard-ui-redesign

## Current Position

Phase: 09 (dashboard-ui-redesign) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-07-01
Stopped at: Phase 9 UI-SPEC approved

Progress: [██████████] 98%

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
| Phase 09 P01 | 4m | 2 tasks | 2 files |
| Phase 09 P02 | 4m | 1 tasks | 2 files |
| Phase 09 P03 | 5m | 2 tasks | 4 files |

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
- Roadmap: Phase 3 delivers First Run UX (plugin pattern: marketplace install → `/gitchange` → `/gitchange-dashboard`); Phase 5 expands minimal dashboard into full drill-down
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

- matchOpenWorkToSurface exported for Phase 7 tour player integration
- Decision surfaces use decisionConfidenceToLevel; era claims keep evidence-count heuristic
- validate runs checkDecisionsIntegrity when decisions.json present

- Topic tour stop cap (8) enforced at Zod layer alongside artifact kind caps
- Context tests bind eras via applyBasicScenarioErasFixture from golden semantic fixture
- writeToursArtifact gates atomic write with checkToursIntegrity against index + eras + decisions
- Tour list 404 uses error message "tours not found" per plan contract
- tourId path param rejects .. and / before artifact lookup (T-07-06)
- tours.list / tours.detail(tourId) react-query key helpers exported from dashboard client

- Tours golden fixture canonical path is `basic-scenario-tours.json`; `applyBasicScenarioToursFixture` exported from core bind helper

- Tour progress persists via zustand subscribe on headSha from snapshot manifest
- Era/decision drills switch intelligence tab; commit/file drills stay on tours tab with CommitDetailPanel

- BASIC_SCENARIO_TOURS_SNAPSHOT locks 3 tours, 4 default chapters, 6 total stops
- validate runs checkToursIntegrity when tours.json present; errors if manifest checkpoint without file

- Workspace file stored in primary repo gitchangeDir; discovered by walking up for workspace.json
- indexWorkspace stamps manifest.repoId after each successful index

- indexWorkspace skips computeIntelligence when incremental pass indexes zero commits
- workspace CLI subcommands accept --cwd for E2E harness from monorepo root
- serve auto-discovers workspace gitchangeDir when workspace.json absent in repo .gitchange

- Piscina maxThreads defaults to max(1, cpus-1)
- Scale fixture uses git fast-import for sub-second 10k history
- CLI index emits progress every 500 commits on stderr
- [Phase ?]: Dashboard active tab uses sky-400 underline (border-b-2) per UI-SPEC top-level nav preference
- [Phase ?]: DashboardLayoutProps restructured to per-view slots; App.tsx sole caller updated same plan, typecheck-guarded
- [Phase ?]: Era label max-width 12rem with ellipsis + native vis-timeline title tooltip; no library swap (09-02)
- [Phase ?]: [09-03]: Virtualized lists use min-h-[24rem] flex-1 flex-fill (not fixed h/max-h caps); ROW_HEIGHT constants unchanged since no row-height edits

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

Last session: 2026-07-01T18:57:23.714Z
Stopped at: Completed 08-05-PLAN.md — milestone gate E2E + workspace integrity
Resume file: None
