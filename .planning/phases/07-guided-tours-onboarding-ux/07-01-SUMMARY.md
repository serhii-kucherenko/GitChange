---
phase: 07-guided-tours-onboarding-ux
plan: 01
subsystem: api
tags: [zod, tours, eras, decisions, vitest, sqlite]

requires:
  - phase: 06-decisions-status-open-work
    provides: decisions.json, open-work.json, EVD-03 threshold helper
  - phase: 04-era-detection-semantic-pipeline
    provides: eras.json, readErasArtifact, era fixtures
provides:
  - ToursArtifact Zod contract with P7-D-10 caps
  - outlineDefaultTourChapters deterministic 4-6 chapter skeleton
  - buildTourSynthesisContext bounded agent bundle
  - readToursArtifact / writeToursArtifact with integrity gate
  - checkToursIntegrity referential validation
affects: [07-02 tour-builder agent, 07-03 pipeline, 07-04 dashboard tour player]

tech-stack:
  added: []
  patterns:
    - "Zod discriminated Tour union (default/role/topic) with artifact-level cap refine"
    - "Deterministic era-to-chapter outline with merge/split to 4-6 chapters"
    - "Bounded synthesis context mirroring decisions/context.ts slice limits"
    - "Atomic tmp+rename write gated by checkToursIntegrity"

key-files:
  created:
    - packages/core/src/schema/zod/tours.ts
    - packages/core/src/schema/zod/tours.test.ts
    - packages/core/src/tours/outline.ts
    - packages/core/src/tours/outline.test.ts
    - packages/core/src/tours/context.ts
    - packages/core/src/tours/context.test.ts
    - packages/core/src/tours/tours-io.ts
    - packages/core/src/tours/tours-io.test.ts
    - packages/core/src/verify/tours-integrity.ts
    - packages/core/src/verify/tours-integrity.test.ts
  modified:
    - packages/core/src/schema/zod/index.ts
    - packages/core/src/index.ts

key-decisions:
  - "Topic tour stop cap (8) enforced at Zod layer alongside artifact kind caps"
  - "Context tests bind eras via applyBasicScenarioErasFixture from golden semantic fixture"
  - "Integrity checker requires eras.json when validating tours artifact writes"

patterns-established:
  - "TourStop drillTarget refine: at least one of eraId, commitSha, filePath, decisionId"
  - "writeToursArtifact throws on integrity failure before atomic rename"

requirements-completed: [TOUR-01]

duration: 12min
completed: 2026-07-01
---

# Phase 7 Plan 01: Tours Schemas + Outline + Context + I/O Summary

**Versioned tours.json Zod contract, deterministic 4–6 chapter outline from eras, bounded synthesis context, and integrity-gated atomic I/O for guided onboarding tours.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T05:08:00Z
- **Completed:** 2026-07-01T05:12:30Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `ToursArtifact` schema with `TourKind`, `RoleTag`, mandatory stop evidence, drill targets, and P7-D-10 caps (1 default, 3 role, 5 topic tours)
- `outlineDefaultTourChapters` produces deterministic 4–6 chapters from era chronology with placeholder evidence-backed stops
- `buildTourSynthesisContext` bundles era summaries, outline, expertise topics, filtered decision/open-work seeds, role path hints, and caps reminder — no live git
- `writeToursArtifact` / `readToursArtifact` with Zod parse + `checkToursIntegrity` before atomic write

## Task Commits

1. **Task 1: Tours Zod schemas + P7-D-10 caps** - `e8eb05e` (feat)
2. **Task 2: Deterministic outline + tour synthesis context** - `eb30434` (feat)
3. **Task 3: Tours I/O + integrity checker** - `822b160` (feat)

## Files Created/Modified

- `packages/core/src/schema/zod/tours.ts` - ToursArtifact, Tour, TourChapter, TourStop schemas
- `packages/core/src/tours/outline.ts` - Deterministic chapter skeleton from eras
- `packages/core/src/tours/context.ts` - Bounded context for tour-builder agent
- `packages/core/src/tours/tours-io.ts` - Validated read/write for tours.json
- `packages/core/src/verify/tours-integrity.ts` - Referential integrity against index, eras, decisions

## Decisions Made

- Topic tour total stop cap enforced in Zod refine (8 stops) per P7-D-10
- Context tests reuse `applyBasicScenarioErasFixture` instead of non-existent eras-basic.json path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Context test initially referenced missing `eras-basic.json`; fixed by using `tests/golden/semantic-fixture.ts` helper aligned with existing golden infrastructure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TOUR-01 data contracts locked; 07-02 tour-builder agent can consume `buildTourSynthesisContext` output
- 07-03 pipeline can call `writeToursArtifact` after agent merge
- 07-04 dashboard can read `readToursArtifact` for tour player

## Self-Check: PASSED

- FOUND: packages/core/src/schema/zod/tours.ts
- FOUND: packages/core/src/tours/outline.ts
- FOUND: packages/core/src/tours/context.ts
- FOUND: packages/core/src/tours/tours-io.ts
- FOUND: packages/core/src/verify/tours-integrity.ts
- FOUND: e8eb05e
- FOUND: eb30434
- FOUND: 822b160

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*
