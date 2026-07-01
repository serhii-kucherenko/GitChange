---
phase: 08-hardening-scale-multi-repo
plan: 03
subsystem: api
tags: [multi-repo, federation, workspace, repoId, tours, commits]

requires:
  - phase: 08-02
    provides: workspace.json registry and per-repo indexing
provides:
  - Unified commit merge with repoId attribution and sort key
  - Unified tour merge with namespaced ids and stop repoId
  - GET /api/workspace for dashboard repo picker
  - RepoBadge UI on commits and tour stops
affects:
  - 08-04
  - graph federation
  - dashboard drill-down

tech-stack:
  added: []
  patterns:
    - "Read-only federation overlay — no SQLite schema merge"
    - "Sort key (committedAt desc, repoId asc, sha desc) for cross-repo commits"
    - "repoId: prefixed tour/chapter/stop ids in multi-repo mode"

key-files:
  created:
    - packages/core/src/read/unified/commits.ts
    - packages/core/src/read/unified/tours.ts
    - packages/core/src/read/unified/workspace-context.ts
    - packages/server/src/routes/workspace.ts
    - packages/dashboard/src/components/RepoBadge.tsx
    - packages/dashboard/src/store/workspace.ts
  modified:
    - packages/core/src/schema/zod/evidence.ts
    - packages/server/src/routes/commits.ts
    - packages/server/src/routes/tours.ts
    - packages/dashboard/src/App.tsx

key-decisions:
  - "Federation stays read-only over per-repo SQLite indexes — no cross-repo narrative inference"
  - "repoId assigned server-side from workspace registry; omitted in single-repo API responses"
  - "Era timeline shows primary-repo badge until federated era merge in 08-04"

patterns-established:
  - "listCommitsUnified / listToursUnified fan-out from WorkspaceReadContext"
  - "Drill store carries selectedRepoId for federated commit detail routing"

requirements-completed: [MULTI-01, MULTI-02]

duration: 18min
completed: 2026-07-01
---

# Phase 8 Plan 3: Federation Read Layer Summary

**Unified commit and tour APIs with explicit repoId attribution, workspace endpoint, and dashboard RepoBadge filtering across multi-repo workspaces**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T05:47:00Z
- **Completed:** 2026-07-01T06:05:00Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments

- Optional `repoId` on all Evidence variants (backward compatible)
- `listCommitsUnified` merges per-repo commit pages with P8-D-09 sort key and unified cursor
- `mergeToursForWorkspace` namespaces tour/stop ids and attaches repoId to stops
- `GET /api/workspace` plus repo-aware `/api/commits` and `/api/tours`
- Dashboard repo filter bar, RepoBadge on commit rows and tour stops, drill routing by repoId

## Task Commits

1. **Task 1: repoId on Evidence + unified commit merge** - `ba66086` (feat)
2. **Task 2: Unified tours + server/dashboard repo attribution** - `615cb93` (feat)

## Files Created/Modified

- `packages/core/src/read/unified/commits.ts` - K-way merge of per-repo commit lists
- `packages/core/src/read/unified/tours.ts` - Workspace tour federation with id prefixing
- `packages/core/src/read/unified/workspace-context.ts` - Workspace registry resolution
- `packages/server/src/routes/workspace.ts` - Workspace metadata API
- `packages/dashboard/src/components/RepoBadge.tsx` - Repo label chip component
- `packages/dashboard/src/store/workspace.ts` - Selected repo filter state

## Decisions Made

- Federation is read-only overlay; no SQLite schema changes per P8-D-06
- Cross-repo links surface as description notes on tours — no auto-created cross-repo narratives
- Era timeline badge shows primary repo only until era federation lands in 08-04

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exhaustive Evidence switch updates after repoId field**
- **Found during:** Task 2 (typecheck)
- **Issue:** Adding optional `repoId` broke `assertNever` exhaustiveness in verify modules
- **Fix:** Added `interview`/`hunk` cases where missing; fixed interview merge path narrowing
- **Files modified:** evidence-integrity.ts, intelligence-integrity.ts, semantic-integrity.ts, interviews/merge.ts, merge-agent-output.ts, decisions route
- **Committed in:** `615cb93`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for TypeScript correctness after Evidence schema extension. No scope creep.

## Issues Encountered

- Core integration tests time out at 5s default when indexing two repos in parallel CI load; targeted vitest runs with 60s timeout pass

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MULTI-02 federation read layer ready for 08-04 temporal graph tab with namespaced node ids
- Commit/tour drill-down routes correct gitchangeDir via repoId query param

## Self-Check

- FOUND: packages/core/src/read/unified/commits.ts
- FOUND: packages/core/src/read/unified/tours.ts
- FOUND: packages/server/src/routes/workspace.ts
- FOUND: packages/dashboard/src/components/RepoBadge.tsx
- FOUND: ba66086
- FOUND: 615cb93

## Self-Check: PASSED

---
*Phase: 08-hardening-scale-multi-repo*
*Completed: 2026-07-01*
