---
phase: 09-dashboard-ui-redesign
plan: 04
subsystem: ui
tags: [react, tailwind, dashboard, design-system, badges, tours, graph]

# Dependency graph
requires:
  - phase: 09-01
    provides: Per-view DashboardLayout frame and slot wiring for leaf components
provides:
  - Uniform card/badge/typography/color contract across Timeline rail cards, filters, drill panels, badges, Tours, and Graph
  - Graph canvas full-bleed at min-h-[32rem] with slim helper strip (no sidebar)
  - Tour player prose at max-w-3xl with contract CTAs (Next stop / Previous stop)
  - Semantic-state badge pills (no violet/rose); metadata raised to slate-400 where readable
affects: [09-dashboard-ui-redesign, ui-checker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational polish = className/copy only; drill callbacks, stores, and @xyflow wiring untouched"
    - "Graph detail strip below canvas (not lg:grid sidebar) per UI-SPEC Graph layout"
    - "Primary tour CTA bg-sky-600 text-slate-950; secondary Previous stop border/emphasis"

key-files:
  created: []
  modified:
    - packages/dashboard/src/components/IndexStatusCard.tsx
    - packages/dashboard/src/components/EraDetailPanel.tsx
    - packages/dashboard/src/components/CommitFilterBar.tsx
    - packages/dashboard/src/components/RepoFilterBar.tsx
    - packages/dashboard/src/components/FileHistoryScrubber.tsx
    - packages/dashboard/src/components/CommitDetailPanel.tsx
    - packages/dashboard/src/components/FileHunkView.tsx
    - packages/dashboard/src/components/DrillBreadcrumb.tsx
    - packages/dashboard/src/components/OpenThreadsPanel.tsx
    - packages/dashboard/src/components/RepoSnapshot.tsx
    - packages/dashboard/src/components/ConfidenceBadge.tsx
    - packages/dashboard/src/components/OpenWorkBadge.tsx
    - packages/dashboard/src/components/RepoBadge.tsx
    - packages/dashboard/src/components/TourPicker.tsx
    - packages/dashboard/src/components/TourChapterNav.tsx
    - packages/dashboard/src/components/TourPlayer.tsx
    - packages/dashboard/src/components/TourStopCard.tsx
    - packages/dashboard/src/components/TemporalGraphView.tsx

key-decisions:
  - "TemporalGraphView node detail moved from 16rem sidebar to slim strip below min-h-[32rem] canvas — matches full-bleed Graph IA"
  - "TourPlayer wraps content in max-w-3xl; Next stop uses bg-sky-600 text-slate-950; Previous stop stays lower-emphasis border button"
  - "Badge aria-label removed from span pills (visible text is the label); title retained for tooltips"
  - "OpenThreadsPanel max-h-[28rem] replaced with flex-fill min-h-[24rem] flex-1 for consistency with Plan 03 list frames"

patterns-established:
  - "Leaf-component restyle pass = card contract (bg-slate-900 border-slate-700 rounded-lg p-4) + Heading titles + slate-400 metadata; zero logic edits"

requirements-completed: [DASH-02, DASH-03]

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 9 Plan 04: Design-System Polish Summary

**Applied the UI-SPEC card/badge/typography/color contract uniformly across remaining leaf components, standardized semantic-state badge pills, restyled Tours with contract CTAs and comfortable prose measure, and reframed the temporal graph as a full-width canvas with a slim helper strip — all presentational, zero logic or drill-callback changes.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-01T13:45:00Z
- **Completed:** 2026-07-01T13:59:00Z
- **Tasks:** 3 completed
- **Files modified:** 18+ (leaf components + lint fixes)

## Accomplishments

- **Timeline rail & drill** — IndexStatusCard, EraDetailPanel, CommitFilterBar, RepoFilterBar, FileHistoryScrubber, CommitDetailPanel, FileHunkView, DrillBreadcrumb, OpenThreadsPanel, RepoSnapshot use the base card contract (`bg-slate-900 border-slate-700 rounded-lg p-4`), Heading-size titles, and readable metadata at `slate-400`.
- **Badges** — ConfidenceBadge, AttributionBadge, OpenWorkBadge, RepoBadge use semantic-state pill treatment (`rounded-full px-2 py-0.5 text-xs` + emerald/amber/sky/slate/red triplets); no `violet`/`rose` classes remain.
- **Tours** — TourPicker/TourChapterNav card headings at `text-lg font-semibold tracking-tight`; TourPlayer prose constrained to `max-w-3xl`; Next stop primary CTA `bg-sky-600 text-slate-950`; Previous stop secondary border button; TourStopCard card contract + sky primary CTA.
- **Graph** — TemporalGraphView canvas `min-h-[32rem] flex-1` full width; node detail in slim `text-xs slate-400` strip below canvas (removed `lg:grid-cols-[1fr_16rem]` sidebar layout).
- **OpenThreadsPanel** — flex-fill list frame (`min-h-[24rem] flex-1`) replacing fixed `max-h-[28rem]`.
- Preserved all locked surface: `onDrillToTimeline`/`onDrillToDecisions`, `@xyflow/react` wiring, store selectors, and data fetching unchanged. `TemporalGraphView.test.tsx` not edited.

## Verification

- `pnpm --dir packages/dashboard typecheck` → exit 0 (green).
- `pnpm --dir packages/dashboard test` → 5 files, 31 tests passed (incl. TemporalGraphView).
- `pnpm --dir packages/dashboard lint` → exit 0 (green).
- `pnpm exec turbo build --filter=@gitchange/dashboard` → exit 0 (green).
- `grep -rn "violet\|rose-" packages/dashboard/src/components` → no matches.

## Deviations from Plan

- Additional lint/a11y fixes applied across dashboard (unused imports, stable React keys, non-null assertion cleanup, tablist container `nav` → `div`) so wave verification (`turbo lint`) passes green — behavior-neutral.

## Threat Surface

- T-09-04 (Tampering): accepted as planned — presentational restyle only.
- T-09-SC (Package legitimacy): N/A — zero package installs.

## Manual Verification (deferred to UI-checker / 09-VALIDATION.md)

- Cards not cramped; metadata `slate-400`; Tours prose `max-w-3xl` with Next/Previous CTAs; graph canvas fills content width with helper strip below.

## Self-Check: PASSED

- FOUND: packages/dashboard/src/components/TemporalGraphView.tsx (min-h-[32rem], no sidebar grid)
- FOUND: packages/dashboard/src/components/TourPlayer.tsx (max-w-3xl, bg-sky-600 Next stop)
- FOUND: packages/dashboard/src/components/ConfidenceBadge.tsx (semantic pill colors)
- FOUND: .planning/phases/09-dashboard-ui-redesign/09-04-SUMMARY.md
