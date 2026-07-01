# Phase 2: Repository Intelligence & Ownership - Research

**Researched:** 2026-07-01
**Domain:** Deterministic repository intelligence over Phase 1 SQLite index — churn, co-change, line-survival ownership, era signals, contributor expertise
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `02-CONTEXT.md` exists for this phase. Locked decisions are inherited from Phase 1 (`01-CONTEXT.md`) and project research (`ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`).

### Inherited Locked Decisions (Phase 1 — still binding)

- **D-01:** SQLite primary store at `.gitchange/index.sqlite` — intelligence metrics cache in same DB, not a separate store.
- **D-02 (extended):** `manifest.json` remains the human-readable checkpoint; Phase 2 adds **`intelligence.json`** as the queryable intelligence artifact per `ARCHITECTURE.md` Pattern 2 checkpoints (`intelligence` checkpoint).
- **D-03:** Schema additions must be additive — new Drizzle tables + Zod schemas; do not break Phase 1 ingestion.
- **D-16 / EVD-01:** Narrative-ready intelligence records (expertise claims, era boundary labels) carry mandatory `evidence[]` with resolvable commit/file refs.
- **D-17:** `.gitchange/` gitignored by default; intelligence artifacts live alongside `index.sqlite`.

### Phase 2 Implicit Decisions (from ROADMAP + RESEARCH — planner discretion unless contradicted)

- **P2-D-01:** Ownership at HEAD uses **line survival** via `es-git` `blameFile` with `trackLinesMovement: true` and copy/move tracking flags — not last-committer heuristics (PITFALLS Pitfall 3, CONT-04).
- **P2-D-02:** `.git-blame-ignore-revs` at repo root is honored; when present and non-empty, use **`simple-git` CLI blame** with `--ignore-revs-file` because es-git `BlameOptions` has no `ignoreRevsFile` (Context7 verified 2026-07-01). When absent, use es-git `blameFile` hot path.
- **P2-D-03:** Merge commits are **skipped for ownership attribution** (index still records them per Phase 1); era/churn/co-change may include merge commit file deltas.
- **P2-D-04:** Co-change and churn exclude **generated/lockfile/deps** paths via `intelligence/path-filters.ts` (minimatch); never treat co-change as structural dependency (PITFALLS Pitfall 6).
- **P2-D-05:** Era boundaries in Phase 2 are **deterministic signals only** (pre-LLM); named eras remain Phase 4. Per-era ownership timelines slice by these signal windows (CONT-01).
- **P2-D-06:** `computeIntelligence(repoPath, gitchangeDir)` is a **separate pass** after indexing in Phase 2 (CLI wiring in Phase 3); tests call it explicitly after `indexFull`.
- **P2-D-07:** Shallow/partial index (`indexCompleteness: partial`) → intelligence records carry `attributionConfidence: degraded` warning in `intelligence.json` and manifest extension.

### Claude's Discretion

- Exact era-signal heuristics (author-count delta, path-churn pivot thresholds)
- Co-change temporal decay half-life (default 180 days)
- Expertise topic extraction: path-prefix buckets + `cc_scope` from conventional commits
- Which files get blame at HEAD (text extensions, skip binary/ignored paths)
- Batch size for blame walks on large repos

### Deferred Ideas (OUT OF SCOPE)

- Dashboard UI for ownership/churn (Phase 5)
- Named LLM eras (Phase 4)
- Contributor lens agent (Phase 4)
- DuckDB analytics tier (Phase 8)
- Multi-repo unified ownership (Phase 8)
- Live git walks in read/query path (forbidden — SCALE-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Per-file and per-era ownership timelines | `file_ownership` at HEAD (Plan 02-02) + `era_ownership` slices from `era_boundaries` (Plan 02-04); exported in `intelligence.json` |
| CONT-03 | Contributor expertise profiles ("ask Alice about auth") | `contributor_expertise` table: topics from path prefixes + cc_scope + co-change clusters; evidence-linked (Plan 02-04) |
| CONT-04 | Line survival at HEAD with rename tracking and ignore-revs | es-git `blameFile` with movement/copy flags; simple-git fallback for `--ignore-revs-file` (P2-D-01, P2-D-02) |
</phase_requirements>

## Summary

Phase 2 builds the **fact layer for "who changed what"** on top of the Phase 1 index. It reads `commits`, `file_changes`, and `authors` from `.gitchange/index.sqlite`, optionally opens the live repo for **blame-at-HEAD** (the only allowed live-git operation in this phase — not in dashboard hot path), and writes intelligence rows back to SQLite plus a human-readable **`intelligence.json`** for downstream agents (Phase 4+) and future dashboard (Phase 5).

The hardest commitments are **line-survival ownership** (not last-committer) and **honest co-change** (filter lockfiles, decay edges, label as correlation not dependency). Era boundaries here are **signals** feeding Phase 4 — not named chapters.

**Primary recommendation:** Implement in vertical MVP slices — (1) intelligence walking skeleton with churn + `intelligence.json`, (2) blame ownership at HEAD, (3) co-change + era signals in parallel, (4) era ownership timelines + expertise profiles, (5) golden fixtures + manifest checkpoint extension.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Churn / hotspot metrics | API / Backend (`intelligence/churn.ts`) | Database (SQLite aggregates) | Pure SQL over `file_changes`; no live git |
| Co-change graph | API / Backend (`intelligence/cochange.ts`) | Database | Pairwise commit co-occurrence with filters |
| Line-survival ownership | API / Backend (`intelligence/ownership/blame.ts`) | es-git / simple-git | Requires HEAD tree blame; not reconstructable from index alone |
| Era boundary signals | API / Backend (`intelligence/era-signals.ts`) | Database | Heuristics over indexed timeline |
| Expertise profiles | API / Backend (`intelligence/expertise.ts`) | Database | Rollups from ownership + topics |
| Artifact export | API / Backend (`intelligence/export.ts`) | `.gitchange/intelligence.json` | Agent/dashboard read contract |
| Orchestration | API / Backend (`intelligence/compute.ts`) | — | Single `computeIntelligence` entry |

**No client tier in Phase 2** — headless library only.

## Standard Stack

### Core (unchanged from Phase 1)
| Library | Version | Purpose |
|---------|---------|---------|
| **es-git** | 0.7.0 | `blameFile`, rename/move tracking in blame |
| **better-sqlite3** | 12.11.1 | Intelligence table persistence |
| **drizzle-orm** | 0.45.2 | Typed intelligence tables + queries |
| **zod** | 4.4.3 | Intelligence artifact validation at export boundary |
| **minimatch** | 10.2.5 | Path filters for co-change/churn exclusions |

### Added for Phase 2
| Library | Version | Purpose | When |
|---------|---------|---------|------|
| **simple-git** | 3.36.0 | `git blame --ignore-revs-file` fallback | Only when `.git-blame-ignore-revs` exists (P2-D-02) |

### Development
| Tool | Purpose |
|------|---------|
| **Vitest** | Unit + golden tests for intelligence outputs |
| **tests/fixtures** | New `OWNERSHIP_SCENARIO` fixture (squash, rename, ignore-revs) |

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| simple-git | npm 3.36.0 | **[ASSUMED]** — STACK.md approved fallback; planner inserts human-verify checkpoint before first install in 02-02 |

No other new runtime packages in Phase 2.

## Architecture Patterns

### Intelligence Pipeline (post-index)

```
.gitchange/index.sqlite (commits, file_changes, authors)
        │
        ├─▶ churn.ts ──────────────▶ file_churn rows
        ├─▶ cochange.ts ───────────▶ co_change_edges rows
        ├─▶ era-signals.ts ────────▶ era_boundaries rows
        │
local .git (HEAD only)
        │
        └─▶ ownership/blame.ts ───▶ file_ownership rows
                │
                ▼
        era-ownership.ts + expertise.ts
                │
                ▼
        export.ts ──▶ intelligence.json + manifest intelligence checkpoint
```

### Pattern 1: Index-First, Blame-Second
Churn and co-change never touch live git. Ownership at HEAD requires blame once per indexed text file — acceptable offline batch, not dashboard hot path.

### Pattern 2: Evidence on Every Expertise Claim
`contributor_expertise` and `era_boundaries` export records include `evidence[]` with commit SHAs and file paths provable from the index.

### Pattern 3: Co-Change Is Correlation
Export metadata `relationship: "co_change"` with `disclaimer: "historical correlation, not import dependency"` on edges used in tours later.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Rename-aware blame | es-git `blameFile` + track flags | libgit2 similarity |
| ignore-revs blame | simple-git `--ignore-revs-file` | es-git lacks option |
| Last-committer ownership | Line survival aggregation | Pitfall 3 |
| Lockfile co-change pairs | Path filter exclusions | Pitfall 6 |

## Common Pitfalls

### Pitfall 3: Ownership Conflation
**Mitigation:** Line survival at HEAD; skip merge commits for attribution; degrade confidence on squash-heavy repos; ignore-revs support.

### Pitfall 6: Co-Change False Signals
**Mitigation:** Exclude `*lock*`, `vendor/`, `dist/`, `*.pb.go`, etc.; temporal decay; never label as dependency.

### Pitfall 5 (partial): Shallow History
**Mitigation:** Read `manifest.indexCompleteness`; propagate `attributionConfidence: degraded` when partial.

## Code Examples

### es-git blame at HEAD (CONT-04)
```typescript
import { openRepository } from "es-git";

const repo = await openRepository(repoPath);
const blame = repo.blameFile("src/main.ts", {
  trackLinesMovement: true,
  trackCopiesSameCommitMoves: true,
  trackCopiesAnyCommitCopies: true,
});
const lineCount = blame.getLineCount();
for (let line = 1; line <= lineCount; line++) {
  const hunk = blame.getHunkByLine(line);
  // aggregate by hunk.origSignature.email or map to author_id via index
}
```

### Churn from indexed file_changes
```typescript
// SQL via Drizzle: GROUP BY path, COUNT(DISTINCT commit_sha),
// filter paths NOT matching INTELLIGENCE_IGNORE_GLOBS
```

## Validation Architecture

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| CONT-04 | Rename preserves original author line share | unit/golden | `pnpm vitest run packages/core/src/intelligence/ownership` |
| CONT-04 | ignore-revs excludes formatting commit attribution | unit | same + OWNSHIP_SCENARIO |
| CONT-01 | Era windows shift top owner per file | golden | `pnpm vitest run tests/golden/intelligence` |
| CONT-03 | Expertise maps topic → contributor with evidence | golden | same |
| GOAL #4 | intelligence.json contains churn, co_change, era_signals | integration | `pnpm vitest run packages/core/src/intelligence/compute` |

### Wave 0 Gaps
- [ ] `OWNERSHIP_SCENARIO` fixture in `tests/fixtures/scenarios.ts`
- [ ] `tests/golden/intelligence.test.ts`
- [ ] Intelligence tables in Drizzle migration `0001_intelligence.sql`

## Security Domain

| Threat | Category | Mitigation |
|--------|----------|------------|
| Malicious path in blame target | Tampering | Blame only paths present in `file_changes`; never write outside `.gitchange/` |
| Secret content in blame output | Information Disclosure | Blame aggregates author IDs only — do not persist line text from blame |
| SQL injection via paths | Tampering | Drizzle parameterized queries only |
| simple-git install typosquat | Supply chain | Human-verify checkpoint before install (T-02-SC) |

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | es-git `Blame.getLineCount()` exists | Medium — iterate until `getHunkByLine` throws |
| A2 | simple-git blame output parseable for aggregation | Low — well-documented porcelain |
| A3 | BASIC_SCENARIO sufficient for churn/co-change golden | Medium — OWNSHIP_SCENARIO added for blame |

## Open Questions

1. **Blame scope on large monorepos** — blame all text files vs top-N by churn. Recommendation: all non-ignored text files under configurable `maxBlameFiles` (default unlimited for fixture repos).
2. **Era signal count** — recommend 3–8 boundaries max from heuristics to avoid noise before Phase 4 LLM naming.

## Sources

- Context7 `/toss/es-git` — `blameFile`, `Blame.getHunkByLine`, `BlameOptions` (2026-07-01)
- `.planning/research/{ARCHITECTURE,PITFALLS,SUMMARY,FEATURES}.md`
- Phase 1 summaries `01-02`, `01-08` — schema + golden patterns
- STACK.md — simple-git fallback role

**Research date:** 2026-07-01
**Valid until:** ~2026-08-01
