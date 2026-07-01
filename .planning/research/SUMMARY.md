# Project Research Summary

**Project:** GitChange
**Domain:** Local-first git-history onboarding / temporal codebase intelligence (plugin + CLI + web dashboard)
**Researched:** 2026-06-30
**Confidence:** HIGH

## Executive Summary

GitChange is a local-first git archaeology and onboarding tool that answers five evidence-backed questions — who changed what, how the project evolved, what decisions were made, what's still in flight, and current progress — through a guided tour, timeline, and drill-down dashboard. Experts in this space (Understand-Anything, Repowise, Historex, Vestige) converge on a **layered pipeline**: deterministic git ingestion and metrics first, host-LLM semantic synthesis second, with all outputs persisted to a derived artifact store (`.gitchange/`) that feeds both a local dashboard and IDE slash commands. GitChange should not fork Understand-Anything but copy its plugin packaging pattern while building a **temporal** (not structural) intelligence layer.

The recommended approach is a **TypeScript monorepo** (pnpm + Turborepo) with `es-git` for 100k+ commit walks, `better-sqlite3` + Drizzle for incremental OLTP indexing, Zod-validated artifacts, and a React + Vite SPA served by Hono on localhost. The v1 thin vertical slice is **ingest → era detection → dashboard → default tour → slash commands**, proving all five core questions at a basic level before adding temporal graph UI, role/topic tour variants, or multi-repo unification. Host AI (Cursor/Claude Code) is the LLM runtime; GitChange supplies schemas, tools, and artifacts only.

The dominant risks are **trust failures** (hallucinated narratives, git diffs mistaken for decisions, wrong ownership from squash merges) and **scale failures** (full-history rescans, dashboard live-git queries). Mitigate with a hard evidence contract on every claim, incremental two-phase indexing with `lastIndexedCommit` checkpoints, ownership computed from line survival with ignore-revs support, and tours capped at 4–6 chapters with mandatory drill-down proof paths. Privacy (secret redaction, `.gitchangeignore`, localhost-only server) is a Phase 1 requirement, not a polish item.

## Key Findings

### Recommended Stack

Build as a pnpm workspace mirroring Understand-Anything's proven layout: `packages/core` (ingestion, SQLite index, schemas), `packages/cli`, `packages/server` (Hono), `packages/dashboard` (React/Vite), and `packages/plugin` (skills/agents). Core exposes browser-safe subpath exports so the dashboard never imports Node-only modules (`es-git`, `better-sqlite3`).

**Core technologies:**
- **TypeScript 6 + Node 22 LTS + pnpm 11 + Turborepo 2:** Shared types across CLI, core, server, dashboard, plugin; fast TDD loop via `turbo test --filter=@gitchange/core`
- **es-git 0.7:** Primary git library — libgit2 via prebuilt napi-rs binaries; ~11× faster revwalk than shelling out to `git`; critical for 100k+ commits
- **better-sqlite3 12 + Drizzle ORM 0.45:** Incremental index store with WAL mode; typed migrations as schema evolves (commits, files, eras, decisions, ownership edges)
- **Hono 4 + React 19 + Vite 8:** Thin localhost API + SPA dashboard; no Next.js/Electron overhead
- **Zod 4 + Vitest 4 + Biome 2:** Schema validation at ingestion boundaries; golden fixtures for AI artifacts; single lint/format tool
- **piscina 5:** Worker pool for per-commit metadata parsing after es-git streams SHAs (100k+ repos)
- **@xyflow/react 12 + vis-timeline 8 + @tanstack/react-virtual 3:** Temporal graph, era timeline, virtualized commit lists

**Explicitly avoid:** isomorphic-git (bulk ingestion), nodegit (install/segfault pain), child_process git as hot path, Next.js/Electron, embedded LLM SDKs, cloud DBs, Neo4j.

### Expected Features

**Must have (table stakes — P1 launch):**
- Git history ingestion + incremental `.gitchange/` index — foundation; deterministic parsing with golden fixtures
- Evidence-linked claims with confidence scores everywhere — trust gate; every narrative links to commit SHA, path, or doc excerpt
- Interactive timeline + era→commit→file drill-down — verification path; answers "who changed what?"
- Era/chapter detection (basic) — named project phases with evidence bundles
- Guided onboarding tour (single default path, 4–6 chapters) — primary UX differentiator
- Decision mining (basic) + contributor profiles — answers questions 3 and 1 at depth
- Open-work surfacing (minimal) + status inference — answers questions 4 and 5 honestly
- Local web dashboard (timeline + tour player) — usable artifacts without re-running agents
- Plugin slash commands (`/gitchange`, `/gitchange-dashboard`) — distribution surface
- Interview loop (basic) — maintainer Q&A when evidence is weak
- Privacy controls (`.gitchangeignore`, secret redaction, no telemetry)

**Should have (competitive — P2 after v1 validation):**
- Temporal knowledge graph UI — time-first navigable graph
- Role-based and topic-thread tour variants — backend vs frontend paths; cross-cutting concerns
- Migration-centric tracker — named migrations with % complete
- Docs-over-time deep analysis — README/ADR evolution as evidence
- Churn/hotspot dashboard panel — context signals, not health scores

**Defer (v2+):**
- GitHub/GitLab PR/issue mining — API-dependent; local-git wedge first
- Hosted/synced team lore — conflicts with local-first positioning
- Multi-repo unified story — high complexity; after single-repo proof
- Static dependency/call graphs — Repowise/Understand-Anything territory
- Own LLM orchestration — host chat is the model

### Architecture Approach

Follow **deterministic-first, LLM-second** with a derived artifact store: `.git/` and project docs are canonical; `.gitchange/` is a versioned, rebuildable cache with `lastIndexedCommit`, schema version, and per-phase checkpoints. Slash commands orchestrate a multi-phase pipeline (ingestion → intelligence → semantic agents → graph assembly → graph reviewer) where host-LLM agents receive **only structured evidence bundles**, never raw git objects. Dashboard and agent tools read pre-built artifacts via a thin local API — no live git walks in the UI hot path.

**Major components:**
1. **Git + doc ingestion (core)** — es-git revwalk, diff parse, doc snapshots; 100% deterministic, TDD-covered
2. **Repository intelligence (core)** — churn, co-change, ownership, era signals, keyword extraction; pure functions, no LLM
3. **Semantic agents (plugin)** — era-synthesizer, decision-miner, tour-builder, status-inferencer; markdown specs executed by host AI
4. **Artifact store (`.gitchange/`)** — SQLite index + JSON artifacts; incremental merge; graph-reviewer validates referential integrity
5. **Local server + dashboard** — Hono serves API + static SPA; timeline, tour player, open-threads panel, drill-down
6. **Plugin surface** — slash commands, skills, multi-platform installers; copies UA packaging, separate codebase

### Critical Pitfalls

1. **Treating git history as decision evidence** — refactors and renames become false "migrations"; require multi-signal agreement, draft/confirmed workflow, and "no recorded decision found" fallback when evidence is below threshold
2. **Hallucinated narrative without drill-down proof** — polished tours that cite wrong files/commits collapse trust on first verification; schema-enforce `evidence[]` on every claim; golden fixtures test link integrity, not just JSON shape
3. **Full-history rescan architecture** — prototyping with `git log -p` per session fails at 50k+ commits; commit to two-phase index/query split in Phase 1; incremental `update` from `lastIndexedCommit` only
4. **Authorship and ownership conflation** — squash merges attribute expertise to wrong people; compute ownership from line survival at HEAD with rename tracking and `.git-blame-ignore-revs` support
5. **Stale or forked index vs canonical git/docs** — committed `.gitchange/` drifts from `main`; show freshness badge, cross-check docs vs code for status inference, rebuild on force-push detection

## Implications for Roadmap

Based on combined research, dependency chains, and pitfall prevention, suggested **8-phase** structure:

### Phase 1: Index Foundation
**Rationale:** Everything depends on deterministic ingestion and artifact schema; rescan trap, secret leakage, and shallow-clone handling are architectural commitments impossible to retrofit.
**Delivers:** Zod schemas + manifest; es-git ingestion with incremental checkpoints; SQLite index via Drizzle; secret redaction pipeline; `.gitchangeignore`; golden fixture repos; `analyzedUpTo` / force-push detection
**Addresses:** Git history ingestion, incremental re-index, privacy controls, search/filter foundation, exportable artifacts
**Avoids:** Full-history rescan (Pitfall 4), secret leakage (Pitfall 8), history integrity edge cases (Pitfall 5)
**Uses:** es-git, better-sqlite3, Drizzle, Zod, piscina (for 100k+ path)

### Phase 2: Repository Intelligence & Ownership
**Rationale:** Decisions, tours, and contributor lens all consume intelligence metrics; bad ownership poisons interview routing and expertise profiles before any LLM pass runs.
**Delivers:** `intelligence.json`; churn/hotspot signals; co-change graph with lockfile/generated-path filtering; per-file/era ownership and contributor profiles; era boundary signals (pre-LLM)
**Addresses:** Authorship & ownership visibility, contributor profiles, churn/hotspot signals (context level)
**Avoids:** Ownership conflation (Pitfall 3), co-change false signals (Pitfall 6)

### Phase 3: Deterministic Pipeline, CLI & Plugin Scaffold
**Rationale:** Enables headless dogfooding and IDE invocation before semantic agents exist; proves artifact read/write and incremental merge end-to-end.
**Delivers:** Artifact writer with checkpoint resume; CLI (`gitchange index | serve | status`); plugin package with `/gitchange` wiring; monorepo layout (`packages/core`, `cli`, `plugin`)
**Addresses:** IDE/agent integration surface (deterministic path), local-first indexing, `.gitchange/` artifact pattern
**Avoids:** Plugin path fragility (start resolver early — Pitfall 12)
**Uses:** commander, Turborepo pipelines, UA plugin packaging patterns

### Phase 4: Era Detection & Semantic Pipeline
**Rationale:** First LLM artifact; answers "how did the project evolve?" and provides scaffolding for tours and temporal graph; must run only after intelligence layer produces era signals.
**Delivers:** era-synthesizer agent spec; `eras.json` with evidence bundles; temporal graph assembler → `temporal-graph.json`; graph-reviewer for referential integrity; contributor-lens agent
**Addresses:** Engineering era/chapter detection, temporal knowledge graph (data layer), evidence-linked claims for eras
**Avoids:** Hallucinated era boundaries (robust signals + doc cross-ref — Pitfall 5), monolithic analyze  agent (specialized agents — Architecture Anti-Pattern 4)

### Phase 5: Dashboard & Evidence Drill-Down
**Rationale:** Makes artifacts usable; tour without drill-down is a critical UX failure per pitfalls research. Ship timeline + era→commit→file navigation before polishing semantic features.
**Delivers:** Hono local server; React dashboard with vis-timeline era axis; era/commit/file drill-down panels; freshness indicator; `@tanstack/react-virtual` for large lists; `127.0.0.1` default bind
**Addresses:** Interactive timeline, commit→change drill-down, file-centric history, local web dashboard, search & filter UI
**Avoids:** Dashboard live-git queries (Architecture Anti-Pattern 2), hallucinated narrative without proof path (Pitfall 2)
**Uses:** Hono, React, Vite, vis-timeline, @tomplum/react-git-log, @tanstack/react-query

### Phase 6: Decisions, Status & Open Work
**Rationale:** Answers questions 3–5; requires cached intelligence + eras; evidence contract must be designed here, not bolted on later.
**Delivers:** decision-miner agent → `decisions.json` with typed evidence spans; status-inferencer → `open-work.json`; Open Threads panel in dashboard; draft/confirmed/rejected workflow; basic interview loop (`/gitchange-interview`); docs-over-time snapshots for cross-ref
**Addresses:** Decision & migration mining, open-work surfacing, status inference with confidence, interview loop (basic), docs-over-time analysis (basic)
**Avoids:** Git history ≠ decision evidence (Pitfall 1), stale index (Pitfall 7), assuming remote PR/issue metadata (Pitfall 10)

### Phase 7: Guided Tours & Onboarding UX
**Rationale:** Primary differentiator; depends on eras, decisions, and working drill-down. Build tour content model and player together with dashboard evidence path.
**Delivers:** tour-builder agent → `tours.json`; tour player in dashboard; default 4–6 chapter onboarding tour; progress tracking; "See evidence" on every step; `/gitchange-dashboard` slash command
**Addresses:** Guided onboarding tours (era-based), tour player, evidence-linked tour narrative
**Avoids:** Tour overload without evidence path (Pitfall 9 — cap default tour, measure completion)

### Phase 8: Hardening, Scale & Extension
**Rationale:** Single-repo semantics must be correct before multi-repo; plugin packaging and 100k+ optimization belong after pipeline is stable.
**Delivers:** `doctor` command; plugin path resolver (clone + global install matrix); 100k-commit fixture passing incremental index; chokidar watch for auto-update; multi-repo story scope (manual linking); temporal graph UI (P2); optional DuckDB analytics tier if aggregations lag
**Addresses:** Scale for 100k+ commits, multi-repo unified story (basic), plugin reliability, auto-update hook
**Avoids:** Multi-repo false narrative (Pitfall 11), plugin path fragility (Pitfall 12), synchronous pipeline timeouts

### Phase Ordering Rationale

- **Fact layer before fiction layer:** Ingestion → intelligence → semantic agents is non-negotiable; LLM passes are cheaper, auditable, and replayable only when facts are cached first.
- **Drill-down before narrative polish:** Dashboard evidence path (Phase 5) precedes decision mining and tours (Phases 6–7) so every claim has a verification UI from day one of semantic output.
- **Plugin after pipeline:** Packaging fragility wastes early iteration; `/gitchange` deterministic path (Phase 3) enables dogfooding while semantic agents mature (Phases 4–7).
- **Multi-repo and graph UI last:** Feature research marks multi-repo as conflicting with v1 thin slice; temporal graph UI is P2 — timeline + tour suffice for MVP validation.
- **Parallel work after Phase 3:** Decision miner, contributor lens, and status inferencer can proceed in parallel once eras + intelligence exist (Architecture note).

### Research Flags

Phases likely needing `/gsd:plan-phase --research-phase` during planning:
- **Phase 1:** es-git streaming + batch SQLite insert patterns at 100k commits; piscina worker sizing; verify CI matrix for native modules across team OS mix
- **Phase 4:** Era/chapter detection heuristics — repo-saga, git-story, Historex patterns; changepoint vs merge-commit noise; doc-milestone cross-validation
- **Phase 6:** Decision mining confidence model — Drift draft/confirmed/rejected workflow; multi-signal agreement thresholds; docs-vs-code divergence detection for open-work
- **Phase 5:** vis-timeline React adapter quality — may need thin custom wrapper research

Phases with standard patterns (skip research-phase):
- **Phase 3:** CLI (commander), Hono localhost server, pnpm/Turborepo monorepo — well-documented, UA precedent
- **Phase 7:** Tour player UX — Vestige/UA tour patterns exist; content model is product design, not unknown tech
- **Stack choices overall:** HIGH confidence from UA + es-git benchmarks + Repowise SQLite pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | UA monorepo precedent, es-git official benchmarks, npm versions verified 2026-06-30 |
| Features | HIGH | Competitor docs + GitChange PROJECT.md; no formal market standard for table stakes (noted MEDIUM on market-wide consensus) |
| Architecture | HIGH | Convergent patterns across UA, Historex, RepoGraph, Repowise; build order dependencies clear |
| Pitfalls | HIGH | Multiple corroborating sources: MSR research, production post-mortems, competitor limitations |

**Overall confidence:** HIGH

### Gaps to Address

- **Era detection accuracy:** Heuristic + LLM labeling quality unknown until dogfood on GitChange repo and one external OSS adopter; plan golden fixtures with maintainer validation loop
- **vis-timeline React integration:** Library is mature but wrapper quality varies; budget time for thin adapter or alternative (custom D3 timeline) during Phase 5 planning
- **100k-commit ingest SLA:** es-git benchmarks are per-commit revwalk; full diff/stat aggregation at monorepo scale needs fixture validation in Phase 1/8
- **Decision mining recall:** <5% of decisions are written as ADRs per competitor notes; interview loop is essential gap-filler, not optional polish — validate maintainer engagement in dogfood
- **Multi-repo linking model:** Manual selection is required but user-defined story scope schema needs design during Phase 8 planning; defer until single-repo semantics proven

## Sources

### Primary (HIGH confidence)
- [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) — plugin pipeline, monorepo layout, React Flow dashboard, slash commands
- [es-git performance benchmarks](https://es-git.dev/performance.html) — revwalk speed vs child_process and nodegit
- [Repowise architecture & docs](https://www.repowise.dev/architecture) — SQLite persistence, git intelligence layers, MCP pattern
- [Historex README](https://github.com/beingbiplov/Historex) — ingestion → analysis → LLM layering
- [Drift Decision Mining wiki](https://github.com/dadbodgeoff/drift/wiki/Decision-Mining) — confidence thresholds, draft/confirmed/rejected
- [MSR 2021: Escaping the Time Pit](https://doi.org/10.1109/msr52588.2021.00022) — out-of-order commits, date filtering
- [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3) — WAL mode, sync API
- GitChange `.planning/PROJECT.md` — five core questions, scope, differentiation

### Secondary (MEDIUM confidence)
- [Vestige v1](https://github.com/codecharlan/vestige-v1) — file-level temporal tours, milestone types
- [Codebase Time Machine](https://github.com/yfwmaniish/codebase-time-machine) — temporal graph, role-based onboarding
- [git-story / repo-saga](https://github.com/sudokatie/git-story) — chapter detection heuristics
- [agent-sh/agent-analyzer](https://github.com/agent-sh/agent-analyzer) — two-phase index, `analyzedUpTo`, force-push fallback
- [LACY onboarding study](https://arxiv.org/html/2603.25391) — AI-only vs expert-guided tour comprehension (57% vs 83%)
- [DuckDB vs SQLite benchmarks](https://duckdblab.org/en/post/duckdb-vs-sqlite-benchmark/) — OLAP tier deferred to v1.1+
- [git-archaeologist limitations](https://github.com/SushantVerma7969/git-archaeologist) — authorship ≠ ownership

### Tertiary (needs validation during implementation)
- vis-timeline React wrapper quality — assess during Phase 5 spike
- Decision mining false-positive rate on GitChange dogfood repo — no benchmark until Phase 6 fixtures exist
- piscina worker pool optimal batch size for conventional-commit parsing at 100k scale

---
*Research completed: 2026-06-30*
*Ready for roadmap: yes*
