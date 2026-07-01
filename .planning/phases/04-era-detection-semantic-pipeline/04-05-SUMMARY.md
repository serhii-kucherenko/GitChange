---
phase: 04-era-detection-semantic-pipeline
plan: 05
subsystem: testing
tags: [golden-tests, semantic-integrity, validate-cli, snapshot-api, eras-summary]

requires:
  - phase: 04-era-detection-semantic-pipeline
    plan: 02
    provides: ErasArtifact fixture shape and era synthesis orchestration
  - phase: 04-era-detection-semantic-pipeline
    plan: 04
    provides: checkSemanticIntegrity, runSemanticPipeline, manifest semantic checkpoint
provides:
  - Golden semantic test gate on BASIC_SCENARIO with locked counts
  - gitchange validate CLI for intelligence + semantic integrity
  - RepoSnapshot erasSummary slice for ERA-02 user visibility
  - eras-summary.schema.json for host-AI tool registration
affects:
  - phase-5-dashboard
  - phase-6-chat-presentation

tech-stack:
  added: []
  patterns:
    - Fixture eras bound to indexed SHAs via bindBasicScenarioErasTemplate (no live LLM in CI)
    - Locked semantic snapshot counts mirror intelligence-snapshot pattern
    - validate command reuses same integrity gates as pipeline

key-files:
  created:
    - tests/golden/semantic.test.ts
    - tests/golden/semantic-fixture.ts
    - packages/core/src/verify/semantic-snapshot.ts
    - packages/core/src/semantic/bind-basic-scenario-eras.ts
    - packages/cli/src/commands/validate.ts
    - packages/core/src/read/snapshot.test.ts
    - packages/plugin/schemas/eras-summary.schema.json
  modified:
    - tests/fixtures/semantic/eras-basic-scenario.json
    - tests/golden/helpers.ts
    - packages/cli/src/bin.ts
    - packages/core/src/read/snapshot.ts
    - packages/core/src/index.ts
    - packages/server/src/routes/snapshot.ts
    - packages/plugin/scripts/generate-schemas.ts
    - packages/plugin/schemas/snapshot.schema.json
    - tests/integration/plugin-schemas.test.ts

key-decisions:
  - "bindBasicScenarioErasTemplate lives in core to avoid drizzle resolution from tests/fixtures"
  - "erasSummary truncates summaries to 200 chars per T-04-11 mitigation"
  - "validate exits 1 when eras.json missing without faking semantic pass"

patterns-established:
  - "Pattern: golden semantic pipeline is index → fixture eras → runSemanticPipeline → checkSemanticIntegrity"
  - "Pattern: collectSemanticSnapshot locks era, inflection, and graph counts"

requirements-completed: [ERA-01, ERA-02, ERA-03]

duration: 18min
completed: 2026-07-01
---

# Phase 4 Plan 05: Golden Semantic Gate + Validate CLI Summary

**Golden semantic integrity gate, gitchange validate command, and snapshot erasSummary for ERA-02 visibility without live LLM in CI**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T10:30:00Z
- **Completed:** 2026-07-01T10:48:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Golden test locks BASIC_SCENARIO semantic counts (2 eras, 2 inflections, 13 graph nodes, 19 edges)
- `gitchange validate` reports intelligence + semantic integrity; exits 1 when eras.json missing
- Snapshot API exposes `erasSummary` with era names, truncated summaries, and inflection types
- Plugin schemas regenerated with `eras-summary.schema.json`

## Task Commits

1. **Task 1: Golden fixture + semantic golden test** - `c9a1cb6` (test)
2. **Task 2: gitchange validate command** - `6e5ec0b` (feat)
3. **Task 3: Snapshot era summary for ERA-02 visibility** - `50197bc` (feat)

## Files Created/Modified

- `tests/golden/semantic.test.ts` - Golden gate for full semantic pipeline + validate CLI
- `packages/core/src/verify/semantic-snapshot.ts` - Locked BASIC_SCENARIO semantic counts
- `packages/cli/src/commands/validate.ts` - Integrity validation subcommand
- `packages/core/src/read/snapshot.ts` - erasSummary builder with 200-char truncation
- `packages/plugin/schemas/eras-summary.schema.json` - Host-AI schema for era highlights

## Decisions Made

- Moved era fixture binding into `packages/core` so golden tests resolve drizzle-orm correctly
- validate requires eras.json before semantic checks; does not fake pass when artifacts absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved apply-basic-scenario-eras from tests/fixtures to core + tests/golden**
- **Found during:** Task 1 (golden test execution)
- **Issue:** `tests/fixtures/semantic/apply-basic-scenario-eras.ts` could not resolve `drizzle-orm` from vitest root
- **Fix:** Created `bind-basic-scenario-eras.ts` in core; thin `semantic-fixture.ts` wrapper in tests/golden
- **Files modified:** packages/core/src/semantic/bind-basic-scenario-eras.ts, tests/golden/semantic-fixture.ts
- **Committed in:** c9a1cb6

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for CI test execution; no scope change.

## Issues Encountered

None beyond the drizzle resolution fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 complete; Phase 5 dashboard can consume erasSummary and temporal-graph.json
- `gitchange validate` available for CI and local trust checks

## Self-Check: PASSED

- FOUND: tests/golden/semantic.test.ts
- FOUND: packages/cli/src/commands/validate.ts
- FOUND: packages/core/src/verify/semantic-snapshot.ts
- FOUND: packages/plugin/schemas/eras-summary.schema.json
- FOUND: c9a1cb6
- FOUND: 6e5ec0b
- FOUND: 50197bc

---
*Phase: 04-era-detection-semantic-pipeline*
*Completed: 2026-07-01*
