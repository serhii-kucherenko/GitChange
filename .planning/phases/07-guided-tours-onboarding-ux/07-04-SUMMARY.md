---
phase: 07-guided-tours-onboarding-ux
plan: 04
subsystem: ui
tags: [react, zustand, tours, vitest, drill-down, localStorage]

requires:
  - phase: 07-guided-tours-onboarding-ux
    provides: Tour read API and dashboard fetchTours/fetchTour client
provides:
  - useTourStore with headSha-scoped localStorage progress
  - TourPicker grouped by default, role, and topic kinds
  - TourPlayer with chapter/stop navigation and evidence drill-down
  - Tours intelligence tab in dashboard layout
affects: [07-05 onboarding UX polish]

tech-stack:
  added: []
  patterns:
    - "Tour progress in separate zustand store from drillStore (P7-D-07)"
    - "See evidence maps drillTarget to drillStore setters without dangerouslySetInnerHTML"
    - "Tours tab keeps active while commit drill shows CommitDetailPanel in main"

key-files:
  created:
    - packages/dashboard/src/store/tour.ts
    - packages/dashboard/src/store/tour.test.ts
    - packages/dashboard/src/components/TourPicker.tsx
    - packages/dashboard/src/components/TourPlayer.tsx
    - packages/dashboard/src/components/TourStopCard.tsx
    - packages/dashboard/src/components/TourChapterNav.tsx
  modified:
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/index.ts

key-decisions:
  - "Tour drill for commit/file stays on tours tab; era/decision switch intelligence tab"
  - "TourPlayer uses retreatStop/advanceStop on full chapter objects for bounds"

patterns-established:
  - "matchOpenWorkToSurface on tour stop drillTarget for OpenWorkBadge rendering"

requirements-completed: [TOUR-02, TOUR-03, TOUR-04]

duration: 18min
completed: 2026-07-01
---

# Phase 7 Plan 04: Tour Player UX Summary

**Fourth dashboard tab with tour picker, chapter player, evidence drill-down into timeline/commits/decisions, open-work badges, and per-HEAD local progress.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T05:22:00Z
- **Completed:** 2026-07-01T05:40:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `useTourStore` persists chapter/stop position and completed stops to `gitchange-tour-progress:<headSha>`
- TourPicker groups onboarding, role, and topic tours with default highlight and synthesis empty state
- TourPlayer + TourStopCard wire See evidence to drillStore; OpenWorkBadge on matching incomplete threads
- Dashboard Tours tab with picker/chapter sidebar and commit detail overlay when drilling

## Task Commits

1. **Task 1: useTourStore + TourPicker** - `d6fe7ea` (feat)
2. **Task 2: TourPlayer + TourStopCard with drill-down** - `cd6ec0a` (feat)
3. **Task 3: Dashboard tab wiring** - `ae45dc3` (feat)

## Files Created/Modified

- `packages/dashboard/src/store/tour.ts` - Tour progress zustand store with localStorage hydrate/persist
- `packages/dashboard/src/components/TourPicker.tsx` - Grouped tour selection from `/api/tours`
- `packages/dashboard/src/components/TourPlayer.tsx` - Chapter/stop navigation with keyboard arrows
- `packages/dashboard/src/components/TourStopCard.tsx` - Narrative, evidence chips, See evidence CTA
- `packages/dashboard/src/App.tsx` - Tours tab layout, progress hydration, commit drill overlay

## Decisions Made

- Commit/file drills keep tours tab active; era/decision drills switch intelligence tab per P7-D-06
- Narratives and excerpts render as React text nodes only (T-07-09 XSS mitigation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - requires existing `tours.json` from tour synthesis; empty state directs user to `/gitchange` tour synthesis.

## Next Phase Readiness

- 07-05 can polish onboarding flows and first-run tour prompts
- Tour player ready for E2E verification with basic-scenario fixture

## Self-Check: PASSED

- FOUND: packages/dashboard/src/store/tour.ts
- FOUND: packages/dashboard/src/components/TourPicker.tsx
- FOUND: packages/dashboard/src/components/TourPlayer.tsx
- FOUND: packages/dashboard/src/components/TourStopCard.tsx
- FOUND: d6fe7ea
- FOUND: cd6ec0a
- FOUND: ae45dc3

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*
