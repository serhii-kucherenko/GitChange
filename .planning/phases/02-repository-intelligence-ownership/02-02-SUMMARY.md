---
phase: 02-repository-intelligence-ownership
plan: 02
subsystem: intelligence
tags: [es-git, simple-git, blame, ownership, sqlite]

requires:
  - phase: 02-repository-intelligence-ownership
    provides: "02-01 walking skeleton — computeIntelligence, intelligence.json schema, file_changes index"
provides:
  - "Line-survival ownership at HEAD via es-git blame with rename/copy tracking"
  - "simple-git fallback for .git-blame-ignore-revs formatting commits"
  - "file_ownership SQLite rows and intelligence.json ownership.files export"
affects: [02-04, 02-05, dashboard-ownership]

tech-stack:
  added: [simple-git@3.36.0]
  patterns:
    - "es-git blame hot path; simple-git porcelain blame when ignore-revs file present"
    - "Merge commits skipped via finalCommitId → origCommitId remap"
    - "Aggregate counts only — no blamed line text persisted"

key-files:
  created:
    - packages/core/src/intelligence/ownership/blame.ts
    - packages/core/src/intelligence/ownership/aggregate.ts
    - packages/core/src/intelligence/ownership/ignore-revs.ts
    - packages/core/src/intelligence/ownership/paths.ts
    - packages/core/src/intelligence/ownership/index.ts
  modified:
    - packages/core/src/intelligence/compute.ts
    - packages/core/src/intelligence/export.ts
    - packages/core/src/intelligence/compute.test.ts
    - packages/core/package.json

key-decisions:
  - "Use es-git blameFile with full move/copy tracking for rename attribution (P2-D-01)"
  - "Delegate ignore-revs to git porcelain via simple-git when .git-blame-ignore-revs exists (P2-D-02)"
  - "Remap merge-commit finalCommitId to origCommitId before author aggregation (P2-D-03)"

patterns-established:
  - "Ownership pass runs after churn in computeIntelligence, before co-change/era signals"
  - "Blameable paths from distinct file_changes where not binary and not content_ignored"

requirements-completed: [CONT-04]

duration: 25min
completed: 2026-07-01
---

# Phase 2 Plan 02: Line-Survival Ownership Summary

**HEAD blame with rename tracking, ignore-revs fallback, and per-file ownership in intelligence.json**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T08:28:00Z
- **Completed:** 2026-07-01T08:53:00Z
- **Tasks:** 3 (checkpoint skipped — human approved via orchestrator)
- **Files modified:** 11

## Accomplishments

- OWNSHIP_SCENARIO fixture drives three blame integration tests (rename, ignore-revs, merge skip)
- `computeOwnership` blames indexed text paths at HEAD and writes `file_ownership` rows
- `intelligence.json` exports `ownership.files[]` with authors, line counts, percentages, and file evidence

## Task Commits

1. **Task 1: OWNSHIP_SCENARIO fixture + failing blame tests** - `91ecdce` (test)
2. **Task 2: Blame module — es-git + simple-git ignore-revs** - `0776f71` (feat)
3. **Task 3: Wire ownership into computeIntelligence + export** - `15117ff` (feat)

**Plan metadata:** `22f12d7` (docs: complete plan)

## Files Created/Modified

- `packages/core/src/intelligence/ownership/blame.ts` — es-git blame + simple-git porcelain parser
- `packages/core/src/intelligence/ownership/aggregate.ts` — line counts, merge skip, DB persistence
- `packages/core/src/intelligence/ownership/ignore-revs.ts` — `.git-blame-ignore-revs` loader
- `packages/core/src/intelligence/ownership/paths.ts` — blameable path query from file_changes
- `packages/core/src/intelligence/compute.ts` — calls `computeOwnership` after churn
- `packages/core/src/intelligence/export.ts` — ownership section in intelligence.json

## Decisions Made

- es-git for default blame; simple-git only when ignore-revs file has entries (matches STACK.md)
- Porcelain parser caches author metadata per SHA for grouped hunks
- Evidence on ownership rows uses HEAD sha with `type: "file"` (not per-blame-hunk SHAs)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Native `better-sqlite3` binary required Node 22 rebuild before integration tests could run locally
- Porcelain blame parser needed SHA-keyed author cache so grouped hunks resolve correct emails

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CONT-04 satisfied; ready for 02-04 per-era ownership timelines
- `file_ownership` table populated; export contract stable for dashboard consumption

## Self-Check: PASSED

---
*Phase: 02-repository-intelligence-ownership*
*Completed: 2026-07-01*
