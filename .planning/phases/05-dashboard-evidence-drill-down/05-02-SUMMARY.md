---
phase: 05-dashboard-evidence-drill-down
plan: 02
subsystem: ui
tags: [sqlite, drizzle, react-query, filters, hono]

requires:
  - phase: 05-dashboard-evidence-drill-down
    provides: listCommits cursor pagination, CommitList, GET /api/commits
provides:
  - CommitListFilters on listCommits (author, path, q, after, before)
  - GET /api/commits filter query params with Zod validation
  - CommitFilterBar dashboard UI wired to useInfiniteQuery
  - Integration tests for filter API on BASIC_SCENARIO
affects:
  - 05-03-PLAN.md
  - 05-04-PLAN.md

tech-stack:
  added: []
  patterns:
    - "Filter bounds use unix seconds at API; SQLite committedAt compared in epoch ms"
    - "LIKE filters use sql template with ESCAPE for wildcard safety (T-05-03)"
    - "useInfiniteQuery queryKey includes filters to reset pagination on change"

key-files:
  created:
    - packages/dashboard/src/components/CommitFilterBar.tsx
    - tests/integration/dashboard-commit-filters.test.ts
  modified:
    - packages/core/src/read/commits.ts
    - packages/core/src/read/commits.test.ts
    - packages/server/src/routes/commits.ts
    - packages/dashboard/src/api/client.ts
    - packages/dashboard/src/components/CommitList.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/App.tsx
    - packages/core/src/index.ts

key-decisions:
  - "after/before API params are unix seconds; core multiplies by 1000 to match indexed committedAt ms"
  - "Path filter uses Drizzle exists subquery on file_changes.path with prefix LIKE"

patterns-established:
  - "Commit filter bar: debounced author (300ms), immediate path/q/date, clear-all resets drill era selection"

requirements-completed: [INGX-06]

duration: 12min
completed: 2026-07-01
---

# Phase 5 Plan 02: Commit Search & Filter Summary

**SQLite-backed commit filters (author, path, message, date range) exposed on `/api/commits` and driven from a dashboard filter bar**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T03:47:00Z
- **Completed:** 2026-07-01T03:54:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `listCommits` supports `CommitListFilters` with parameterized Drizzle WHERE (author LIKE, path EXISTS, message LIKE, date bounds)
- `GET /api/commits` accepts `author`, `path`, `q`, `after`, `before`; invalid dates return 400
- `CommitFilterBar` above commit list with active-filter chip, clear-all, and debounced author input
- `CommitList` resets infinite pagination via `queryKey: ["commits", filters]` and shows distinct empty states
- Core + integration tests cover all five filter dimensions on BASIC_SCENARIO

## Task Commits

1. **Task 1: listCommits filter SQL + API query params** - `4b21742` (feat)
2. **Task 2: CommitFilterBar UI + wire to CommitList** - `44c227b` (feat)

## Files Created/Modified

- `packages/core/src/read/commits.ts` - Filter SQL, LIKE escape, InvalidCommitFilterError
- `packages/server/src/routes/commits.ts` - Query param parsing and Zod filter validation
- `packages/dashboard/src/components/CommitFilterBar.tsx` - Four filter dimensions + clear
- `packages/dashboard/src/components/CommitList.tsx` - Filter-aware query and empty states
- `tests/integration/dashboard-commit-filters.test.ts` - Serve + filter API E2E

## Decisions Made

- API date filters use unix seconds per plan contract; DB `committedAt` is epoch ms from ingestion
- Drizzle `like()` two-arg API required `sql` LIKE … ESCAPE for wildcard mitigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Date filter unit mismatch (seconds vs ms)**
- **Found during:** Task 1 integration tests
- **Issue:** `committedAt` stored as epoch ms; `before`/`after` compared as seconds returned zero rows
- **Fix:** Multiply filter seconds by 1000 in `listCommits` WHERE clauses
- **Files modified:** `packages/core/src/read/commits.ts`, tests
- **Commit:** `4b21742`

**2. [Rule 1 - Bug] Commit row dates displayed incorrectly**
- **Found during:** Task 2
- **Issue:** `formatCommittedAt` multiplied ms timestamps by 1000
- **Fix:** Pass ms directly to `new Date(timestamp)`
- **Files modified:** `packages/dashboard/src/components/CommitList.tsx`
- **Commit:** `44c227b`

**3. [Rule 3 - Blocking] Drizzle like() escape arity**
- **Found during:** Task 1 build
- **Issue:** `like(col, pattern, escape)` not supported in drizzle-orm 0.45.2
- **Fix:** `sql\`${col} LIKE ${pattern} ESCAPE '\\'\`` helper
- **Files modified:** `packages/core/src/read/commits.ts`
- **Commit:** `4b21742`

Otherwise none — plan executed as written.

## Issues Encountered

None blocking.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 05-03 era timeline; filter bar and drill store clear-all hook in place
- Filtered commit list can narrow context before era/file drill-down in 05-04/05-05

## Self-Check: PASSED

- FOUND: packages/dashboard/src/components/CommitFilterBar.tsx
- FOUND: packages/core/src/read/commits.ts
- FOUND: tests/integration/dashboard-commit-filters.test.ts
- FOUND: 4b21742
- FOUND: 44c227b

---
*Phase: 05-dashboard-evidence-drill-down*
*Completed: 2026-07-01*
