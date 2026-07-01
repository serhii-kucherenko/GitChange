---
phase: 1
slug: index-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (root) — Wave 0 installs |
| **Quick run command** | `pnpm vitest run packages/core/src/<area>` |
| **Full suite command** | `turbo test --filter=@gitchange/core` |
| **Estimated runtime** | ~30–90 seconds (synthetic fixtures); dogfood integration slower |

---

## Sampling Rate

- **After every task commit:** Run area-scoped `pnpm vitest run packages/core/src/<area>`
- **After every plan wave:** Run `turbo test --filter=@gitchange/core`
- **Before `/gsd:verify-work`:** Full suite green + secret-grep golden test green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | SCALE-03 | — | N/A | unit | `turbo test --filter=@gitchange/core` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | EVD-01, EVD-04 | T-01 | Zod evidence[] enforced at write boundary | unit | `pnpm vitest run packages/core/src/schema` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | INGX-02 | T-02 | Paths stored as data only; no shell interpolation | golden | `pnpm vitest run packages/core/src/ingestion` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | PRIV-02, PRIV-03 | T-01 | Secrets redacted before persist; ignored paths metadata-only | golden | `pnpm vitest run packages/core/src/privacy` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 2 | INGX-01, INGX-04 | — | Local-only index; incremental cursor respected | integration | `pnpm vitest run packages/core/src/index` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 2 | INGX-05 | — | Partial index + warnings on shallow; halt on force-push | integration | `pnpm vitest run packages/core/src/index/freshness` | ❌ W0 | ⬜ pending |
| 01-07-01 | 07 | 3 | INGX-03, D-13 | — | Doc snapshots at commit boundaries | golden | `pnpm vitest run packages/core/src/ingestion/doc` | ❌ W0 | ⬜ pending |
| 01-08-01 | 08 | 3 | EVD-04, SCALE-03, PRIV-01 | T-01 | No secret prefixes in built fixture SQLite; message + doc secrets recorded as findings; core has no network imports | golden+grep | `turbo test --filter=@gitchange/core` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` (root) + `packages/core` test wiring
- [ ] `pnpm-workspace.yaml`, `turbo.json`, `packages/core/package.json`
- [ ] `tests/fixtures/` synthetic repo builder (programmatic tiny git repos)
- [ ] Shared fixture helpers (temp repo + temp `.gitchange/` setup/teardown)
- [ ] `pnpm add -D vitest turbo typescript @biomejs/biome -w`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dogfood on GitChange repo | D-11 | Slow; optional in CI initially | Run full index against repo root; inspect manifest.json warnings |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
