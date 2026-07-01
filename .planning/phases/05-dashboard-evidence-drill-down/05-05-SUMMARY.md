---
phase: 05-dashboard-evidence-drill-down
plan: 05
subsystem: ui
tags: [file-history, react-virtual, react-query, sqlite, hono]

requires:
  - phase: 05-01
    provides: Paginated commits API + drill store
  - phase: 05-04
    provides: CommitDetailPanel + FileHunkView drill-down
provides:
  - getFileHistory core read from file_changes
  - GET /api/files/:path/history with traversal guards
  - FileHistoryScrubber + virtualized FileHistoryList UI
affects: [05-06]

tech-stack:
  added: []
  patterns:
    - "Hono :path{.+} route for repo-relative file paths with slashes"
    - "File history cursor tuple committedAt:commitSha:fileChangeId base64url"
    - "selectCommitAndFile drill jump from scrubber to hunk panel"

key-files:
  created:
    - packages/core/src/read/file-history.ts
    - packages/core/src/read/file-history.test.ts
    - packages/server/src/routes/file-history.ts
    - packages/dashboard/src/components/FileHistoryScrubber.tsx
    - packages/dashboard/src/components/FileHistoryList.tsx
    - tests/integration/dashboard-file-history.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/api/client.ts
    - packages/dashboard/src/store/drill.ts
    - packages/dashboard/src/layout/DashboardLayout.tsx

key-decisions:
  - "File history ordered newest-first; API documents order field"
  - "Path match includes oldPath for rename discovery"
  - "Commit detail panel replaces commit list while a commit is selected"

patterns-established:
  - "File history pagination mirrors listCommits cursor semantics with fileChangeId tiebreaker"
  - "Scrubber autocomplete uses snapshot highlights.topChurnFiles paths"

requirements-completed: [TIME-03, DASH-04]

duration: 18min
completed: 2026-07-01
---

# Phase 5 Plan 05: File-Centric History Scrubber Summary

**Indexed file_changes power a virtualized scrubber UI with drill-down into commit hunk evidence — no live git at read time.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 completed
- **Files modified:** 12

## Accomplishments

- `getFileHistory` joins `file_changes` + `commits`, newest-first with cursor pagination and rename `oldPath` matching.
- `GET /api/files/:path/history` returns empty events for unknown paths; rejects `..` and null-byte paths with 400.
- Dashboard sidebar `FileHistoryScrubber` loads history via react-query; `FileHistoryList` virtualizes events (DASH-04).
- Clicking an event calls `selectCommitAndFile` → `CommitDetailPanel` + `FileHunkView` from Plan 05-04.

## Task Commits

1. **Task 1: getFileHistory core + API route** - `1be6bd5` (feat)
2. **Task 2: FileHistoryScrubber UI + drill jump** - `8686223` (feat)

## Files Created/Modified

- `packages/core/src/read/file-history.ts` - Core path query with pagination and path validation helpers
- `packages/server/src/routes/file-history.ts` - Hono route with `:path{.+}` pattern for slash-containing paths
- `packages/dashboard/src/components/FileHistoryScrubber.tsx` - Path input + submit panel
- `packages/dashboard/src/components/FileHistoryList.tsx` - Virtualized touch timeline with infinite scroll
- `tests/integration/dashboard-file-history.test.ts` - API integration against BASIC_SCENARIO fixture

## Decisions Made

- Used Hono `:path{.+}` instead of `*` wildcard — `*` captured empty string for single-segment paths.
- Wired `CommitDetailPanel` in `App.tsx` when a commit is selected (05-04 components existed but were not mounted).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Hono wildcard route returning empty path param**
- **Found during:** Task 1 (API integration tests returned 400 invalid_path)
- **Issue:** `/files/*/history` left `param('*')` empty for encoded file paths
- **Fix:** Switched to `/files/:path{.+}/history` greedy path param
- **Files modified:** `packages/server/src/routes/file-history.ts`
- **Verification:** Integration tests pass
- **Committed in:** `1be6bd5`

**2. [Rule 2 - Missing Critical] Mounted CommitDetailPanel for scrubber drill jump**
- **Found during:** Task 2 (05-04 panel not wired in App.tsx)
- **Issue:** File history click could set drill state but no hunk panel rendered
- **Fix:** Show `CommitDetailPanel` when `selectedCommitSha` is set
- **Files modified:** `packages/dashboard/src/App.tsx`
- **Committed in:** `8686223`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for TIME-03 end-to-end scrubber → hunk flow.

## Issues Encountered

- Tests require Node 22.x — `better-sqlite3` native module fails on Node 24 without rebuild.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- File-centric history entry point complete; ready for Plan 05-06 (confidence UI + PRIV-04 hardening).

## Self-Check: PASSED

- FOUND: packages/core/src/read/file-history.ts
- FOUND: packages/dashboard/src/components/FileHistoryScrubber.tsx
- FOUND: packages/server/src/routes/file-history.ts
- FOUND: tests/integration/dashboard-file-history.test.ts
- FOUND: commit 1be6bd5
- FOUND: commit 8686223

---
*Phase: 05-dashboard-evidence-drill-down*
*Completed: 2026-07-01*
