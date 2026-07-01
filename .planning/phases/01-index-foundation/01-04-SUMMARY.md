---
phase: 01-index-foundation
plan: 04
subsystem: security
tags: [privacy, minimatch, redaction, gitchangeignore, secrets]

requires:
  - phase: 01-02
    provides: "Schema contract; secret_findings table reserved for downstream persistence"
provides:
  - Default .gitchangeignore template (D-10)
  - minimatch-based IgnoreMatcher with repo file loader
  - Data-driven secret redaction with ruleId-only findings (D-08)
  - applyPrivacy gate composing ignore + redaction (D-07/D-09)
affects: [01-05, 01-07, 01-08]

tech-stack:
  added: []
  patterns:
    - "Last-match-wins gitignore negation via minimatch (no hand-rolled glob engine)"
    - "Fresh RegExp per redact() call to avoid /g lastIndex state bugs"
    - "Ignored paths → content null; secrets → «redacted»; commits never dropped (D-09)"

key-files:
  created:
    - packages/core/src/privacy/default-gitchangeignore.ts
    - packages/core/src/privacy/gitchangeignore.ts
    - packages/core/src/privacy/redaction.ts
    - packages/core/src/privacy/index.ts
    - packages/core/src/privacy/gitchangeignore.test.ts
    - packages/core/src/privacy/redaction.test.ts
  modified: []

key-decisions:
  - "Secret rules stored as {id, source, flags} and compiled per call to avoid global regex state"
  - "applyPrivacy short-circuits on ignored paths without running redaction pass"
  - "findings[] carries ruleId only — raw secret values never persisted (D-08)"

patterns-established:
  - "Pattern: privacy gate is pure/local — no network imports or calls (PRIV-01)"
  - "Pattern: metadata-only for .gitchangeignore matches; redaction for everything else"

requirements-completed: [PRIV-01, PRIV-02, PRIV-03]

duration: 4min
completed: 2026-07-01
---

# Phase 1 Plan 04: Privacy Gate Summary

**minimatch-based .gitchangeignore matcher with shipped default template plus data-driven secret redaction preserving commit metadata.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-01T07:48:53Z
- **Completed:** 2026-07-01T07:51:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 6

## Accomplishments

- `DEFAULT_GITCHANGEIGNORE` ships five D-10 patterns (`.env*`, `**/secrets/**`, `*credentials*`, `*.pem`, `*.key`).
- `loadIgnore(repoRoot)` reads `.gitchangeignore` (skipping blanks/comments) or falls back to defaults.
- `createIgnoreMatcher` evaluates globs via minimatch with `!` negation and last-match-wins ordering.
- `redact()` covers AWS keys, GitHub PATs, OpenAI keys, private key headers, and generic token/password patterns.
- `applyPrivacy()` drops content to `null` for ignored paths; redacts secrets on other paths without signaling commit drop.
- 19 Vitest tests green across ignore + redaction modules.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: .gitchangeignore matcher + default template** — `a42611d` (test), `c8aab06` (feat)
2. **Task 2: secret redaction gate** — `c3798c5` (test), `2d054e9` (feat)

## Files Created/Modified

- `packages/core/src/privacy/default-gitchangeignore.ts` — Default ignore pattern list (D-10)
- `packages/core/src/privacy/gitchangeignore.ts` — `loadIgnore`, `createIgnoreMatcher`, `IgnoreMatcher`
- `packages/core/src/privacy/redaction.ts` — `SECRET_RULES`, `redact`, `applyPrivacy`
- `packages/core/src/privacy/index.ts` — Barrel export for privacy modules
- `packages/core/src/privacy/gitchangeignore.test.ts` — Ignore matcher golden tests
- `packages/core/src/privacy/redaction.test.ts` — Redaction + applyPrivacy golden tests

## Decisions Made

- Compiled secret regexes per `redact()` invocation to prevent `/g` `lastIndex` bugs across repeated calls.
- `applyPrivacy` skips redaction when path is ignored — content set to `null` immediately (D-07).
- No network access: modules use only `node:fs`, `node:path`, `node:os`, and `minimatch` (PRIV-01).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` fails on pre-existing `packages/core/src/ingestion/_probe.ts` errors from Plan 03 (out of scope for Plan 04). Privacy modules themselves introduce no new type errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Privacy gate modules are pure and ready for Plan 05 pipeline insertion before Zod/write boundary.
- Plan 08 should add CI grep on fixture SQLite for leaked `AKIA`/`ghp_`/`sk-`/`BEGIN ... PRIVATE KEY` per threat model T-04-01.

## Self-Check: PASSED

- FOUND: packages/core/src/privacy/default-gitchangeignore.ts
- FOUND: packages/core/src/privacy/gitchangeignore.ts
- FOUND: packages/core/src/privacy/redaction.ts
- FOUND: packages/core/src/privacy/index.ts
- FOUND: packages/core/src/privacy/gitchangeignore.test.ts
- FOUND: packages/core/src/privacy/redaction.test.ts
- FOUND: a42611d
- FOUND: c8aab06
- FOUND: c3798c5
- FOUND: 2d054e9

---
*Phase: 01-index-foundation*
*Completed: 2026-07-01*
