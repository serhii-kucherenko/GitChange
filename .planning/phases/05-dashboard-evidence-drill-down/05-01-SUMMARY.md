---
phase: 05-dashboard-evidence-drill-down
plan: 01
subsystem: ui
tags: [react-query, react-virtual, zustand, hono, sqlite, cursor-pagination]

requires:
  - phase: 03-cli-plugin-scaffold
    provides: Minimal dashboard SPA, Hono serve, snapshot API
  - phase: 04-era-detection-semantic-pipeline
    provides: Indexed SQLite commits + manifest
provides:
  - GET /api/commits with cursor pagination from SQLite
  - listCommits core read query with author join
  - Virtualized CommitList with useInfiniteQuery
  - zustand drill store scaffold (selectedCommitSha/file/era)
  - DashboardLayout multi-panel shell
  - SCALE-02 grep gate for @gitchange/server
affects:
  - 05-02-PLAN.md
  - 05-03-PLAN.md
  - 05-04-PLAN.md

tech-stack:
  added: ["@tanstack/react-query@5.101.2", "@tanstack/react-virtual@3.14.5", "zustand@5.0.14"]
  patterns:
    - "Cursor pagination: committedAt desc + sha tiebreaker, base64url cursor tuple"
    - "Dashboard duplicates API types locally — no @gitchange/core in client bundle"
    - "Server routes thin-wrap core read functions; SCALE-02 blocks es-git in server"

key-files:
  created:
    - packages/core/src/read/commits.ts
    - packages/server/src/routes/commits.ts
    - packages/dashboard/src/api/client.ts
    - packages/dashboard/src/components/CommitList.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/store/drill.ts
    - tests/integration/dashboard-commits.test.ts
    - tests/integration/scale02-server-imports.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/main.tsx
    - packages/dashboard/package.json

key-decisions:
  - "Skipped package-legitimacy checkpoint per user directive; STACK.md versions installed directly"
  - "RepoSnapshot panel deferred from main layout — IndexStatusCard preserved for DASH-03 partial"
  - "vis-timeline deferred to Plan 05-03 per plan scope"

patterns-established:
  - "Infinite scroll commit list: react-query pages + react-virtual rows with loader sentinel"
  - "Malformed cursor returns 400 invalid_cursor from Hono route"

requirements-completed: [DASH-01, DASH-04, SCALE-02]

duration: 25min
completed: 2026-07-01
---

# Phase 5 Plan 01: Commit List Walking Skeleton Summary

**Paginated `/api/commits` from indexed SQLite with a virtualized dashboard commit panel and zustand drill scaffold**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T03:42:00Z
- **Completed:** 2026-07-01T03:44:00Z
- **Tasks:** 2 (checkpoint skipped)
- **Files modified:** 15

## Accomplishments

- `listCommits` reads commits + authors from SQLite with cursor pagination (default 50, max 200)
- `GET /api/commits` mounted on Hono with Zod response validation and 400 on bad cursors
- Dashboard expanded to two-column layout: IndexStatusCard sidebar + virtualized CommitList
- react-query `useInfiniteQuery` fetches pages; react-virtual renders rows with scroll-triggered pagination
- zustand drill store scaffolds `selectedCommitSha`, `selectedFilePath`, `selectedEraId` with downstream clears
- SCALE-02 integration test asserts zero `es-git` imports in `@gitchange/server`

## Task Commits

1. **Task 1: listCommits core query + commits API integration test** - `dde3887` (feat)
2. **Task 2: Dashboard layout + virtualized CommitList + react-query** - `e3898d7` (feat)

## Files Created/Modified

- `packages/core/src/read/commits.ts` - Cursor-paginated commit list from Drizzle SQLite
- `packages/server/src/routes/commits.ts` - GET /commits route with limit/cursor parsing
- `packages/dashboard/src/components/CommitList.tsx` - Virtualized infinite commit list
- `packages/dashboard/src/store/drill.ts` - Drill-down selection scaffold
- `tests/integration/dashboard-commits.test.ts` - E2E index → serve → paginated commits

## Decisions Made

- User authorized skipping the package-legitimacy checkpoint; installed @tanstack/react-query, react-virtual, zustand at STACK.md versions
- Integration tests require Node 22.x (better-sqlite3 native module ABI)

## Deviations from Plan

### Checkpoint skipped

- **Found during:** Task 0 (package legitimacy gate)
- **Action:** User explicitly directed autonomous install; proceeded without human "approved" reply

Otherwise none — plan executed as written.

## Issues Encountered

- Vitest failed on Node 24 (NODE_MODULE_VERSION mismatch for better-sqlite3); resolved by running tests with Node 22.22.0 per project CI convention

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 05-02 commit search/filter on `listCommits` filters param
- Drill store and layout shell ready for era timeline (05-03) and commit detail panels (05-04)
- DASH-03 partial only (IndexStatusCard); full confidence badges remain in 05-06

## Self-Check: PASSED

- FOUND: packages/core/src/read/commits.ts
- FOUND: packages/server/src/routes/commits.ts
- FOUND: packages/dashboard/src/components/CommitList.tsx
- FOUND: tests/integration/dashboard-commits.test.ts
- FOUND: dde3887
- FOUND: e3898d7

---
*Phase: 05-dashboard-evidence-drill-down*
*Completed: 2026-07-01*
