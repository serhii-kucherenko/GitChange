---
phase: 05-dashboard-evidence-drill-down
plan: 06
subsystem: ui
tags: [react, vitest, confidence, localhost, integration-tests]

requires:
  - phase: 05-dashboard-evidence-drill-down
    provides: drill-down API, hunk capture, era timeline, file scrubber from plans 05-01–05-05
provides:
  - ConfidenceBadge and AttributionBadge components with evidence-count heuristic
  - Extended IndexStatusCard semantic freshness fields (DASH-03)
  - PRIV-04 localhost bind integration tests
  - SCALE-02 server es-git import gate test
  - Phase 5 E2E drill-down acceptance test
affects: [06-decisions-status-open-work]

tech-stack:
  added: []
  patterns:
    - "evidenceCountToLevel heuristic: high≥3, medium=2, low≤1"
    - "manifest warnings downgrade displayed attribution confidence"
    - "Phase 5 E2E via API sequence only (no browser)"

key-files:
  created:
    - packages/dashboard/src/utils/confidence.ts
    - packages/dashboard/src/utils/confidence.test.ts
    - packages/dashboard/src/components/ConfidenceBadge.tsx
    - tests/integration/dashboard-priv-bind.test.ts
    - tests/integration/scale02-no-esgit-server.test.ts
    - tests/integration/dashboard-drilldown-e2e.test.ts
  modified:
    - packages/dashboard/src/components/IndexStatusCard.tsx
    - packages/dashboard/src/components/EraDetailPanel.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/types.ts

key-decisions:
  - "Phase 5 confidence UI uses evidence-count heuristic only; full decision model deferred to Phase 6"
  - "Attribution badge downgrades to Degraded when manifest.warnings is non-empty"
  - "PRIV-04 tests use lsof listen-address assertion plus 0.0.0.0 stderr warning check"

patterns-established:
  - "ConfidenceBadge chip colors: emerald high, sky medium, amber low/degraded"
  - "Integration E2E chains eras → filtered commits → commit hunks → file history"

requirements-completed: [EVD-02, PRIV-04, DASH-03, SCALE-02]

duration: 18min
completed: 2026-07-01
---

# Phase 5 Plan 06: Confidence UI + Privacy Gate Summary

**Attribution and evidence-confidence badges in dashboard header and era detail, with PRIV-04 bind tests and Phase 5 API drill-down E2E gate**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T04:11:00Z
- **Completed:** 2026-07-01T04:29:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Header shows Complete/Degraded attribution from snapshot intelligence, downgraded when manifest has warnings
- Era claims and inflections display High/Medium/Low confidence chips from evidence count
- Index status card surfaces core/semantic schema versions and semantic computed timestamp
- Integration tests enforce localhost default bind, zero es-git in server, and full era→commit→hunk→file drill path

## Task Commits

1. **Task 1: Confidence utilities + badges in dashboard** - `efc503b` (feat)
2. **Task 2: PRIV-04 bind test + SCALE-02 gate + drill-down E2E** - `44ea9da` (test)

## Files Created/Modified

- `packages/dashboard/src/utils/confidence.ts` - evidenceCountToLevel, attribution downgrade helper
- `packages/dashboard/src/components/ConfidenceBadge.tsx` - Evidence and attribution badge chips
- `packages/dashboard/src/layout/DashboardLayout.tsx` - Header attribution badge
- `packages/dashboard/src/components/EraDetailPanel.tsx` - Per-claim/inflection confidence chips
- `packages/dashboard/src/components/IndexStatusCard.tsx` - Semantic schema and freshness fields
- `tests/integration/dashboard-priv-bind.test.ts` - PRIV-04 localhost bind policy
- `tests/integration/scale02-no-esgit-server.test.ts` - Server es-git import gate
- `tests/integration/dashboard-drilldown-e2e.test.ts` - Phase 5 acceptance E2E

## Decisions Made

- Used manifest.semanticSchemaVersion / semanticComputedAt for DASH-03 (erasCheckpoint fields not in manifest schema)
- Kept existing start.ts/serve.ts defaults unchanged — P5-D-06 already implemented

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Integration tests require Node 22.x for native sqlite/es-git; Node 24 caused index CLI exit 1. Verified green on Node v22.22.0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 complete — all six plans delivered; ready for Phase 6 decision mining and open-work surfaces
- Confidence heuristic in place; Phase 6 can replace with full decision-confidence model

## Self-Check: PASSED

- FOUND: packages/dashboard/src/utils/confidence.ts
- FOUND: packages/dashboard/src/components/ConfidenceBadge.tsx
- FOUND: tests/integration/dashboard-drilldown-e2e.test.ts
- FOUND: efc503b
- FOUND: 44ea9da

---
*Phase: 05-dashboard-evidence-drill-down*
*Completed: 2026-07-01*
