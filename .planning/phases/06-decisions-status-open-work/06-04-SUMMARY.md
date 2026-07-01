---
phase: 06-decisions-status-open-work
plan: 04
subsystem: ui
tags: [decisions, open-work, hono, react-query, evd-03, virtualized-lists]

requires:
  - phase: 06-02
    provides: Decision miner artifacts and attribution schema
  - phase: 06-03
    provides: Status inferencer and open-work assembly pipeline
provides:
  - GET /api/decisions and GET /api/decisions/:id with EVD-03 gap stripping
  - GET /api/open-work and GET /api/open-work/:id with chronological events
  - DecisionsPanel and OpenThreadsPanel with tab navigation
  - MigrationThreadPanel with commit drill-down wiring
  - OpenWorkBadge component for Phase 6-06 reuse
affects: [06-05, 06-06, 07-tour-player]

tech-stack:
  added: []
  patterns:
    - "Core read helpers load decisions.json / open-work.json from gitchangeDir (no es-git in server)"
    - "Below-threshold decision detail returns gap message only — no summary leak"
    - "Dashboard types duplicated locally — no @gitchange/core in client bundle"
    - "Intelligence tab switcher: Timeline | Decisions | Open work"

key-files:
  created:
    - packages/core/src/read/decisions.ts
    - packages/core/src/read/open-work.ts
    - packages/server/src/routes/decisions.ts
    - packages/server/src/routes/open-work.ts
    - packages/dashboard/src/components/DecisionsPanel.tsx
    - packages/dashboard/src/components/OpenThreadsPanel.tsx
    - packages/dashboard/src/components/MigrationThreadPanel.tsx
    - packages/dashboard/src/components/OpenWorkBadge.tsx
    - tests/integration/decisions-api.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/server/src/app.ts
    - packages/dashboard/src/App.tsx
    - packages/dashboard/src/layout/DashboardLayout.tsx
    - packages/dashboard/src/store/drill.ts
    - packages/dashboard/src/types.ts
    - packages/dashboard/src/api/client.ts

key-decisions:
  - "getDecisionById returns { id, gap, evidence: [] } when isBelowEvidenceThreshold — never paraphrase"
  - "Thread events sanitized via validateFilePath; invalid paths dropped from API output"
  - "Migration thread events displayed newest-first in UI; API returns chronological per TIME-04"

patterns-established:
  - "Drill store extended with selectedDecisionId and selectedThreadId"
  - "Evidence links in DecisionsPanel call setSelectedCommitSha for existing CommitDetailPanel"

requirements-completed: [DEC-02, STAT-02, TIME-04, EVD-03]

duration: 18min
completed: 2026-07-01
---

# Phase 6 Plan 04: Decisions & Open Work Dashboard Summary

**Browse decisions and open threads in the dashboard with honest EVD-03 gaps and migration thread commit drill-down.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 completed
- **Files modified:** 18

## Accomplishments

- Core `listDecisions` / `getDecisionById` and `listOpenWork` / `getOpenWorkThread` read from artifact JSON with pagination, status priority sort, and EVD-03 threshold enforcement.
- Hono routes `GET /api/decisions`, `GET /api/decisions/:id`, `GET /api/open-work`, `GET /api/open-work/:id` registered with Zod response validation.
- Dashboard tab switcher exposes Decisions and Open work panels without breaking era/commit/file drill-down.
- `MigrationThreadPanel` virtualized event list drills to `CommitDetailPanel` via `setSelectedCommitSha`.
- Integration tests seed fixture artifacts, assert gap response shape, and verify thread event SHAs resolve via `/api/commits/:sha`.

## Task Commits

1. **Task 1: Core read queries + Hono API routes** - `6d24282`
2. **Task 2: Decisions + open threads dashboard panels** - `69c6017`
3. **Task 3: Migration thread panel + TIME-04 drill wiring** - `91174b8`

## Files Created/Modified

- `packages/core/src/read/decisions.ts` - Paginated list + detail with gap response
- `packages/core/src/read/open-work.ts` - Thread list/detail with path sanitization
- `packages/server/src/routes/decisions.ts` - Zod-validated decisions API
- `packages/server/src/routes/open-work.ts` - Zod-validated open-work API
- `packages/dashboard/src/components/DecisionsPanel.tsx` - Virtualized browse + detail drawer
- `packages/dashboard/src/components/OpenThreadsPanel.tsx` - Thread list with badges
- `packages/dashboard/src/components/MigrationThreadPanel.tsx` - Event timeline with commit drill
- `packages/dashboard/src/components/OpenWorkBadge.tsx` - Compact status badge
- `tests/integration/decisions-api.test.ts` - API + EVD-03 + SHA resolution tests

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/core/src/read/decisions.ts
- FOUND: packages/server/src/routes/decisions.ts
- FOUND: packages/dashboard/src/components/DecisionsPanel.tsx
- FOUND: packages/dashboard/src/components/MigrationThreadPanel.tsx
- FOUND: tests/integration/decisions-api.test.ts
- FOUND: 6d24282
- FOUND: 69c6017
- FOUND: 91174b8
