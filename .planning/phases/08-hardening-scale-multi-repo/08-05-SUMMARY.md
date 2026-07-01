---
phase: 08-hardening-scale-multi-repo
plan: 05
subsystem: testing
tags: [multi-repo, e2e, workspace-integrity, dash-02, scale-01]

requires:
  - phase: 08-01
    provides: SCALE incremental indexing + benchmark
  - phase: 08-03
    provides: federated APIs with repoId attribution
  - phase: 08-04
    provides: temporal graph tab + GET /api/graph
provides:
  - Workspace integrity verifier + golden gate
  - Multi-repo dashboard E2E with incremental re-index assertion
  - DASH-02 acceptance E2E (timeline + graph + tours)
affects: [v1.0-milestone-close, verification]

tech-stack:
  added: []
  patterns:
    - "checkWorkspaceIntegrity gates multi-repo manifest, links, and repoId attribution"
    - "E2E harness uses workspace --cwd from monorepo root with ephemeral ports"

key-files:
  created:
    - packages/core/src/verify/workspace-integrity.ts
    - tests/golden/workspace-evidence-integrity.test.ts
    - tests/integration/dashboard-multi-repo-e2e.test.ts
    - tests/integration/dashboard-dash02-acceptance.test.ts
  modified:
    - packages/cli/src/commands/validate.ts
    - packages/cli/src/commands/serve.ts
    - packages/cli/src/bin.ts
    - packages/core/src/workspace/index-workspace.ts
    - packages/core/src/index.ts

key-decisions:
  - "indexWorkspace skips computeIntelligence when incremental pass indexes zero commits"
  - "workspace CLI subcommands accept --cwd for discovery while pnpm runs from monorepo root"
  - "serve auto-discovers workspace gitchangeDir via findWorkspaceGitchangeDir when local workspace.json absent"

patterns-established:
  - "Golden workspace integrity mirrors tours-evidence-integrity two-repo BASIC_SCENARIO pattern"
  - "DASH-02 acceptance is API-only smoke across commits, graph, and tours endpoints"

requirements-completed: [SCALE-01, MULTI-01, MULTI-02, DASH-02]

duration: 7min
completed: 2026-07-01
---

# Phase 8 Plan 05: Milestone Gate Summary

**Multi-repo golden integrity, federated dashboard E2E, and DASH-02 three-surface acceptance close Phase 8 and v1.0**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-01T13:07:00Z
- **Completed:** 2026-07-01T13:14:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `checkWorkspaceIntegrity` validates repo paths, manifest repoIds, link refs, unified commit repoId, and tour evidence repoId in multi-repo workspaces
- Golden `workspace-evidence-integrity` test locks two-repo BASIC_SCENARIO with manual cross-repo link
- `gitchange validate` runs workspace integrity when `workspace.json` is present
- Multi-repo E2E: workspace CLI → index → serve → `/api/workspace` + federated commits + repoId filter + 0-commit incremental re-index
- DASH-02 acceptance: single session hits `/api/commits`, `/api/graph`, and `/api/tours` with pre-built fixtures only

## Task Commits

1. **Task 1: Workspace integrity verifier + golden gate** — `ddd48a5` (test), `5024e02` (feat)
2. **Task 2: Multi-repo + DASH-02 acceptance E2E** — `6642db4` (feat)

## Files Created/Modified

- `packages/core/src/verify/workspace-integrity.ts` — Multi-repo provenance verifier
- `packages/core/src/verify/workspace-integrity.test.ts` — Unit coverage for integrity rules
- `tests/golden/workspace-evidence-integrity.test.ts` — Golden gate for two-repo workspace
- `tests/integration/dashboard-multi-repo-e2e.test.ts` — MULTI-01/02 + SCALE-01 E2E
- `tests/integration/dashboard-dash02-acceptance.test.ts` — DASH-02 three-surface acceptance
- `packages/cli/src/commands/validate.ts` — Workspace integrity gate
- `packages/cli/src/commands/serve.ts` — Workspace gitchangeDir auto-discovery
- `packages/cli/src/bin.ts` — `--cwd` on workspace subcommands
- `packages/core/src/workspace/index-workspace.ts` — Skip intelligence recompute on 0-commit pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Skip intelligence recompute on unchanged HEAD workspace index**
- **Found during:** Task 2
- **Issue:** Second `workspace index` failed with FOREIGN KEY constraint because `computeIntelligence` re-ran on zero new commits
- **Fix:** `indexWorkspace` only calls `computeIntelligence` when `commitsIndexed > 0` (unless `rebuildIntelligence`)
- **Files modified:** `packages/core/src/workspace/index-workspace.ts`, `packages/core/src/workspace/index-workspace.test.ts`
- **Commit:** `6642db4`

**2. [Rule 2 - Missing critical functionality] Workspace CLI `--cwd` for E2E harness**
- **Found during:** Task 2
- **Issue:** E2E could not run `pnpm` from monorepo root while workspace discovery needs repo directory
- **Fix:** Added `--cwd` option to all `gitchange workspace` subcommands
- **Files modified:** `packages/cli/src/bin.ts`, `tests/integration/dashboard-multi-repo-e2e.test.ts`
- **Commit:** `6642db4`

## Self-Check: PASSED

- FOUND: packages/core/src/verify/workspace-integrity.ts
- FOUND: tests/golden/workspace-evidence-integrity.test.ts
- FOUND: tests/integration/dashboard-multi-repo-e2e.test.ts
- FOUND: tests/integration/dashboard-dash02-acceptance.test.ts
- FOUND: commit ddd48a5
- FOUND: commit 5024e02
- FOUND: commit 6642db4
