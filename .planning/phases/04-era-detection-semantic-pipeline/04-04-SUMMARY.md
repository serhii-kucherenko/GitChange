---
phase: 04-era-detection-semantic-pipeline
plan: 04
subsystem: testing
tags: [semantic-integrity, temporal-graph, manifest, pipeline, zod]

requires:
  - phase: 04-era-detection-semantic-pipeline
    plan: 01
    provides: ErasArtifact schema, evidence types, eras I/O
  - phase: 04-era-detection-semantic-pipeline
    plan: 03
    provides: assembleAndWriteTemporalGraph, temporal-graph.json
provides:
  - checkErasIntegrity, checkTemporalGraphIntegrity, checkSemanticIntegrity
  - runSemanticPipeline orchestration with manifest semantic checkpoint
  - Manifest optional semanticComputedAt, semanticHeadSha, semanticSchemaVersion
affects:
  - 04-05-golden-validate
  - phase-5-dashboard
  - phase-8-temporal-graph-ui

tech-stack:
  added: []
  patterns:
    - Intelligence-integrity mirror for semantic artifacts (eras + temporal graph)
    - Manifest checkpoint only written after checkSemanticIntegrity passes
    - Pipeline assumes eras.json pre-written by host AI (no LLM in core)

key-files:
  created:
    - packages/core/src/verify/semantic-integrity.ts
    - packages/core/src/verify/semantic-integrity.test.ts
    - packages/core/src/semantic/pipeline.ts
    - packages/core/src/semantic/pipeline.test.ts
  modified:
    - packages/core/src/schema/manifest.ts
    - packages/core/src/schema/manifest.test.ts
    - packages/core/src/index.ts

key-decisions:
  - "SemanticIntegrityReport mirrors intelligence pattern with danglingSignalIds for era signalId validation"
  - "checkTemporalGraphIntegrity validates era_contains_commit window and inflection parent era links"
  - "runSemanticPipeline throws on integrity failure without mutating manifest semantic fields"

patterns-established:
  - "Pattern: checkSemanticIntegrity combines eras + graph reports into unified gate"
  - "Pattern: runSemanticPipeline sequence is eras → graph → integrity → manifest checkpoint"

requirements-completed: [ERA-01, ERA-02, ERA-03]

duration: 12min
completed: 2026-07-01
---

# Phase 4 Plan 04: Semantic Integrity + Pipeline Summary

**Referential integrity gate for eras.json and temporal-graph.json with runSemanticPipeline orchestration and manifest semantic checkpoint on pass only**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T10:13:00Z
- **Completed:** 2026-07-01T10:25:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `checkSemanticIntegrity` validates era evidence, signalIds, graph node/edge consistency, and era commit windows
- `runSemanticPipeline` assembles temporal graph, gates on integrity, and sets manifest semantic checkpoint
- Manifest schema extended additively with optional semantic checkpoint fields

## Task Commits

1. **Task 1: Semantic integrity checker** - `29edf34` (feat)
2. **Task 2: Manifest semantic checkpoint + pipeline** - `ce2a575` (feat)

## Files Created/Modified

- `packages/core/src/verify/semantic-integrity.ts` - Eras and temporal graph referential integrity checks
- `packages/core/src/verify/semantic-integrity.test.ts` - Valid fixture pass + dangling SHA/signalId/edge detection
- `packages/core/src/semantic/pipeline.ts` - runSemanticPipeline orchestrator
- `packages/core/src/semantic/pipeline.test.ts` - Checkpoint set on success, unset on integrity failure
- `packages/core/src/schema/manifest.ts` - Optional semantic checkpoint fields
- `packages/core/src/schema/manifest.test.ts` - Semantic field round-trip test
- `packages/core/src/index.ts` - Public exports for pipeline and integrity checker

## Decisions Made

- SemanticIntegrityReport includes danglingSignalIds separate from commit/file refs for clearer diagnostics
- Pipeline throws Error with joined integrity errors rather than returning partial ok state
- Doc evidence validated against doc_snapshots table (same key pattern as intelligence-integrity)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- better-sqlite3 native module required Node 22 rebuild before tests could run locally

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-05 can add golden semantic test and CLI validate subcommand using exported checkSemanticIntegrity
- Phase 5 dashboard can trust manifest semantic checkpoint as consumption gate

---
*Phase: 04-era-detection-semantic-pipeline*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: packages/core/src/verify/semantic-integrity.ts
- FOUND: packages/core/src/verify/semantic-integrity.test.ts
- FOUND: packages/core/src/semantic/pipeline.ts
- FOUND: packages/core/src/semantic/pipeline.test.ts
- FOUND: 29edf34
- FOUND: ce2a575
