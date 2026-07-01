---
phase: 02-repository-intelligence-ownership
plan: 01
subsystem: api
tags: [drizzle, sqlite, zod, churn, intelligence, minimatch]

requires:
  - phase: 01-index-foundation
    provides: index.sqlite with commits/file_changes, manifest.json, openDb migrations
provides:
  - Intelligence Drizzle tables (file_churn, co_change_edges, file_ownership, era_boundaries, era_ownership, contributor_expertise)
  - IntelligenceArtifact Zod contract and intelligence.json export
  - computeIntelligence public API with churn from indexed file_changes
affects: [02-02, 02-03, 02-04, 02-05, phase-4-agents, phase-5-dashboard]

tech-stack:
  added: []
  patterns:
    - "Index-first intelligence: churn reads file_changes only, no live git walk"
    - "Atomic intelligence.json write via temp-rename (manifest pattern)"
    - "attributionConfidence degraded when manifest.indexCompleteness is partial"

key-files:
  created:
    - packages/core/migrations/0001_intelligence.sql
    - packages/core/src/schema/zod/intelligence.ts
    - packages/core/src/intelligence/path-filters.ts
    - packages/core/src/intelligence/churn.ts
    - packages/core/src/intelligence/export.ts
    - packages/core/src/intelligence/compute.ts
    - packages/core/src/intelligence/churn.test.ts
    - packages/core/src/intelligence/compute.test.ts
  modified:
    - packages/core/src/schema/drizzle/schema.ts
    - packages/core/src/schema/zod/index.ts
    - packages/core/src/index.ts

key-decisions:
  - "All intelligence SQLite tables created in single 0001_intelligence migration to avoid later conflicts"
  - "Churn excludes content_ignored paths (privacy) in addition to INTELLIGENCE_IGNORE_GLOBS"
  - "Walking skeleton exports empty coChange/ownership/eraSignals/expertise sections until later plans populate them"

patterns-established:
  - "Pattern: computeIntelligence is separate pass after indexFull (P2-D-06)"
  - "Pattern: churn evidence[] uses file ref to last-touched commit per path"

requirements-completed: []

duration: 8min
completed: 2026-07-01
---

# Phase 2 Plan 01: Intelligence Walking Skeleton Summary

**Churn metrics from indexed file_changes with Zod-validated intelligence.json export via computeIntelligence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-01T01:37:00Z
- **Completed:** 2026-07-01T01:41:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added all Phase 2 intelligence Drizzle tables in migration `0001_intelligence.sql`
- Implemented churn aggregation from `file_changes` joined to `commits` with path filters
- Delivered `computeIntelligence` orchestrator writing schema-valid `.gitchange/intelligence.json`
- E2E test: `indexFull` → `computeIntelligence` on BASIC_SCENARIO produces churn with evidence

## Task Commits

1. **Task 1: Failing E2E test** - `5e05cb8` (test)
2. **Task 2: Schemas + migration + churn** - `88e5e53` (feat)
3. **Task 3: computeIntelligence + export + API** - `f8f466c`, `03192ad` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `packages/core/src/intelligence/compute.ts` - Post-index orchestrator entry point
- `packages/core/src/intelligence/churn.ts` - SQL aggregation into file_churn table
- `packages/core/src/intelligence/export.ts` - intelligence.json atomic writer
- `packages/core/src/schema/zod/intelligence.ts` - IntelligenceArtifact contract
- `packages/core/migrations/0001_intelligence.sql` - Intelligence table migration

## Decisions Made

- Excluded `content_ignored` file_changes from churn (privacy-sensitive paths like `.env`)
- Pre-created all intelligence tables in one migration per research recommendation
- Set `attributionConfidence: degraded` when manifest reports partial index completeness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Filter content_ignored paths from churn**
- **Found during:** Task 2 (churn unit test)
- **Issue:** `.env` appeared in churn despite privacy exclusion during indexing
- **Fix:** Skip file_changes where `contentIgnored` is true in churn aggregation
- **Files modified:** `packages/core/src/intelligence/churn.ts`
- **Verification:** churn.test.ts passes with `.env` excluded
- **Committed in:** `88e5e53`

**2. [Rule 3 - Blocking] Remove duplicate exports in index.ts**
- **Found during:** Task 3 (typecheck)
- **Issue:** Duplicate `computeIntelligence` exports caused TS2300 errors
- **Fix:** Deduplicated public API exports
- **Files modified:** `packages/core/src/index.ts`
- **Verification:** `pnpm --filter @gitchange/core typecheck` passes
- **Committed in:** `03192ad`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both required for correctness and build; no scope creep.

## Issues Encountered

None beyond auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-02 (blame ownership) and 02-03 (co-change + era signals) in parallel
- Intelligence tables and export contract in place for downstream plans
- `intelligence.json` churn section validated end-to-end on BASIC_SCENARIO

## Self-Check: PASSED

- FOUND: packages/core/src/intelligence/compute.ts
- FOUND: packages/core/src/intelligence/churn.ts
- FOUND: packages/core/src/intelligence/export.ts
- FOUND: packages/core/migrations/0001_intelligence.sql
- FOUND: 5e05cb8, 88e5e53, 03192ad

---
*Phase: 02-repository-intelligence-ownership*
*Completed: 2026-07-01*
