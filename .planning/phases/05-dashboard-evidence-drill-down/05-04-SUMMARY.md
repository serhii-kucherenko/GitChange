---
phase: 05-dashboard-evidence-drill-down
plan: 04
subsystem: api
tags: [sqlite, hunks, drill-down, react-query, hono, privacy]

requires:
  - phase: 05-01
    provides: Paginated commits API + virtualized CommitList + drill store
provides:
  - Index-time hunks_json capture with privacy redaction
  - GET /api/commits/:sha read-only commit detail
  - CommitDetailPanel + FileHunkView + DrillBreadcrumb UI
affects: [05-03, 05-05, 05-06]

tech-stack:
  added: []
  patterns:
    - "captureDiffHunks at index via es-git diff.print + unified patch parse"
    - "hunks_json column on file_changes (migration 0002)"
    - "Commit detail served from SQLite only — no es-git in server"

key-files:
  created:
    - packages/core/src/ingestion/hunks.ts
    - packages/core/src/read/commit-detail.ts
    - packages/server/src/routes/commit-detail.ts
    - packages/dashboard/src/components/CommitDetailPanel.tsx
    - packages/dashboard/src/components/FileHunkView.tsx
    - packages/dashboard/src/components/DrillBreadcrumb.tsx
    - tests/golden/hunk-capture.test.ts
    - tests/integration/dashboard-commit-detail.test.ts
  modified:
    - packages/core/src/index/process-commit.ts
    - packages/core/src/artifacts/writer.ts
    - packages/dashboard/src/App.tsx

key-decisions:
  - "Per-file diff via es-git pathspecs + print(Patch) at index time only"
  - "Caps: 20 hunks/file, 32KB total patch bytes/file (P5-D-02)"
  - "Hunk evidence refs added alongside file evidence on indexed changes"
  - "Existing .gitchange indexes need re-index for hunks_json data"

patterns-established:
  - "HunkRecord schema: startLine, endLine, patch with applyPrivacy on patch text"
  - "Drill breadcrumb upstream clicks clear downstream drill state"

requirements-completed: [TIME-02, SCALE-02, DASH-01]

duration: 25min
completed: 2026-07-01
---

# Phase 5 Plan 04: Hunk Capture + Commit Drill-Down Summary

**Index-time redacted diff hunks in SQLite power commit→file→hunk drill-down without live git in the server.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 24

## Accomplishments

- `captureDiffHunks` persists privacy-redacted unified diff hunks to `hunks_json` during indexing (migration 0002).
- Evidence union enables `hunk` type; file changes carry hunk evidence refs when hunks exist.
- `GET /api/commits/:sha` returns commit + files with parsed hunks; 404 for unknown sha, 400 for invalid sha.
- Dashboard: selecting a commit opens `CommitDetailPanel`; selecting a file shows `FileHunkView` with monospace patch text and ignored/redacted states.
- `DrillBreadcrumb` shows era (if set) → short sha → file path with upstream navigation.

## Task Commits

1. **Task 1: Index-time hunk capture + migration** - `a356b02`
2. **Task 2: Commit detail API + drill-down panels** - `b5bdebd`
3. **Lint fix (dashboard drill components)** - `f0be98d`

## Files Created/Modified

- `packages/core/src/ingestion/hunks.ts` - captureDiffHunks with caps and applyPrivacy
- `packages/core/migrations/0002_hunks_json.sql` - hunks_json column migration
- `packages/core/src/read/commit-detail.ts` - getCommitDetail SQLite read path
- `packages/server/src/routes/commit-detail.ts` - GET /commits/:sha route
- `packages/dashboard/src/components/CommitDetailPanel.tsx` - commit + file drill UI
- `packages/dashboard/src/components/FileHunkView.tsx` - diff hunk display panel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Hunk evidence in integrity checker**
- **Found during:** Task 1 verification
- **Issue:** `checkEvidenceIntegrity` assertNever tripped on new `hunk` evidence type
- **Fix:** Added `hunk` case validating commitSha + file_change row
- **Files modified:** `packages/core/src/verify/evidence-integrity.ts`
- **Commit:** `a356b02`

## Verification

- `pnpm vitest run packages/core/src/ingestion/hunks.test.ts packages/core/src/read/commit-detail.test.ts tests/golden/hunk-capture.test.ts tests/integration/dashboard-commit-detail.test.ts tests/integration/scale02-server-imports.test.ts` — 12 passed (Node 22)
- `@gitchange/server` has zero es-git imports

## Self-Check: PASSED

- FOUND: packages/core/src/ingestion/hunks.ts
- FOUND: packages/core/src/read/commit-detail.ts
- FOUND: packages/dashboard/src/components/FileHunkView.tsx
- FOUND: .planning/phases/05-dashboard-evidence-drill-down/05-04-SUMMARY.md
- FOUND: a356b02
- FOUND: b5bdebd
