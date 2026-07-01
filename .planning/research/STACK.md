# Stack Research

**Domain:** Local-first git-history analysis plugin + CLI + web dashboard (100k+ commits)
**Researched:** 2026-06-30
**Confidence:** HIGH (core choices); MEDIUM (optional analytics tier)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 6.0.3 | Language across CLI, core, server, dashboard, plugin | De facto standard for AI coding plugins (Understand-Anything, Repowise dashboard). Shared types between ingestion and UI; strict mode + Vitest TDD match project constraints. |
| **Node.js** | 22.x LTS | Runtime | Required by `better-sqlite3@12` (engines: 20/22/23/24/25/26). LTS stability for native modules (`es-git`, `better-sqlite3`). Avoid Node 24+ edge cases with native addons until validated. |
| **pnpm** | 11.9.0 | Monorepo package manager | Workspace protocol, fast installs, disk efficiency. Proven in Understand-Anything plugin monorepo pattern GitChange copies. |
| **Turborepo** | 2.10.2 | Monorepo task orchestration | Cache `build`/`test`/`lint` across `packages/*`. Keeps core ingestion TDD loop fast as packages grow. |
| **es-git** | 0.7.0 | Primary git library (revwalk, blame, diff, trees) | libgit2 via napi-rs with prebuilt binaries — no node-gyp pain. Benchmarks: ~11× faster revwalk than `child_process`, ~6% faster than nodegit ([es-git performance](https://es-git.dev/performance.html)). Critical for 100k+ commit walks. |
| **better-sqlite3** | 12.11.1 | Incremental index store | Synchronous, fast OLTP for point lookups (era → commit → file drill-down). WAL mode handles concurrent reads during re-index. Repowise uses SQLite for persistence; same pattern fits GitChange's derived cache. |
| **Hono** | 4.12.27 | Local API server | Minimal overhead for localhost-only dashboard API. Pairs with `@hono/node-server@2.0.6`. No SSR/edge features needed — lighter than Fastify for a thin static-file + JSON API layer. |
| **React** | 19.2.7 | Dashboard UI | Ecosystem depth for graph/timeline/virtualization libs. Matches proven Understand-Anything dashboard stack. |
| **Vite** | 8.1.2 | Dashboard bundler + dev server | Fast HMR for UI iteration; static build served by Hono in production. No Next.js overhead for a local-only SPA. |
| **Vitest** | 4.1.9 | Unit + integration tests | Native ESM, TypeScript, fixture-friendly. Understand-Anything uses Vitest for core TDD; aligns with GitChange's ingestion-first testing mandate. |
| **Zod** | 4.4.3 | Schema validation | Validates AI-generated artifacts (eras, decisions, tours) and index records. Fail-fast at ingestion boundaries; golden-fixture tests compare parsed output against Zod schemas. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **simple-git** | 3.36.0 | Thin git CLI wrapper | Fallback for operations es-git doesn't expose cleanly (e.g. `git log --format=...` one-offs, porcelain edge cases). Not the hot path for 100k-commit walks. |
| **drizzle-orm** | 0.45.2 | SQLite schema + migrations | Typed tables for commits, files, eras, decisions, ownership edges. Use from day one — index schema will evolve; raw SQL migrations become painful at 100k+ rows. |
| **piscina** | 5.2.0 | Worker thread pool | Parallelize per-commit parsing (conventional commit extraction, file stat aggregation) after es-git streams SHAs. Keeps main thread responsive for CLI progress output. |
| **conventional-commits-parser** | 7.0.0 | Parse conventional commit messages | Deterministic status/migration keyword extraction. Part of TDD-covered ingestion, not LLM inference. |
| **commander** | 15.0.0 | CLI entry (`gitchange`, `gitchange serve`) | Standard Node CLI UX for `init`, `index`, `serve`, `status`. |
| **@xyflow/react** | 12.11.1 | Temporal knowledge graph | Interactive node-edge graph with pan/zoom/selection. Proven in Understand-Anything; handles hundreds of nodes well with virtualization patterns. |
| **vis-timeline** | 8.5.1 | Era / commit timeline axis | Horizontal timeline for era chapters, inflection points, migration windows. Mature zoom/pan; wrap in React via thin adapter (no heavy re-render wrapper). |
| **@tomplum/react-git-log** | 3.5.1 | Commit graph in drill-down | Branching commit graph for era → commit navigation. Actively maintained (2026 releases); TypeScript-native. |
| **@tanstack/react-query** | 5.101.2 | Server-state caching | Cache dashboard API responses; stale-while-revalidate during background re-index. |
| **@tanstack/react-virtual** | 3.14.5 | Virtualized commit/file lists | Render 100k-row commit lists without DOM blow-up in drill-down panels. |
| **zustand** | 5.0.14 | Client UI state | Tour player position, selected era/commit, panel layout. Minimal boilerplate; Understand-Anything precedent. |
| **tailwindcss** | 4.3.2 | Dashboard styling | Utility-first; v4 CSS-first config. Matches modern plugin-dashboard aesthetic. |
| **chokidar** | 5.0.0 | Watch `.git/` for incremental re-index | Detect new commits after `git commit`; trigger delta index pass. |
| **gray-matter** | 4.0.3 | Parse markdown frontmatter | Mine ADRs, changelogs, README evolution from docs-over-time analysis. |
| **minimatch** | (bundled via chokidar) | `.gitchangeignore` patterns | Secret/path exclusion during indexing. |
| **ulid** | 2.3.0 | Stable artifact IDs | Sortable, collision-resistant IDs for graph nodes/eras without UUID verbosity. |
| **tsx** | 4.22.4 | Dev execution of TS CLI | `pnpm dev` without separate compile step during iteration. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **@biomejs/biome** | 2.5.1 | Lint + format (single tool) | Faster than ESLint+Prettier for greenfield TS monorepo. Run in CI via `turbo lint`. |
| **TypeScript** `strict: true` | Type safety | Non-negotiable for shared core ↔ dashboard types. |
| **turbo** | Pipeline caching | `turbo test --filter=@gitchange/core` for fast ingestion TDD loop. |

## Monorepo Layout

```
gitchange/
├── packages/
│   ├── core/          # Git ingestion, SQLite index, Zod schemas, search API
│   ├── server/        # Hono local API + static dashboard serve
│   ├── dashboard/     # React + Vite SPA
│   ├── cli/           # commander entrypoints
│   └── plugin/        # Skills, agents, manifests (Cursor/Claude Code)
├── agents/            # Agent prompt definitions (markdown)
├── skills/            # Slash command definitions
├── tests/
│   ├── fixtures/      # Golden repos + expected index snapshots
│   └── integration/
├── pnpm-workspace.yaml
├── turbo.json
└── vitest.config.ts
```

**Rationale:** Mirrors Understand-Anything's proven plugin monorepo without forking it. `core` exposes browser-safe subpath exports (`./types`, `./schema`, `./search`) so the dashboard never imports Node-only modules (es-git, better-sqlite3).

## Installation

```bash
# Prerequisites: Node 22.x, pnpm 11.x, git 2.x on PATH

# Monorepo bootstrap
pnpm install

# Core (ingestion + index)
pnpm add es-git better-sqlite3 drizzle-orm zod conventional-commits-parser ulid gray-matter -F @gitchange/core
pnpm add -D drizzle-kit @types/better-sqlite3 -F @gitchange/core

# Server
pnpm add hono @hono/node-server chokidar -F @gitchange/server

# CLI
pnpm add commander -F @gitchange/cli

# Dashboard
pnpm add react react-dom @xyflow/react zustand @tanstack/react-query @tanstack/react-virtual vis-timeline @tomplum/react-git-log -F @gitchange/dashboard
pnpm add -D vite @vitejs/plugin-react tailwindcss -F @gitchange/dashboard

# Workers (core)
pnpm add piscina -F @gitchange/core

# Dev (root)
pnpm add -D typescript vitest turbo @biomejs/biome tsx -w
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **TypeScript monorepo** | Python (Repowise stack) | If team has zero TS capacity and accepts slower plugin integration. Repowise proves Python works for git analytics, but GitChange's UA-style multi-platform plugin packaging is TypeScript-native. |
| **es-git** | `child_process` + `git` CLI | Tiny repos (<5k commits) or CI-only environments where native addons are banned. Accept 10–100× slower full-history walks. |
| **es-git** | nodegit@0.27.0 | Never for v1 — install failures on non-Ubuntu Linux, segfault risk on auth errors, node-gyp compile on many platforms. |
| **es-git** | isomorphic-git | Browser/WASM git needed (e.g. in-dashboard git without CLI). Not suitable for 100k+ commit ingestion — packfile re-parse per operation, documented memory traps ([isomorphic-git cache docs](https://isomorphic-git.org/docs/en/cache)). |
| **better-sqlite3** | DuckDB@1.4.4 | Heavy cross-commit analytics (aggregations over 100k+ rows, window functions). Add as read-only analytics layer in v1.1+, not primary index. DuckDB 10–200× faster on GROUP BY but poor incremental OLTP writes. |
| **Hono** | Fastify@5.9.0 | Need mature plugin ecosystem (rate limiting, complex hooks). Fastify is excellent; Hono wins on bundle size for a localhost tool. |
| **Vite + React SPA** | Next.js | Never for v1 — no SSR/SEO need; adds server complexity to a local-first tool. |
| **@xyflow/react** | D3 raw / Cytoscape.js | Need automatic graph layout only with zero React integration. React Flow is the ecosystem default for interactive code graphs in 2025–2026. |
| **drizzle-orm** | Raw better-sqlite3 SQL | Prototype only. Schema will grow (commits, files, eras, decisions, ownership, migrations); migrations without ORM become rewrite risk. |
| **Biome** | ESLint + Prettier | Team already standardized on ESLint (e.g. copying UA config verbatim). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **isomorphic-git** (bulk ingestion) | Pure-JS packfile parsing; 100s of ms per status op; memory blow-up without careful cache lifecycle. Unacceptable for 100k+ commit monorepos. | **es-git** for hot path; **simple-git** for rare CLI fallbacks |
| **nodegit** | libgit2 bindings via node-gyp; install failures, segfaults, poor DX. es-git solves same problem with prebuilt napi-rs binaries. | **es-git** |
| **`git` CLI via child_process** (primary) | ~13ms per commit × 100k = 20+ minutes minimum for basic walks; parsing stdout is fragile. | **es-git** revwalk (~1.2ms/commit in benchmarks) |
| **Next.js / Remix** | SSR, deployment, and routing complexity irrelevant to localhost dashboard. | **Vite + React SPA** served by Hono |
| **Electron** | Massive install footprint; git + browser dashboard sufficient. | **CLI + local HTTP server** (UA pattern) |
| **Neo4j / dedicated graph DB** | Operational overhead for local-first tool; graph fits in SQLite + JSON artifacts. | **SQLite edges table** + **@xyflow/react** for viz |
| **Cloud DB (Postgres, Supabase)** | Violates local-first v1 constraint; no cloud SaaS in scope. | **better-sqlite3** in `.gitchange/` |
| **Embedded LLM SDK (OpenAI, Anthropic)** | Host chat is the LLM; GitChange supplies tools and artifacts only. | **Zod-validated JSON artifacts** consumed by agent skills |
| **MongoDB / JSON-file-only index** | No indexed queries at 100k+ commits; drill-down latency unacceptable. | **SQLite with proper indexes** + JSON export for human readability |
| **Rust / Go rewrite for v1** | Slower iteration; plugin ecosystem is TypeScript. Optimize hot paths with es-git (Rust/libgit2 under the hood) instead. | **TypeScript + es-git + piscina workers** |
| **GitHub/GitLab API** | Out of scope; local clone only. | **Local `.git` directory** via es-git |

## Stack Patterns by Variant

**If indexing a single repo (<10k commits):**
- Skip piscina worker pool initially; single-threaded es-git revwalk is fast enough.
- SQLite still worth it for indexed drill-down, but JSON-only prototype acceptable for spike.

**If indexing 100k+ commits (v1 requirement):**
- es-git streaming revwalk → batch insert to SQLite (transactions of 500–1000 rows).
- piscina workers for per-commit metadata parsing (conventional commits, file stats).
- WAL mode + indexes on `(repo_id, committed_at)`, `(repo_id, path)`, `(era_id)`.
- Dashboard: virtualize all lists; paginate API responses.

**If multi-repo unified story:**
- Single SQLite DB with `repo_id` column; CLI prompts user to select related repos.
- es-git opens each `.git` sequentially; parallel repo indexing only after single-repo path is stable.

**If browser must work offline without Node (future):**
- Dashboard reads pre-built `.gitchange/index.sqlite` via **sql.js** or **wa-sqlite** (read-only).
- Ingestion stays Node-only — do not move es-git to browser.

**If cross-commit analytics lag (era aggregations, ownership rollups):**
- Add **DuckDB@1.4.4** as read-only analytics engine querying SQLite export or Parquet snapshots.
- Do not replace SQLite as write path.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `es-git@0.7.0` | `Node 20.x–26.x` | Prebuilt binaries per platform; verify CI matrix matches team OS mix. |
| `better-sqlite3@12.11.1` | `Node 20.x–26.x` | Native module; rebuild on Node major upgrade. |
| `drizzle-orm@0.45.2` | `better-sqlite3@12.x` | Use `drizzle-orm/better-sqlite3` adapter. |
| `vite@8.1.2` | `@vitejs/plugin-react@6.0.3` | Matched pair for React 19 dashboard. |
| `react@19.2.7` | `@xyflow/react@12.11.1` | React Flow v12 supports React 18+; verified compatible. |
| `hono@4.12.27` | `@hono/node-server@2.0.6` | Use `@hono/node-server` for Node serve, not deprecated adapters. |
| `vitest@4.1.9` | `vite@8.x` | Shared config; vitest 4 aligns with Vite 8. |
| `typescript@6.0.3` | All above | Enable `moduleResolution: "bundler"`, `strict: true`. |

## Confidence by Recommendation

| Area | Confidence | Notes |
|------|------------|-------|
| TypeScript monorepo + pnpm + turbo | **HIGH** | Understand-Anything, Repowise (partial TS), industry default for AI plugins |
| es-git for git ingestion | **HIGH** | Official benchmarks, Context7 docs, prebuilt binaries verified |
| better-sqlite3 primary store | **HIGH** | Repowise architecture, OLTP fit, 100k rows well within SQLite comfort zone |
| Hono local server | **HIGH** | Standard 2025 lightweight Node HTTP; no conflicting evidence |
| React + Vite + React Flow dashboard | **HIGH** | Understand-Anything production pattern |
| vis-timeline for eras | **MEDIUM** | Mature library; React wrapper quality varies — may need thin custom adapter |
| DuckDB analytics tier (deferred) | **MEDIUM** | Benchmarks strong; not needed until aggregation queries prove slow on SQLite |
| drizzle-orm vs raw SQL | **HIGH** | Schema evolution is certain given 5 core questions + AI artifacts |

## Sources

- [Understand-Anything CLAUDE.md](https://github.com/Egonex-AI/Understand-Anything/blob/main/CLAUDE.md) — monorepo layout, React Flow, Vitest, pnpm, web-tree-sitter WASM note (HIGH)
- [es-git performance benchmarks](https://es-git.dev/performance.html) — revwalk 11× faster than child_process (HIGH)
- [es-git getting started](https://es-git.dev/getting-started.html) — napi-rs prebuilt binaries, libgit2 (HIGH)
- [Context7 /toss/es-git](https://context7.com/toss/es-git) — revwalk API, benchmark tables (HIGH)
- [isomorphic-git cache docs](https://isomorphic-git.org/docs/en/cache) — packfile re-parse performance traps (HIGH)
- [Repowise architecture](https://www.repowise.dev/architecture) — SQLite persistence, single git log pass, MCP pattern (MEDIUM)
- [Repowise GitHub](https://github.com/repowise-dev/repowise) — Python primary, TypeScript dashboard, tree-sitter (MEDIUM)
- [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3) — sync API, WAL guidance (HIGH)
- [DuckDB vs SQLite benchmarks](https://duckdblab.org/en/post/duckdb-vs-sqlite-benchmark/) — OLAP vs OLTP tradeoff (MEDIUM)
- npm registry (`npm view <pkg> version`) — all version numbers verified 2026-06-30 (HIGH)

---
*Stack research for: GitChange — local-first git-history onboarding / temporal codebase intelligence*
*Researched: 2026-06-30*
