---
phase: 01-index-foundation
plan: 06
subsystem: ingestion
tags: [freshness, shallow-clone, force-push, manifest, es-git, vitest]

requires:
  - phase: 01-index-foundation
    provides: full + incremental index orchestrators and manifest schema
provides:
  - Shallow-clone detection with partial index completeness
  - Force-push halt via ForcePushHaltError on incremental runs
  - Out-of-order committer-date warnings
  - Manifest warning persistence and stdout echo
affects: [01-07, 01-08, phase-3-cli]

tech-stack:
  added: []
  patterns:
    - "Freshness detection as pure inspectable module wired at orchestrator boundaries"
    - "Committer-date axis for out-of-order counting on newest-first revwalk"

key-files:
  created:
    - packages/core/src/index/freshness.ts
    - packages/core/src/index/freshness.test.ts
  modified:
    - packages/core/src/index/full.ts
    - packages/core/src/index/incremental.ts
    - packages/core/src/index/full.test.ts
    - packages/core/src/index/incremental.test.ts

key-decisions:
  - "Out-of-order counts when an older commit in revwalk order has a newer committer timestamp than its descendant"
  - "Force-push detection requires both revparse existence and HEAD ancestry walk, not existence alone"
  - "Shallow detection prefers .git/shallow file check with repo.isShallow() as secondary signal"

patterns-established:
  - "Warning codes routed through exhaustive switch helpers before manifest write and stdout echo"
  - "Incremental merge halts before any DB writes when cursor is unreachable from HEAD"

requirements-completed: [INGX-05]

duration: 12min
completed: 2026-07-01
---

# Phase 1 Plan 06: Freshness Detection Summary

**History-integrity checks for shallow clones (partial index + warning), force-push halts on incremental, and out-of-order committer-date warnings persisted to manifest and stdout**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T01:08:00Z
- **Completed:** 2026-07-01T01:20:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `freshness.ts` detects shallow repos, unreachable index cursors, and out-of-order committer timestamps
- `indexFull` sets `indexCompleteness: partial` on shallow clones, records warnings, and echoes them to stdout
- `indexIncremental` throws `ForcePushHaltError` before appending when history was rewritten
- Integration tests cover shallow partial indexing, force-push halt, and backdated commit warnings

## Task Commits

1. **Task 1: freshness detection module** - `84a69df` (feat)
2. **Task 2: wire freshness into full + incremental** - `12244de` (feat)

## Files Created/Modified

- `packages/core/src/index/freshness.ts` - Shallow, force-push ancestry, out-of-order counting, warning echo helpers
- `packages/core/src/index/freshness.test.ts` - Unit tests for detection primitives
- `packages/core/src/index/full.ts` - Shallow + out-of-order wiring into full index manifest
- `packages/core/src/index/incremental.ts` - Force-push halt before incremental walk
- `packages/core/src/index/full.test.ts` - Shallow partial + out-of-order integration tests
- `packages/core/src/index/incremental.test.ts` - Force-push halt integration test

## Decisions Made

- Out-of-order inversion uses committer-date on newest-first revwalk: count when `timestamps[i] > timestamps[i-1]`
- Ancestry check walks from HEAD rather than relying on `revparseSingle` alone (A2 from research)
- `.git/shallow` file check is primary shallow signal; `repo.isShallow()` confirms when file absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected out-of-order inversion direction**
- **Found during:** Task 1 (unit test RED)
- **Issue:** Initial inversion check counted normal chronological descent (older timestamps on older commits) as out-of-order
- **Fix:** Invert comparison to flag when an older commit in walk order has a newer committer timestamp
- **Files modified:** `packages/core/src/index/freshness.ts`, `packages/core/src/index/freshness.test.ts`
- **Committed in:** `84a69df`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct out-of-order detection; no scope change.

## Issues Encountered

None beyond the inversion logic fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INGX-05 freshness warnings complete; ready for 01-07 doc snapshot ingestion
- Downstream CLI/status can read `manifest.indexCompleteness` and `manifest.warnings` for degraded badges

## Self-Check: PASSED

- FOUND: packages/core/src/index/freshness.ts
- FOUND: packages/core/src/index/freshness.test.ts
- FOUND: commit 84a69df
- FOUND: commit 12244de

---
*Phase: 01-index-foundation*
*Completed: 2026-07-01*
