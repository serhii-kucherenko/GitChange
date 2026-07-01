---
phase: 07-guided-tours-onboarding-ux
plan: 04
subsystem: ui
tags: [react, zustand, react-query, tours, localStorage, vitest]

requires:
  - phase: 07-guided-tours-onboarding-ux
    provides: fetchTours/fetchTour API client and TourDetail types from 07-03
  - phase: 06-open-work
    provides: matchOpenWorkToSurface and OpenWorkBadge
  - phase: 05-dashboard
    provides: useDrillStore drill-down actions and CommitDetailPanel
provides:
  - useTourStore with headSha-scoped localStorage progress persistence
  - TourPicker grouped by default/role/topic tour kinds
  - TourPlayer with chapter nav, stop navigation, and evidence drill-down
  - Tours intelligence tab in dashboard layout
affects: [07-05 golden E2E, onboarding UX verification]

tech-stack:
  added: []
  patterns:
    - "Tour progress separate from drillStore; keyed gitchange-tour-progress:${headSha}"
    - "Tour stop drill maps drillTarget to drillStore; commit drill keeps tours tab with CommitDetailPanel overlay"
    - "Narrative rendered as React text nodes only (T-07-09 XSS mitigation)"

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
  - "Tour progress persists via zustand subscribe on headSha from snapshot manifest"
  - "Era/decision drills switch intelligence tab; commit/file drills stay on tours tab with CommitDetailPanel"

patterns-established:
  - "TourPicker groups tours by kind with defaultTourId highlight badge"
  - "TourStopCard evidence chips and See evidence CTA share drillFromTarget handler"

requirements-completed: [TOUR-02, TOUR-03, TOUR-04]

duration: 25min
completed: 2026-07-01
---

# Phase 7 Plan 04: Tour Player UX Summary

**Tours dashboard tab with role/topic picker, chapter/stop player, evidence drill-down into timeline/decisions/commits, open-work badges, and headSha-scoped localStorage progress.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T05:00:00Z
- **Completed:** 2026-07-01T05:27:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `useTourStore` persists active tour, chapter/stop indices, and completed stops per HEAD sha
- TourPicker renders Onboarding, Role variants, and Topic threads groups from `/api/tours`
- TourPlayer navigates prev/next stops and chapter jumps via TourChapterNav
- TourStopCard maps drillTarget to drillStore (era → timeline, decision → decisions, commit/file → CommitDetailPanel)
- `matchOpenWorkToSurface` drives OpenWorkBadge on stops with linked incomplete threads
- Dashboard fourth tab "Tours" wires picker + chapter nav in sidebar and player in main

## Task Commits

Each task was committed atomically:

1. **Task 1: useTourStore + TourPicker** - `d6fe7ea` (feat)
2. **Task 2: TourPlayer + TourStopCard with drill-down** - `cd6ec0a` (feat)
3. **Task 3: Dashboard tab wiring** - `ae45dc3` (feat)

## Files Created/Modified

- `packages/dashboard/src/store/tour.ts` - zustand tour progress store with hydrate/persist
- `packages/dashboard/src/store/tour.test.ts` - persistence round-trip and navigation unit tests
- `packages/dashboard/src/components/TourPicker.tsx` - grouped tour selection UI with empty states
- `packages/dashboard/src/components/TourPlayer.tsx` - stop player with prev/next navigation
- `packages/dashboard/src/components/TourStopCard.tsx` - narrative, evidence chips, See evidence CTA, OpenWorkBadge
- `packages/dashboard/src/components/TourChapterNav.tsx` - chapter list with keyboard-accessible buttons
- `packages/dashboard/src/App.tsx` - tours tab layout, localStorage sync, drill panel overlay
- `packages/dashboard/src/layout/DashboardLayout.tsx` - IntelligenceTab union extended with tours
- `packages/dashboard/src/index.ts` - re-exports useTourStore and PersistedTourProgress

## Decisions Made

- Tour progress auto-persists on any store change via subscribe effect keyed to manifest head sha
- Commit/file drill from tour keeps tours tab active; CommitDetailPanel renders when selectedCommitSha is set (mirrors decisions tab pattern)
- Era and decision drills switch intelligence tab to timeline or decisions respectively

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tour player UX complete for 07-05 golden E2E verification
- Requires tours.json artifact from tour synthesis pipeline (07-02) for live dashboard testing

## Self-Check: PASSED

- All 9 key files FOUND
- Task commits d6fe7ea, cd6ec0a, ae45dc3 FOUND
- `pnpm exec vitest run packages/dashboard/src/store/tour.test.ts` — 4 passed
- `pnpm --filter @gitchange/dashboard exec tsc --noEmit` — passed

---
*Phase: 07-guided-tours-onboarding-ux*
*Completed: 2026-07-01*
