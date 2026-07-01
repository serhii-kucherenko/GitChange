---
phase: 02-repository-intelligence-ownership
plan: 03
subsystem: api
tags: [co-change, era-signals, drizzle, sqlite, intelligence, decay]

requires:
  - phase: 02-01
    provides: intelligence tables, path-filters, computeIntelligence orchestrator, intelligence.json export
provides:
  - computeCoChange with lockfile exclusion and exponential decay weighting
  - computeEraSignals with author_spike, path_churn_pivot, cc_scope_shift heuristics
  - intelligence.json coChange.edges and eraSignals.boundaries populated after computeIntelligence
affects: [02-04, 02-05, phase-4-agents]

tech-stack:
  added: []
  patterns:
    - "Co-change is correlation: export edges carry relationship co_change and disclaimer metadata"
    - "Era boundaries are deterministic pre-LLM signals with commit evidence refs"
    - "Canonical lexicographic path pair ordering for co_change_edges deduplication"

key-files:
  created:
    - packages/core/src/intelligence/cochange.ts
    - packages/core/src/intelligence/cochange.test.ts
    - packages/core/src/intelligence/era-signals.ts
    - packages/core/src/intelligence/era-signals.test.ts
  modified:
    - packages/core/src/intelligence/compute.ts
    - packages/core/src/intelligence/export.ts
    - packages/core/src/intelligence/compute.test.ts

key-decisions:
  - "Co-change decay uses configurable halfLifeDays (default 180) with referenceAt for testability"
  - "Era signal fallback timeline_segment when heuristics find no candidates on small repos"
  - "Era windows capped at 8 boundaries; adaptive window size for repos under 30 commits"

patterns-established:
  - "Pattern: co-change weight = count * exp(-ageDays / halfLife) at compute time"
  - "Pattern: era boundary evidence[] references boundary commit SHA from index"

requirements-completed: [CONT-01]

duration: 12min
completed: 2026-07-01
---

# Phase 2 Plan 03: Co-Change and Era Signals Summary

**Co-change graph with lockfile filtering and decay-weighted edges plus deterministic era boundary signals exported in intelligence.json**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T01:44:00Z
- **Completed:** 2026-07-01T01:48:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Implemented `computeCoChange` aggregating per-commit file pairs with path filters and exponential decay
- Implemented `computeEraSignals` with author spike, path churn pivot, and conventional scope shift heuristics
- Wired both passes into `computeIntelligence` and export layer with Zod-valid artifact sections
- BASIC_SCENARIO produces co-change edges and at least one era boundary with resolvable commit evidence

## Task Commits

1. **Task 1: Failing co-change tests** - `364b8ef` (test)
2. **Task 2: Co-change computation** - `1f7cc49` (feat)
3. **Task 3: Era signals + wire** - `6dc3b9b` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `packages/core/src/intelligence/cochange.ts` - Co-change pair aggregation, decay weight, export helper
- `packages/core/src/intelligence/cochange.test.ts` - Pair detection, lockfile exclusion, decay tests
- `packages/core/src/intelligence/era-signals.ts` - Era boundary heuristics and persistence
- `packages/core/src/intelligence/era-signals.test.ts` - BASIC_SCENARIO boundary and evidence tests
- `packages/core/src/intelligence/compute.ts` - Calls computeCoChange and computeEraSignals after churn
- `packages/core/src/intelligence/export.ts` - Populates coChange.edges and eraSignals.boundaries
- `packages/core/src/intelligence/compute.test.ts` - Asserts co-change and era sections in intelligence.json

## Decisions Made

- Used `referenceAt` option on `computeCoChange` so decay tests are deterministic without mocking Date
- Added `timeline_segment` fallback boundary for repos where heuristics produce no candidates (ensures >= 1 boundary on BASIC_SCENARIO)
- Adaptive window size `min(30, max(3, floor(n/2)))` for era heuristics on small fixture repos

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing `ownership/blame.test.ts` failures from Plan 02-02 (not in scope); Plan 02-03 verification tests all pass on Node 22

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-04 can consume `era_boundaries` windows for era ownership timelines and expertise profiles
- `intelligence.json` coChange and eraSignals sections ready for Phase 4 era synthesis agents
- No blockers for 02-04

## Self-Check: PASSED

- FOUND: packages/core/src/intelligence/cochange.ts
- FOUND: packages/core/src/intelligence/era-signals.ts
- FOUND: packages/core/src/intelligence/cochange.test.ts
- FOUND: packages/core/src/intelligence/era-signals.test.ts
- FOUND: 364b8ef
- FOUND: 1f7cc49
- FOUND: 6dc3b9b

---
*Phase: 02-repository-intelligence-ownership*
*Completed: 2026-07-01*
