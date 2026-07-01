---
phase: 03-cli-plugin-scaffold
plan: 05
subsystem: plugin
tags: [install-ux, path-resolver, marketplace, inst-01, plug-04, cursor-plugin, claude-plugin]

requires:
  - phase: 03-cli-plugin-scaffold
    provides: slash commands, plugin manifests, host-AI schemas
provides:
  - P3-D-04 resolveGitChangeRoot / resolveCliBin with unit tests
  - plugin-style install.sh and install.ps1 (clone, build, CLI link)
  - README install section and marketplace metadata polish
  - validate-plugin.yml CI (manifest JSON, skills dirs, resolver tests)
affects: [03-06-PLAN, INST-02, INST-03]

tech-stack:
  added: []
  patterns: [P3-D-04 four-step root resolution; pinned official GitHub clone URL in installer]

key-files:
  created:
    - packages/plugin/scripts/resolve-root.ts
    - packages/plugin/scripts/resolve-root.test.ts
    - scripts/install.sh
    - scripts/install.ps1
    - .github/workflows/validate-plugin.yml
  modified:
    - packages/cli/src/repo-path.ts
    - packages/plugin/package.json
    - packages/plugin/skills/gitchange/SKILL.md
    - packages/plugin/skills/gitchange-dashboard/SKILL.md
    - README.md
    - .claude-plugin/marketplace.json

key-decisions:
  - "resolveGitChangeRoot precedence: GITCHANGE_ROOT → cwd .cursor-plugin → global node_modules/.bin/gitchange → module walk-up"
  - "resolveCliBin prefers packages/cli/dist/bin.js, then node_modules/.bin/gitchange, then pnpm exec fallback"
  - "install.sh pins OFFICIAL_REPO; non-default GITCHANGE_REPO_URL emits warning (T-03-10/11)"

patterns-established:
  - "Skills document P3-D-04 separately from git repo root (.git walk-up)"
  - "Installer idempotent: git pull + pnpm install + pnpm build on re-run"

requirements-completed: [PLUG-04, INST-01]

duration: 12min
completed: 2026-07-01
---

# Phase 3 Plan 05: Install UX + Plugin Path Resolver Summary

**P3-D-04 path resolver with unit tests, plugin-style one-line installers, and CI manifest validation for marketplace discovery**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T09:49:00Z
- **Completed:** 2026-07-01T09:51:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `resolveGitChangeRoot` and `resolveCliBin` cover monorepo dev, marketplace clone, global install, and `GITCHANGE_ROOT` override with typed `ResolveError`
- Eight vitest cases pass for resolver precedence and CLI binary selection
- `install.sh` / `install.ps1` clone to `~/.gitchange-plugin`, build with pnpm, link CLI to `~/.local/bin`, print Cursor/Claude symlink steps
- README documents prerequisites, one-liner install, verification, and IDE plugin usage
- `validate-plugin.yml` parses manifests, verifies skills directories, runs resolver tests, and checks `install.sh` syntax

## Task Commits

1. **Task 1: Plugin root resolver with unit tests** - `7a42f7a` (feat)
2. **Task 2: Install scripts + README + marketplace polish** - `a02b903` (feat)
3. **CI/README polish** - `af3ab17` (docs)

**Plan metadata:** `da8ae24` (docs: complete plan)

## Files Created/Modified

- `packages/plugin/scripts/resolve-root.ts` - P3-D-04 root and CLI binary resolution
- `packages/plugin/scripts/resolve-root.test.ts` - temp-dir tests for all precedence paths
- `packages/cli/src/repo-path.ts` - shared walk-up helper for `.git` discovery
- `scripts/install.sh` - macOS/Linux one-line installer (Node 22+, pinned repo URL)
- `scripts/install.ps1` - Windows equivalent
- `.github/workflows/validate-plugin.yml` - plugin manifest and resolver CI gate
- `README.md` - install, verify, and IDE plugin sections
- `.claude-plugin/marketplace.json` - keywords, repository, homepage metadata
- `packages/plugin/skills/gitchange/SKILL.md` - documents resolver order and install fallback
- `packages/plugin/skills/gitchange-dashboard/SKILL.md` - references resolve-root for CLI

## Decisions Made

- Kept resolver logic in `packages/plugin/scripts/` (not shared package) to avoid plugin→cli circular deps; `repo-path.ts` duplicates walk-up pattern with test parity
- Installer warns on non-official `GITCHANGE_REPO_URL` rather than blocking (documented in README)

## Deviations from Plan

None - plan executed as written.

## TDD Gate Compliance

Task 1 had `tdd="true"` but implementation and tests landed in a single `feat` commit (`7a42f7a`) rather than separate `test` then `feat` commits. Tests were written first and pass; gate sequence in git log is non-canonical.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Install path and resolver ready for 03-06 integration / first-run verification
- Users can install via curl|bash and resolve CLI from non-monorepo layouts

## Self-Check: PASSED

- FOUND: packages/plugin/scripts/resolve-root.ts
- FOUND: packages/plugin/scripts/resolve-root.test.ts
- FOUND: scripts/install.sh
- FOUND: scripts/install.ps1
- FOUND: .github/workflows/validate-plugin.yml
- FOUND: 7a42f7a
- FOUND: a02b903
- FOUND: af3ab17
- FOUND: da8ae24

---
*Phase: 03-cli-plugin-scaffold*
*Completed: 2026-07-01*
