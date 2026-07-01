---
phase: 06-decisions-status-open-work
plan: 01
subsystem: core
tags: [zod, decisions, open-work, evidence, sqlite, evd-03]

requires:
  - phase: 05-dashboard-evidence-drill-down
    provides: Evidence drill-down patterns, confidence UI baseline, indexed hunks
  - phase: 04-era-detection-semantic-pipeline
    provides: eras.json I/O, synthesis context bundler pattern
provides:
  - DecisionsArtifact and OpenWorkArtifact Zod schemas
  - interview evidence type (P6-D-04)
  - extractDecisionCandidates deterministic miner
  - isBelowEvidenceThreshold + EVD03_GAP_MESSAGE
  - buildDecisionMiningContext bounded bundler
  - read/write decisions.json and open-work.json
affects:
  - 06-02 decision-miner agent merge
  - 06-03 status inferencer and open-work assembly
  - 06-04 dashboard panels
  - 06-06 EVD-03 API/UI gates

tech-stack:
  added: []
  patterns:
    - "Atomic tmp+rename artifact writes with Zod validation at boundary"
    - "SQLite-only candidate mining (no live git per SCALE-02)"
    - "PITFALLS #1 noise filters on merge/chore/lockfile commits"

key-files:
  created:
    - packages/core/src/schema/zod/decisions.ts
    - packages/core/src/schema/zod/open-work.ts
    - packages/core/src/decisions/candidates.ts
    - packages/core/src/decisions/threshold.ts
    - packages/core/src/decisions/context.ts
    - packages/core/src/decisions/decisions-io.ts
    - packages/core/src/decisions/open-work-io.ts
  modified:
    - packages/core/src/schema/zod/evidence.ts
    - packages/core/src/schema/zod/index.ts
    - packages/core/src/index.ts

key-decisions:
  - "Interview evidence paths restricted to interviews/ prefix under .gitchange"
  - "EVD-03 floor at confidence 0.35 with literal gap message exported from threshold.ts"
  - "Candidate cap 60 pre-agent; context bundle caps per 06-RESEARCH"

patterns-established:
  - "Decision mining mirrors era synthesis: intelligence.json + SQLite reads, no es-git"
  - "Chore/docs commits excluded when no structural path change"

requirements-completed: [DEC-01, EVD-03]

duration: 12min
completed: 2026-07-01
---

# Phase 6 Plan 01: Schemas + Deterministic Mining Summary

**Decision and open-work artifact contracts with noise-filtered candidate mining and a single EVD-03 confidence floor module.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T04:22:00.000Z
- **Completed:** 2026-07-01T04:34:00.000Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Added `DecisionsArtifact` and `OpenWorkArtifact` Zod schemas with mandatory evidence on narrative fields
- Extended `Evidence` union with `interview` type (path under `interviews/`, 500-char excerpt cap)
- Implemented `extractDecisionCandidates` reading indexed SQLite only with merge/chore/lockfile noise filters
- Centralized EVD-03 via `isBelowEvidenceThreshold` and `EVD03_GAP_MESSAGE = "No recorded decision found"`
- Added `buildDecisionMiningContext` and validated atomic I/O for `decisions.json` / `open-work.json`

## Task Commits

1. **Task 1: Decision + open-work schemas and interview evidence type** - `e3e5e53`
2. **Task 2: Deterministic candidates + EVD-03 threshold** - `107637a`
3. **Task 3: Mining context bundler + artifact I/O** - `30e0a29`

## Files Created/Modified

- `packages/core/src/schema/zod/decisions.ts` - DecisionRecord, DecisionsArtifact (max 40)
- `packages/core/src/schema/zod/open-work.ts` - OpenWorkThread with events[], OpenWorkArtifact (max 20)
- `packages/core/src/schema/zod/evidence.ts` - interview evidence variant
- `packages/core/src/decisions/candidates.ts` - deterministic candidate extraction
- `packages/core/src/decisions/threshold.ts` - EVD-03 floor helpers
- `packages/core/src/decisions/context.ts` - bounded mining context bundler
- `packages/core/src/decisions/decisions-io.ts` - validated decisions.json I/O
- `packages/core/src/decisions/open-work-io.ts` - validated open-work.json I/O
- `packages/core/src/index.ts` - public exports for downstream plans

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/core/src/schema/zod/decisions.ts
- FOUND: packages/core/src/schema/zod/open-work.ts
- FOUND: packages/core/src/decisions/candidates.ts
- FOUND: packages/core/src/decisions/threshold.ts
- FOUND: packages/core/src/decisions/context.ts
- FOUND: packages/core/src/decisions/decisions-io.ts
- FOUND: packages/core/src/decisions/open-work-io.ts
- FOUND: e3e5e53
- FOUND: 107637a
- FOUND: 30e0a29
