---
phase: 04-era-detection-semantic-pipeline
plan: 03
subsystem: database
tags: [temporal-graph, semantic, zod, ulid, co-change, eras]

requires:
  - phase: 04-era-detection-semantic-pipeline
    plan: 01
    provides: TemporalGraphArtifact schema, eras I/O, evidence types
  - phase: 02-repository-intelligence-ownership
    provides: intelligence.json coChange edges with disclaimer metadata
provides:
  - assembleTemporalGraph deterministic merge of eras + intelligence + SQLite index
  - readTemporalGraph / writeTemporalGraph / assembleAndWriteTemporalGraph
  - 500-node graph cap with evidence-referenced file nodes only
affects:
  - 04-04-graph-reviewer
  - 04-05-golden-validate
  - phase-5-dashboard
  - phase-8-temporal-graph-ui

tech-stack:
  added: []
  patterns:
    - Evidence-referenced file nodes cap graph size (≤500 nodes hard limit)
    - Co-change edges copy intelligence disclaimer onto files_co_changed edges
    - Atomic tmp+rename write for temporal-graph.json with Zod gate

key-files:
  created:
    - packages/core/src/semantic/assemble-graph.ts
    - packages/core/src/semantic/assemble-graph.test.ts
    - packages/core/src/semantic/graph-io.ts
    - packages/core/src/semantic/graph-io.test.ts
  modified:
    - packages/core/src/schema/zod/temporal-graph.ts
    - packages/core/src/index.ts

key-decisions:
  - "File node ids use file:{path}; contributor nodes use contributor:{authorId}; inflection ids use inflection:{ulid}"
  - "Optional disclaimer field added to TemporalGraphEdge for files_co_changed correlation labeling"
  - "Era commit membership resolved via committedAt window against SQLite commits table"

patterns-established:
  - "Pattern: assembleTemporalGraph is read-only against SQLite with parameterized Drizzle queries"
  - "Pattern: Graph assembly throws when eras.json missing or node count exceeds 500"

requirements-completed: [ERA-01, ERA-03]

duration: 18min
completed: 2026-07-01
---

# Phase 4 Plan 03: Temporal Graph Assembler Summary

**Deterministic assembleTemporalGraph merges eras.json, intelligence.json, and the SQLite index into validated temporal-graph.json with era, commit, file, contributor, and inflection nodes**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T03:15:00Z
- **Completed:** 2026-07-01T03:19:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `assembleTemporalGraph` builds era→commit, era→inflection, contributor→commit, commit→file, and files_co_changed edges from fixture/index data
- Evidence-referenced file paths only; 500-node hard cap prevents graph explosion (T-04-07)
- `writeTemporalGraph` / `readTemporalGraph` / `assembleAndWriteTemporalGraph` with Zod validation and atomic write
- Public exports from `@gitchange/core` index

## Task Commits

1. **Task 1: Graph assembly core** - `b5876a4` (feat)
2. **Task 2: Graph I/O + public export** - `8a709cb` (feat)

## Files Created/Modified

- `packages/core/src/semantic/assemble-graph.ts` - Deterministic graph assembly from eras + intelligence + index
- `packages/core/src/semantic/assemble-graph.test.ts` - BASIC_SCENARIO fixture tests
- `packages/core/src/semantic/graph-io.ts` - temporal-graph.json read/write helpers
- `packages/core/src/semantic/graph-io.test.ts` - Round-trip and validation tests
- `packages/core/src/schema/zod/temporal-graph.ts` - Optional disclaimer on edges
- `packages/core/src/index.ts` - Public graph API exports

## Decisions Made

- Inflection node ids generated at assembly time (`inflection:{ulid}`) since InflectionPoint has no stable id field
- Co-change edges included only when both paths exist in the evidence-referenced file set

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended TemporalGraphEdge with optional disclaimer**
- **Found during:** Task 1 (files_co_changed edges)
- **Issue:** Plan requires co-change disclaimer metadata but 04-01 edge schema lacked a disclaimer field
- **Fix:** Added optional `disclaimer` literal to `TemporalGraphEdge` Zod schema
- **Files modified:** `packages/core/src/schema/zod/temporal-graph.ts`
- **Committed in:** `b5876a4`

---

**Total deviations:** 1 auto-fixed (missing critical metadata)
**Impact on plan:** Schema extension required for ERA-03 / co-change labeling truth; no scope creep.

## Issues Encountered

- Tests require Node 22.x for better-sqlite3 native bindings (NODE_MODULE_VERSION mismatch on Node 24)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-04 graph reviewer and semantic integrity checks
- `temporal-graph.json` produced deterministically; no LLM imports in semantic assembler module

## Self-Check: PASSED

- FOUND: packages/core/src/semantic/assemble-graph.ts
- FOUND: packages/core/src/semantic/graph-io.ts
- FOUND: packages/core/src/semantic/assemble-graph.test.ts
- FOUND: packages/core/src/semantic/graph-io.test.ts
- FOUND: b5876a4
- FOUND: 8a709cb

---
*Phase: 04-era-detection-semantic-pipeline*
*Completed: 2026-07-01*
