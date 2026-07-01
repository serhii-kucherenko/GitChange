---
phase: 07-guided-tours-onboarding-ux
plan: 05
subsystem: testing
tags: [vitest, golden-tests, e2e, tours, validate-cli]

# Dependency graph
requires:
  - phase: 07-guided-tours-onboarding-ux
    provides: tours schemas, bind fixture, API routes, tour player UX
provides:
  - Golden tours evidence integrity gate (EVD-04)
  - Dashboard tour drill-down E2E acceptance test
  - gitchange validate tours integrity check
  - verifyToursEvidenceIntegrity snapshot helper in core
affects: [08-hardening-scale-multi-repo, phase-8-workspace-integrity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden tests call verifyToursEvidenceIntegrity from @gitchange/core (no drizzle in tests/golden)"
    - "validate CLI mirrors decisions gate for tours.json / manifest.toursComputedAt"

key-files:
  created:
    - packages/core/src/verify/tours-snapshot.ts
    - packages/core/src/verify/tours-snapshot.test.ts
    - tests/golden/tours-evidence-integrity.test.ts
    - tests/integration/dashboard-tour-e2e.test.ts
  modified:
    - tests/fixtures/tours/basic-scenario-tours.json
    - packages/core/src/index.ts
    - packages/cli/src/commands/validate.ts

key-decisions:
  - "BASIC_SCENARIO tours fixture includes default (4 chapters), backend role, and auth topic tours"
  - "Corrupt tours tampering writes tours.json directly to bypass writeToursArtifact integrity gate in negative tests"

patterns-established:
  - "verifyToursEvidenceIntegrity wraps checkToursIntegrity with chapter/kind snapshot assertions"
  - "Phase 7 E2E: GET /api/tours → tour detail → GET /api/commits/:sha with hunks"

requirements-completed: [TOUR-01, TOUR-02, TOUR-03, TOUR-04]

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 7 Plan 05: Golden + E2E Gate Summary

**Golden tours evidence integrity and dashboard tour drill E2E proving stop-to-commit detail on BASIC_SCENARIO fixture**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-01T12:29:00Z
- **Completed:** 2026-07-01T12:44:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `verifyToursEvidenceIntegrity` golden verifier with locked BASIC_SCENARIO snapshot counts
- Golden test validates every tour stop evidence SHA resolves in indexed fixture
- Dashboard E2E proves tours list → default tour → commit detail with hunks/files
- `gitchange validate` runs `checkToursIntegrity` when tours.json present or manifest checkpoint set
- Auth topic tour added to BASIC_SCENARIO fixture template

## Task Commits

Each task was committed atomically:

1. **Task 1: Golden tours integrity + BASIC_SCENARIO fixture** - `797521d` (feat)
2. **Task 2: Dashboard tour E2E + validate CLI** - `0707a11` (feat)

## Files Created/Modified

- `packages/core/src/verify/tours-snapshot.ts` - Snapshot collector + `verifyToursEvidenceIntegrity` wrapper
- `packages/core/src/verify/tours-snapshot.test.ts` - Unit tests including corrupt SHA detection
- `tests/golden/tours-evidence-integrity.test.ts` - EVD-04 golden gate on BASIC_SCENARIO
- `tests/integration/dashboard-tour-e2e.test.ts` - Phase 7 acceptance E2E + validate CLI tests
- `tests/fixtures/tours/basic-scenario-tours.json` - Added auth topic tour
- `packages/cli/src/commands/validate.ts` - Tours integrity gate
- `packages/core/src/index.ts` - Export tours snapshot helpers

## Decisions Made

- Default tour chapter count locked at 4 after outline overlay (within 4–6 schema range)
- Negative tests write corrupt `tours.json` directly since `writeToursArtifact` blocks invalid artifacts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `better-sqlite3` native module required Node 22 rebuild before tests could run locally

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 complete — all TOUR-01–TOUR-04 criteria proven via golden + E2E gates
- Ready for Phase 8 hardening, scale benchmarks, and multi-repo workspace integrity

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: packages/core/src/verify/tours-snapshot.ts
- FOUND: packages/core/src/verify/tours-snapshot.test.ts
- FOUND: tests/golden/tours-evidence-integrity.test.ts
- FOUND: tests/integration/dashboard-tour-e2e.test.ts
- FOUND: 797521d
- FOUND: 0707a11
