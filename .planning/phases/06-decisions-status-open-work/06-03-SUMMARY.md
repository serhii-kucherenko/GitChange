---
phase: 06-decisions-status-open-work
plan: 03
subsystem: core
tags: [status, open-work, inference, pipeline, sqlite, stat-01, stat-02]

requires:
  - phase: 06-decisions-status-open-work
    plan: 01
    provides: OpenWorkArtifact schema, decisions I/O, candidate mining
provides:
  - inferOpenWorkStatus tri-method STAT-01 inference
  - buildThreadEvents TIME-04 chronology from file_changes
  - assembleOpenWork producing open-work.json
  - runDecisionsPipeline with manifest checkpoints
affects:
  - 06-04 dashboard OpenThreadsPanel
  - 06-06 agent status queries

tech-stack:
  added: []
  patterns:
    - "Deterministic status inference before LLM (keyword, trailer, docs-vs-code)"
    - "Thread events capped at 100; open threads capped at 20"
    - "runDecisionsPipeline requires eras.json + decisions.json"

key-files:
  created:
    - packages/core/src/status/infer.ts
    - packages/core/src/status/infer.test.ts
    - packages/core/src/status/thread-events.ts
    - packages/core/src/status/thread-events.test.ts
    - packages/core/src/decisions/assemble-open-work.ts
    - packages/core/src/decisions/assemble-open-work.test.ts
  modified:
    - packages/core/src/semantic/pipeline.ts
    - packages/core/src/semantic/pipeline.test.ts
    - packages/core/src/schema/manifest.ts
    - packages/core/src/index.ts

key-decisions:
  - "Docs-vs-code divergence checks any doc snapshot for completion keywords against recent code path touches"
  - "Stale threshold 90 days; docs-vs-code recent window 30 days"
  - "assembleOpenWork falls back to top deterministic candidate when no in_flight decisions"

patterns-established:
  - "INFERENCE_SIGNAL_CODES exported for dashboard tooltips"
  - "Thread clustering merges overlapping relatedPaths before inference"

requirements-completed: [STAT-01, STAT-02]

duration: 18min
completed: 2026-07-01
---

# Phase 6 Plan 03: Status Inferencer + Open-Work Assembly Summary

**Deterministic STAT-01 status inference, TIME-04 thread event chronology, and runDecisionsPipeline producing validated open-work.json with manifest checkpoints.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T04:28:00.000Z
- **Completed:** 2026-07-01T04:46:00.000Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Implemented `inferOpenWorkStatus` with keyword, trailer, and docs-vs-code methods plus 90-day stale detection
- Added `buildThreadEvents` querying indexed `file_changes` newest-first (max 100 events)
- Implemented `assembleOpenWork` from in_flight/unknown decisions and WIP orphan candidates
- Extended pipeline with `runDecisionsPipeline` and manifest fields `decisionsComputedAt`, `openWorkComputedAt`, schema versions

## Task Commits

1. **Task 1: STAT-01 status inference engine** - `b3a914d` (feat)
2. **Task 2: Thread events + open-work assembly** - `c2dedef` (feat)
3. **Task 3: runDecisionsPipeline + manifest checkpoint** - `09fb906` (feat)

## Files Created/Modified

- `packages/core/src/status/infer.ts` - Tri-method status inference and signal codes
- `packages/core/src/status/thread-events.ts` - Commit chronology from file_changes
- `packages/core/src/decisions/assemble-open-work.ts` - open-work.json assembly and write
- `packages/core/src/semantic/pipeline.ts` - `runDecisionsPipeline` entry point
- `packages/core/src/schema/manifest.ts` - Optional decisions/open-work checkpoint fields

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/core/src/status/infer.ts
- FOUND: packages/core/src/status/thread-events.ts
- FOUND: packages/core/src/decisions/assemble-open-work.ts
- FOUND: packages/core/src/semantic/pipeline.ts (runDecisionsPipeline)
- FOUND: b3a914d
- FOUND: c2dedef
- FOUND: 09fb906
