# Phase 8: Hardening, Scale & Multi-Repo — Research

**Researched:** 2026-07-01
**Domain:** 100k+ commit indexing hardening, manual multi-repo workspace federation, temporal graph dashboard UI
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `08-CONTEXT.md` exists for this phase. Locked decisions inherited from Phases 1–7 and project research (`ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `FEATURES.md`).

### Inherited Locked Decisions (still binding)

- **D-01 / D-17:** Per-repo `.gitchange/index.sqlite` + `manifest.json`; derived cache gitignored by default.
- **D-16 / EVD-01:** Narrative claims carry mandatory `evidence[]` with resolvable refs; Zod-validated at write boundary.
- **P3-D-03 / SCALE-02:** Dashboard and server read **pre-built `.gitchange/` only** — no live full-repo git walks in hot path.
- **P4-D-01:** Semantic artifacts (`eras.json`, `temporal-graph.json`) per repo; manifest checkpoint fields additive.
- **P4-D-06:** Stable artifact IDs use **`ulid`** prefixes.
- **P5-D-07:** Commit list API uses cursor pagination for large repos.
- **P7-D-05 / TOUR-04:** Tour stops require evidence + `drillTarget`; tour player drills via `useDrillStore`.

### Phase 8 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P8-D-01 (SCALE-01):** Add **`piscina@5.2.0`** worker pool for per-commit **diff + parse** after es-git revwalk streams SHAs on the main thread; SQLite writer stays on main thread (better-sqlite3 sync API). Workers receive `{repoPath, sha, ignoreRules}` and return serializable commit/file-change/doc rows — never share `Repository` handles across threads.
- **P8-D-02 (SCALE-01):** Extend `openDb` with `PRAGMA cache_size=-64000` and `PRAGMA mmap_size=268435456` (256MB); WAL + NORMAL synchronous already set in `artifacts/db.ts`.
- **P8-D-03 (SCALE-01):** CLI `index` emits **progress** every 500 commits: `{indexed, rate, elapsed}` on stderr; `gitchange status` shows last index duration when recorded in manifest (`lastIndexDurationMs` optional field).
- **P8-D-04 (SCALE-01):** Scale gate: CI runs **10k-commit synthetic fixture** under 120s; optional `GITCHANGE_SCALE_100K=1` local benchmark (not CI-default) validates architecture on 100k commits.
- **P8-D-05 (MULTI-01):** Workspace config at **`.gitchange/workspace.json`** (`WorkspaceArtifact`) listing `repos[]` with stable `repoId` (slug), absolute `repoPath`, display `label`, and resolved `gitchangeDir` (default `<repoPath>/.gitchange`). User adds repos via `gitchange workspace add <path> --label <name>`.
- **P8-D-06 (MULTI-01):** **Per-repo indexes remain separate** — no flattening commits into one SQLite DB (ARCHITECTURE.md + PITFALLS #11). Federation happens at read/overlay layer only.
- **P8-D-07 (MULTI-01):** `indexWorkspace()` indexes repos **sequentially** (es-git opens one `.git` at a time); failures on one repo do not delete others' indexes.
- **P8-D-08 (MULTI-02):** Add optional **`repoId`** field on `Evidence` union members and on unified API DTOs (`CommitSummary.repoId`, `TourStop.repoId`). Required when workspace has >1 repo; omitted (defaults to primary) for single-repo backward compatibility.
- **P8-D-09 (MULTI-02):** Unified timeline merges per-repo commit streams with **explicit sort key** `(committedAt desc, repoId asc, sha desc)` — never infer cross-repo causality from date proximity alone (PITFALLS #11).
- **P8-D-10 (MULTI-02):** Cross-repo links are **manual only** in `workspace.json` `links[]`: `{ id, sourceRepoId, targetRepoId, kind: "shared_migration"|"manual", label, evidenceNote }`. No auto-inferred cross-repo decisions.
- **P8-D-11 (MULTI-02):** Unified tours: `mergeToursForWorkspace()` namespaces tour/chapter/stop IDs with `repoId:` prefix; every stop shows `repoId` badge in UI; cross-repo topic tours only when user created a `links[]` entry referencing both repos.
- **P8-D-12 (DASH-02):** Add fifth intelligence tab **`graph`** beside Timeline | Decisions | Open work | Tours; render `temporal-graph.json` with **`@xyflow/react@12.11.1`**.
- **P8-D-13 (DASH-02):** Graph UI loads **era + inflection nodes only** initially (≤500 nodes per `MAX_GRAPH_NODES`); commit/file/contributor nodes lazy-loaded on era expand — no 100k-node render.
- **P8-D-14 (DASH-02):** Node click drills via existing `useDrillStore` (era → timeline, commit → detail panel); multi-repo nodes carry `repoId` in node `data` for federated drill routing.
- **P8-D-15:** `manifest.json` gains optional `repoId` string matching workspace entry; single-repo installs omit field.

### Claude's Discretion

- Piscina `maxThreads` default `max(1, cpus - 1)`
- Workspace file location if `.gitchange/` missing (create on first `workspace add`)
- Graph layout algorithm (`dagre` vs built-in) — prefer `@xyflow/react` default + manual era banding
- Whether unified era timeline interleaves era bands per repo or stacks lanes (recommend **repo-colored lanes** on vis-timeline)

### Deferred Ideas (OUT OF SCOPE)

- chokidar auto-reindex watch (mentioned in Phase 5 research, not in Phase 8 requirements)
- `gitchange doctor` command (SUMMARY.md Phase 8 mention — not in SCALE/MULTI/DASH reqs)
- DuckDB analytics tier (STACK.md v1.1+)
- Per-era full blame ownership (deferred from Phase 2 STATE — not in Phase 8 requirements)
- GitHub/GitLab API integration (v2)
- Auto-detected cross-repo co-change without manual links
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCALE-01 | System indexes repositories with 100k+ commits using incremental two-phase architecture | P8-D-01–04 piscina + WAL tuning + progress + scale fixture gate; existing incremental `walkRange` + manifest cursor preserved |
| MULTI-01 | User can manually select one or multiple related repos for unified analysis | P8-D-05–07 workspace.json + CLI + sequential per-repo index |
| MULTI-02 | Unified timeline and tours present cross-repo story with explicit repo attribution | P8-D-08–11 federated read APIs, repoId on evidence/stops, manual links only |
| DASH-02 | Dashboard includes timeline, temporal knowledge graph, and tour player views | P8-D-12–14 fifth `graph` tab with @xyflow/react; timeline/tours already exist — extend with repo badges |
</phase_requirements>

## Summary

Phase 8 closes the v1 milestone: **scale** (100k+ commits without abandoning the two-phase index/query split), **multi-repo** (manual workspace federation without false cross-repo narratives), and **temporal graph UI** (the last major dashboard surface deferred since Phases 4–5).

The codebase already has incremental indexing (`walkRange`), WAL SQLite, cursor-paginated commit APIs, `temporal-graph.json` assembly (≤500 nodes), and a tour player planned in Phase 7. Gaps: **no piscina**, **no workspace federation**, **no `repoId` on evidence**, **no @xyflow/react** in `packages/dashboard`.

**Primary recommendation:** Five vertical MVP plans — (1) SCALE hardening, (2) MULTI workspace + CLI, (3) MULTI federated read APIs + tour attribution, (4) DASH temporal graph tab, (5) golden multi-repo + scale benchmark gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Piscina worker pool | Core (`index/worker-pool.ts`, `index/worker.ts`) | process-commit split | SCALE-01; es-git revwalk stays main thread |
| SQLite pragmas + progress | Core (`artifacts/db.ts`, `index/full.ts`) | CLI stderr | SCALE-01 observability |
| Workspace schema + I/O | Core (`workspace/schema.ts`, `workspace-io.ts`) | Zod | MULTI-01 contract |
| Workspace CLI | CLI (`commands/workspace.ts`) | core workspace I/O | MULTI-01 user entry |
| Federated commit/tour reads | Core (`read/unified/*.ts`) | per-repo read fns | MULTI-02; no merged SQLite |
| repoId on Evidence | Core (`schema/zod/evidence.ts`) | all artifact writers | PITFALLS #11 provenance |
| Unified API routes | Server (`routes/workspace.ts`, extend `commits.ts`) | core unified reads | SCALE-02 preserved |
| Repo attribution UI | Client (`RepoBadge.tsx`, timeline/tour/graph) | workspace context | MULTI-02 visible |
| Temporal graph view | Client (`TemporalGraphView.tsx`) | `@xyflow/react` | DASH-02 |
| Graph read API | Server (`routes/graph.ts`) | `readTemporalGraph` per repo | Pre-built JSON only |

**No new LLM agents** — federation and graph UI are deterministic.

## Standard Stack

### New for Phase 8

| Library | Version | Purpose | Package |
|---------|---------|---------|---------|
| **piscina** | 5.2.0 | Worker thread pool for per-commit processing | `@gitchange/core` |
| **@xyflow/react** | 12.11.1 | Temporal knowledge graph UI | `@gitchange/dashboard` |

### Unchanged from Phase 1–7

| Library | Purpose |
|---------|---------|
| es-git 0.7.0 | Revwalk on main thread |
| better-sqlite3 12.11.1 | Per-repo OLTP index |
| hono 4.12.27 | Federated read APIs |
| vis-timeline 8.5.1 | Unified timeline (extend with repo lanes) |
| zustand 5.0.14 | Drill + tour + workspace selection state |

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| piscina | npm 5.2.0 | **[OK]** — STACK.md; Node.js worker pool (nearform) |
| @xyflow/react | npm 12.11.1 | **[OK]** — STACK.md; React Flow official package |

Planner inserts **blocking human-verify checkpoint** before first `pnpm add` of `piscina` and `@xyflow/react` (threat model T-08-SC).

## Architecture Patterns

### Scale Pipeline (SCALE-01)

```
es-git revwalk (main thread)
    │ stream SHA batches (500)
    ▼
piscina workers (repoPath + sha + ignore rules)
    │ serializable CommitRecord + FileChange[] + DocSnapshot[]
    ▼
main-thread IndexWriter (batched SQLite insert)
    ▼
manifest.json (lastIndexedCommit, lastIndexDurationMs)
```

Incremental path unchanged: `walkRange(cursor..HEAD)` only.

### Multi-Repo Federation (MULTI-01/02)

```
.gitchange/workspace.json          repo A/.gitchange/    repo B/.gitchange/
  repos[{repoId, path, label}]  →  index.sqlite       +  index.sqlite
  links[{manual cross-repo}]   →  eras.json tours... +  eras.json tours...
        │
        ▼
listCommitsUnified(workspace) ──▶ merge + repoId attribution
mergeToursForWorkspace()      ──▶ prefixed IDs + repo badges
        │
        ▼
Hono /api/workspace, /api/commits?repoId=, /api/graph?repoId=
```

### Temporal Graph UI (DASH-02)

```
GET /api/graph?repoId= (or all repos in workspace)
    ▼
temporal-graph.json (pre-built, ≤500 nodes)
    ▼
TemporalGraphView (@xyflow/react)
    │ era/inflection nodes visible; expand era → load commit nodes from graph artifact
    ▼
useDrillStore (existing Phase 5 drill-down)
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom worker pool | piscina | Battle-tested thread pool; STACK.md locked |
| Merge SQLite files | Federated read layer | PITFALLS #11; per-repo rebuild independence |
| Custom graph canvas | @xyflow/react | STACK.md; proven in Understand-Anything |
| Cross-repo inference | Manual `links[]` only | PITFALLS #11 false narrative |

## Common Pitfalls

### Pitfall 4: Full-History Rescan
**Mitigation:** Preserve incremental `walkRange`; scale tests assert second incremental pass processes ≪1% of commits.

### Pitfall 11: Multi-Repo False Narrative
**Mitigation:** P8-D-09 sort-only merge; P8-D-10 manual links; `repoId` on every evidence ref in multi-repo mode; UI badges mandatory.

### Dashboard Graph Blow-Up
**Mitigation:** P8-D-13 era-first render; `MAX_GRAPH_NODES` already enforced at write time in `assemble-graph.ts`.

## Code Examples

### Evidence with repoId (additive MULTI-02)

```typescript
// Extend each Evidence variant with optional repoId
z.object({
  type: z.literal("commit"),
  sha: z.string().length(40),
  repoId: z.string().min(1).optional(),
})
```

### Workspace artifact shape (P8-D-05)

```typescript
WorkspaceArtifact = {
  schemaVersion: "1",
  primaryRepoId: string,
  repos: [{ repoId, label, repoPath, gitchangeDir }],
  links: [{ id, sourceRepoId, targetRepoId, kind, label }],
}
```

## Multi-Source Coverage Audit (Planning)

| SOURCE | ID | Feature | Plan | Status |
|--------|-----|---------|------|--------|
| GOAL | — | Large monorepos + unified multi-repo story | 08-01–08-05 | COVERED |
| REQ | SCALE-01 | 100k+ incremental two-phase index | 08-01, 08-05 | COVERED |
| REQ | MULTI-01 | Manual multi-repo selection | 08-02, 08-05 | COVERED |
| REQ | MULTI-02 | Unified timeline/tours with repo attribution | 08-03, 08-05 | COVERED |
| REQ | DASH-02 | Timeline + graph + tour player views | 08-04, 08-05 | COVERED |
| RESEARCH | P8-D-01 | piscina workers | 08-01 | COVERED |
| RESEARCH | P8-D-05 | workspace.json | 08-02 | COVERED |
| RESEARCH | P8-D-08 | repoId on evidence | 08-03 | COVERED |
| RESEARCH | P8-D-12 | @xyflow graph tab | 08-04 | COVERED |
| RESEARCH | PITFALLS #11 | Manual links, no date-merge narrative | 08-03 | COVERED |

---
*Research complete — ready for plan execution*
