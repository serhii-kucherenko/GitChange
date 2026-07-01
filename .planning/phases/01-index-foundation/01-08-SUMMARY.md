---
phase: 01-index-foundation
plan: 08
subsystem: testing
tags: [vitest, golden-fixtures, sqlite, evidence-integrity, privacy, dogfood]

requires:
  - phase: 01-05
    provides: indexFull orchestrator and .gitchange artifacts
  - phase: 01-06
    provides: freshness warnings and incremental indexing
  - phase: 01-07
    provides: doc snapshots with evidence links
provides:
  - Referential evidence-integrity checker (checkEvidenceIntegrity)
  - Secret-leakage grep on built SQLite bytes and text columns
  - Locked BASIC_SCENARIO ingestion count snapshot
  - Opt-in dogfood smoke test for GitChange self-index
  - PRIV-01 static network-surface grep gate
affects: [02-repository-intelligence, phase-2, scale-03, evd-04]

tech-stack:
  added: []
  patterns:
    - "Golden tests index BASIC_SCENARIO via shared helper"
    - "Verify utilities live in packages/core/src/verify/"
    - "Dogfood gated behind GITCHANGE_DOGFOOD env flag"

key-files:
  created:
    - packages/core/src/verify/evidence-integrity.ts
    - packages/core/src/verify/secret-audit.ts
    - packages/core/src/verify/ingestion-snapshot.ts
    - packages/core/src/verify/test-utils.ts
    - tests/golden/helpers.ts
    - tests/golden/evidence-integrity.test.ts
    - tests/golden/secret-leakage.test.ts
    - tests/golden/ingestion-snapshot.test.ts
    - tests/golden/dogfood.test.ts
  modified:
    - tests/fixtures/scenarios.ts

key-decisions:
  - "Golden tests import verify helpers from @gitchange/core; no direct drizzle-orm imports in tests/golden"
  - "BASIC_SCENARIO secret strings aligned to SECRET_RULES pattern lengths so redaction and findings fire"
  - "Dogfood test skipped in CI unless GITCHANGE_DOGFOOD=1"

patterns-established:
  - "Post-index referential integrity: every evidence[] commit/file ref must resolve in SQLite"
  - "Secret audit: raw index.sqlite bytes plus all text columns scanned for forbidden prefixes"

requirements-completed: [EVD-04, SCALE-03, PRIV-01]

duration: 12min
completed: 2026-07-01
---

# Phase 1 Plan 08: Golden Fixtures Summary

**Referential evidence-integrity checker, secret-leakage grep on built SQLite, locked ingestion snapshot, and opt-in dogfood self-index gate**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T01:19:00Z
- **Completed:** 2026-07-01T01:31:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `checkEvidenceIntegrity` validates every `evidence[]` commit SHA and `{path, commitSha}` file ref resolves in the index (EVD-04)
- Golden secret-leakage test greps raw SQLite bytes and all text columns; confirms metadata-only `secret_findings` for message and doc sources
- Ingestion snapshot locks BASIC_SCENARIO at 7 commits, 1 author, 1 merge, 1 rename, 9 file changes, 2 doc snapshots
- Dogfood test indexes GitChange itself when `GITCHANGE_DOGFOOD=1`; PRIV-01 grep confirms no network imports in `packages/core/src`

## Task Commits

1. **Task 1: evidence-integrity checker + golden test** - `ef8ee1b` (feat)
2. **Task 2: secret-leakage + ignored-path + ingestion-snapshot golden tests** - `bc7e536` (feat)
3. **Task 3: dogfood integration test (opt-in) + full-suite gate** - `22a5f09` (feat)

## Files Created/Modified

- `packages/core/src/verify/evidence-integrity.ts` - Referential integrity checker for narrative evidence links
- `packages/core/src/verify/secret-audit.ts` - SQLite byte and text-column secret prefix scanner
- `packages/core/src/verify/ingestion-snapshot.ts` - Snapshot collector and locked BASIC_SCENARIO counts
- `packages/core/src/verify/test-utils.ts` - Golden-test DB corruption helper
- `tests/golden/*.test.ts` - Golden fixture suite (integrity, secrets, snapshot, dogfood, PRIV-01)
- `tests/fixtures/scenarios.ts` - Secret strings aligned to redaction regex lengths

## Decisions Made

- Golden tests avoid direct `drizzle-orm` imports (pnpm isolation); shared helpers live in `packages/core/src/verify/`
- Dogfood remains opt-in via `GITCHANGE_DOGFOOD` for CI speed (D-11)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BASIC_SCENARIO secrets did not match redaction regex lengths**
- **Found during:** Task 2 (secret-leakage golden test)
- **Issue:** `ghp_` token was 32 chars (needs 36); `AKIA` key was 14 chars (needs 16) — secrets leaked into SQLite and no `secret_findings` rows were created
- **Fix:** Updated `MESSAGE_SECRET`, `DOC_SECRET`, and `IGNORED_SECRET` in `scenarios.ts` to match `SECRET_RULES` patterns
- **Files modified:** `tests/fixtures/scenarios.ts`
- **Verification:** `pnpm vitest run tests/golden/secret-leakage` passes; raw-byte grep returns no hits
- **Committed in:** `bc7e536`

**2. [Rule 3 - Blocking] Drizzle update in corruption helper needed `.run()`**
- **Found during:** Task 1 (corruption detection test)
- **Issue:** Evidence tampering did not persist; integrity check still returned `ok: true`
- **Fix:** Added `.run()` to drizzle update in `corruptFirstFileEvidence`
- **Files modified:** `packages/core/src/verify/test-utils.ts`
- **Verification:** Corruption test passes
- **Committed in:** `ef8ee1b`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for golden tests to enforce trust guarantees. No scope creep.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 Index Foundation complete — all 8 plans shipped
- Golden fixture safety net in place for Phase 2 intelligence work atop the index
- Run dogfood locally before milestones: `GITCHANGE_DOGFOOD=1 pnpm vitest run tests/golden/dogfood`

---
*Phase: 01-index-foundation*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: packages/core/src/verify/evidence-integrity.ts
- FOUND: tests/golden/evidence-integrity.test.ts
- FOUND: tests/golden/secret-leakage.test.ts
- FOUND: tests/golden/ingestion-snapshot.test.ts
- FOUND: tests/golden/dogfood.test.ts
- FOUND: ef8ee1b
- FOUND: bc7e536
- FOUND: 22a5f09
