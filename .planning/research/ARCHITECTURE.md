# Architecture Research

**Domain:** Git-history onboarding / temporal codebase intelligence (local-first plugin + dashboard)
**Researched:** 2026-06-30
**Confidence:** HIGH (patterns verified across Repowise, Historex, RepoGraph, repowise, Deciduous/Drift)

## Standard Architecture

### System Overview

Git-history onboarding tools converge on a **layered pipeline** with a hard split between **deterministic git ingestion** and **LLM interpretation**, plus a **derived artifact store** that feeds both a **local dashboard** and **host-AI plugin commands**. GitChange should follow the IDE plugin pattern (slash commands → multi-agent pipeline → `.gitchange/` → local server) while borrowing temporal-specific patterns from Historex, RepoGraph, and decision-mining tools.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Host AI (Cursor / Claude Code)                       │
│  Slash commands: /gitchange, /gitchange-dashboard, /gitchange-interview│
│  LLM = semantic layer only (eras, decisions, tours, status inference)   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ orchestrates agents, reads/writes context
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        Plugin / Skill Surface                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Agent specs  │  │ Command defs │  │ Install/sync │  │ MCP/tools   │ │
│  │ (markdown)   │  │ (skills)     │  │ (multi-plat) │  │ (optional)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └─────────────┘ │
├─────────┴─────────────────┴────────────────────────────────────────────┤
│                     Orchestration & CLI                                   │
│  Pipeline runner · incremental checkpoint · multi-repo merge · redaction │
├──────────────────────────────────────────────────────────────────────────┤
│                     Semantic Pipeline (host-LLM agents)                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│
│  │ era-       │ │ decision-  │ │ tour-      │ │ status-    │ │ graph- ││
│  │ synthesizer│ │ miner      │ │ builder    │ │ inferencer │ │reviewer││
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └───┬────┘│
│        └──────────────┴──────────────┴──────────────┴──────────────┘   │
│              Input: structured repo intelligence + evidence spans only  │
├──────────────────────────────────────────────────────────────────────────┤
│                     Repository Intelligence (deterministic)               │
│  churn · co-change · ownership · hotspots · era signals · doc deltas     │
├──────────────────────────────────────────────────────────────────────────┤
│                     Git Ingestion (deterministic, TDD core)               │
│  commit walk · diffs · authors · paths · messages · merge detection      │
├──────────────────────────────────────────────────────────────────────────┤
│                     Canonical Sources                                       │
│  ┌─────────────────────┐              ┌─────────────────────┐            │
│  │  .git/ (history)    │              │  docs/ README ADRs  │            │
│  └─────────────────────┘              └─────────────────────┘            │
├──────────────────────────────────────────────────────────────────────────┤
│                     Derived Artifact Store (.gitchange/)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ index    │ │ temporal │ │ tours    │ │ decisions│ │ contributors │ │
│  │ metadata │ │ graph    │ │          │ │ + status │ │ + open work  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
├───────┴──────────────┴────────────┴────────────┴──────────────┴────────┤
│                     Read API + Local Web Server                           │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ REST/static file server     │  │ Dashboard (timeline, graph,     │  │
│  │ (serve artifacts, drill-down)│  │ tour player, open-threads panel) │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation | GitChange Notes |
|-----------|----------------|------------------------|-----------------|
| **Git ingestion** | Walk history; extract commits, authors, file deltas, messages, timestamps | GitPython, libgit2, or `git log`/`git show` subprocess with structured parsers | Must be 100% deterministic; golden fixtures; incremental from last indexed SHA |
| **Doc ingestion** | Track README/ADR/doc changes across commits | Path-filtered diff + content snapshots at era boundaries | Cross-reference with code migrations for status inference |
| **Repository intelligence** | Compute churn, co-change pairs, ownership %, bus factor, era boundaries, keyword signals | Pure functions over ingestion output; no LLM | Historex/RepoGraph pattern: facts before interpretation |
| **Semantic agents** | Eras, decision narratives, tours, open-work status, interview prompts | Host-LLM subagents driven by markdown specs; input = structured JSON only | Constrain LLM to evidence spans; never raw full-repo analysis |
| **Artifact writer** | Persist derived index to `.gitchange/`; schema versioning; incremental merge | JSON (+ optional SQLite for large repos); manifest with `lastIndexedCommit` | Git/docs remain canonical; `.gitchange/` is disposable cache |
| **Graph reviewer** | Validate referential integrity (era→commit, decision→evidence, tour→nodes) | Deterministic checks + optional LLM review pass | Same role as artifact integrity reviewers |
| **Orchestrator / CLI** | Run full or incremental pipeline; multi-repo merge; privacy redaction | Node or Python CLI invoked by slash commands | `/gitchange` triggers pipeline; `/gitchange-dashboard` serves UI |
| **Plugin surface** | Slash commands, skills, platform installers | `.cursor-plugin/`, skill markdown, install scripts | Copy plugin packaging patterns only; separate codebase |
| **Query / read API** | Serve artifacts to dashboard and chat context | Thin static server or FastAPI/Express reading `.gitchange/` | No write path except pipeline + interview writeback |
| **Dashboard** | Timeline, temporal graph, tour player, drill-down (era→commit→file) | React + graph lib (React Flow / D3) + local Vite dev server | Reads artifacts only; no ingestion in browser |
| **Interview loop** | Surface weak-evidence gaps; write maintainer answers to project docs | Chat-driven; persists to `docs/` or `.gitchange/interviews/` then re-index | Host AI asks; GitChange supplies evidence gaps |

## Recommended Project Structure

```
gitchange/
├── packages/
│   ├── core/                    # Shared engine (no UI, no plugin manifests)
│   │   ├── ingestion/           # Git walk, diff parse, doc snapshots
│   │   ├── intelligence/        # Churn, co-change, ownership, era signals
│   │   ├── schema/              # JSON schemas, validators, golden fixtures
│   │   ├── artifacts/           # Read/write .gitchange/, incremental merge
│   │   ├── privacy/             # Redaction, .gitchangeignore
│   │   └── pipeline/            # Phase ordering, checkpoints, multi-repo
│   ├── cli/                     # Headless: gitchange index | serve | status
│   ├── plugin/                  # Slash commands, agent markdown, installers
│   │   ├── skills/              # /gitchange, /gitchange-dashboard, etc.
│   │   └── agents/              # era-synthesizer, decision-miner, tour-builder…
│   └── dashboard/               # React app: timeline, graph, tours
│       ├── api/                 # Optional thin adapter over artifact files
│       └── components/          # Timeline, TourPlayer, OpenThreads, DrillDown
├── fixtures/                    # Golden repos + expected .gitchange/ outputs
├── package.json                 # Monorepo root (pnpm workspaces recommended)
└── .cursor-plugin/              # Cursor auto-discovery (plugin pattern)
```

### Structure Rationale

- **`packages/core/`:** All deterministic logic and artifact I/O live here so ingestion stays testable without a running LLM or browser. Matches standard `packages/core` split and Historex's `ingestion/` + `analysis/` separation.
- **`packages/plugin/`:** Agent orchestration is markdown + command wiring; host AI executes agents. Keeps GitChange from owning an LLM runtime.
- **`packages/dashboard/`:** Read-only consumer of `.gitchange/` JSON. Can ship before semantic agents are complete if core artifacts exist.
- **`packages/cli/`:** Enables CI, dogfooding, and dashboard bootstrapping without an IDE session.
- **`.gitchange/` at repo root (generated):** Uses a generated `.gitchange/` folder — team may commit for onboarding; `intermediate/` stays gitignored.

## Architectural Patterns

### Pattern 1: Deterministic-First, LLM-Second Pipeline

**What:** Parse git and compute metrics deterministically; pass only structured evidence bundles to host-LLM agents for narrative synthesis.
**When to use:** Always — core product requirement and anti-hallucination strategy.
**Trade-offs:** More upfront schema design; LLM passes are cheaper and auditable; replays are reproducible on the fact layer.

**Example (Historex / repowise / GitChange):**
```typescript
// Phase 1 — deterministic (core package)
const commits = await gitIngestion.walk(repo, { since: lastIndexedSha });
const intelligence = repositoryIntelligence.compute(commits);

// Phase 2 — semantic (host LLM via plugin agents)
// Agent receives ONLY intelligence + evidence spans, not raw git objects
const eras = await hostAgent.run("era-synthesizer", {
  input: intelligence.eraSignals,
  evidence: intelligence.topInflectionCommits,
});
```

### Pattern 2: Derived Artifact Store with Incremental Checkpoints

**What:** Canonical truth stays in `.git/` and project docs; `.gitchange/` is a versioned, rebuildable index with `lastIndexedCommit`, per-entity fingerprints, and schema version.
**When to use:** All indexing runs; required for 100k+ commit monorepos.
**Trade-offs:** Must handle schema migrations; disk size (mitigate with git-lfs for large graphs, per plugin guidance).

**Example:**
```typescript
interface GitChangeManifest {
  schemaVersion: string;
  lastIndexedCommit: string;
  indexedAt: string;
  repos: Array<{ path: string; head: string }>;
  checkpoints: {
    ingestion: string;
    intelligence: string;
    semantic: string;
  };
}
```

### Pattern 3: Plugin-as-Orchestrator

**What:** Slash commands define multi-phase pipelines; the IDE's agent runtime executes specialized subagents; deterministic scripts run between agent phases.
**When to use:** GitChange's primary distribution model (Cursor, Claude Code).
**Trade-offs:** Depends on host agent quality; mitigated by strict agent I/O schemas and graph-reviewer validation.

**Pipeline phases (adapted from plugin + semantic batching):**
```
Phase 0   repo-selector / multi-repo config     → repos.json
Phase 1   git-ingestion (+ doc-ingestion)       → commits-index.json, doc-snapshots/
Phase 1.5 repository-intelligence               → intelligence.json
Phase 2   era-synthesizer (LLM)                 → eras.json
Phase 3   decision-miner (LLM)                  → decisions.json
Phase 4   status-inferencer (LLM + patterns)    → open-work.json
Phase 5   tour-builder (LLM)                  → tours.json
Phase 6   temporal-graph-assembler              → temporal-graph.json
Phase 7   graph-reviewer (deterministic + opt LLM) → validated graph
```

### Pattern 4: Evidence-Linked Decision Graph

**What:** Decisions are nodes with typed evidence spans (commit SHA, file path, doc excerpt); edges include `supersedes`, `refines`, `implements`, `blocked-by`.
**When to use:** Decision mining, interview loop, drill-down navigation.
**Trade-offs:** Requires consistent evidence schema; repowise and Deciduous validate this as the differentiator vs flat summaries.

**Example:**
```typescript
interface DecisionNode {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "superseded" | "in_flight";
  confidence: number;
  evidence: Array<
    | { type: "commit"; sha: string; excerpt: string }
    | { type: "doc"; path: string; revision: string; excerpt: string }
    | { type: "interview"; path: string; author: string; excerpt: string }
  >;
  relatedFiles: string[];
  eraId: string;
}
```

### Pattern 5: Thin Read API over Artifacts

**What:** Dashboard and chat tools query pre-built JSON via a local server; no live git walks in the UI hot path.
**When to use:** Dashboard, `/gitchange-dashboard`, agent context injection.
**Trade-offs:** Stale until re-index; acceptable because incremental updates are fast for new commits only.

## Data Flow

### Full Index Flow (cold start)

```
User: /gitchange
    ↓
Plugin reads repo path(s) + .gitchangeignore + privacy rules
    ↓
Git Ingestion ──commits, diffs, authors, messages──▶ commits-index.json
Doc Ingestion ──README/ADR deltas───────────────────▶ doc-snapshots/
    ↓
Repository Intelligence ──churn, co-change, ownership──▶ intelligence.json
    ↓
Host LLM Agents (sequential + bounded parallel)
    era-synthesizer ──▶ eras.json
    decision-miner  ──▶ decisions.json
    status-inferencer ▶ open-work.json
    tour-builder    ──▶ tours.json
    contributor-lens ─▶ contributors.json
    ↓
Temporal Graph Assembler ──merge nodes/edges──▶ temporal-graph.json
    ↓
Graph Reviewer ──validate refs, confidence──▶ manifest.json (complete)
    ↓
User: /gitchange-dashboard → local server reads .gitchange/ → browser UI
```

### Incremental Update Flow (warm)

```
post-commit hook OR /gitchange (default incremental)
    ↓
Read manifest.lastIndexedCommit
    ↓
Git Ingestion (new commits only) → patch commits-index.json
    ↓
Recompute affected intelligence slices (files touched, active eras)
    ↓
Re-run semantic agents ONLY for affected eras/decisions/tours
    ↓
Graph reviewer → bump manifest
```

### Drill-Down Navigation Flow (dashboard)

```
Timeline era card
    ↓ click
Era detail (commits, decisions, contributors)
    ↓ click commit
Commit detail (message, diff stats, linked files, decisions)
    ↓ click file
File-centric history (ownership timeline, co-change partners, migrations)
    ↓
Temporal graph highlights same nodes/edges (shared IDs across artifacts)
```

### Interview Loop Flow

```
Pipeline flags low-confidence decision or era gap
    ↓
/gitchange-interview (or inline in chat) presents evidence + question
    ↓
Maintainer answer → write to docs/ or .gitchange/interviews/
    ↓
Re-index merges interview evidence into decisions.json (higher confidence)
```

### State Management

```
Canonical (git + docs)          Derived (.gitchange/)
        │                              ▲
        │                              │ write (pipeline only)
        └──────── read ────────────────┤
                                       │
Dashboard / Plugin / CLI ── read API ──┘
        │
        └── subscribe: manifest version / SSE progress during index
```

### Key Data Flows

1. **Who changed what:** `commits-index` + `contributors.json` → contributor lens UI; ownership computed in intelligence layer from per-file author timelines.
2. **How project evolved:** `eras.json` + `temporal-graph.json` → timeline + graph; era boundaries from intelligence signals + LLM synthesis.
3. **Decisions (past):** `decisions.json` with evidence links → decision tracker + graph nodes; mined from commits, docs, conventional commit patterns.
4. **Decisions (in flight):** `open-work.json` with confidence scores → Open Threads panel + inline badges; pattern + keyword + doc/code divergence.
5. **Current progress:** `open-work.json` + latest commits → status badges on tours/timeline; agent query via plugin context.

## Suggested Build Order

Dependencies dictate phase ordering. Build the **fact pipeline** before **semantic agents**; build **artifact schema** before **dashboard**; build **thin vertical slice** before **multi-repo** and **scale optimizations**.

| Order | Component | Depends On | Delivers |
|-------|-----------|------------|----------|
| **1** | Schema + manifest | — | Contract for all artifacts; golden fixture tests |
| **2** | Git ingestion | Schema | `commits-index.json`; TDD core |
| **3** | Repository intelligence | Git ingestion | `intelligence.json`; no LLM |
| **4** | Artifact writer + incremental | 1–3 | `.gitchange/` read/write, checkpoint resume |
| **5** | CLI (`index`, `status`) | 1–4 | Headless dogfooding |
| **6** | Plugin scaffold + `/gitchange` | 1–5 | End-to-end deterministic index from IDE |
| **7** | Era synthesizer agent | 1–6 | First LLM artifact; timeline raw material |
| **8** | Temporal graph assembler | 1–7 | `temporal-graph.json` |
| **9** | Local server + thin dashboard | 1–8 | Timeline + era→commit drill-down (MVP UI) |
| **10** | Decision miner + evidence model | 1–9 | Third core question answered |
| **11** | Tour builder | Eras + graph | Guided onboarding differentiator |
| **12** | Status inferencer + open work | Decisions + intelligence | In-flight work surfacing |
| **13** | Contributor lens | Intelligence + eras | "Who changed what" UX completeness |
| **14** | Interview loop + doc writeback | Decisions | Gap-filling workflow |
| **15** | Graph reviewer + schema validation | All artifacts | CI gate for AI outputs |
| **16** | Privacy (.gitchangeignore, redaction) | Ingestion | Private-repo safety |
| **17** | Multi-repo merge | Pipeline | Unified story across repos |
| **18** | Scale (streaming ingest, chunked graph) | All core | 100k+ commits |

**Critical path for thin vertical slice (PROJECT.md):** 1 → 2 → 3 → 4 → 6 → 7 → 9 → 11 — ingest → era → dashboard → tour.

**Parallelizable after step 6:** Decision miner (10), contributor lens (13), and status inferencer (12) can proceed in parallel once eras + intelligence exist.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Small repo (<5k commits)** | Single JSON files; full re-index acceptable; monolith fine |
| **Medium (5k–50k commits)** | Incremental indexing mandatory; chunk `commits-index` by year or SHAs; intelligence computed incrementally per touched files |
| **Large monorepo (50k–100k+ commits)** | Stream git walk (don't load all commits in memory); optional SQLite for commit/file stats; temporal graph partitioned by era; semantic agents scoped to active eras only; git commit-graph + path filters for `git log` performance |
| **Multi-repo** | Per-repo `.gitchange/` with `story-merge.json` at workspace level; shared contributor IDs by email; cross-repo edges manual or config-driven |

### Scaling Priorities

1. **First bottleneck: git walk** — Use `git log` with `--commit-graph`, path filters, and incremental `since`; persist checkpoints every N commits. (Git commit-graph file is the standard optimization; see [git commit-graph docs](https://git-scm.com/docs/commit-graph).)
2. **Second bottleneck: LLM semantic passes** — Scope agents to era deltas and high-signal commits only; never re-synthesize unchanged eras on incremental runs.
3. **Third bottleneck: dashboard graph render** — Era-partitioned subgraphs; lazy-load commit/file detail on drill-down; don't render 100k nodes at once.

## Anti-Patterns

### Anti-Pattern 1: LLM Reads Raw Git Directly

**What people do:** Ask the host AI to `git log` and narrate history ad hoc.
**Why it's wrong:** Non-reproducible, expensive, misses cross-file signals (co-change, ownership), no persistent drill-down artifacts.
**Do this instead:** Deterministic ingestion → structured intelligence → constrained semantic agents → `.gitchange/` artifacts.

### Anti-Pattern 2: Dashboard Performs Live Git Operations

**What people do:** Dashboard calls `git show` on every click.
**Why it's wrong:** Slow UX; can't precompute graph layout; hard to redact secrets consistently.
**Do this instead:** Pre-index into `.gitchange/`; dashboard reads artifacts via local API; re-index on demand or hook.

### Anti-Pattern 3: Storing Canonical State in `.gitchange/`

**What people do:** Treat generated JSON as source of truth; edit decisions only in index.
**Why it's wrong:** Diverges from git/docs; team can't PR maintainer lore; index rebuild loses edits.
**Do this instead:** Interview answers and maintainer knowledge flow to `docs/` (or ADRs); `.gitchange/` rebuilds from git + docs.

### Anti-Pattern 4: Monolithic "Analyze Everything" Agent

**What people do:** Single LLM pass for eras + decisions + tours + status.
**Why it's wrong:** Context overflow on large repos; poor validation; one failure loses all outputs.
**Do this instead:** Specialized agents per concern (Historex-style pattern) with graph-reviewer between phases.

### Anti-Pattern 5: Graph Without Stable IDs

**What people do:** Generate nodes with display-name IDs (`"Auth Rewrite"`).
**Why it's wrong:** Drill-down breaks across artifacts; incremental merge corrupts references.
**Do this instead:** Stable IDs (`era:2024-q1-auth`, `commit:abc123`, `decision:redis-sessions`); graph-reviewer enforces referential integrity.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Host AI (Cursor, Claude Code)** | Plugin skills + agent markdown; LLM not bundled | GitChange supplies tools, schemas, artifacts — per PROJECT.md |
| **Git** | Local subprocess or libgit2; read-only | No GitHub/GitLab API in v1 |
| **Ollama / local models** | Optional via host platform config | GitChange does not ship model runtime |
| **MCP (optional v2)** | Task-shaped tools over `.gitchange/` like repowise | Not required for v1 thin slice; repowise pattern for agent queries |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **ingestion ↔ intelligence** | Typed `CommitRecord[]` / file stats | Pure functions; no side effects |
| **intelligence ↔ semantic agents** | `intelligence.json` + evidence bundles | Agents never call git directly |
| **semantic agents ↔ artifacts** | Schema-validated JSON writes | Golden fixtures per agent output |
| **artifacts ↔ dashboard** | Read-only HTTP or static file serve | Dashboard has zero write access |
| **plugin ↔ CLI** | CLI invoked by slash command scripts | Same `packages/core` entrypoints |
| **interview ↔ docs** | File writes to `docs/` then re-index | Chat orchestrates; core ingests new doc evidence |

## Comparison: Reference Architectures

| Tool | Ingestion | Intelligence | Semantic | Store | UI | Agent Surface |
|------|-----------|--------------|----------|-------|-----|---------------|
| **Structural graph tools** | Tree-sitter scan | Import graph | Host LLM agents | `.gitchange/*.json` | React dashboard | Slash commands |
| **Historex** | GitPython | Python analysis | Ollama (local) | HTML/MD reports | FastAPI web | Web form |
| **RepoGraph** | GitPython | Graph metrics | None | FalkorDB | Flask + D3 | CLI |
| **repowise** | Tree-sitter + git | Multi-layer index | Docs generation | SQLite + vectors | Next.js + MCP | MCP tools |
| **GitChange (target)** | Git + docs | Temporal metrics | Host LLM agents | `.gitchange/*.json` | React dashboard | Slash commands |

**GitChange positioning:** A plugin + dashboard shape, Historex's git-archaeology layering, RepoGraph's contributor/co-change graph model, repowise/Deciduous's evidence-linked decision graph — applied to the five onboarding questions.

## Sources

- [Historex README](https://github.com/beingbiplov/Historex) — ingestion → analysis → LLM → output layering; evidence-first LLM (HIGH)
- [RepoGraph README](https://github.com/FalkorDB/RepoGraph) — git analyzer → graph builder → query → web; temporal snapshots (HIGH)
- [repowise concepts](https://github.com/repowise-dev/repowise/blob/main/website/concepts.md) — scan → extract → analysis → indexing → persistence; decision lineage (MEDIUM)
- [Drift Decision Mining](https://github.com/dadbodgeoff/drift/wiki/Decision-Mining) — commit clustering → ADR generation with evidence (MEDIUM)
- [Deciduous](https://deciduous.dev/) — narrative decision graph from commits (MEDIUM)
- [Git commit-graph documentation](https://git-scm.com/docs/commit-graph) — large-repo walk optimization (HIGH)
- GitChange `.planning/PROJECT.md` — product constraints and five core questions (HIGH)

---
*Architecture research for: GitChange — git-history onboarding / temporal codebase intelligence*
*Researched: 2026-06-30*
