---
phase: 03-cli-plugin-scaffold
plan: 02
subsystem: api
tags: [hono, localhost, cli, serve, status, snapshot-api]

requires:
  - phase: 03-cli-plugin-scaffold
    provides: gitchange index CLI, getRepoSnapshot stub, @gitchange/server package shell
provides:
  - Hono localhost server with GET /api/health and GET /api/snapshot
  - gitchange serve and gitchange status CLI commands
  - Extended getRepoSnapshot with intelligence + dashboard highlights
  - Integration tests for serve/status on BASIC_SCENARIO
affects: [03-03-PLAN, 03-04-PLAN, 03-05-PLAN]

tech-stack:
  added: [hono@4.12.27, @hono/node-server@2.0.6]
  patterns: [localhost-only bind 127.0.0.1, Zod validation at API boundary, read-only snapshot from pre-built index]

key-files:
  created:
    - packages/server/src/app.ts
    - packages/server/src/routes/snapshot.ts
    - packages/server/src/start.ts
    - packages/cli/src/commands/serve.ts
    - packages/cli/src/commands/status.ts
    - tests/integration/cli-serve-status.test.ts
  modified:
    - packages/core/src/read/snapshot.ts
    - packages/core/src/index.ts
    - packages/cli/src/bin.ts
    - packages/server/src/index.ts
    - packages/server/package.json
    - packages/cli/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Default serve bind 127.0.0.1:9876 with warning when --host 0.0.0.0"
  - "Snapshot API returns 404 { error: not_indexed } when manifest missing"
  - "Highlights slice top 5 churn files and top 3 expertise topics for dashboard cards"

patterns-established:
  - "Server read-only: getRepoSnapshot only; no es-git or write paths in Hono layer"
  - "CLI delegates HTTP to @gitchange/server startServer"

requirements-completed: [PLUG-03]

duration: 12min
completed: 2026-07-01
---

# Phase 3 Plan 02: Hono Server + Serve/Status Summary

**Localhost Hono API on 127.0.0.1:9876 with `/api/snapshot`, plus `gitchange serve` and `gitchange status` CLI commands**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T02:31:00Z
- **Completed:** 2026-07-01T02:36:00Z
- **Tasks:** 2 (checkpoint auto-approved)
- **Files modified:** 14

## Accomplishments

- `@gitchange/server` Hono app with `/api/health` and `/api/snapshot` (Zod-validated JSON)
- `gitchange serve` binds `127.0.0.1` by default; `gitchange status` prints index freshness and stats
- `getRepoSnapshot` extended with parsed `intelligence.json` and dashboard highlights
- Passing integration test covering status output, snapshot API, and localhost-only bind

## Task Commits

1. **Task 1: Failing tests for serve and status** - `74d04bf` (test)
2. **Task 2: Hono server + serve/status commands** - `7598172` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/server/src/app.ts` — `createApp({ gitchangeDir })` with health + snapshot routes
- `packages/server/src/routes/snapshot.ts` — GET `/snapshot` with Zod response validation
- `packages/server/src/start.ts` — `startServer` using `@hono/node-server`
- `packages/cli/src/commands/serve.ts` — `--repo`, `--port`, `--gitchange-dir`, `--host`
- `packages/cli/src/commands/status.ts` — human-readable index status table; exit 1 if not indexed
- `packages/core/src/read/snapshot.ts` — intelligence parse + top churn/expertise highlights
- `tests/integration/cli-serve-status.test.ts` — E2E serve/status on BASIC_SCENARIO

## Decisions Made

- Exported `ManifestSchema` from core for server-side response validation
- Expertise highlight `label` uses topic string (no separate label in intelligence artifact)
- Hono checkpoint auto-approved; hono@4.12.27 and @hono/node-server@2.0.6 verified on npm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed macOS lsof argument syntax in bind-address test**
- **Found during:** Task 2 verification
- **Issue:** `lsof -iTCP :port` fails on macOS; requires `-iTCP:port` without space
- **Fix:** Updated integration test lsof invocation
- **Files modified:** `tests/integration/cli-serve-status.test.ts`
- **Verification:** Integration test passes
- **Committed in:** `7598172`

**2. [Rule 3 - Blocking] Node 22 required for better-sqlite3 native module in tests**
- **Found during:** Task 1 RED run
- **Issue:** Default Node 24 could not load better-sqlite3 compiled for Node 22
- **Fix:** Run tests with Node 22.22.0 (`pnpm rebuild better-sqlite3` under Node 22)
- **Verification:** Both cli-index and cli-serve-status tests pass on Node 22

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Test-environment fixes only; no API or CLI behavior changes.

## Issues Encountered

None beyond Node version mismatch for native module (documented above).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/api/snapshot` contract ready for minimal dashboard (Plan 03-03)
- `gitchange serve` can be launched by dashboard skill after index
- Run integration tests with Node 22.x

## Self-Check: PASSED

- FOUND: packages/server/src/app.ts
- FOUND: packages/cli/src/commands/serve.ts
- FOUND: packages/cli/src/commands/status.ts
- FOUND: 74d04bf
- FOUND: 7598172

---
*Phase: 03-cli-plugin-scaffold*
*Completed: 2026-07-01*
