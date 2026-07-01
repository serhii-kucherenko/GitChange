---
phase: 08-hardening-scale-multi-repo
plan: 04
subsystem: ui
tags: [xyflow, react-flow, graph, dashboard, hono, federation]

requires:
  - phase: 08-03
    provides: RepoBadge, workspace store, drill store repoId routing
provides:
  - GET /api/graph federated temporal graph API
  - readGraph and readGraphUnified core readers
  - TemporalGraphView with era-first lazy expand
  - Fifth intelligence tab (Graph) in dashboard
affects: [08-05]

tech-stack:
  added: ["@xyflow/react@12.11.1", "@testing-library/react", "jsdom"]
  patterns:
    - "Era-first graph render with expand-to-reveal commits via era_contains_commit edges"
    - "Workspace node id prefixing repoId: for federated graph merge"

key-files:
  created:
    - packages/core/src/read/graph.ts
    - packages/core/src/read/unified/graph.ts
    - packages/server/src/routes/graph.ts
    - packages/dashboard/src/components/TemporalGraphView.tsx
    - packages/dashboard/src/components/temporal-graph-model.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/api/client.ts

key-decisions:
  - "User-authorized bypass of @xyflow/react package legitimacy checkpoint"
  - "Pure temporal-graph-model helpers tested without live ReactFlow canvas"
  - "Graph drill uses existing eras API for SelectedEra metadata on timeline switch"

patterns-established:
  - "Graph API DTO maps artifact nodes to drill targets (eraId, commitSha, parentEraId)"
  - "Dashboard graph tab fetches /api/graph only when tab active via react-query"

requirements-completed: [DASH-02]

duration: 25min
completed: 2026-07-01
---

# Phase 8 Plan 4: Temporal Graph UI Summary

**@xyflow/react temporal graph tab reading pre-built temporal-graph.json with federated repoId drill-down into timeline and commit panels**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T06:00:00Z
- **Completed:** 2026-07-01T06:25:00Z
- **Tasks:** 2 (checkpoint auto-approved)
- **Files modified:** 19

## Accomplishments

- Graph read layer (`readGraph`, `readGraphUnified`) and `GET /api/graph` with optional `repoId` filter
- Fifth intelligence tab renders era/inflection nodes first; expanding an era reveals commit children
- Node clicks drill timeline (era/inflection) or commit detail with optional `repoId`; RepoBadge in node detail panel for multi-repo

## Task Commits

1. **Task 1: Graph read API + unified federation** - `0b7d263` (feat)
2. **Task 2: TemporalGraphView + Graph intelligence tab** - `3a376c8` (feat), `5570aa1` (refactor)

**Plan metadata:** `60fade3` (docs: complete plan)

## Files Created/Modified

- `packages/core/src/read/graph.ts` - Single-repo graph DTO reader over temporal-graph.json
- `packages/core/src/read/unified/graph.ts` - Workspace merge with `repoId:` node prefixing
- `packages/server/src/routes/graph.ts` - GET /api/graph route (no es-git)
- `packages/dashboard/src/components/TemporalGraphView.tsx` - React Flow canvas + drill wiring
- `packages/dashboard/src/components/temporal-graph-model.ts` - Era-first visibility and layout helpers
- `packages/dashboard/src/App.tsx` - Graph tab query + main panel integration

## Decisions Made

- Package legitimacy checkpoint auto-approved per user authorization for `@xyflow/react@12.11.1`
- Dashboard component tests mock `@xyflow/react`; model logic tested in pure unit tests
- `drill.ts` unchanged — repoId support already landed in 08-03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dashboard vitest/jsdom setup for TemporalGraphView tests**
- **Found during:** Task 2
- **Issue:** Root vitest config lacked jsdom and React plugin for `.test.tsx` files
- **Fix:** Added `@vitest-environment jsdom` pragma, root testing-library deps, vitest react plugin
- **Files modified:** `vitest.config.ts`, `package.json`, `packages/dashboard/package.json`
- **Verification:** `pnpm exec vitest run packages/dashboard/src/components/*.test.*` passes
- **Committed in:** `3a376c8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure only; no scope change.

## Issues Encountered

- Unified graph test sort assertion corrected for lexicographic id ordering (same node set)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DASH-02 graph surface complete alongside timeline and tours
- Ready for 08-05 remaining hardening work

## Self-Check: PASSED

- FOUND: packages/dashboard/src/components/TemporalGraphView.tsx
- FOUND: packages/server/src/routes/graph.ts
- FOUND: packages/core/src/read/unified/graph.ts
- FOUND: 0b7d263
- FOUND: 3a376c8
- FOUND: 5570aa1

---
*Phase: 08-hardening-scale-multi-repo*
*Completed: 2026-07-01*
