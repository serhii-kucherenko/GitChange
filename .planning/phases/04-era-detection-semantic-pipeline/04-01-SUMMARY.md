---
phase: 04-era-detection-semantic-pipeline
plan: 01
subsystem: database
tags: [zod, eras, temporal-graph, semantic, ulid, evidence]

requires:
  - phase: 02-repository-intelligence-ownership
    provides: intelligence.json era signals, churn, era ownership, expertise
  - phase: 01-index-foundation
    provides: doc_snapshots in SQLite, evidence contract
provides:
  - ErasArtifact and TemporalGraphArtifact Zod schemas
  - doc evidence type on Evidence union
  - buildEraSynthesisContext bounded host-AI input bundler
  - readErasArtifact / writeErasArtifact with validation gate
affects:
  - 04-02-era-synthesizer-agent
  - 04-03-temporal-graph-assembler
  - 04-04-graph-reviewer
  - 04-05-golden-validate

tech-stack:
  added: [ulid@2.3.0]
  patterns:
    - Zod gate at eras.json write boundary with max 8 named eras
    - Read-only context bundler from intelligence.json + SQLite (no live git)
    - Signal-anchored era synthesis context with signalId/signalType fields

key-files:
  created:
    - packages/core/src/schema/zod/eras.ts
    - packages/core/src/schema/zod/temporal-graph.ts
    - packages/core/src/semantic/context.ts
    - packages/core/src/semantic/eras-io.ts
  modified:
    - packages/core/src/schema/zod/evidence.ts
    - packages/core/src/schema/zod/index.ts
    - packages/core/src/index.ts
    - packages/core/src/verify/evidence-integrity.ts
    - packages/core/src/verify/intelligence-integrity.ts

key-decisions:
  - "Reused ingestion isDocPath for doc delta selection in context bundler"
  - "MAX_ERAS=8 enforced at writeErasArtifact boundary (aligned with era signal cap)"
  - "Doc evidence integrity checks resolve against doc_snapshots rows"

patterns-established:
  - "Pattern: Semantic artifacts validate at persistence boundary before atomic tmp+rename write"
  - "Pattern: Era synthesis context caps signals (8), churn (10), doc deltas (5), expertise (5)"

requirements-completed: [ERA-01, ERA-02]

duration: 25min
completed: 2026-07-01
---

# Phase 4 Plan 01: Semantic Contracts Walking Skeleton Summary

**Zod schemas for eras.json and temporal-graph.json, doc evidence type, bounded era synthesis context bundler, and validated eras I/O**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T03:07:00Z
- **Completed:** 2026-07-01T03:13:30Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `ErasArtifact` schema with named eras, claims[], inflections[], mandatory evidence, and `InflectionType` ERA-03 taxonomy
- Additive `doc` evidence type (path, commitSha, excerpt max 500) per P4-D-07
- `buildEraSynthesisContext` returns bounded JSON from intelligence.json + SQLite without es-git
- `writeErasArtifact` / `readErasArtifact` with Zod gate and max 8 eras

## Task Commits

1. **Task 1: Semantic Zod schemas + doc evidence extension** - `92b1d0f` (feat)
2. **Task 2: Era synthesis context bundler** - `d75876a` (feat)
3. **Task 3: Eras artifact read/write helpers** - `7aadb55` (feat)

## Files Created/Modified

- `packages/core/src/schema/zod/eras.ts` - ErasArtifact, NamedEra, InflectionPoint, InflectionType schemas
- `packages/core/src/schema/zod/temporal-graph.ts` - TemporalGraphArtifact node/edge structure
- `packages/core/src/schema/zod/evidence.ts` - doc evidence discriminant
- `packages/core/src/semantic/context.ts` - buildEraSynthesisContext
- `packages/core/src/semantic/eras-io.ts` - read/write eras.json with validation
- `packages/core/src/index.ts` - public exports for semantic API

## Decisions Made

- Reused `isDocPath` from ingestion for doc delta filtering (consistent with index doc detection)
- Integrity checkers extended for `doc` evidence refs against `doc_snapshots` table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Doc evidence integrity in verify modules**
- **Found during:** Task 2 (doc evidence extension)
- **Issue:** `assertNever` exhaustiveness failed after adding `doc` evidence type
- **Fix:** Added `doc` case resolving path+commitSha against `doc_snapshots`
- **Files modified:** `evidence-integrity.ts`, `intelligence-integrity.ts`
- **Committed in:** `d75876a`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for compile-time exhaustiveness and EVD-01 referential integrity with new evidence type.

## Issues Encountered

- Native module tests require Node 22.x (`better-sqlite3` NODE_MODULE_VERSION mismatch on Node 24)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 contracts complete; 04-02 (era-synthesizer agent), 04-03 (graph assembler), 04-04 (graph reviewer) can proceed in parallel
- `TemporalGraphArtifact` schema ready for deterministic assembly in 04-03

## Self-Check: PASSED

- FOUND: packages/core/src/schema/zod/eras.ts
- FOUND: packages/core/src/schema/zod/temporal-graph.ts
- FOUND: packages/core/src/semantic/context.ts
- FOUND: packages/core/src/semantic/eras-io.ts
- FOUND: 92b1d0f
- FOUND: d75876a
- FOUND: 7aadb55

---
*Phase: 04-era-detection-semantic-pipeline*
*Completed: 2026-07-01*
