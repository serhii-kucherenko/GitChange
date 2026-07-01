---
phase: 05-dashboard-evidence-drill-down
plan: 03
subsystem: ui
tags: [vis-timeline, react-query, zustand, hono, eras, timeline]

requires:
  - phase: 05-dashboard-evidence-drill-down
    provides: Paginated /api/commits, drill store scaffold, commit filters (05-01, 05-02)
  - phase: 04-era-detection-semantic-pipeline
    provides: eras.json artifact with commit windows
provides:
  - GET /api/eras with commit counts per era window
  - listErasForDashboard core read query
  - EraTimeline vis-timeline adapter (imperative mount, setItems updates)
  - EraDetailPanel with inflections and claims evidence counts
  - Era selection filters commits via after/before drill store wiring
affects:
  - 05-05-PLAN.md
  - 05-06-PLAN.md

tech-stack:
  added: ["vis-timeline@8.5.1", "vis-data@8.0.3"]
  patterns:
    - "Era windows stored as ms in eras.json; API commit filters use unix seconds (after/before)"
    - "vis-timeline mounted imperatively in useEffect; items updated via DataSet not React remount"
    - "Era selection merges into CommitList filters via eraToCommitFilters helper"

key-files:
  created:
    - packages/core/src/read/eras.ts
    - packages/core/src/read/eras.test.ts
    - packages/server/src/routes/eras.ts
    - packages/dashboard/src/components/EraTimeline.tsx
    - packages/dashboard/src/components/EraDetailPanel.tsx
    - tests/integration/dashboard-eras.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/package.json
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/store/drill.ts
    - packages/dashboard/src/components/CommitFilterBar.tsx
    - packages/dashboard/src/api/client.ts
    - packages/dashboard/src/main.tsx
    - packages/dashboard/src/index.css
    - packages/dashboard/src/components/DrillBreadcrumb.tsx

key-decisions:
  - "Era drill store holds SelectedEra object (id, name, startAt, endAt) instead of bare selectedEraId"
  - "Commit filter after/before derived from era ms timestamps via floor division by 1000"
  - "vis-data added explicitly as dashboard dependency for Vite bundle resolution"

patterns-established:
  - "GET /api/eras returns JSON array; 404 when eras.json missing or index absent"
  - "Era badge in CommitFilterBar with separate clear-era action"

requirements-completed: [TIME-01, DASH-01]

duration: 18min
completed: 2026-07-01
---

# Phase 5 Plan 03: Era Timeline Summary

**vis-timeline era bands from eras.json with era click filtering commits and era detail panel**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-01T03:55:00Z
- **Completed:** 2026-07-01T04:01:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- `listErasForDashboard` reads eras.json and adds SQLite commit counts per era window
- `GET /api/eras` serves Zod-validated era array; 404 when semantic artifacts absent
- EraTimeline renders interactive era bands via vis-timeline thin React adapter
- Era selection sets drill store window and merges `after`/`before` into commit list filters
- EraDetailPanel shows summary, inflection types, and claims with evidence counts

## Task Commits

1. **Task 1: listErasForDashboard + GET /api/eras** - `e69d81c` (feat)
2. **Task 2: EraTimeline vis-timeline + era-driven commit filter** - `8753520` (feat)

## Files Created/Modified

- `packages/core/src/read/eras.ts` - Dashboard era list with commit window counts
- `packages/server/src/routes/eras.ts` - Hono GET /eras route
- `packages/dashboard/src/components/EraTimeline.tsx` - vis-timeline imperative adapter
- `packages/dashboard/src/components/EraDetailPanel.tsx` - Selected era claims/inflections panel
- `packages/dashboard/src/store/drill.ts` - SelectedEra state + eraToCommitFilters helper
- `tests/integration/dashboard-eras.test.ts` - API + era window filter integration tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] app.ts eras route mount missing on first edit**
- **Found during:** Task 1 verification
- **Issue:** Integration tests returned SPA HTML (200) instead of API 404/JSON
- **Fix:** Re-applied createErasRoutes import and mount in app.ts
- **Files modified:** packages/server/src/app.ts
- **Commit:** e69d81c

**2. [Rule 3 - Blocking] vis-data not bundled by Vite**
- **Found during:** Task 2 build
- **Issue:** Rolldown could not resolve vis-data import from EraTimeline
- **Fix:** Added vis-data@8.0.3 explicit dashboard dependency
- **Files modified:** packages/dashboard/package.json
- **Commit:** 8753520

None otherwise - plan executed as written.

## Self-Check: PASSED

- FOUND: packages/core/src/read/eras.ts
- FOUND: packages/server/src/routes/eras.ts
- FOUND: packages/dashboard/src/components/EraTimeline.tsx
- FOUND: packages/dashboard/src/components/EraDetailPanel.tsx
- FOUND: tests/integration/dashboard-eras.test.ts
- FOUND: e69d81c
- FOUND: 8753520
