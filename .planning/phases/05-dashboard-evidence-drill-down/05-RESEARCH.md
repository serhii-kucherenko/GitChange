# Phase 5: Dashboard & Evidence Drill-Down - Research

**Researched:** 2026-07-01
**Domain:** Full interactive localhost dashboard — era timeline, commit search/filter, file scrubber, evidence drill-down to diff hunks
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `05-CONTEXT.md` exists for this phase. Locked decisions inherited from Phases 1–4 and project research (`ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `SUMMARY.md`).

### Inherited Locked Decisions (still binding)

- **D-01 / D-17:** `.gitchange/index.sqlite` + `manifest.json`; whole `.gitchange/` gitignored by default.
- **D-16 / EVD-01:** Every narrative claim carries mandatory `evidence[]` with resolvable commit/file/doc refs; Zod-validated at write boundary.
- **P3-D-01:** Default `gitchange serve` binds **`127.0.0.1:9876`** (configurable via `GITCHANGE_PORT`).
- **P3-D-03:** Dashboard is **read-only** — all data from pre-built `.gitchange/` via Hono JSON API; **no live git walks** in server hot path (SCALE-02).
- **P3-D-05:** Phase 3 minimal dashboard is **superseded in place** — same `/gitchange-dashboard` entry point expands into full drill-down; do not create a separate app.
- **P4-D-01:** Semantic artifacts: **`eras.json`**, **`temporal-graph.json`**; manifest semantic checkpoint fields.
- **P4-D-07:** `Evidence` union includes **`doc`** type; **`hunk`** type reserved for Phase 5 (currently commented in `evidence.ts`).

### Phase 5 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P5-D-01:** Drill-down reads **SQLite + JSON artifacts only** at request time — no `es-git` in `@gitchange/server` or dashboard bundle (SCALE-02).
- **P5-D-02:** **Index-time hunk capture** extends `processCommit` to persist redacted patch excerpts in SQLite (`hunks_json` on `file_changes` or dedicated rows) so TIME-02 does not require live `git show` (evidence.ts hunk type enabled).
- **P5-D-03:** Timeline uses **`vis-timeline` 8.5.1** via thin React adapter (`useRef` + `useEffect` mount/unmount); era markers sourced from `eras.json` commit windows.
- **P5-D-04:** Large lists use **`@tanstack/react-virtual` 3.14.5**; server-state via **`@tanstack/react-query` 5.101.2**; panel drill state via **`zustand` 5.0.14** (no react-router — single SPA shell per Phase 3 pattern).
- **P5-D-05:** **EVD-02 confidence UI** in Phase 5 displays: (a) global `attributionConfidence` from `intelligence.json`, (b) manifest freshness warnings, (c) per-claim heuristic from evidence count (`high` ≥3 refs, `medium` 2, `low` 1) on era claims/inflections. Full decision-confidence model deferred to Phase 6.
- **P5-D-06:** **PRIV-04** formalizes Phase 3 behavior: default host `127.0.0.1`; `--host 0.0.0.0` requires explicit flag + stderr warning (already in `start.ts`); add integration test asserting default bind address.
- **P5-D-07:** Commit query API supports **cursor pagination** (`limit` + `cursor` on `committedAt`/`sha`) for 100k+ commit repos; default page size 50.
- **P5-D-08:** File scrubber returns **chronological file touch events** from `file_changes` indexed rows only — no blame walk at read time.

### Claude's Discretion

- vis-timeline item styling (era bands vs point markers)
- Exact hunk byte cap per file (recommend 32KB patch text, max 20 hunks/file)
- Whether file scrubber shows doc snapshot excerpts inline for doc paths
- Dashboard dev proxy target port in vite.config

### Deferred Ideas (OUT OF SCOPE)

- Temporal knowledge graph **UI** (@xyflow/react — Phase 8 DASH-02)
- Tour player (Phase 7)
- Open threads / migration threads (Phase 6 TIME-04, STAT-02)
- Multi-repo unified dashboard (Phase 8)
- chokidar auto-reindex watch (Phase 8)
- `gitchange serve` auto-open browser (unchanged from Phase 3)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Full local web dashboard on localhost from indexed artifacts | Expand Phase 3 SPA: era views, drill panels, same Hono static serve |
| DASH-03 | Index freshness and schema version | Extend `IndexStatusCard` + header badges; manifest + semantic checkpoint fields |
| DASH-04 | Virtualize large commit lists | `@tanstack/react-virtual` on commit list and file-event list |
| TIME-01 | Interactive timeline with era markers | `vis-timeline` + `eras.json` windows; click selects era |
| TIME-02 | Drill era → commit → file → diff hunk | zustand drill state + hunk capture at index + detail API |
| TIME-03 | File-centric history scrubber | `GET /api/files/:path/history` from `file_changes` |
| INGX-06 | Search/filter commits by author, path, message, date | `listCommits` core query + filter bar UI |
| PRIV-04 | Local server binds localhost by default | Formalize P3-D-01 + test; warn on `0.0.0.0` |
| EVD-02 | Confidence scores shown in UI | P5-D-05 heuristic + `attributionConfidence` badge |
| SCALE-02 | No live full-repo git walks in UI hot path | P5-D-01/P5-D-02 index-time capture; grep gate on server imports |
</phase_requirements>

## Summary

Phase 5 expands the Phase 3 minimal dashboard into the **complete evidence drill-down experience** while preserving the same install → `/gitchange-dashboard` entry point. The critical gap discovered in codebase analysis: **`file_changes` stores metadata only** — `hunkStart`/`hunkEnd` are always null and `Evidence` hunk type is commented out. TIME-02 therefore requires **index-time hunk capture** (Plan 05-04) before diff hunk panels can work without violating SCALE-02.

**Primary recommendation:** Six vertical MVP plans — (1) commit list E2E walking skeleton, (2) search/filter, (3) era timeline, (4) hunk capture + commit/file drill-down, (5) file scrubber, (6) confidence UI + PRIV-04 hardening + integration gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hunk capture at index | Core (`ingestion/hunks.ts`, `process-commit.ts`) | privacy redaction | SCALE-02: persist once, read many |
| Commit/file query reads | Core (`read/commits.ts`, `read/files.ts`) | Drizzle SQLite | No es-git in server |
| Era/timeline payload | Core (`read/eras.ts`) | `readErasArtifact` | JSON + SQLite join for commit counts |
| Drill-down REST API | Server (`routes/commits.ts`, `routes/files.ts`, `routes/eras.ts`) | core read fns | Thin Hono routes, Zod response parse |
| Dashboard layout + drill state | Client (`packages/dashboard`) | zustand store | Panel layout per STACK.md |
| Timeline visualization | Client (`components/EraTimeline.tsx`) | vis-timeline adapter | TIME-01 |
| Virtualized lists | Client (`components/CommitList.tsx`, `FileHistoryList.tsx`) | react-virtual | DASH-04 |
| Confidence badges | Client (`components/ConfidenceBadge.tsx`) | intelligence + claim heuristics | EVD-02 Phase 5 scope |
| Localhost bind policy | CLI + Server (`serve.ts`, `start.ts`) | integration test | PRIV-04 |

**No LLM tier** — dashboard consumes pre-built artifacts only.

## Standard Stack

### New for Phase 5

| Library | Version | Purpose | Package |
|---------|---------|---------|---------|
| **vis-timeline** | 8.5.1 | Era/commit timeline axis | `@gitchange/dashboard` |
| **@tanstack/react-virtual** | 3.14.5 | Virtualized commit/file lists | `@gitchange/dashboard` |
| **@tanstack/react-query** | 5.101.2 | Server-state caching for API | `@gitchange/dashboard` |
| **zustand** | 5.0.14 | Drill-down panel state | `@gitchange/dashboard` |

### Unchanged from Phase 1–4

| Library | Purpose |
|---------|---------|
| react / react-dom 19.2.7 | Dashboard UI |
| vite 8.1.2 | Build + dev proxy |
| tailwindcss 4.3.2 | Styling |
| hono 4.12.27 | API server |
| @gitchange/core | read queries, manifest, eras |

### Explicitly Deferred

| Library | Reason |
|---------|--------|
| @xyflow/react | Graph UI — Phase 8 DASH-02 |
| @tomplum/react-git-log | Branch graph nice-to-have; era timeline sufficient for v1 |
| react-router-dom | Single SPA + zustand drill state per P5-D-04 |

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| vis-timeline | npm 8.5.1 | **[OK]** — STACK.md; mature timeline lib |
| @tanstack/react-virtual | npm 3.14.5 | **[OK]** — STACK.md |
| @tanstack/react-query | npm 5.101.2 | **[OK]** — STACK.md |
| zustand | npm 5.0.14 | **[OK]** — STACK.md |

Planner inserts **blocking human-verify checkpoint** in Plan 05-01 before first `pnpm add` of new dashboard packages (slopcheck gate per threat model T-05-SC).

## Architecture Patterns

### Read Path (SCALE-02)

```
Dashboard React
    │ fetch /api/*
    ▼
Hono routes (packages/server)
    │ listCommits / getCommitDetail / getFileHistory / listEras
    ▼
@gitchange/core read/* (SQLite + eras.json)
    │ NO es-git import
    ▼
.gitchange/index.sqlite + eras.json + intelligence.json
```

### Index-Time Hunk Capture (P5-D-02)

```
processCommit (existing)
    ├─ diffCommit (file list) — existing
    └─ captureDiffHunks (NEW) — es-git patch per non-binary file
           ├─ applyPrivacy on patch text
           ├─ cap hunks per file + total bytes
           └─ persist hunks_json on file_changes row
```

Enable `Evidence` hunk type: `{ type: "hunk", path, commitSha, startLine, endLine }`.

### Drill-Down State Machine (zustand)

```
selectedEraId → filters commit list window
selectedCommitSha → shows file list + message
selectedFilePath → shows hunks_json patch + file metadata
```

Era click → set era + commit window filter. Commit click → set sha. File click → set path. Breadcrumb clears downstream selections.

### Confidence Display (EVD-02 / P5-D-05)

| Signal | Source | UI |
|--------|--------|-----|
| Index attribution | `intelligence.attributionConfidence` | Header badge: Complete / Degraded |
| Freshness | `manifest.warnings[]` | Existing warning chips + confidence downgrade |
| Claim strength | `claims[].evidence.length` | Per-claim High/Med/Low chip on era detail |

### vis-timeline Adapter Pattern

- Mount `Timeline` in `useEffect` on container ref; `destroy()` on unmount
- Items: one band per era (`start`/`end` from `startAt`/`endAt`); optional commit dots on zoom
- `select` event → `setSelectedEraId`
- Import `vis-timeline/styles/vis-timeline-graph2d.min.css` in dashboard entry

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| 100k commit DOM | Manual scroll div | @tanstack/react-virtual |
| Timeline zoom/pan | Custom D3 axis | vis-timeline |
| API cache invalidation | Custom event bus | react-query staleTime |
| Live `git show` for hunks | On-demand es-git in server | Index-time hunk capture |
| Commit filter SQL | Raw string concat | Drizzle parameterized queries |

## Common Pitfalls

### Pitfall 1: Live Git in Server Hot Path
**Symptom:** Slow dashboard on large repos; violates SCALE-02.
**Mitigation:** Grep gate: `@gitchange/server` must not import `es-git`. Hunk data captured at index.

### Pitfall 2: vis-timeline React Re-render Loop
**Symptom:** Timeline flickers, memory leak.
**Mitigation:** Imperative mount in `useEffect`; update items via `timeline.setItems()` not React re-mount.

### Pitfall 3: Unredacted Patch in hunks_json
**Symptom:** Secrets in dashboard diff view.
**Mitigation:** Run `applyPrivacy` on patch text; respect `contentIgnored`/`contentRedacted` flags; skip hunks for ignored paths.

### Pitfall 4: Full Commit Load
**Symptom:** Browser OOM on 100k commits.
**Mitigation:** Cursor pagination API; virtualizer fetches next page on scroll end.

## Codebase Gap Analysis

| Need | Current State | Phase 5 Action |
|------|---------------|----------------|
| Commit list API | Only `/api/snapshot` | Add `/api/commits` with filters + pagination |
| Hunk data | `hunkStart`/`hunkEnd` always null | P5-D-02 capture + `hunks_json` column |
| Era in dashboard | `erasSummary` in snapshot only | Full era list + timeline markers |
| File history | Not exposed | `file_changes` query by path |
| Dashboard routing | Single page App.tsx | Multi-panel layout + zustand |
| Confidence UI | Not shown | P5-D-05 badges |

## Sources

- `packages/dashboard/src/App.tsx` — Phase 3 minimal shell (HIGH)
- `packages/core/src/schema/zod/evidence.ts` — hunk type reserved comment (HIGH)
- `packages/core/src/artifacts/writer.ts` — hunkStart null (HIGH)
- `.planning/research/STACK.md` — vis-timeline, react-virtual, react-query (HIGH)
- `.planning/phases/03-cli-plugin-scaffold/03-03-SUMMARY.md` — dashboard patterns (HIGH)
- `.planning/phases/04-era-detection-semantic-pipeline/04-05-SUMMARY.md` — erasSummary API (HIGH)
