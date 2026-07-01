---
phase: 3
slug: cli-plugin-scaffold
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for CLI, plugin packaging, install UX, and first-run flow.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Node version** | 22.x LTS (native `better-sqlite3` / `es-git` addons) |
| **Quick run command** | `pnpm vitest run tests/integration/<area>.test.ts` |
| **Full suite command** | `pnpm turbo test --filter=@gitchange/core` plus `pnpm vitest run tests/integration` |
| **Estimated runtime** | ~60–120 seconds (fixtures + dashboard build) |

---

## Sampling Rate

- **After every task commit:** Run scoped integration or package test for the touched area
- **After every plan wave:** Run `pnpm vitest run tests/integration`
- **Before phase sign-off:** First-run flow + core suite green on Node 22
- **Max feedback latency:** 120 seconds

---

## Per-Requirement Verification Map

| Requirement | Plan | Automated Gate | Manual Gate | Status |
|-------------|------|----------------|-------------|--------|
| PLUG-01 `/gitchange` slash command | 03-04 | `pnpm vitest run tests/integration/plugin-schemas.test.ts` | Dogfood `/gitchange` in Cursor/Claude | ✅ green |
| PLUG-02 `/gitchange-dashboard` | 03-03, 03-04 | `tests/integration/dashboard-snapshot.test.ts` | Open dashboard via slash command | ✅ green |
| PLUG-03 CLI index/serve/status | 03-01, 03-02 | `cli-index.test.ts`, `cli-serve-status.test.ts` | — | ✅ green |
| PLUG-04 UA packaging pattern | 03-05 | `.github/workflows/validate-plugin.yml`, `resolve-root.test.ts` | Marketplace symlink steps from installer | ✅ green |
| PLUG-05 Host AI only (no LLM SDK) | 03-04 | `plugin-schemas.test.ts` grep gate (forbidden imports) | — | ✅ green |
| INST-01 One-line / marketplace install | 03-05 | `bash -n scripts/install.sh`; README install section | Run installer on clean machine | ✅ green |
| INST-02 First analysis via `/gitchange` | 03-04 | Skill docs + `cli-index.test.ts` | Slash command in host IDE | ✅ green |
| INST-03 Dashboard initial value | 03-03 | `dashboard-snapshot.test.ts` | `/gitchange-dashboard` in host IDE | ✅ green |
| INST-04 Quickstart ≤5 steps | 03-06 | `grep -c '^[0-9]\.' docs/QUICKSTART.md` (3–5); `first-run-flow.test.ts` | Read `docs/QUICKSTART.md` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase 3 Integration Gates

| Gate | Command | Covers |
|------|---------|--------|
| First-run E2E | `pnpm vitest run tests/integration/first-run-flow.test.ts` | INST-04, T-03-13 (index → status → serve → API → HTML) |
| CLI index | `pnpm vitest run tests/integration/cli-index.test.ts` | PLUG-03, INST-02 path |
| CLI serve/status | `pnpm vitest run tests/integration/cli-serve-status.test.ts` | PLUG-03, P3-D-01 localhost bind |
| Dashboard + API | `pnpm vitest run tests/integration/dashboard-snapshot.test.ts` | INST-03, PLUG-02 |
| Plugin schemas + PLUG-05 | `pnpm vitest run tests/integration/plugin-schemas.test.ts` | PLUG-01, PLUG-05 |
| Core regression | `pnpm turbo test --filter=@gitchange/core` | Index + intelligence foundation |
| Plugin CI | `validate-plugin.yml` on push | PLUG-04 manifests, resolver, install script syntax |
| QUICKSTART step count | `grep -c '^[0-9]\.' docs/QUICKSTART.md` | INST-04 (≤5 numbered steps) |

**Full Phase 3 sign-off:**

```bash
nvm use 22   # or equivalent Node 22.x
pnpm vitest run tests/integration/first-run-flow.test.ts
pnpm vitest run tests/integration
pnpm turbo test --filter=@gitchange/core
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slash commands in host IDE | PLUG-01, INST-02, INST-03 | Requires Cursor/Claude Code runtime | Install plugin, run `/gitchange` then `/gitchange-dashboard` on a real repo |
| Marketplace discovery | PLUG-04, INST-01 | Host marketplace UI | Confirm `.claude-plugin/marketplace.json` lists plugin after symlink |
| One-line installer on fresh machine | INST-01 | CI does not clone to user home | Run `curl … install.sh \| bash` outside monorepo |

---

## Validation Sign-Off

- [x] All Phase 3 requirements mapped to plans and gates
- [x] First-run integration test covers index + serve + snapshot + dashboard HTML
- [x] QUICKSTART documents install → `/gitchange` → `/gitchange-dashboard` in 5 steps
- [x] PLUG-05 static grep gate in integration tests
- [x] Node 22 required for native module compatibility
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 3 complete (2026-07-01)
