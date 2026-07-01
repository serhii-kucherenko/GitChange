---
phase: 03-cli-plugin-scaffold
plan: 01
subsystem: cli
tags: [commander, cli, monorepo, integration-test, gitchange-index]

requires:
  - phase: 01-index-foundation
    provides: indexFull, indexIncremental, manifest read/write, SQLite store
  - phase: 02-repository-intelligence-ownership
    provides: computeIntelligence, intelligence.json artifact
provides:
  - @gitchange/cli package with gitchange index command
  - Package shells for server, dashboard, plugin
  - getRepoSnapshot read helper for server plan 03-02
  - E2E integration test on BASIC_SCENARIO fixture
affects: [03-02-PLAN, 03-03-PLAN, 03-04-PLAN, 03-05-PLAN, 03-06-PLAN]

tech-stack:
  added: [commander@15.0.0]
  patterns: [P3-D-02 index always runs computeIntelligence, manifest-gated full vs incremental]

key-files:
  created:
    - packages/cli/src/bin.ts
    - packages/cli/src/commands/index.ts
    - packages/cli/src/repo-path.ts
    - packages/core/src/read/snapshot.ts
    - packages/server/package.json
    - packages/dashboard/package.json
    - packages/plugin/package.json
    - tests/integration/cli-index.test.ts
  modified:
    - packages/core/src/index.ts
    - pnpm-lock.yaml

key-decisions:
  - "CLI always calls computeIntelligence after successful index (P3-D-02), overriding library rebuildIntelligence default"
  - "resolveRepoPath walks up from cwd or --repo path until .git directory found"
  - "Integration tests spawn tsx on packages/cli/src/bin.ts before dist build is required"

patterns-established:
  - "Thin CLI wrapper: all git/SQLite work delegated to @gitchange/core"
  - "Four-package Phase 3 layout: cli, server, dashboard, plugin"

requirements-completed: [PLUG-03]

duration: 15min
completed: 2026-07-01
---

# Phase 3 Plan 01: CLI Index Walking Skeleton Summary

**`gitchange index` runs full or incremental indexing plus intelligence on any local repo, producing `.gitchange/manifest.json` and `intelligence.json`**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-01T02:23:00Z
- **Completed:** 2026-07-01T02:27:00Z
- **Tasks:** 2 (checkpoint auto-approved)
- **Files modified:** 20

## Accomplishments

- `@gitchange/cli` with commander-based `gitchange index` wired to `indexFull`/`indexIncremental` + `computeIntelligence`
- `getRepoSnapshot` read helper exported from core for upcoming Hono server
- Package shells for `@gitchange/server`, `@gitchange/dashboard`, `@gitchange/plugin`
- Passing E2E integration test on `BASIC_SCENARIO` fixture

## Task Commits

1. **Task 1: Failing E2E — gitchange index on fixture repo** - `6663c1a` (test)
2. **Task 2: Implement gitchange index + core read helpers + package shells** - `ce0c338` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/cli/src/bin.ts` — commander program with `index` subcommand
- `packages/cli/src/commands/index.ts` — manifest-gated index + intelligence orchestration
- `packages/cli/src/repo-path.ts` — walk-up `.git` discovery (P3-D-04 partial)
- `packages/core/src/read/snapshot.ts` — manifest + SQLite COUNT stats for server snapshot API
- `tests/integration/cli-index.test.ts` — E2E CLI test via tsx spawn
- `packages/server|dashboard|plugin/package.json` — workspace stubs for parallel Phase 3 plans

## Decisions Made

- Auto-approved commander@15.0.0 npm checkpoint (loop mode / auto_advance)
- Tests require Node 22 per `.nvmrc` for better-sqlite3 native ABI match

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Reason | Resolved by |
|------|--------|-------------|
| `packages/server/src/index.ts` | Placeholder export only | Plan 03-02 |
| `packages/dashboard/package.json` | No sources yet | Plan 03-03 |
| `packages/plugin/package.json` | No skills/schemas yet | Plan 03-04 |

## Issues Encountered

- Native module ABI mismatch when running tests on Node 24 (system default); tests pass on Node 22 after `nvm use 22`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 complete — `gitchange index` E2E proven
- Plan 03-02 can implement Hono server + `serve`/`status` using `getRepoSnapshot`
- Plans 03-03/03-04 can proceed in parallel after 03-02

---
*Phase: 03-cli-plugin-scaffold*
*Completed: 2026-07-01*

## Self-Check: PASSED

- All key files present
- Task commits 6663c1a, ce0c338 verified in git log
