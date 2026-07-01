---
phase: 07-guided-tours-onboarding-ux
plan: 02
subsystem: api
tags: [zod, tours, vitest, plugin, merge-gate, pipeline]

requires:
  - phase: 07-guided-tours-onboarding-ux
    provides: ToursArtifact schemas, outline, context, tours-io
provides:
  - tour-builder agent spec and JSON schemas
  - mergeTourBuilderOutput merge gate with outline preservation
  - build-tour-context / write-tours plugin scripts
  - runToursPipeline manifest checkpoint
  - bindBasicScenarioToursTemplate fixture helper
affects: [07-03 tour read API, 07-04 dashboard tour player]

tech-stack:
  added: []
  patterns:
    - "Agent JSON validated before merge; default tour chapter order from outline"
    - "Host-LLM tour synthesis documented in SKILL after decision mining"
    - "Manifest toursComputedAt / toursHeadSha / toursSchemaVersion checkpoint"

key-files:
  created:
    - packages/plugin/agents/tour-builder.md
    - packages/plugin/schemas/tour-synthesis-context.schema.json
    - packages/plugin/schemas/tours.schema.json
    - packages/core/src/tours/merge-agent-output.ts
    - packages/core/src/tours/merge-agent-output.test.ts
    - packages/core/src/tours/bind-basic-scenario-tours.ts
    - packages/core/src/tours/pipeline.ts
    - packages/core/src/tours/pipeline.test.ts
    - packages/plugin/scripts/build-tour-context.ts
    - packages/plugin/scripts/write-tours.ts
    - tests/fixtures/tours/basic-scenario-tours.json
    - tests/fixtures/tours/tours-basic-scenario.json
    - tests/golden/tours-fixture.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/src/schema/manifest.ts
    - packages/plugin/agents/gitchange-orchestrator.md
    - packages/plugin/skills/gitchange/SKILL.md
    - packages/plugin/scripts/generate-schemas.ts
    - packages/plugin/schemas/manifest.schema.json

key-decisions:
  - "mergeTourBuilderOutput validates agent era/decision refs before outline overlay"
  - "bindBasicScenarioToursTemplate remaps file/doc evidence to indexed touch SHAs"

patterns-established:
  - "Tour synthesis Phase 6 in orchestrator after decisions + open-work prerequisites"

requirements-completed: [TOUR-01, TOUR-02, TOUR-03]

duration: 14min
completed: 2026-07-01
---

# Phase 7 Plan 02: Tour Builder Agent + Pipeline Summary

**Host-LLM tour synthesis layer with merge gate, plugin scripts, pipeline manifest checkpoint, and skill/orchestrator documentation for default, role, and topic tours.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-01T05:10:00Z
- **Completed:** 2026-07-01T05:24:00Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- `tour-builder.md` agent spec constraining output to context era/decision/thread IDs
- `mergeTourBuilderOutput` preserves default outline chapter order, assigns stop ULIDs, rejects unknown refs
- `build-tour-context.ts` and `write-tours.ts` scripts for host chat workflow
- `runToursPipeline` verifies tours integrity and sets manifest tour checkpoints
- SKILL and orchestrator document tour synthesis after decision mining

## Task Commits

1. **Task 1: tour-builder agent + JSON schemas + merge gate** - `80b66aa` (test), `7c84fa6` (feat)
2. **Task 2: Scripts, pipeline, orchestrator + skill Phase 7** - `045a594` (feat)

## Files Created/Modified

- `packages/plugin/agents/tour-builder.md` - Host-AI tour synthesis spec
- `packages/core/src/tours/merge-agent-output.ts` - Merge gate for agent tours artifact
- `packages/core/src/tours/pipeline.ts` - runToursPipeline manifest checkpoint
- `packages/plugin/scripts/build-tour-context.ts` - stdout JSON from buildTourSynthesisContext
- `packages/plugin/scripts/write-tours.ts` - merge + writeToursArtifact persist script

## Decisions Made

- Agent era refs validated on raw output before outline overlay prevents silent invented eraIds
- Fixture binding uses indexed file touch commit SHAs for file/doc evidence integrity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `better-sqlite3` native module required Node 22.x for vitest (NODE_MODULE_VERSION mismatch on Node 24).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-03 read API can serve tours.json via GET /api/tours
- 07-04 tour player can consume fetchTours/fetchTour after synthesis

## Self-Check: PASSED

- FOUND: packages/plugin/agents/tour-builder.md
- FOUND: packages/core/src/tours/merge-agent-output.ts
- FOUND: packages/core/src/tours/pipeline.ts
- FOUND: packages/plugin/scripts/build-tour-context.ts
- FOUND: packages/plugin/scripts/write-tours.ts
- FOUND: 80b66aa
- FOUND: 7c84fa6
- FOUND: 045a594

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*
