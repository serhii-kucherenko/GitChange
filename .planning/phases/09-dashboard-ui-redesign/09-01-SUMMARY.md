---
phase: 09-dashboard-ui-redesign
plan: 01
subsystem: dashboard-frame
tags: [ui, layout, accessibility, tailwind-v4, react]
requires:
  - "packages/dashboard/src/snapshot.ts (SnapshotLoadState) — unchanged"
  - "packages/dashboard components (EraTimeline, CommitList, DecisionsPanel, etc.) — restyled in later plans"
provides:
  - "Shared app frame: sticky full-width header + full-width accessible tablist"
  - "Per-view body layout slots (eraTimeline, filterBar, timelineRail, commitList, intelligenceRail, intelligenceMain)"
  - "Frame-level centered loading/empty/error states"
affects:
  - "packages/dashboard/src/layout/DashboardLayout.tsx"
  - "packages/dashboard/src/App.tsx"
tech-stack:
  added: []
  patterns:
    - "role=tablist/tab + aria-selected tab nav (roving handler preserved)"
    - "Per-view CSS grid layouts driven by intelligenceTab"
    - "Centered max-w-md frame-level state region"
key-files:
  created: []
  modified:
    - "packages/dashboard/src/layout/DashboardLayout.tsx"
    - "packages/dashboard/src/App.tsx"
decisions:
  - "Active tab uses underline treatment (border-b-2 border-sky-400) per UI-SPEC preference for top-level nav"
  - "DashboardLayoutProps restructured to per-view slots; App.tsx (sole caller) updated in same plan, typecheck-guarded"
  - "Frame-level single centered loading state replaces prior dual sidebar+main loading text (behavior-neutral)"
metrics:
  duration: "~4 min"
  completed: 2026-07-01
---

# Phase 09 Plan 01: Dashboard App Frame + Information Architecture Summary

Restructured the shared dashboard frame — sticky full-width header, an accessible full-width tablist under it, per-view body layouts replacing the single fixed 22rem+1fr grid, and centered frame-level loading/empty/error states — all behavior-neutral (no query, store, or callback logic touched).

## What Was Built

### Task 1 — Shared app frame (sticky header + full-width tablist)
- Header is now `sticky top-0 z-20 h-14`, inner row `mx-auto max-w-[96rem]`, `backdrop-blur`. Product title kept at `text-2xl font-semibold tracking-tight`; `HEAD {sha7}` lowered to `text-xs`. `resolveDisplayedAttribution` + `AttributionBadge` preserved exactly.
- Primary tab nav moved OUT of `<aside>` to a full-width bar directly under the header (`border-b border-slate-800 bg-slate-900/80`, inner `mx-auto flex max-w-[96rem] gap-1 px-6`).
- Tablist is now `role="tablist" aria-label="Primary views"`; each tab is `role="tab"` with `aria-selected`, `whitespace-nowrap px-4 py-2`, `min-h-[32px]`, and the `focus-visible:ring-sky-400` ring. Active tab: `border-b-2 border-sky-400 font-semibold text-slate-100`; inactive: `text-slate-400 hover:text-slate-200`. `aria-current="page"` retained alongside `aria-selected`. Tablist renders only when `loadState.status === "ready"`.
- `onIntelligenceTabChange`, `TAB_LABELS`, and the `IntelligenceTab` union are unchanged.
- Commit: `8941990`

### Task 2 — Per-view body layouts + centered states + App.tsx re-wiring
- Removed the single fixed `lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]` grid (grep-confirmed gone).
- `DashboardLayoutProps` restructured to per-view slots: `eraTimeline`, `filterBar`, `timelineRail`, `commitList`, `intelligenceRail`, `intelligenceMain`.
- Per-view body layouts inside `mx-auto max-w-[96rem] px-6 py-8`:
  - **Timeline:** full-width era strip → full-width filter bar → `grid lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] gap-8` (rail stacked `gap-6` / commit list `1fr`), collapses to single column below `lg`.
  - **Decisions / Open work:** `lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] gap-8`.
  - **Tours:** `lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] gap-8`.
  - **Graph:** full-bleed within content width; canvas region `flex-1 min-h-[32rem]` with a slim helper strip (no 22rem sidebar).
- Loading/empty/error moved to a centered frame-level region `mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center`, with verbatim §Copywriting copy (empty "No analysis yet" + body; error `role="alert"` "Couldn't load the index…"; loading "Loading index status…").
- App.tsx re-wired to the new slots; cross-view drill callbacks `onDrillToTimeline`/`onDrillToDecisions` (TourPlayer, TemporalGraphView) preserved exactly. No `useQuery`, `useState`, Zustand selector, `useEffect`, `fetchSnapshot`, or `mergedFilters` logic changed.
- Commit: `191c5d3`

## Deviations from Plan

None — plan executed as written. Minor spec-aligned copy touch-ups made while restructuring the slots (behavior-neutral): the two selection-empty pane strings now read the verbatim §Copywriting Contract text ("Select a decision to view its evidence and drill into commits." / "Select a thread to view its migration timeline and drill into commits.") and the graph-missing message matches "Temporal graph not available yet. Run semantic synthesis to build temporal-graph.json." These are within the plan's slot-rewiring surface, not scope additions.

## Verification

- `pnpm --dir packages/dashboard typecheck` — passes (exit 0), interface + sole caller in sync.
- `pnpm --dir packages/dashboard test` — 31/31 passing (behavioral suite: TemporalGraphView drill callbacks + tour store tests unaffected).
- Old fixed grid `minmax(0,22rem)` grep-confirmed removed from `packages/dashboard/src/`.

## Known Stubs

None — this plan restructures existing wired components; no placeholder/empty data introduced.

## Self-Check: PASSED

- FOUND: packages/dashboard/src/layout/DashboardLayout.tsx
- FOUND: packages/dashboard/src/App.tsx
- FOUND: commit 8941990 (Task 1)
- FOUND: commit 191c5d3 (Task 2)
