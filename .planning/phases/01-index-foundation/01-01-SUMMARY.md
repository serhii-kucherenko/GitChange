---
phase: 01-index-foundation
plan: 01
subsystem: infra
tags: [pnpm, turborepo, vitest, typescript, fixtures]

requires: []
provides:
  - pnpm + Turborepo monorepo with @gitchange/core package shell
  - Root Vitest config with area-scoped test runs
  - Programmatic synthetic git repo fixture builder (BASIC_SCENARIO)
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08]

tech-stack:
  added: [pnpm, turbo, vitest, typescript, biome, es-git, better-sqlite3, drizzle-orm, zod]
  patterns: [synthetic fixture repos at test setup, turbo-filtered package tests]

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - vitest.config.ts
    - packages/core/src/index.ts
    - tests/fixtures/builder.ts
    - tests/fixtures/scenarios.ts
  modified:
    - .gitignore

key-decisions:
  - "Core package test script delegates to root vitest via pnpm --dir ../.. for correct path resolution"
  - "Shallow clones use file:// URL because git ignores --depth on local path clones"
  - "Fixture git operations use execFileSync only (no shell interpolation)"

patterns-established:
  - "Synthetic repos built in os.tmpdir() with pinned author/committer identity and deterministic dates"
  - "BASIC_SCENARIO covers merge, rename, conventional commits, ignored .env, commit-message secret, docs/leak.md secret"

requirements-completed: [SCALE-03]

duration: 25min
completed: 2026-07-01
---

# Phase 1 Plan 01 Summary

**pnpm monorepo with @gitchange/core shell, green Vitest loop, and deterministic synthetic git fixture builder for golden tests**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 15+

## Accomplishments

- Scaffolded pnpm + Turborepo workspace with `@gitchange/core` and Phase 1 dependencies
- Native modules (`es-git`, `better-sqlite3`) load successfully under Node 24 (`.nvmrc` pins 22 for CI)
- Root Vitest config with smoke test; `turbo test --filter=@gitchange/core` passes
- `buildRepo(BASIC_SCENARIO)` produces 7-commit repo with merge, rename, secrets, and shallow-clone support

## Files Created/Modified

- `package.json`, `pnpm-workspace.yaml`, `turbo.json` — monorepo orchestration
- `packages/core/` — Node-only core package shell with `CORE_SCHEMA_VERSION`
- `tests/fixtures/builder.ts` — programmatic git repo builder
- `tests/fixtures/scenarios.ts` — canonical `BASIC_SCENARIO`

## Decisions Made

- Core `test` script runs vitest from repo root (`pnpm --dir ../.. exec vitest run`) so include globs resolve correctly
- `shallowCloneOf` uses `file://${repo.dir}` because plain local clones ignore `--depth`

## Deviations from Plan

None — plan executed as written with minor implementation details for vitest cwd and shallow clone protocol.

## Issues Encountered

- Vitest run from `packages/core` cwd could not resolve test globs — fixed by delegating to root vitest
- `git clone --depth` on local paths does not create shallow repos — fixed with `file://` URL

## Next Phase Readiness

- Wave 2 (01-02) unblocked: Zod schemas, Drizzle tables, manifest, drizzle-kit push
- Fixture builder ready for ingestion and golden tests in later plans

---
*Phase: 01-index-foundation*
*Completed: 2026-07-01*
