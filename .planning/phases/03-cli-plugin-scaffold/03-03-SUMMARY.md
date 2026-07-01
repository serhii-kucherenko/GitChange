---
phase: 03-cli-plugin-scaffold
plan: 03
subsystem: ui
tags: [react, vite, tailwind, hono, serve-static, snapshot-api, spa]

requires:
  - phase: 03-cli-plugin-scaffold
    provides: Hono /api/snapshot, gitchange serve, getRepoSnapshot highlights
provides:
  - Minimal React dashboard SPA at http://127.0.0.1:9876
  - Index status card and repo snapshot from /api/snapshot only
  - Hono serveStatic with SPA fallback; API routes precede static
  - Integration test for dashboard HTML + snapshot API coexistence
affects: [03-04-PLAN, 03-05-PLAN, 03-06-PLAN]

tech-stack:
  added: [react@19.2.7, vite@8.1.2, tailwindcss@4.3.2, @tailwindcss/vite@4.3.2]
  patterns: [client fetches /api/snapshot only, resolveDashboardDist via import.meta.url, turbo ^build pulls dashboard before server]

key-files:
  created:
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/components/IndexStatusCard.tsx
    - packages/dashboard/src/components/RepoSnapshot.tsx
    - packages/dashboard/src/snapshot.ts
    - packages/dashboard/vite.config.ts
    - packages/server/src/static.ts
    - packages/server/src/paths.ts
    - tests/integration/dashboard-snapshot.test.ts
  modified:
    - packages/server/src/app.ts
    - packages/server/src/start.ts
    - packages/cli/src/commands/serve.ts
    - packages/server/package.json

key-decisions:
  - "Dashboard dist resolved from @gitchange/server package layout (../../dashboard/dist), not cwd-relative monorepo paths"
  - "Snapshot 404 maps to empty state prompting gitchange index — no @gitchange/core in client bundle"
  - "Server devDependency on @gitchange/dashboard ensures turbo build orders dashboard before server"

patterns-established:
  - "Dashboard is read-only consumer of /api/snapshot JSON; types duplicated locally in packages/dashboard/src/types.ts"
  - "wireStatic registers API routes first, then serveStatic with index.html fallback"

requirements-completed: [INST-03, PLUG-02]

duration: 12min
completed: 2026-07-01
---

# Phase 3 Plan 03: Minimal Dashboard SPA Summary

**React dashboard at localhost:9876 showing index status and repo snapshot from /api/snapshot, served by Hono static middleware**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T09:30:00Z
- **Completed:** 2026-07-01T09:42:30Z
- **Tasks:** 3 (checkpoint auto-approved, TDD test, implementation)
- **Files modified:** 21

## Accomplishments

- Vite + React 19 + Tailwind v4 dashboard SPA with loading, error, empty, and ready states
- IndexStatusCard shows schema version, indexedAt, last commit, completeness, warning badges
- RepoSnapshot shows commit/file/author counts, top churn files, expertise topics
- Hono `wireStatic` serves `packages/dashboard/dist` at `/` with SPA fallback; `/api/*` unchanged
- Passing integration test: index fixture → serve → GET `/` has `#root`, GET `/api/snapshot` returns 200

## Task Commits

1. **Task 1: Dashboard build + static serve smoke test** - `fdfed75` (test)
2. **Task 2: Minimal dashboard UI + Hono static hosting** - `04e5955` (feat)
3. **Lint fix: snapshot route format** - `6166b1a` (style)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/dashboard/src/App.tsx` — Single-page shell fetching `/api/snapshot` on mount
- `packages/dashboard/src/components/IndexStatusCard.tsx` — Manifest freshness and warnings
- `packages/dashboard/src/components/RepoSnapshot.tsx` — Stats and intelligence highlights
- `packages/server/src/static.ts` — `wireStatic` with serveStatic + index.html fallback
- `packages/server/src/paths.ts` — `resolveDashboardDist()` from installed package layout
- `packages/cli/src/commands/serve.ts` — Passes dashboard dist path to `startServer`
- `tests/integration/dashboard-snapshot.test.ts` — End-to-end serve + static + API test

## Decisions Made

- Client types mirror API shape locally — no workspace import of `@gitchange/core` in dashboard bundle (grep gate passes)
- `@gitchange/dashboard` as server devDependency so `turbo build` builds dashboard before server via `^build`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome format on snapshot route**
- **Found during:** Verification (lint)
- **Issue:** `createSnapshotRoutes` signature failed biome format check
- **Fix:** Collapsed function signature to single line
- **Files modified:** `packages/server/src/routes/snapshot.ts`
- **Commit:** `6166b1a`

**2. [Rule 3 - Blocking] Node 22 required for better-sqlite3 native module**
- **Found during:** Integration test execution on Node 24
- **Issue:** `better-sqlite3` compiled for NODE_MODULE_VERSION 127; Node 24 requires 137
- **Fix:** Ran tests and verification under Node 22.22.0 per STACK.md
- **Verification:** `pnpm vitest run tests/integration/dashboard-snapshot.test.ts` passes on Node 22

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking env)
**Impact on plan:** No scope change; environment alignment with project stack constraint.

## TDD Gate Compliance

- RED: `fdfed75` test commit exists
- GREEN: `04e5955` feat commit follows test commit
- Gate sequence valid

## Issues Encountered

- Integration tests fail on Node 24 due to native module ABI mismatch; project targets Node 22 LTS

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard shell ready for Phase 5 drill-down (timeline, graph, tour)
- Plugin packaging (03-04+) can ship built `dist/` with serve command

## Self-Check: PASSED

- FOUND: packages/dashboard/src/App.tsx
- FOUND: packages/server/src/static.ts
- FOUND: tests/integration/dashboard-snapshot.test.ts
- FOUND: fdfed75
- FOUND: 04e5955
- FOUND: 6166b1a

---
*Phase: 03-cli-plugin-scaffold*
*Completed: 2026-07-01*
