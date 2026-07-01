---
phase: 02-repository-intelligence-ownership
plan: 05
subsystem: testing
tags: [vitest, golden-fixtures, intelligence, evidence-integrity, manifest]

requires:
  - phase: 02-repository-intelligence-ownership
    provides: computeIntelligence, intelligence.json export, era ownership, expertise
provides:
  - Intelligence golden fixture gate with locked snapshot counts
  - checkIntelligenceIntegrity and collectIntelligenceSnapshot verify helpers
  - Manifest intelligence checkpoint fields
  - Optional rebuildIntelligence index hook
affects: [phase-3-cli, phase-4-eras, phase-5-dashboard]

tech-stack:
  added: []
  patterns:
    - "Golden tests import verify helpers from packages/core (no drizzle in tests/golden)"
    - "Intelligence evidence refs resolve to indexed file_changes rows"
    - "Manifest records intelligenceComputedAt/HeadSha/SchemaVersion after compute"

key-files:
  created:
    - packages/core/src/verify/intelligence-integrity.ts
    - packages/core/src/verify/intelligence-snapshot.ts
    - packages/core/src/verify/intelligence-integrity.test.ts
    - tests/golden/intelligence.test.ts
  modified:
    - tests/golden/helpers.ts
    - packages/core/src/schema/manifest.ts
    - packages/core/src/intelligence/compute.ts
    - packages/core/src/index/full.ts
    - packages/core/src/index/incremental.ts
    - packages/core/src/index/types.ts
    - packages/core/src/intelligence/ownership/aggregate.ts

key-decisions:
  - "Ownership file evidence uses last indexed touch commit, not HEAD, for referential integrity"
  - "rebuildIntelligence defaults false for backward-compatible index-only flows"

patterns-established:
  - "Intelligence golden gate mirrors Phase 1 ingestion snapshot + evidence integrity pattern"

requirements-completed: [CONT-01, CONT-03, CONT-04]

duration: 12min
completed: 2026-07-01
---

# Phase 2 Plan 05: Golden Intelligence Fixtures Summary

**Golden intelligence tests lock snapshot counts, evidence integrity, and manifest checkpoint fields — closing Phase 2 with the same trust bar as Phase 1**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T09:00:00Z
- **Completed:** 2026-07-01T09:12:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added `checkIntelligenceIntegrity` and `collectIntelligenceSnapshot` verify helpers with locked BASIC_SCENARIO counts
- Golden intelligence tests cover snapshot lock, OWNSHIP_SCENARIO top-author assertion, section presence, and secret-prefix grep
- Manifest records `intelligenceComputedAt`, `intelligenceHeadSha`, `intelligenceSchemaVersion` after `computeIntelligence`
- `IndexOptions.rebuildIntelligence` optionally runs intelligence pass after index (default false)

## Task Commits

1. **Task 1: Intelligence evidence integrity + snapshot verify helpers** - `3dd1303` (feat)
2. **Task 2: Golden intelligence tests** - `2a055ce` (feat)
3. **Task 3: Manifest checkpoint + optional index hook + full suite gate** - `bf518bf` (feat)

**Plan metadata:** `017d060` (docs)

## Files Created/Modified

- `packages/core/src/verify/intelligence-integrity.ts` - Referential integrity checker for intelligence.json evidence
- `packages/core/src/verify/intelligence-snapshot.ts` - Locked BASIC_SCENARIO intelligence counts
- `tests/golden/intelligence.test.ts` - Phase 2 golden gate (CONT-01, CONT-03, CONT-04)
- `tests/golden/helpers.ts` - `indexAndCompute` helper for golden fixtures
- `packages/core/src/schema/manifest.ts` - Optional intelligence checkpoint fields
- `packages/core/src/intelligence/compute.ts` - Writes manifest checkpoint after export
- `packages/core/src/index/full.ts` / `incremental.ts` - Optional `rebuildIntelligence` hook

## Decisions Made

- Ownership evidence uses last file touch commit from index (not HEAD) so EVD-01 referential checks pass on clean exports
- `rebuildIntelligence` stays opt-in to preserve existing index-only callers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ownership evidence pointed at HEAD instead of indexed touch commit**
- **Found during:** Task 1 (intelligence integrity verification)
- **Issue:** `buildOwnershipEvidence` used HEAD sha; files unchanged at HEAD failed referential integrity
- **Fix:** Resolve last touch commit from `file_changes` for ownership evidence refs
- **Files modified:** `packages/core/src/intelligence/ownership/aggregate.ts`, `packages/core/src/intelligence/compute.test.ts`
- **Verification:** `pnpm vitest run packages/core/src/verify/intelligence-integrity.test.ts tests/golden/intelligence.test.ts`
- **Committed in:** `3dd1303`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Required for evidence integrity gate to pass on real exports. No scope creep.

## Issues Encountered

None beyond the ownership evidence bug above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 complete: intelligence artifacts are golden-gated and manifest-checkpointed
- Phase 3 can consume `intelligence.json` and manifest intelligence fields for CLI/dashboard first-run UX

## Self-Check: PASSED

- FOUND: packages/core/src/verify/intelligence-integrity.ts
- FOUND: packages/core/src/verify/intelligence-snapshot.ts
- FOUND: tests/golden/intelligence.test.ts
- FOUND: 3dd1303
- FOUND: 2a055ce
- FOUND: bf518bf

---
*Phase: 02-repository-intelligence-ownership*
*Completed: 2026-07-01*
