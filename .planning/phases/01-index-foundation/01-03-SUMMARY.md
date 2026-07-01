---
phase: 01-index-foundation
plan: 03
subsystem: ingestion
tags: [es-git, revwalk, conventional-commits, diff]

requires:
  - plan: 01-01
    provides: synthetic fixture builder
  - plan: 01-02
    provides: CommitRecord and FileChange Zod schemas
provides:
  - es-git revwalk streaming (walkFromHead, walkRange)
  - Pure commit parser with conventional-commit extraction
  - File diff with rename detection and binary flag
affects: [01-05, 01-07, 01-08]

tech-stack:
  added: []
  patterns: [pure parse functions, streaming revwalk generator, blob.isBinary fallback]

key-files:
  created:
    - packages/core/src/ingestion/git-walk.ts
    - packages/core/src/ingestion/commit-parse.ts
    - packages/core/src/ingestion/diff.ts
    - packages/core/src/ingestion/index.ts

requirements-completed: [INGX-02]

duration: 30min
completed: 2026-07-01
---

# Phase 1 Plan 03 Summary

**es-git ingestion primitives: streaming revwalk, pure CommitRecord parser, and rename-aware file diffs with binary detection**

## Accomplishments

- `walkFromHead` / `walkRange` stream SHAs via generator without materializing full history
- `parseCommit` extracts author, committer, timestamps, merge parents, conventional-commit fields
- `diffCommit` reports added/modified/deleted/renamed with `findSimilar`; binary via DiffFlags + `blob.isBinary()` fallback

## Verification

- `pnpm vitest run packages/core/src/ingestion` — 8 passed
- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` — pass

## Task Commits

Both tasks landed in one commit (combined feat):

1. **Task 1: revwalk streaming + commit parse** — `d083abc`
2. **Task 2: tree diff + rename detection** — `d083abc`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Parent SHAs via `revparseSingle`**
- **Found during:** Task 1
- **Issue:** es-git 0.7.0 `Commit` has no `parents()` / `parentCount()` accessors
- **Fix:** Enumerate parents with `revparseSingle(\`${sha}^${n}\`)` until NotFound
- **Files modified:** `packages/core/src/ingestion/commit-parse.ts`

**2. [Rule 1 - Bug] Binary flag on added tree diffs**
- **Found during:** Task 2
- **Issue:** `DiffFlags.Binary` unset on `Added` deltas for binary blobs
- **Fix:** Fallback to `repo.getObject(oid).peelToBlob().isBinary()`
- **Files modified:** `packages/core/src/ingestion/diff.ts`

**3. [Rule 3 - Blocking] `Deltas` not iterable in TypeScript**
- **Found during:** Task 2
- **Issue:** `for...of` over `diff.deltas()` fails typecheck
- **Fix:** Generator wrapper using `deltas.next()`
- **Files modified:** `packages/core/src/ingestion/diff.ts`

**4. [Rule 3 - Blocking] Test imports outside `rootDir`**
- **Found during:** Task 1
- **Fix:** Exclude `src/**/*.test.ts` from `packages/core/tsconfig.json` typecheck (vitest still runs them)
- **Files modified:** `packages/core/tsconfig.json`

## Self-Check: PASSED

- FOUND: packages/core/src/ingestion/git-walk.ts
- FOUND: packages/core/src/ingestion/commit-parse.ts
- FOUND: packages/core/src/ingestion/diff.ts
- FOUND: packages/core/src/ingestion/index.ts
- FOUND: packages/core/src/ingestion/commit-parse.test.ts
- FOUND: packages/core/src/ingestion/diff.test.ts
- FOUND: d083abc

---
*Phase: 01-index-foundation*
*Completed: 2026-07-01*
