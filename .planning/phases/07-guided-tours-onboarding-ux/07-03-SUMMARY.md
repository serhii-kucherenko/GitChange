---
phase: 07-guided-tours-onboarding-ux
plan: 03
subsystem: api
tags: [hono, tours, vitest, react-query, zod]

requires:
  - phase: 07-guided-tours-onboarding-ux
    provides: readToursArtifact, ToursArtifact Zod schemas
provides:
  - listTours / getTourById core read helpers
  - GET /api/tours list and GET /api/tours/:tourId detail routes
  - Dashboard TourSummary/TourDetail types and fetchTours/fetchTour client
affects: [07-04 dashboard tour player, 07-05 golden E2E]

tech-stack:
  added: []
  patterns:
    - "Artifact read helpers return null when tours.json missing (no live git)"
    - "Hono routes mirror decisions/open-work 404 JSON error shape"
    - "Dashboard types duplicated locally — no @gitchange/core in client bundle"

key-files:
  created:
    - packages/core/src/read/tours.ts
    - packages/core/src/read/tours.test.ts
    - packages/server/src/routes/tours.ts
    - packages/server/src/routes/tours.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/src/types.ts
    - packages/dashboard/src/api/client.ts

key-decisions:
  - "Tour list 404 uses error message 'tours not found' per plan contract"
  - "tourId path param rejects .. and / before artifact lookup (T-07-06)"

patterns-established:
  - "tours.list / tours.detail(tourId) react-query key helpers exported from client.ts"

requirements-completed: [TOUR-04]

duration: 8min
completed: 2026-07-01
---

# Phase 7 Plan 03: Tour Read API Summary

**GET /api/tours list and detail routes serving pre-built tours.json with dashboard client types for react-query tour player loading.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-01T05:15:00Z
- **Completed:** 2026-07-01T05:23:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `listTours` returns tour summaries with `chapterCount`, `stopCount`, optional `roleTag`/`topicKey`, and `defaultTourId`
- `getTourById` returns full tour with chapters and stops from artifact only
- Hono routes mounted at `/api/tours` with 404 when artifact missing
- Dashboard `fetchTours`, `fetchTour`, and `tours.list` / `tours.detail(id)` query keys

## Task Commits

1. **Task 1: Core read helpers for tours** - `2cf8113` (test), `4d754da` (feat)
2. **Task 2: Hono routes + dashboard API client** - `3cd4043` (test), `5607903` (feat)

## Files Created/Modified

- `packages/core/src/read/tours.ts` - listTours and getTourById read helpers
- `packages/core/src/read/tours.test.ts` - fixture-based read boundary tests
- `packages/server/src/routes/tours.ts` - Hono tour list/detail routes with Zod response validation
- `packages/server/src/routes/tours.test.ts` - API integration tests + SCALE-02 es-git gate on route file
- `packages/server/src/app.ts` - mount createToursRoutes
- `packages/dashboard/src/types.ts` - TourSummary, TourDetail, TourStop, TourChapter types
- `packages/dashboard/src/api/client.ts` - fetchTours, fetchTour, tours query keys

## Decisions Made

- Tour list 404 body uses `{ error: "tours not found" }` as specified in plan
- tourId path validation rejects `..` and `/` before artifact lookup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-04 tour player can call `fetchTours` / `fetchTour` and wire drill-down from stop evidence
- Pre-built `tours.json` required (07-02 pipeline) for non-404 API responses

## Self-Check: PASSED

- FOUND: packages/core/src/read/tours.ts
- FOUND: packages/core/src/read/tours.test.ts
- FOUND: packages/server/src/routes/tours.ts
- FOUND: packages/server/src/routes/tours.test.ts
- FOUND: commit 2cf8113
- FOUND: commit 4d754da
- FOUND: commit 3cd4043
- FOUND: commit 5607903

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*
