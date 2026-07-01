---
phase: 06-decisions-status-open-work
plan: 06
subsystem: dashboard
tags: [decisions, open-work, badges, status-query, golden, e2e]

requires:
  - phase: 06-decisions-status-open-work
    provides: decisions/open-work artifacts, dashboard panels, interview loop
provides:
  - matchOpenWorkToSurface for Phase 7 tour integration
  - status-query-response.schema.json agent contract
  - checkDecisionsIntegrity + golden decisions gate
  - Timeline/commit/era OpenWorkBadge wiring
affects: [07-tour-player, validate-cli]

tech-stack:
  added: []
  patterns:
    - "Decision confidence model separate from era evidence-count heuristic"
    - "Open-work surface matching by commit, path prefix, or era window"
    - "StatusQueryResponse with EVD03_GAP_MESSAGE literal gap field"

key-files:
  created:
    - packages/dashboard/src/utils/open-work-match.ts
    - packages/plugin/schemas/status-query-response.schema.json
    - packages/core/src/verify/decisions-integrity.ts
    - packages/core/src/verify/decisions-snapshot.ts
    - tests/golden/decisions.test.ts
    - tests/integration/decisions-dashboard-e2e.test.ts
  modified:
    - packages/dashboard/src/components/EraTimeline.tsx
    - packages/dashboard/src/components/CommitList.tsx
    - packages/dashboard/src/components/DecisionsPanel.tsx
    - packages/plugin/skills/gitchange/SKILL.md
    - packages/cli/src/commands/validate.ts

key-decisions:
  - "Era claims keep evidence-count heuristic; decisions use decisionConfidenceToLevel"
  - "matchOpenWorkToSurface excludes completed threads; accepts eraWindow for timeline matching"
  - "validate runs decisions integrity when decisions.json present; errors if manifest checkpoint without file"

patterns-established:
  - "Phase 7 hook: export matchOpenWorkToSurface from @gitchange/dashboard index"
  - "Golden BASIC_SCENARIO decisions snapshot locks 3 decisions, 1 thread, 1 incomplete"

requirements-completed: [STAT-03, STAT-04, EVD-03, CONT-02]

duration: 25min
completed: 2026-07-01
---

# Phase 6 Plan 06: Timeline Badges + Status Gate Summary

**Open-work badges on timeline/commits, agent status-query schema, and golden/E2E gate completing Phase 6.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T04:52:00Z
- **Completed:** 2026-07-01T05:00:00Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- `decisionConfidenceToLevel` replaces evidence-count heuristic on decision surfaces; era claims unchanged per P5-D-05
- `matchOpenWorkToSurface` exported for Phase 7; wired into EraTimeline, CommitList, and EraDetailPanel with OpenWorkBadge
- `status-query-response.schema.json` + /gitchange Phase 4 documents evidence-first status answers with EVD03 gap
- `checkDecisionsIntegrity`, golden decisions test, validate extension, and Phase 6 dashboard E2E all green on Node 22

## Task Commits

1. **Task 1: Decision confidence + badge matching** - `89cf66d` (feat)
2. **Task 2: STAT-04 status schema + skill** - `95e7431` (feat)
3. **Task 3: Golden gate + E2E** - `f20ddf1` (feat)

## Files Created/Modified

- `packages/dashboard/src/utils/open-work-match.ts` - STAT-03 surface matching utility
- `packages/dashboard/src/utils/confidence.ts` - Decision confidence model
- `packages/plugin/schemas/status-query-response.schema.json` - STAT-04 agent contract
- `packages/core/src/verify/decisions-integrity.ts` - Evidence referential integrity
- `tests/golden/decisions.test.ts` - Locked BASIC_SCENARIO counts
- `tests/integration/decisions-dashboard-e2e.test.ts` - API chain including gap + attribution

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- FOUND: packages/dashboard/src/utils/open-work-match.ts
- FOUND: packages/plugin/schemas/status-query-response.schema.json
- FOUND: packages/core/src/verify/decisions-integrity.ts
- FOUND: tests/golden/decisions.test.ts
- FOUND: tests/integration/decisions-dashboard-e2e.test.ts
- FOUND: .planning/phases/06-decisions-status-open-work/06-06-SUMMARY.md
- FOUND: 89cf66d
- FOUND: 95e7431
- FOUND: f20ddf1

**Self-Check: PASSED**
