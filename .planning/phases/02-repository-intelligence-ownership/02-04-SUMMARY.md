---
phase: 02-repository-intelligence-ownership
plan: 04
subsystem: database
tags: [sqlite, drizzle, expertise, era-ownership, intelligence]

requires:
  - phase: 02-02
    provides: HEAD file_ownership line-survival aggregates
  - phase: 02-03
    provides: era_boundaries windows and co_change_edges
provides:
  - Per-era ownership timelines in era_ownership table and eraOwnership export
  - Contributor expertise profiles in contributor_expertise and expertise.topics export
affects: [02-05, phase-4-eras, dashboard]

tech-stack:
  added: []
  patterns:
    - "Commit-window proxy for era ownership (touch counts per era boundary window)"
    - "Expertise topics from path prefixes, cc_scope, and co-change hub paths"

key-files:
  created:
    - packages/core/src/intelligence/era-ownership.ts
    - packages/core/src/intelligence/expertise.ts
    - packages/core/src/intelligence/era-ownership.test.ts
    - packages/core/src/intelligence/expertise.test.ts
  modified:
    - packages/core/src/intelligence/compute.ts
    - packages/core/src/intelligence/export.ts
    - packages/core/src/schema/zod/intelligence.ts
    - tests/fixtures/scenarios.ts

key-decisions:
  - "Era ownership uses commit-touch proxy per era_boundaries window; full per-era blame deferred to Phase 8"
  - "Path-prefix expertise topics use final segment label (e.g. src/auth → auth) with >=3 touches threshold"
  - "Expertise export uses topics[] with suggestedContributors instead of flat profiles[]"

patterns-established:
  - "Evidence on every expertise contributor entry (file + commit refs, Zod min 1)"
  - "eraOwnership.eras[] labels combine signal_type with ISO date range"

requirements-completed: [CONT-01, CONT-03]

duration: 12min
completed: 2026-07-01
---

# Phase 2 Plan 04: Era Ownership + Expertise Summary

**Per-era stewardship timelines and contributor expertise topics exported in intelligence.json with evidence-backed scores**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T01:58:00Z
- **Completed:** 2026-07-01T02:05:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `computeEraOwnership` rolls up commit-window touch scores per era boundary into `era_ownership` with evidence
- `computeExpertise` scores contributors on path-prefix, cc_scope, and co-change hub topics
- `intelligence.json` now includes `eraOwnership.eras` and `expertise.topics` sections (Zod-validated)
- CONT-01 and CONT-03 behaviors verified by unit tests on fixture repos

## Task Commits

1. **Task 1: Failing era-ownership + expertise tests** - `f2c215b` (test)
2. **Task 2: Per-era ownership timelines** - `fb302e5` (feat)
3. **Task 3: Contributor expertise profiles + export** - `cc3514a` (feat)

## Files Created/Modified

- `packages/core/src/intelligence/era-ownership.ts` — Era window touch aggregation and export helper
- `packages/core/src/intelligence/expertise.ts` — Topic scoring, persistence, and export helper
- `packages/core/src/intelligence/compute.ts` — Wires era ownership + expertise after era signals
- `packages/core/src/intelligence/export.ts` — Exports new artifact sections
- `packages/core/src/schema/zod/intelligence.ts` — `eraOwnership` and `expertise.topics` schemas
- `tests/fixtures/scenarios.ts` — `ERA_OWNERSHIP_SCENARIO` and `EXPERTISE_SCENARIO` fixtures

## Decisions Made

- Era ownership uses commit-touch proxy (not per-era blame) for Phase 2 performance; documented in test comments
- Expertise topic labels derive from path prefix leaf segment (`src/auth` → `auth`)
- Expanded `ERA_OWNERSHIP_SCENARIO` to 12 commits so era-signals produces multiple boundaries for stewardship shift tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Expanded ERA_OWNERSHIP_SCENARIO for multi-era test coverage**
- **Found during:** Task 2
- **Issue:** Initial 8-commit fixture produced only one era boundary; stewardship shift test could not compare dominant authors across eras
- **Fix:** Expanded scenario to 12 commits with distinct Alice-then-Bob phases
- **Files modified:** `tests/fixtures/scenarios.ts`
- **Committed in:** `fb302e5`

**2. [Rule 3 - Blocking] Updated churn.test IntelligenceArtifact sample for new schema**
- **Found during:** Task 3 verification
- **Issue:** `expertise.profiles` replaced by `expertise.topics` and `eraOwnership` required in Zod schema
- **Fix:** Updated churn test fixture to include `eraOwnership: { eras: [] }` and `expertise: { topics: [] }`
- **Files modified:** `packages/core/src/intelligence/churn.test.ts`
- **Committed in:** `cc3514a`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Required for test pass and schema consistency; no scope creep.

## Issues Encountered

None blocking. Pre-existing Biome lint warnings in `@gitchange/core` remain out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-05 can run evidence integrity checks against `eraOwnership` and `expertise.topics` evidence refs
- Dashboard / Phase 4 can consume contributor lens data without additional ingestion work

## Self-Check

```
FOUND: packages/core/src/intelligence/era-ownership.ts
FOUND: packages/core/src/intelligence/expertise.ts
FOUND: packages/core/src/intelligence/era-ownership.test.ts
FOUND: packages/core/src/intelligence/expertise.test.ts
FOUND: f2c215b
FOUND: fb302e5
FOUND: cc3514a
```

## Self-Check: PASSED

---
*Phase: 02-repository-intelligence-ownership*
*Completed: 2026-07-01*
