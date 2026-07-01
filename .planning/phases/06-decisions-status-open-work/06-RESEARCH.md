# Phase 6: Decisions, Status & Open Work — Research

**Researched:** 2026-07-01
**Domain:** Decision mining, open-work status inference, maintainer interview loop, migration threads, honest evidence gaps
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `06-CONTEXT.md` exists for this phase. Locked decisions inherited from Phases 1–5 and project research (`ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`).

### Inherited Locked Decisions (still binding)

- **D-16 / EVD-01:** Every narrative claim carries mandatory `evidence[]` with resolvable commit/file/doc refs; Zod-validated at write boundary.
- **P3-D-03 / SCALE-02:** Dashboard and server read **pre-built `.gitchange/` only** — no live git walks in hot path.
- **P4-D-01:** Semantic artifacts live under `.gitchange/` with manifest checkpoint fields.
- **P4-D-07:** `Evidence` union includes `commit`, `file`, `doc`, `hunk` types.
- **P5-D-05:** Phase 5 confidence UI uses evidence-count heuristic on **era claims/inflections only**; full **decision-confidence model is Phase 6 scope**.

### Phase 6 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P6-D-01:** New artifacts: **`.gitchange/decisions.json`** (past decisions + migrations) and **`.gitchange/open-work.json`** (in-flight threads). Schema versioned via Zod; atomic tmp+rename write like `eras.json`.
- **P6-D-02:** **Two-phase decision mining (DEC-01):** (1) deterministic candidate extraction from indexed SQLite (`cc_type`/`cc_scope`, message keywords, doc ADR frontmatter, merge/WIP patterns) with noise filters per PITFALLS #1; (2) host-LLM **decision-miner** agent refines candidates into `DecisionsArtifact` — never invent decisions absent from candidate list + context bundle.
- **P6-D-03:** **EVD-03 confidence floor:** `confidence < 0.35` OR `evidence.length < 1` → API/UI/agent returns literal **`"No recorded decision found"`** for that query; no fabricated rationale. Decisions below floor may exist in artifact tagged `below_threshold` but must not surface as affirmative answers.
- **P6-D-04:** **Interview evidence type** added to `Evidence` union: `{ type: "interview", path, recordedAt, excerpt }` referencing `.gitchange/interviews/<id>.json` or appended doc path. **DEC-04 writeback:** default `.gitchange/interviews/` JSON; optional maintainer-approved append to `docs/` ADR markdown (never auto-commit to git).
- **P6-D-05:** **TIME-04 migration threads:** `OpenWorkThread.events[]` chronologically lists commit touches on `relatedPaths[]` from indexed `file_changes` only; dashboard `MigrationThreadPanel` navigates thread → commit drill-down via existing zustand store.
- **P6-D-06:** **STAT-01 tri-method inference:** (a) conventional-commit + keyword patterns on messages, (b) git trailer regex when present in message body (`Refs:`, `Closes:`, `BREAKING CHANGE`), (c) docs-vs-code divergence (doc claims migration complete but recent commits still touch migration paths).
- **P6-D-07:** **STAT-03 scope split:** Wire `OpenWorkBadge` on **EraTimeline**, **CommitList**, and **EraDetailPanel** in Phase 6; export `matchOpenWorkToSurface(path|eraId|commitSha)` utility for Phase 7 tour player — do not build tour player here.
- **P6-D-08:** **Pipeline ordering:** Decision + open-work synthesis runs **after** `eras.json` exists (needs era windows for attribution). Extend `runSemanticPipeline` → `runDecisionsPipeline` or append steps post-graph with manifest fields `decisionsComputedAt`, `openWorkComputedAt`.
- **P6-D-09:** **CONT-02 attribution:** Each decision may include `attribution` linking primary driver from evidence commit authors cross-referenced with `intelligence.expertise` topic match on `relatedPaths[]` prefix — confidence capped at `inferred_medium` without interview confirmation.
- **P6-D-10:** **Review workflow (DEC-03):** `reviewStatus: pending | confirmed | rejected` on mined decisions; interview loop sets `confirmed`/`rejected` and bumps confidence on confirm.

### Claude's Discretion

- Exact confidence numeric weights for multi-signal scoring
- Max decisions cap (recommend 40) and max open threads (recommend 20)
- Stale-work threshold days (recommend 90 days since last thread event)
- Interview skill name: `/gitchange-interview` vs inline in `/gitchange`

### Deferred Ideas (OUT OF SCOPE)

- Tour player integration (Phase 7 TOUR-01–04) — only badge hook utility
- Temporal graph **UI** (@xyflow/react — Phase 8)
- Optional decision nodes in `temporal-graph.json` (nice-to-have in 06-06 if low cost; not blocking)
- PR/issue trailer mining from GitHub API (INTG-01 v2)
- Real-time collaborative lore editing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEC-01 | Auto-mine decisions from commits, messages, trailers, doc deltas | P6-D-02 deterministic candidates + decision-miner agent; `conventional-commits-parser` already in core |
| DEC-02 | Browse decisions with status, evidence, supersession | `DecisionsArtifact` schema + dashboard `DecisionsPanel` + `GET /api/decisions` |
| DEC-03 | Maintainer confirm/reject via in-chat interview | `/gitchange-interview` skill + `reviewStatus` field |
| DEC-04 | Interview answers persist to docs or index | P6-D-04 `.gitchange/interviews/` + merge helper |
| STAT-01 | Pattern/keyword/trailer + docs-vs-code status inference | P6-D-06 `inferOpenWorkStatus` in core |
| STAT-02 | Open threads panel | `open-work.json` + `OpenThreadsPanel` + `GET /api/open-work` |
| STAT-03 | Timeline/tour inline badges for incomplete work | P6-D-07 badges on era/commit surfaces; hook for Phase 7 |
| STAT-04 | Agent status queries with evidence + confidence | `status-query.schema.json` + `/gitchange` Phase 4 status section |
| TIME-04 | Migration-centric threads across commits/files | P6-D-05 thread events from `file_changes` |
| CONT-02 | Decision attribution — who drove pivots | P6-D-09 attribution block on `DecisionRecord` |
| EVD-03 | "No recorded decision found" below threshold | P6-D-03 floor enforced in read API, UI, agent spec |
</phase_requirements>

## Summary

Phase 6 answers GitChange's **third, fourth, and fifth core questions** — what decisions were made, what's in flight, and current progress — with the same evidence contract as eras. The codebase already indexes conventional commit fields (`cc_type`, `cc_scope`, `cc_breaking`), doc snapshots with frontmatter, and hunk-level drill-down from Phase 5. The gap is **no decision/open-work artifact schemas**, **no mining pipeline**, **no interview loop**, and **no dashboard surfaces** beyond era-level confidence heuristics.

**Primary recommendation:** Six vertical MVP plans — (1) schemas + deterministic mining skeleton, (2) decision-miner agent + decisions artifact, (3) status inferencer + open-work artifact, (4) dashboard browse + migration threads, (5) interview loop + writeback, (6) agent status + timeline badges + golden gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decision/open-work Zod schemas | Core (`schema/zod/decisions.ts`, `open-work.ts`) | evidence interview type | Contract before agents |
| Deterministic candidate mining | Core (`decisions/candidates.ts`) | SQLite reads | DEC-01 noise-filtered facts |
| Decision synthesis context bundler | Core (`decisions/context.ts`) | eras + intelligence + index | Bounded host-AI input |
| Status inference | Core (`status/infer.ts`) | doc snapshots + file_changes | STAT-01 deterministic |
| Artifact I/O + pipeline | Core (`decisions/*-io.ts`, `semantic/pipeline.ts`) | manifest checkpoint | Same pattern as eras |
| Decision-miner / interview agents | Plugin (`agents/`, `skills/`) | JSON schemas | PLUG-05 host LLM |
| Read APIs | Server (`routes/decisions.ts`, `open-work.ts`) | core read fns | SCALE-02 |
| Dashboard panels + badges | Client (`packages/dashboard`) | react-query + zustand | DEC-02, STAT-02, TIME-04 |
| EVD-03 honest gaps | Core read + dashboard + agent spec | shared `isBelowEvidenceThreshold()` | Single source of truth |

**LLM tier:** decision-miner and interview synthesis only — status inference is deterministic-first.

## Standard Stack

### New for Phase 6

| Library | Version | Purpose | Package |
|---------|---------|---------|---------|
| *(none)* | — | Reuse existing stack | — |

`conventional-commits-parser@7.0.0` already parses commit messages at index time. Phase 6 reads `cc_*` columns and raw `message` for trailers — no new npm packages required.

### Unchanged from Phase 1–5

| Library | Purpose |
|---------|---------|
| zod 4.4.3 | Artifact validation |
| drizzle-orm 0.45.2 | SQLite reads for mining |
| hono 4.12.27 | Dashboard API |
| @tanstack/react-query 5.101.2 | Dashboard server state |

### Explicitly Deferred

| Item | Reason |
|------|--------|
| @xyflow/react decision graph UI | Phase 8 DASH-02 |
| Tour player | Phase 7 |
| GitHub API for PR trailers | v2 INTG-01 |

## Package Legitimacy Audit

No new package-manager installs in Phase 6. Existing dependencies cover all capabilities.

| Package | Registry | Disposition |
|---------|----------|-------------|
| conventional-commits-parser | npm | [VERIFIED] already in @gitchange/core |
| zod | npm | [VERIFIED] |
| drizzle-orm | npm | [VERIFIED] |

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom decision JSON | Zod `DecisionsArtifact` + plugin JSON Schema | EVD-04 golden gate |
| Live git log for thread events | Indexed `file_changes` chronological query | SCALE-02 |
| LLM-only decision list | Deterministic candidates gate agent input | PITFALLS #1 false positives |
| Separate confidence systems | Extend `confidence.ts` for decision levels | Replace P5 heuristic for decisions only |

## Common Pitfalls

### Pitfall 1: Treating Git History as Decision Evidence
**Mitigation:** Noise filters (merge, chore, lockfile-only); multi-signal confidence; `below_threshold` + EVD-03 string; `reviewStatus` until maintainer confirms.

### Pitfall 2: Hallucinated Narrative
**Mitigation:** Agent constrained to candidate IDs; Zod `evidence.min(1)`; golden tests verify SHA resolution.

### Pitfall 8: Status Without Cross-Reference
**Mitigation:** STAT-01 docs-vs-code check flags "doc says done, code still changing" as `in_progress`.

## Codebase Starting Points

| Area | Path | Notes |
|------|------|-------|
| Evidence union | `packages/core/src/schema/zod/evidence.ts` | Add `interview` type (P6-D-04) |
| Era pipeline pattern | `packages/core/src/semantic/` | Mirror for `decisions/` |
| Conventional fields | `commits.cc_type`, `cc_scope`, `cc_breaking` | Already indexed |
| Confidence UI | `packages/dashboard/src/utils/confidence.ts` | Extend for decision confidence |
| /gitchange skill | `packages/plugin/skills/gitchange/SKILL.md` | Add Phase 3 decisions + Phase 4 status |
| Drill store | `packages/dashboard/src/store/drill.ts` | Wire decision/thread selection |

## Validation Architecture

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| DEC-01 | decisions.json validates; candidates ⊆ indexed SHAs | unit/golden | `pnpm vitest run tests/golden/decisions` |
| DEC-02 | Supersession refs resolve; browse API returns paginated list | integration | `pnpm vitest run tests/integration/decisions-api` |
| DEC-03/04 | Interview merge bumps reviewStatus + evidence | unit | `pnpm vitest run packages/core/src/interviews` |
| STAT-01/02 | open-work.json infers threads from fixture | unit/golden | `pnpm vitest run tests/golden/decisions` |
| EVD-03 | Below-threshold query returns exact gap string | unit + integration | `pnpm vitest run packages/core/src/decisions/threshold` |
| TIME-04 | Thread events ordered; drill to commit works | integration E2E | `pnpm vitest run tests/integration/decisions-dashboard-e2e` |
| STAT-04 | Agent schema includes evidence + confidence fields | integration grep | `pnpm vitest run tests/integration/plugin-schemas` |
| PLUG-05 | No LLM SDK in core | integration grep | existing gate |

### Wave 0 Gaps (address in 06-01 / 06-06)

- [ ] `packages/core/src/schema/zod/decisions.ts`
- [ ] `packages/core/src/schema/zod/open-work.ts`
- [ ] `tests/golden/decisions.test.ts`
- [ ] `tests/fixtures/decisions/basic-scenario-decisions.json`

## Multi-Source Coverage Audit

| Source | Item | Plan |
|--------|------|------|
| GOAL | Browse mined decisions | 06-02, 06-04 |
| GOAL | Honest gap when weak evidence | 06-01, 06-04, 06-06 |
| GOAL | Interview confirm/reject | 06-05 |
| GOAL | Open threads panel | 06-03, 06-04 |
| GOAL | Agent status + inline badges | 06-06 |
| DEC-01–04 | All decision reqs | 06-01–02, 06-05 |
| STAT-01–04 | All status reqs | 06-03, 06-04, 06-06 |
| TIME-04 | Migration threads | 06-04 |
| CONT-02 | Pivot attribution | 06-02, 06-06 |
| EVD-03 | No fabrication | 06-01, 06-04, 06-06 |

**Coverage:** 11/11 requirement IDs mapped. No gaps. No phase split recommended.

---
*Research completed: 2026-07-01*
