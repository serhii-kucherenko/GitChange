# Phase 3: CLI & Plugin Scaffold - Research

**Researched:** 2026-07-01
**Domain:** Local-first CLI, Hono API server, minimal React dashboard, Understand-Anything plugin packaging
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `03-CONTEXT.md` exists for this phase. Locked decisions inherited from Phase 1 (`01-CONTEXT.md`), Phase 2 (`02-RESEARCH.md`), and project research (`ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`).

### Inherited Locked Decisions (still binding)

- **D-01 / D-17:** `.gitchange/index.sqlite` + `manifest.json`; whole `.gitchange/` gitignored by default.
- **P2-D-06:** `computeIntelligence` is separate pass after index; CLI Phase 3 wires both in `gitchange index` default flow.
- **PRIV-01:** No network in `@gitchange/core`; server/dashboard may bind localhost only for local HTTP (not telemetry).
- **PLUG-05 / PROJECT.md:** Host AI is the LLM — GitChange supplies tools, schemas, artifacts only; **no embedded LLM SDK**.

### Phase 3 Implicit Decisions (ROADMAP + RESEARCH — planner discretion)

- **P3-D-01:** Default `gitchange serve` binds **`127.0.0.1:9876`** (configurable via `GITCHANGE_PORT`); satisfies minimal-dashboard localhost requirement even though PRIV-04 is formally Phase 5.
- **P3-D-02:** `gitchange index` runs **`indexFull` or `indexIncremental`** based on manifest presence; always runs **`computeIntelligence`** after successful index (unlike library default `rebuildIntelligence: false`).
- **P3-D-03:** Dashboard is **read-only** — all data from pre-built `.gitchange/` via Hono JSON API; **no live git walks** in server hot path (SCALE-02).
- **P3-D-04:** Plugin root resolution follows UA precedence: host-provided workspace root → `GITCHANGE_ROOT` env → walk-up from `cwd` for `.git` + `.gitchange/` → monorepo dev fallback (PITFALLS Pitfall 12).
- **P3-D-05:** Minimal dashboard shows **index status + basic repo snapshot** only: manifest freshness, commit count, warnings, top churn files, expertise topics — **not** full timeline/drill-down (Phase 5).
- **P3-D-06:** Package layout mirrors UA: `packages/cli`, `packages/server`, `packages/dashboard`, `packages/plugin` + root `.cursor-plugin/` and `.claude-plugin/` manifests.

### Claude's Discretion

- Exact dashboard visual styling (Tailwind utility layout)
- Whether `gitchange serve` auto-opens browser (default: no — slash command opens)
- CLI progress output format (spinner vs plain stdout)
- Default intelligence summary slice sizes (top 5 churn, top 3 expertise topics)

### Deferred Ideas (OUT OF SCOPE)

- Full interactive timeline / era drill-down (Phase 5)
- `doctor` command and install-matrix CI (Phase 8 per PITFALLS)
- chokidar auto-reindex watch (Phase 8)
- MCP tools (v2 INTG-03)
- Temporal graph UI (Phase 8 DASH-02)
- Named LLM era synthesis (Phase 4)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLUG-01 | `/gitchange` slash command triggers analysis pipeline | `packages/plugin/skills/gitchange/SKILL.md` orchestrates CLI `gitchange index`; agent markdown specs only |
| PLUG-02 | `/gitchange-dashboard` opens local web UI | Skill invokes `gitchange serve` (if not running) + opens `http://127.0.0.1:9876` |
| PLUG-03 | CLI `index`, `serve`, `status` | `@gitchange/cli` with commander; wires `@gitchange/core` |
| PLUG-04 | UA packaging pattern (skills, agents, multi-platform install) | `.cursor-plugin/`, `.claude-plugin/`, `packages/plugin/`, install script |
| PLUG-05 | Host AI is LLM — tools/schemas/artifacts only | Zod-exported JSON schemas in `packages/plugin/schemas/`; grep gate forbids LLM SDK imports |
| INST-01 | Marketplace or one-line installer (UA pattern) | `.claude-plugin/marketplace.json`, `scripts/install.sh` |
| INST-02 | First analysis via single `/gitchange` after install — no manual config | Skill auto-detects repo root; runs index + intelligence; surfaces manifest summary |
| INST-03 | `/gitchange-dashboard` shows initial value without manual config | Minimal React SPA reads `/api/snapshot` |
| INST-04 | Quickstart ≤5 steps: install → `/gitchange` → `/gitchange-dashboard` | `docs/QUICKSTART.md` |
</phase_requirements>

## Summary

Phase 3 delivers the **distribution and first-run surface** for GitChange: terminal CLI, localhost server, minimal dashboard, and IDE slash commands — copying Understand-Anything's packaging pattern while wiring the **already-built** Phase 1 index and Phase 2 intelligence passes. The walking skeleton proves `gitchange index` on a fixture repo produces `.gitchange/` and `intelligence.json`; subsequent plans layer serve/status API, dashboard shell, plugin skills, install UX, and quickstart docs.

**Primary recommendation:** Six vertical MVP plans — (1) package scaffold + `index` E2E, (2) Hono server + `serve`/`status`, (3) minimal dashboard SPA, (4) plugin slash commands + schemas, (5) install + path resolver, (6) quickstart + integration tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Index orchestration | CLI (`packages/cli`) | `@gitchange/core` | Thin wrapper; business logic stays in core |
| Intelligence orchestration | CLI | `@gitchange/core` computeIntelligence | P2-D-06 wiring lands here |
| Read-only snapshot API | API / Backend (`packages/server`) | `@gitchange/core` readManifest | No live git; SQLite + JSON reads |
| Static dashboard hosting | API / Backend (Hono `serveStatic`) | `packages/dashboard` build output | SPA served from `dist/` |
| Minimal dashboard UI | Client (`packages/dashboard`) | fetch `/api/snapshot` | React + Vite; no Node native imports |
| Slash command orchestration | Plugin (`packages/plugin/skills/`) | CLI subprocess | Host AI executes skill markdown |
| Host AI tool schemas | Plugin (`packages/plugin/schemas/`) | Zod from core | Bounded payloads for chat context |
| Plugin root resolution | Plugin (`packages/plugin/scripts/`) | env + walk-up | Pitfall 12 mitigation |
| Install / marketplace | Repo root manifests + scripts | — | UA multi-platform pattern |

**No LLM tier in GitChange** — host chat executes agent specs.

## Standard Stack

### New for Phase 3

| Library | Version | Purpose | Package |
|---------|---------|---------|---------|
| **commander** | 15.0.0 | CLI argument parsing | `@gitchange/cli` |
| **hono** | 4.12.27 | Localhost API + static file server | `@gitchange/server` |
| **@hono/node-server** | 2.0.6 | Node HTTP adapter for Hono | `@gitchange/server` |
| **react** | 19.2.7 | Dashboard UI | `@gitchange/dashboard` |
| **react-dom** | 19.2.7 | Dashboard render | `@gitchange/dashboard` |
| **vite** | 8.1.2 | Dashboard bundler | `@gitchange/dashboard` |
| **@vitejs/plugin-react** | 6.0.3 | React HMR/build | `@gitchange/dashboard` |
| **tailwindcss** | 4.3.2 | Dashboard styling | `@gitchange/dashboard` |

### Unchanged from Phase 1–2

| Library | Purpose |
|---------|---------|
| `@gitchange/core` | indexFull, indexIncremental, computeIntelligence, readManifest |
| **better-sqlite3** | Read-only commit counts in server (via core openDb) |
| **zod** | API response + plugin schema validation |

### Explicitly Deferred

| Library | Reason |
|---------|--------|
| chokidar | Auto-reindex watch — Phase 8 |
| @tanstack/react-query | Minimal dashboard can use fetch + useState in Phase 3 |
| @xyflow/react, vis-timeline | Full dashboard — Phase 5 |

## Package Legitimacy Audit

| Package | Registry | Disposition |
|---------|----------|-------------|
| commander | npm 15.0.0 | **[OK]** — STACK.md, widely used |
| hono | npm 4.12.27 | **[OK]** — STACK.md |
| @hono/node-server | npm 2.0.6 | **[OK]** — STACK.md matched pair |
| react / react-dom | npm 19.2.7 | **[OK]** — STACK.md |
| vite | npm 8.1.2 | **[OK]** — STACK.md |
| @vitejs/plugin-react | npm 6.0.3 | **[OK]** — STACK.md matched pair |
| tailwindcss | npm 4.3.2 | **[OK]** — STACK.md |

Planner inserts **blocking human-verify checkpoint** in Plan 03-01 before first `pnpm add` of new runtime packages (slopcheck gate per threat model T-03-SC).

## Architecture Patterns

### End-to-End First-Run Flow

```
User installs plugin (marketplace or install.sh)
        │
        ▼
/gitchange  ──▶  SKILL.md instructs host AI
        │          ├─ resolve repo root (P3-D-04)
        │          ├─ run: gitchange index [--repo PATH]
        │          └─ present manifest + intelligence summary to user
        ▼
.gitchange/  (index.sqlite, manifest.json, intelligence.json)
        │
/gitchange-dashboard  ──▶  SKILL.md
        │          ├─ ensure gitchange serve running (127.0.0.1:9876)
        │          └─ open browser to dashboard
        ▼
Minimal dashboard  ◀── GET /api/snapshot (manifest + counts + intelligence slice)
```

### UA Plugin Packaging (copy pattern, separate codebase)

```
gitchange/
├── .cursor-plugin/plugin.json          # skills + agents paths
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── packages/
│   ├── cli/          # bin: gitchange
│   ├── server/       # Hono app
│   ├── dashboard/    # Vite React SPA
│   └── plugin/       # skills/, agents/, schemas/, scripts/
└── scripts/install.sh
```

Reference: [Understand-Anything `.cursor-plugin/plugin.json`](https://github.com/Egonex-AI/Understand-Anything/blob/main/.cursor-plugin/plugin.json) — `skills` and `agents` directory pointers.

### Read API Contract (minimal snapshot)

`GET /api/snapshot` returns:

- `manifest` — full Manifest schema
- `stats` — `{ commitCount, fileChangeCount, authorCount }` from SQLite COUNT queries
- `intelligence` — parsed `intelligence.json` or `null` if missing
- `highlights` — `{ topChurnFiles[], topExpertiseTopics[] }` sliced for dashboard cards

Server opens SQLite **read-only**; never calls es-git.

## Common Pitfalls

### Pitfall 12: Plugin Path Fragility (mitigate in Phase 3, full doctor in Phase 8)

- Never hardcode `../../packages/cli` from skill paths
- `resolveGitChangeRoot(cwd)` with UA precedence order
- Integration test from monorepo dev layout only is insufficient — Plan 03-06 tests CLI directly

### Dashboard Launch Gate

- `/gitchange-dashboard` skill MUST check manifest exists; if missing, instruct user to run `/gitchange` first (UA pattern)
- Do not silently serve empty dashboard on missing index

### Native Module in Browser

- Dashboard MUST NOT import `@gitchange/core` (pulls better-sqlite3/es-git)
- All data via HTTP API from server package

## Sources

- [GitChange ROADMAP.md Phase 3](../../ROADMAP.md) — goal, success criteria, First Run hint
- [GitChange ARCHITECTURE.md](../../research/ARCHITECTURE.md) — plugin pipeline, package layout
- [GitChange STACK.md](../../research/STACK.md) — commander, Hono, React/Vite versions
- [GitChange PITFALLS.md](../../research/PITFALLS.md) — Pitfall 12 plugin fragility
- [Understand-Anything plugin.json](https://github.com/Egonex-AI/Understand-Anything/blob/main/.cursor-plugin/plugin.json) — packaging reference (HIGH)
- Phase 1 SKELETON.md — later phases add cli/server/dashboard/plugin
- Phase 2 SUMMARY — computeIntelligence, intelligence.json, manifest checkpoint fields

---
*Research for: Phase 3 CLI & Plugin Scaffold*
*Researched: 2026-07-01*
