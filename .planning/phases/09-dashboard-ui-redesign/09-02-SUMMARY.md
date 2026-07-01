---
phase: 09-dashboard-ui-redesign
plan: 02
subsystem: ui
tags: [react, vis-timeline, tailwind, css, dashboard, era-timeline]

# Dependency graph
requires:
  - phase: 09-01
    provides: DashboardLayout per-view frame (era timeline rendered in the Timeline view rail/strip)
provides:
  - Era timeline labels truncate cleanly with ellipsis instead of running together across adjacent items
  - Native hover tooltip (vis-timeline item title) revealing the full era name
  - Taller era strip (min-h-[8rem]) for readable axis/item text
affects: [09-dashboard-ui-redesign, era-timeline, ui-checker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vis-timeline native item `title` field for hover tooltips (no React portal, no new dependency)"
    - "Scoped `.era-timeline .vis-item .vis-item-content` CSS override to constrain label boxes"

key-files:
  created: []
  modified:
    - packages/dashboard/src/index.css
    - packages/dashboard/src/components/EraTimeline.tsx

key-decisions:
  - "Era label max-width set to 12rem (reads clean at <=8 eras); left for UI-checker to tune against the legibility target"
  - "Full era name reachable via native vis-timeline item `title` tooltip — no React tooltip/portal, no new dependency"
  - "Axis text color already #94a3b8 (slate-400) at 12px — met spec, no change needed"

patterns-established:
  - "Presentational label-overlap fix = CSS truncation + native title, never a vis-timeline library swap or content-logic change"

requirements-completed: [DASH-02]

# Metrics
duration: 4min
completed: 2026-07-01
---

# Phase 9 Plan 02: Era Timeline Label Truncation Summary

**Fixed the core era-timeline label overlap defect ("Mono Git Schema Ba Plugin distribution & onb") with a scoped `.vis-item-content` ellipsis rule plus a native `title` hover tooltip and a taller strip — no vis-timeline behavior, selection, or badge-injection change.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-01T18:51:00Z
- **Completed:** 2026-07-01T18:53:00Z
- **Tasks:** 1 completed
- **Files modified:** 2

## Accomplishments
- Added an additive `.era-timeline .vis-item .vis-item-content` rule (`max-width: 12rem`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, `padding: 0 8px`) so adjacent era labels truncate to a clean `…` instead of colliding.
- Added `title: era.name` to every vis-timeline item (and to the `TimelineItem` interface) so hover reveals the untruncated era name — using vis-timeline's native tooltip, no new dependency.
- Raised the era strip container from `min-h-[7rem]` to `min-h-[8rem]` per the spec's vertical-room requirement.
- Preserved all locked surface: `formatEraLabel`, the `.open-work-badge*` classes and their HTML generator, and the `select`/`setSelection` selection logic are unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Constrain era label boxes + add native tooltip + raise strip height** - `03a50d0` (fix)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) — see final docs commit.

## Files Created/Modified
- `packages/dashboard/src/index.css` - Added the `.vis-item-content` truncation rule between the `.vis-selected` and `.vis-time-axis` blocks; `.open-work-badge*` classes left intact.
- `packages/dashboard/src/components/EraTimeline.tsx` - Added `title: string` to `TimelineItem`, `title: era.name` in `toTimelineItems`, and bumped the container className `min-h-[7rem]` → `min-h-[8rem]`.

## Verification
- `pnpm --dir packages/dashboard typecheck` → exit 0 (green).
- `pnpm --dir packages/dashboard test` → 5 files, 31 tests passed (green).
- `.era-timeline .vis-item .vis-item-content` rule present with `max-width` + `overflow: hidden` + `text-overflow: ellipsis` + `white-space: nowrap` + `padding: 0 8px`.
- `toTimelineItems` sets `title: era.name` on each item; `formatEraLabel`, open-work badge injection, and `select`/`setSelection` unchanged.
- Container className is `era-timeline min-h-[8rem] …`.
- No new `dangerouslySetInnerHTML`; `open-work-badge-html.ts` untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

- T-09-02 (Injection): Mitigated as required. The only injected HTML remains the existing controlled `open-work-badge-html.ts` template; the new `title` field carries plain-text `era.name`, not HTML. No new `dangerouslySetInnerHTML` introduced.

## Manual Verification (deferred to UI-checker / 09-VALIDATION.md)
- At ≤8 eras, no run-together labels; each item shows its full name or a clean `…`.
- Hovering a truncated era item reveals the full era name via the native tooltip.
- Era strip has vertical room (min-h-[8rem]) with readable axis/item text.

## Self-Check: PASSED
- FOUND: packages/dashboard/src/index.css (truncation rule present)
- FOUND: packages/dashboard/src/components/EraTimeline.tsx (title + min-h-[8rem])
- FOUND: commit 03a50d0
