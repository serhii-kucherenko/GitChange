---
phase: 9
slug: dashboard-ui-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Presentational redesign** — the correct validation is: types compile, existing
> behavioral tests stay green (they assert logic/roles, not CSS), the bundle builds,
> and a human confirms the visual contract per view. Do NOT stand up new CSS test infra.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.3.0 (dashboard runs under `jsdom`) |
| **Config file** | `vitest.config.ts` (root; dashboard via `environmentMatchGlobs`) |
| **Quick run command** | `pnpm --dir packages/dashboard typecheck` (+ `pnpm --dir packages/dashboard test` if touched file has a test) |
| **Full suite command** | `turbo typecheck && turbo lint && turbo test` |
| **Build (bundle contract)** | `turbo build` (→ `packages/dashboard/dist`) |
| **Estimated runtime** | ~30 seconds (typecheck+test); build ~20s |

---

## Sampling Rate

- **After every task commit:** `pnpm --dir packages/dashboard typecheck` + (if touched file has a test) `pnpm --dir packages/dashboard test`
- **After every plan wave:** `turbo typecheck && turbo lint && turbo test`
- **Before `/gsd:verify-work`:** `turbo build` green + full `turbo test` green + manual per-view visual verification
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (frame/layout) | — | A | DASH-01 | — | Read-only render; no new write path | typecheck+existing | `pnpm --dir packages/dashboard typecheck` | ✅ | ⬜ pending |
| (era label CSS) | — | B | DASH-02 | — | N/A | typecheck+manual | `pnpm --dir packages/dashboard typecheck` | ✅ | ⬜ pending |
| (virtualized lists) | — | C | DASH-04 | — | N/A | typecheck+manual | `pnpm --dir packages/dashboard typecheck` | ✅ | ⬜ pending |
| (graph/tours restyle) | — | D | DASH-02 | — | Preserve drill callbacks | existing test | `pnpm --dir packages/dashboard test` | ✅ | ⬜ pending |
| (leaf/badge restyle) | — | D | DASH-03 | — | N/A | typecheck+manual | `pnpm --dir packages/dashboard typecheck` | ✅ | ⬜ pending |

*Planner refines Task IDs/Plan/Wave to match final PLAN.md files. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Vitest + jsdom + Testing Library already provide the behavioral safety net (`TemporalGraphView.test.tsx`, `temporal-graph-model.test.ts`, `store/tour.test.ts`, `utils/confidence.test.ts`, `utils/open-work-match.test.ts`). A presentational redesign warrants no new CSS unit tests.

*Optional (non-blocking) highest-value guard:* a smoke render of `App`/`DashboardLayout` asserting each tab renders its view region without throwing.

---

## Manual-Only Verifications

Run `pnpm --dir packages/dashboard dev` (server on 9876 for data) and confirm per view:

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header + tab nav | Contract | CSS/layout, not assertable in unit tests | Full-width; tabs never wrap; active tab `sky-400` underline; keyboard-focusable with visible ring |
| Timeline layout | DASH-02 | Visual legibility | Era strip full-width `min-h-[8rem]`; labels ellipsis + hover tooltip, no run-together labels at ≤8 eras; rail cards not cramped; commit list full header + first row visible; virtualization scrolls |
| Decisions / Open work | DASH-03 | Visual layout | Two-pane split; empty-pane copy per contract; no clipped rows |
| Tours | DASH-02 | Visual layout | Picker + player readable; prose `max-w-3xl`; Next/Previous stop CTAs |
| Graph | DASH-02 | Visual layout | Canvas fills content width; helper strip not a 22rem sidebar |
| Load/empty/error states | DASH-01 | Visual placement | Centered in content region (`max-w-md`); `role="alert"` preserved on error |
| Contrast | Contract | Visual/a11y | Metadata `slate-400` (not `slate-500`) on card surfaces; body ≥ 4.5:1 |

---

## Validation Sign-Off

- [ ] All tasks have typecheck/existing-test verify or are manual-visual with checklist steps
- [ ] Sampling continuity: typecheck runs after every task commit
- [ ] Wave 0 covers all MISSING references (none required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
