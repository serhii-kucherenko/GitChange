---
phase: 09-dashboard-ui-redesign
plan: 03
subsystem: ui
tags: [react, tanstack-virtual, tailwind, dashboard, virtualized-lists, scroll-containers]

# Dependency graph
requires:
  - phase: 09-01
    provides: Per-view DashboardLayout frame whose panes the virtualized lists now grow to fill
provides:
  - Four virtualized lists (CommitList, DecisionsPanel, MigrationThreadPanel, FileHistoryList) grow to fill their pane via min-h-[24rem] flex-1 instead of fixed h-[min(70vh,40rem)] / max-h caps
  - Headers/toolbars stay outside the scroll region with a border-b divider; no clipped header or first row
  - Honest empty-state copy on DecisionsPanel ("No recorded decisions found for this repo.") per EVD-03
affects: [09-dashboard-ui-redesign, ui-checker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Virtualized scroll frame = flex-col section, header outside scroll, ref={parentRef} scroll div carries min-h-[24rem] flex-1 overflow-auto (grows via parent flex, no fixed height cap)"
    - "ROW_HEIGHT / estimateSize / inline row style kept mutually consistent — no row-height change so constants untouched"

key-files:
  created: []
  modified:
    - packages/dashboard/src/components/CommitList.tsx
    - packages/dashboard/src/components/MigrationThreadPanel.tsx
    - packages/dashboard/src/components/DecisionsPanel.tsx
    - packages/dashboard/src/components/FileHistoryList.tsx

key-decisions:
  - "Row heights unchanged (no vertical-padding edits), so all four ROW_HEIGHT constants (44/64/56/52) and their estimateSize/inline styles were left exactly as-is — the safest way to preserve @tanstack/react-virtual positioning"
  - "Replaced fixed h-[min(70vh,40rem)] (CommitList, MigrationThreadPanel) and max-h-[28rem] (DecisionsPanel) / max-h-64 (FileHistoryList) caps with min-h-[24rem] flex-1 so panes grow with the Plan-01 per-view layouts"
  - "Raised readable metadata from slate-500 to slate-400 (WCAG AA floor per UI-SPEC Color contract); headings bumped to text-lg font-semibold tracking-tight"
  - "DecisionsPanel no-decisions copy set verbatim to the EVD-03 honest-gap string 'No recorded decisions found for this repo.'"

patterns-established:
  - "Presentational scroll-frame fix = container-class + (only if needed) row-height-constant change; fetch/pagination/store/translateY logic untouched"

requirements-completed: [DASH-03, DASH-04]

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 9 Plan 03: Virtualized List Scroll Frames Summary

**Fixed the clipped-header / cramped-list defect on all four virtualized lists — replaced fixed height caps (`h-[min(70vh,40rem)]`, `max-h-[28rem]`, `max-h-64`) with `min-h-[24rem] flex-1` flex-fill so each list grows to fill its pane, kept every header outside the scroll region with a `border-b` divider, and left all virtualization logic (ROW_HEIGHT, estimateSize, translateY positioning) untouched.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-01T11:54:00Z
- **Completed:** 2026-07-01T11:57:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- **CommitList** — replaced fixed `h-[min(70vh,40rem)]` section height; the `ref={parentRef}` scroll div now carries `min-h-[24rem] flex-1 overflow-auto`. Header stays outside the scroll with its `border-b` divider; heading at `text-lg font-semibold tracking-tight`, meta raised to `slate-400`.
- **MigrationThreadPanel** — same flex-fill treatment on its `min-h-[24rem] flex-1 overflow-y-auto` scroll div; "← Back to threads" and meta text raised to `slate-400`; heading bumped to `text-lg font-semibold tracking-tight`.
- **DecisionsPanel** — replaced the `max-h-[28rem]` fixed cap with `min-h-[24rem] flex-1 overflow-y-auto` inside the existing `flex flex-col` container; header (title + count) stays outside the scroll region. Applied the honest-gap empty copy `"No recorded decisions found for this repo."` and raised meta to `slate-400`.
- **FileHistoryList** — replaced its `max-h-64` cap with `min-h-[24rem] flex-1 overflow-auto`; raised row metadata (changeType, committedAt/renamed) from `slate-500` to `slate-400`.
- Preserved all locked surface: pagination/"Load more" logic, `filters` prop, data fetching, drill-store selection, and the absolutely-positioned `translateY` row rendering are unchanged. No `ROW_HEIGHT`/`estimateSize` constant changed (no row-height edits were made).

## Task Commits

Each task was committed atomically (only dashboard files staged):

1. **Task 1: Flex-fill CommitList and MigrationThreadPanel scroll frames** — `0dea1a0` (feat)
2. **Task 2: Flex-fill DecisionsPanel and FileHistoryList; honest empty copy** — `b7554d7` (feat)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) — see final docs commit.

## Files Created/Modified

- `packages/dashboard/src/components/CommitList.tsx` — section drops fixed height; scroll div `min-h-[24rem] flex-1 overflow-auto`; heading + meta restyled.
- `packages/dashboard/src/components/MigrationThreadPanel.tsx` — section drops fixed height; scroll div `min-h-[24rem] flex-1 overflow-y-auto`; heading + meta restyled.
- `packages/dashboard/src/components/DecisionsPanel.tsx` — scroll div `max-h-[28rem]` → `min-h-[24rem] flex-1 overflow-y-auto`; empty-state copy → EVD-03 string; heading + meta restyled.
- `packages/dashboard/src/components/FileHistoryList.tsx` — scroll div `max-h-64` → `min-h-[24rem] flex-1 overflow-auto`; row metadata raised to `slate-400`.

## Verification

- `pnpm --dir packages/dashboard typecheck` → exit 0 (green).
- `pnpm --dir packages/dashboard test` → 5 files, 31 tests passed (green).
- No `h-[min(70vh,40rem)]` remains in CommitList/MigrationThreadPanel; no `max-h-[28rem]` in DecisionsPanel; no `max-h-64` in FileHistoryList.
- Each `ref={parentRef}` scroll div carries `min-h-[24rem] flex-1 overflow-(y-)auto`; each header sits outside the scroll region with a `border-b` divider.
- ROW_HEIGHT (44/64/56/52), `estimateSize: () => ROW_HEIGHT`, and inline row `style` remain mutually consistent (unchanged).
- No change to pagination, `filters` prop, data fetching, selection, or translateY row positioning.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

- T-09-03 (Tampering): accepted as planned — presentational restyle of read-only virtualized lists over pre-built artifacts (SCALE-02). No new inputs, network calls, or writes; pagination/fetch/virtualizer logic preserved.
- T-09-SC (Package legitimacy): N/A — zero package installs.

## Manual Verification (deferred to UI-checker / 09-VALIDATION.md)

- Commit list fills its pane width and height; full header + first row visible; virtualization scrolls smoothly with no overlapping/gapped rows.
- Decisions and Open-work lists show no clipped first row; empty Decisions state reads "No recorded decisions found for this repo."
- Metadata renders in `slate-400` (not `slate-500`) on card surfaces.

## Self-Check: PASSED

- FOUND: packages/dashboard/src/components/CommitList.tsx (min-h-[24rem] flex-1; no h-[min(70vh,40rem)])
- FOUND: packages/dashboard/src/components/MigrationThreadPanel.tsx (min-h-[24rem] flex-1)
- FOUND: packages/dashboard/src/components/DecisionsPanel.tsx (min-h-[24rem] flex-1; EVD-03 copy)
- FOUND: packages/dashboard/src/components/FileHistoryList.tsx (min-h-[24rem] flex-1)
- FOUND: commit 0dea1a0
- FOUND: commit b7554d7
