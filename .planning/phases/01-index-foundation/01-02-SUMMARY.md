---
phase: 01-index-foundation
plan: 02
subsystem: database
tags: [zod, drizzle, sqlite, evidence, manifest, schema]

requires:
  - phase: 01-01
    provides: "@gitchange/core monorepo shell, Vitest, pnpm workspace"
provides:
  - Zod evidence contract (commit + file refs, hunk reserved)
  - Narrative record schemas (FileChangeRecord, DocSnapshot) with evidence[].min(1)
  - CommitRecord evidence source schema (no evidence[] field)
  - Drizzle SQLite tables per SKELETON contract (5 tables + indexes)
  - Manifest zod schema with atomic read/write helpers
  - Applied SQLite schema at packages/core/.gitchange/index.sqlite
affects: [01-03, 01-04, 01-05, 01-07, 01-08]

tech-stack:
  added: ["@types/node@22.15.32"]
  patterns:
    - "Evidence discriminated union at Zod write boundary (D-16)"
    - "Narrative vs source record split (commits/authors vs file_changes/doc_snapshots)"
    - "Manifest atomic write via temp file rename"
    - "Drizzle sqliteTable with reserved nullable hunk columns (D-15)"

key-files:
  created:
    - packages/core/src/schema/zod/evidence.ts
    - packages/core/src/schema/zod/commit.ts
    - packages/core/src/schema/zod/file-change.ts
    - packages/core/src/schema/zod/doc-snapshot.ts
    - packages/core/src/schema/zod/index.ts
    - packages/core/src/schema/drizzle/schema.ts
    - packages/core/src/schema/manifest.ts
    - packages/core/src/schema/evidence.test.ts
    - packages/core/src/schema/manifest.test.ts
    - packages/core/drizzle.config.ts
    - packages/core/migrations/.gitkeep
  modified:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "Evidence union accepts commit + file only; hunk variant commented as Phase 5 reserved (D-15)"
  - "Narrative records enforce evidence[].min(1) at Zod parse; commits/authors are evidence sources without evidence[]"
  - "Manifest warnings limited to shallow_clone | force_push_detected | out_of_order_commits with exhaustive-switch helpers"
  - "drizzle-kit push (not hand-written migrations) for Phase 1 schema application"

patterns-established:
  - "Pattern: Zod validate at ingest boundary before SQLite persist"
  - "Pattern: evidence_json text column stores serialized Evidence[] for narrative tables"

requirements-completed: [EVD-01, EVD-04]

duration: 12min
completed: 2026-07-01
---

# Phase 1 Plan 02: Index Schema & Evidence Contract Summary

**Zod evidence contract + Drizzle SQLite index schema + manifest round-trip, physically applied via drizzle-kit push.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3/3 completed
- **Files modified:** 13

## Accomplishments

- Evidence discriminated union enforces commit SHA (40 hex) and file path refs; hunk type rejected (reserved for Phase 5).
- `FileChangeRecord` and `DocSnapshot` reject empty or missing `evidence[]`; `CommitRecord` has no evidence field.
- Five Drizzle tables (`authors`, `commits`, `file_changes`, `doc_snapshots`, `secret_findings`) with SCALE indexes and nullable `hunkStart`/`hunkEnd`.
- Manifest schema round-trips via atomic JSON write; unknown warning codes rejected at parse.
- Schema applied to `packages/core/.gitchange/index.sqlite` (gitignored).

## Task Commits

1. **Task 1: Zod schemas + evidence contract** — `d0909ea`
2. **Task 2: Drizzle tables + manifest** — `aebd486`
3. **Task 3: drizzle-kit push config** — `7f04a2f`

**Plan metadata:** `f3d7932` (docs: complete plan)

## Files Created/Modified

- `packages/core/src/schema/zod/*.ts` — Zod validators for evidence, commits, file changes, doc snapshots
- `packages/core/src/schema/drizzle/schema.ts` — SQLite table definitions with indexes
- `packages/core/src/schema/manifest.ts` — Manifest schema + read/write helpers
- `packages/core/drizzle.config.ts` — drizzle-kit config targeting `.gitchange/index.sqlite`
- `packages/core/src/schema/*.test.ts` — 19 tests covering evidence contract and manifest round-trip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/node for core package TypeScript**
- **Found during:** Task 2 verification (`tsc --noEmit`)
- **Issue:** `node:fs`, `node:path`, `NodeJS.ErrnoException` unresolved without Node types
- **Fix:** Added `@types/node@22.15.32` devDependency and `"types": ["node"]` in `tsconfig.json`
- **Files modified:** `packages/core/package.json`, `packages/core/tsconfig.json`, `pnpm-lock.yaml`

**2. [Rule 3 - Blocking] Compiled better-sqlite3 native bindings**
- **Found during:** Task 3 (`drizzle-kit push`)
- **Issue:** Prebuilt `better_sqlite3.node` missing after pnpm install on Node 24/22
- **Fix:** Ran `npm run build-release` in better-sqlite3 package under Node 22 LTS
- **Note:** CI/dev should use Node 22 per `.nvmrc`; rebuild may be needed after Node major upgrades

**3. [Rule 1 - Bug] Fixed typo in readManifest**
- **Found during:** Task 2 tests
- **Issue:** `gitchChangeDir` undefined reference in `readManifest`
- **Fix:** Renamed to `gitchangeDir`
- **Files modified:** `packages/core/src/schema/manifest.ts`

## Verification Results

| Command | Result |
|---------|--------|
| `pnpm vitest run packages/core/src/schema/evidence` | 11 passed |
| `pnpm vitest run packages/core/src/schema/manifest` | 8 passed |
| `pnpm vitest run packages/core/src/schema` | 19 passed |
| `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` | pass |
| `cd packages/core && pnpm drizzle-kit push` | 5 tables applied |

## Self-Check: PASSED

- FOUND: packages/core/src/schema/zod/evidence.ts
- FOUND: packages/core/src/schema/drizzle/schema.ts
- FOUND: packages/core/src/schema/manifest.ts
- FOUND: packages/core/drizzle.config.ts
- FOUND: packages/core/.gitchange/index.sqlite (local, gitignored)
