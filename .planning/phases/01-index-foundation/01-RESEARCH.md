# Phase 1: Index Foundation - Research

**Researched:** 2026-06-30
**Domain:** Deterministic git/doc ingestion → SQLite derived cache (`.gitchange/`), privacy redaction, golden-fixture TDD
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Index artifact shape**
- **D-01:** SQLite is the primary ingestion store from day one (commits, authors, file changes, doc snapshot metadata). Path: `.gitchange/index.sqlite`.
- **D-02:** Human-readable output in Phase 1 is limited to `manifest.json` (schema version, `lastIndexedCommit`, `indexedAt`, repo head, freshness warnings, index completeness). No full JSON sidecar dumps of commit history.
- **D-03:** JSON artifact files for semantic layers (eras, tours, decisions) are deferred; Phase 1 schema must not block their addition.

**Freshness and history integrity (INGX-05)**
- **D-04:** Shallow clone / incomplete history → **warn and continue**; index available commits; set `indexCompleteness: partial`; surface degraded badge in status output.
- **D-05:** Force-push / rewritten history detected during incremental update → **warn and halt incremental merge**; require explicit `gitchange index --full` rebuild. Cold-start on a shallow clone is allowed.
- **D-06:** Freshness warnings persisted in `manifest.json` and echoed to CLI stdout on completion.

**Privacy and sensitive data (PRIV-02, PRIV-03)**
- **D-07:** `.gitchangeignore`-matched paths: record path + change type only; **no file content or diff hunks**.
- **D-08:** Secret-pattern matches in diff content / commit messages: **redact sensitive substrings**; retain SHA, author, timestamp, file path metadata.
- **D-09:** Do **not** drop whole commits just because they touch secrets — authorship graph integrity matters more.
- **D-10:** Ship a default `.gitchangeignore` template (`.env*`, `**/secrets/**`, `*credentials*`, `*.pem`, `*.key`); user-extensible.

**Golden fixtures and TDD (EVD-04, SCALE-03)**
- **D-11:** **Both** fixture strategies — tiny synthetic repos (3–8 commits: merges, renames, conventional commits, ignored paths, simulated secrets) for fast CI golden tests; GitChange's own repo as slower dogfood integration fixture (required locally pre-milestone, optional in CI initially).
- **D-12:** Golden tests validate Zod schema conformance **and** evidence-link integrity (every indexed claim traceable to commit SHA + file path).

**Doc ingestion scope (INGX-03)**
- **D-13:** Default doc paths: `README*`, `CHANGELOG*`, `docs/**`, `**/adr/**`, and `*.md` at repo root. Extension via `.gitchangeignore` inverse patterns / future config — not in Phase 1 CLI surface beyond defaults.
- **D-14:** Store doc content snapshots at commit boundaries where matched paths changed; link snapshots to commit SHA.

**Evidence contract at index layer (EVD-01)**
- **D-15:** Phase 1 evidence refs are **commit SHA + file path** granularity. Diff hunk offsets / excerpt spans deferred to Phase 5; schema must reserve fields for hunk-level evidence without requiring it now.
- **D-16:** Every narrative-ready record (doc snapshot, file change summary) includes a mandatory `evidence[]` array with ≥1 `{ type: "commit", sha }` or `{ type: "file", path, commitSha }` entry — Zod-validated at write boundary.

**`.gitchange/` version control policy**
- **D-17:** `.gitchange/` is **gitignored by default** (entire directory). Document opt-in to commit `manifest.json` only — never require committing the SQLite DB or intermediate artifacts.
- **D-18:** Default `.gitignore` entry added by `gitchange init` (or first index) if not present.

### Claude's Discretion
- Exact SQLite table layout and Drizzle migration numbering
- es-git revwalk batch sizes and optional piscina worker activation threshold (enable when commit count exceeds ~10k+)
- Specific secret redaction regex set beyond the default template
- Synthetic fixture repo layout under `tests/fixtures/` vs `fixtures/`
- `manifest.json` field naming — prefer `lastIndexedCommit` per ROADMAP/REQUIREMENTS

### Deferred Ideas (OUT OF SCOPE)
- JSON sidecar exports of full commit index
- Hunk-level evidence storage (Phase 5 drill-down)
- `gitchange index --watch` / chokidar auto-reindex (Phase 8)
- Multi-repo index merge (Phase 8)
- Semantic artifacts (eras, tours, decisions) and dashboard UI (later phases)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INGX-01 | Index a local git clone → `.gitchange/` derived index with no network access | es-git `openRepository` + `revwalk().pushHead()` reads local `.git` only; no remote calls. SQLite write via better-sqlite3/Drizzle. See Code Examples §1, §3. |
| INGX-02 | Parse commits, authors, timestamps, messages, merges, renames, file-level diffs | es-git `getCommit(sha)` → `author()`/`committer()`/`message()`/`summary()`/parents; `diffTreeToTree(parentTree, commitTree)` → `deltas()`; `findSimilar({renames:true})` for renames; merge = parent count > 1. See Code Examples §1–2. |
| INGX-03 | Analyze docs tracked in git (README, CHANGELOG, docs/, ADRs) over time | Path-glob match (D-13) against diff deltas; snapshot matched doc blob content at changing commits (D-14); `gray-matter` for frontmatter. See §Doc Ingestion. |
| INGX-04 | Incrementally re-index only commits after `lastIndexedCommit` | es-git `revwalk().pushRange('<lastIndexedCommit>..HEAD')` walks only new commits. Manifest stores cursor. See Code Examples §4. |
| INGX-05 | Detect force-push / shallow-clone; surface freshness warnings | Shallow: `.git/shallow` file presence / `repo.isShallow()`. Force-push: stored `lastIndexedCommit` no longer reachable from HEAD (`revparseSingle` fails or not an ancestor). D-04/D-05. See §History Integrity. |
| PRIV-01 | Local-only, no telemetry | No network deps in `@gitchange/core`; assert no outbound calls in tests. |
| PRIV-02 | Redact secrets from artifacts at ingest | Regex + entropy redaction pass over diff/message content before persist; store match type + location, never raw value. D-08. See §Secret Redaction. |
| PRIV-03 | Configurable `.gitchangeignore` for sensitive paths | `minimatch` glob engine; default template (D-10); path-matched → metadata only (D-07). |
| SCALE-03 | Core ingestion/parsing covered by TDD with golden fixtures | Vitest + synthetic fixture repos + Zod snapshot assertions (D-11/D-12). See §Validation Architecture. |
| EVD-01 | Every narrative claim links to evidence (SHA, path, doc excerpt) | Zod `evidence[]` required field on narrative-ready records; enforced at write boundary. D-16. See §Evidence Contract. |
| EVD-04 | Golden fixture tests validate evidence link integrity | Deterministic post-write check: every `evidence[].sha` exists in commits table; every `{path, commitSha}` exists in file_changes. D-12. |
</phase_requirements>

## Summary

Phase 1 is a **greenfield, single-package-focused build**: scaffold the pnpm/Turborepo monorepo, then implement `@gitchange/core` as a deterministic, network-free ingestion engine that walks a local `.git` with **es-git** (libgit2 via prebuilt napi-rs binaries), redacts secrets during ingest, and writes a **better-sqlite3 + Drizzle** index (`.gitchange/index.sqlite`) plus a human-readable `manifest.json` checkpoint. The whole phase is a *fact layer* — no LLM, no dashboard, no CLI packaging (CLI is Phase 3, though a thin internal entrypoint or test harness is needed to drive/verify ingestion).

The two hardest-to-retrofit commitments are **two-phase incremental architecture** (index once, read from cache; never full-rescan on every run) and the **evidence contract** (`evidence[]` Zod-required on every narrative-ready record). Both are locked by CONTEXT and confirmed by pitfalls research as foundational. Everything else — schema table layout, batch sizes, redaction regex set — is discretionary and should follow the prescriptive patterns below.

**Primary recommendation:** Build in this order — (0) monorepo + tooling scaffold → (1) Zod schemas + Drizzle table definitions + migration → (2) es-git ingestion (commits/authors/diffs/renames/merges) streaming into batched SQLite transactions → (3) doc snapshot ingestion → (4) `.gitchangeignore` + secret redaction pipeline → (5) manifest/checkpoint + incremental `pushRange` walk → (6) shallow/force-push detection → (7) golden synthetic fixtures + evidence-integrity tests → (8) dogfood on GitChange's own repo. Defer piscina workers until a 100k-commit fixture proves single-threaded es-git is too slow (YAGNI for MVP; keep the parse step pure/isolatable so workers can be dropped in later).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Git history walk (revwalk, commit read) | API / Backend (`@gitchange/core`, Node-only) | — | es-git is a native addon; must run in Node, never browser. |
| Diff / rename / merge extraction | API / Backend (core `ingestion/`) | — | Pure functions over es-git objects; deterministic, TDD-covered. |
| Doc snapshot capture | API / Backend (core `ingestion/`) | Database (blob content in SQLite) | Path-filtered; content persisted to index. |
| Secret redaction + `.gitchangeignore` | API / Backend (core `privacy/`) | — | Must run *before* persistence; gate on the write path. |
| Index persistence (commits/files/authors/docs) | Database / Storage (`.gitchange/index.sqlite`) | — | better-sqlite3 synchronous OLTP; WAL mode. |
| Manifest / checkpoint | Database / Storage (`.gitchange/manifest.json`) | — | Human-readable JSON; the read-API contract for downstream phases. |
| Schema validation (Zod) | API / Backend (core `schema/`) | — | Fail-fast at ingest boundary; shared types for later phases. |

**No client/CDN/frontend tier in Phase 1** — this is a headless library. Guard against accidentally coupling core to any UI concern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **es-git** | 0.7.0 | Git revwalk, commit read, tree diff, rename detection | libgit2 via prebuilt napi-rs binaries — no node-gyp; ~11× faster revwalk than `child_process`. `[VERIFIED: Context7 /toss/es-git + npm registry]` |
| **better-sqlite3** | 12.11.1 | Synchronous SQLite index store (`.gitchange/index.sqlite`) | Fast OLTP point lookups; WAL mode; transaction-batched inserts. `[VERIFIED: npm registry + Drizzle official docs]` |
| **drizzle-orm** | 0.45.2 | Typed SQLite schema + query builder | Typed tables + migrations as schema evolves; `drizzle-orm/better-sqlite3` adapter. `[VERIFIED: Context7 /drizzle-team/drizzle-orm-docs + npm]` |
| **drizzle-kit** | 0.31.10 | Migration generation (`generate`/`migrate`) | Deterministic SQL migrations; avoids raw-SQL migration drift at 100k+ rows. `[VERIFIED: npm registry]` |
| **zod** | 4.4.3 | Schema validation at ingest/write boundary | Enforces evidence contract (D-16); golden fixtures compare parsed output. `[VERIFIED: npm registry]` |
| **TypeScript** | 6.0.3 | Language, `strict: true`, `moduleResolution: "bundler"` | Shared types core→downstream. `[VERIFIED: npm registry]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **conventional-commits-parser** | 7.0.0 | Parse conventional commit messages | Extract `type`/`scope`/breaking-change deterministically for later status mining; store parsed fields now. `[VERIFIED: npm]` |
| **gray-matter** | 4.0.3 | Parse markdown frontmatter | Doc snapshot metadata (ADR frontmatter, changelog headers). `[VERIFIED: npm]` |
| **minimatch** | 10.2.5 | `.gitchangeignore` + doc-path glob matching | Path exclusion (PRIV-03) and doc-path defaults (D-13). `[VERIFIED: npm]` |
| **piscina** | 5.2.0 | Worker thread pool for per-commit parsing | **Defer** — only if a 100k-commit fixture proves single-threaded parse too slow. Keep parse step pure so it can be moved to a worker without refactor. `[VERIFIED: npm]` |

### Development Tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **Vitest** | 4.1.9 | Unit + integration/golden tests | Native ESM/TS; fixture-friendly. `[VERIFIED: npm]` (see slopcheck note in audit) |
| **@biomejs/biome** | 2.5.1 | Lint + format | Single tool; run via `turbo lint`. `[VERIFIED: npm]` |
| **turbo** | 2.10.2 | Task orchestration/caching | `turbo test --filter=@gitchange/core`. `[VERIFIED: npm]` |
| **tsx** | 4.22.4 | Dev execution of TS | Run ingestion scripts without compile. `[VERIFIED: npm]` |
| **@types/better-sqlite3** | 7.6.13 | Type defs | Dev dependency for core. `[VERIFIED: npm]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| es-git | `simple-git` (3.36.0) / `git` CLI | Fallback only for porcelain one-offs es-git doesn't expose; 10–100× slower on 100k-commit walks; fragile stdout parsing. **Do not** use as the hot path. |
| es-git | isomorphic-git / nodegit | Never for v1 — packfile re-parse memory traps (isomorphic-git); node-gyp/segfault pain (nodegit). |
| better-sqlite3 | JSON-file-only index | Prototype only; no indexed queries at 100k+ commits. SQLite is locked (D-01). |
| Drizzle | Raw better-sqlite3 SQL | Prototype only; schema will grow across phases — migration drift risk. |
| piscina now | Single-threaded es-git | Prefer single-threaded for MVP; add workers only when measured too slow. |

**Installation (Phase 1 scope — `@gitchange/core`):**
```bash
pnpm add es-git better-sqlite3 drizzle-orm zod conventional-commits-parser gray-matter minimatch -F @gitchange/core
pnpm add -D drizzle-kit @types/better-sqlite3 -F @gitchange/core
# root dev tooling
pnpm add -D typescript vitest turbo @biomejs/biome tsx -w
# piscina: defer until 100k-commit fixture proves need
# pnpm add piscina -F @gitchange/core
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` on 2026-06-30 against the npm registry. es-git, drizzle-orm, better-sqlite3, and zod APIs additionally confirmed via Context7 official docs.

## Package Legitimacy Audit

> slopcheck 0.6.1 run against a temp `package.json` mirroring the Phase 1 dependency set (npm ecosystem). Registry versions verified via `npm view`.

| Package | Registry | slopcheck | Registry verified | Disposition |
|---------|----------|-----------|-------------------|-------------|
| es-git | npm | [OK] | 0.7.0 | Approved |
| better-sqlite3 | npm | [OK] | 12.11.1 | Approved |
| drizzle-orm | npm | [OK] | 0.45.2 | Approved |
| drizzle-kit | npm | [OK] | 0.31.10 | Approved |
| zod | npm | [OK] | 4.4.3 | Approved |
| conventional-commits-parser | npm | [OK] | 7.0.0 | Approved |
| piscina | npm | [OK] | 5.2.0 | Approved (deferred) |
| gray-matter | npm | [OK] | 4.0.3 | Approved |
| minimatch | npm | [OK] | 10.2.5 | Approved |
| commander | npm | [OK] | 15.0.0 | Approved (Phase 3, not installed now) |
| @types/better-sqlite3 | npm | [OK] | 7.6.13 | Approved |
| typescript | npm | [OK] | 6.0.3 | Approved |
| turbo | npm | [OK] | 2.10.2 | Approved |
| @biomejs/biome | npm | [OK] | 2.5.1 | Approved |
| tsx | npm | [OK] | 4.22.4 | Approved |
| **vitest** | npm | **[SUS]** | 4.1.9 | **Approved — false positive** |

**Packages removed due to [SLOP]:** none.
**Packages flagged [SUS]:** `vitest` — slopcheck flags it as "suspiciously close to 'vite' (possible typosquat)." This is a **false positive**: Vitest is the official, canonical Vite-native test framework (tens of millions of weekly downloads, source repo `vitest-dev/vitest`, confirmed as the project's chosen test runner in STACK.md and verified on npm). No checkpoint required — but the planner may add a one-line note when introducing it.

## Architecture Patterns

### System Architecture Diagram (Phase 1 ingestion pipeline)

```
                    ┌─────────────────────────────────────┐
   local .git ─────▶│  es-git openRepository()            │
   (canonical)      │  revwalk (pushHead | pushRange)     │◀── manifest.lastIndexedCommit
                    └───────────────┬─────────────────────┘        (incremental cursor)
                                    │ stream of SHAs (newest→oldest)
                                    ▼
                    ┌─────────────────────────────────────┐
                    │  per-commit parse (pure fn)         │
                    │  author/committer/msg/parents/merge │
                    │  diffTreeToTree(parent, commit)     │
                    │  findSimilar({renames:true})        │
                    │  conventional-commits-parser        │
                    └───────────────┬─────────────────────┘
                                    │ CommitRecord + FileChange[] + DocSnapshot[]
                                    ▼
        ┌───────────────────────────────────────────────────────┐
   .gitchangeignore ─▶│  PRIVACY GATE (privacy/)                │
   secret regexes  ──▶│  1. path match → metadata only (D-07)  │
                      │  2. secret redaction on content (D-08) │
                      └───────────────┬────────────────────────┘
                                      │ redacted, evidence-tagged records
                                      ▼
                      ┌──────────────────────────────────────┐
                      │  Zod validate (schema/) — evidence[]  │  ── reject on missing evidence (D-16)
                      └───────────────┬──────────────────────┘
                                      │ batches of 500–1000 rows
                                      ▼
                      ┌──────────────────────────────────────┐
                      │  Drizzle db.transaction(...)          │──▶ .gitchange/index.sqlite (WAL)
                      └───────────────┬──────────────────────┘
                                      ▼
                      ┌──────────────────────────────────────┐
                      │  write manifest.json                  │──▶ lastIndexedCommit, indexedAt,
                      │  (checkpoint + freshness warnings)    │    head, indexCompleteness, warnings[]
                      └──────────────────────────────────────┘
```

**Trace the primary use case (INGX-01):** local `.git` → revwalk from HEAD → parse each commit into records → privacy gate → Zod validate → batched SQLite insert → write manifest. Re-run (INGX-04) replaces `pushHead()` with `pushRange('<lastIndexedCommit>..HEAD')`; force-push detection (INGX-05) short-circuits before the walk.

### Recommended Project Structure

```
gitchange/
├── packages/
│   └── core/                      # @gitchange/core — the ONLY package touched in Phase 1
│       ├── src/
│       │   ├── ingestion/         # git-walk.ts, commit-parse.ts, diff.ts, doc-snapshot.ts
│       │   ├── schema/            # zod schemas + drizzle table defs + evidence types
│       │   │   ├── drizzle/       # table definitions (commits, authors, file_changes, doc_snapshots)
│       │   │   ├── zod/           # runtime validators (CommitRecord, FileChange, DocSnapshot, Evidence)
│       │   │   └── manifest.ts    # Manifest zod schema + read/write helpers
│       │   ├── privacy/           # gitchangeignore.ts, redaction.ts, default-template
│       │   ├── artifacts/         # db.ts (drizzle client + WAL pragma), writer.ts (batched tx)
│       │   ├── index/             # orchestrator: full() / incremental() index entrypoints
│       │   └── index.ts           # package exports (Node-only surface)
│       ├── drizzle.config.ts
│       ├── migrations/            # drizzle-kit generated SQL
│       ├── package.json
│       └── tsconfig.json
├── tests/
│   └── fixtures/                  # synthetic golden repos + expected snapshots (D-11)
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
├── biome.json
├── tsconfig.base.json
├── .nvmrc                         # pin Node (see Environment Availability)
└── package.json                   # root
```

**Rationale:** Only `packages/core` is built in Phase 1. Later phases add `cli/`, `server/`, `dashboard/`, `plugin/`. Keep core's public exports Node-only and free of any browser-incompatible import so the future dashboard never pulls in es-git/better-sqlite3. Structure mirrors ARCHITECTURE.md's prescribed `ingestion/ schema/ artifacts/ privacy/` split.

### Pattern 1: Two-Phase Index / Query Split (locked, foundational)
**What:** `.git` + docs are canonical; `.gitchange/` is a rebuildable derived cache. Indexing writes the cache; all future reads (Phase 5 dashboard, agents) query the cache — never a live full-repo walk.
**When to use:** Always. This is the single most important architectural commitment (Pitfall 4).
**How:** Manifest stores `lastIndexedCommit`; incremental runs walk only `pushRange('<cursor>..HEAD')`. Never `git log -p` per query.

### Pattern 2: Incremental Checkpoint via Manifest
**What:** `manifest.json` records `schemaVersion`, `lastIndexedCommit`, `indexedAt`, repo `head`, `indexCompleteness` (`complete` | `partial`), and `warnings[]`.
**When to use:** Every index run writes/updates it as the last step (D-02, D-06).
**Example shape:**
```typescript
// Source: adapted from ARCHITECTURE.md GitChangeManifest + CONTEXT D-02/D-06
interface Manifest {
  schemaVersion: string;          // e.g. "1"
  lastIndexedCommit: string;      // HEAD sha at index time
  indexedAt: string;              // ISO 8601
  repo: { head: string; branch: string | null };
  indexCompleteness: "complete" | "partial";
  warnings: Array<{
    code: "shallow_clone" | "force_push_detected" | "out_of_order_commits";
    message: string;
  }>;
}
```

### Pattern 3: Evidence Contract Enforced at Write Boundary (EVD-01)
**What:** Every narrative-ready record (doc snapshot, file change summary) carries a mandatory `evidence[]` array with ≥1 typed ref; Zod rejects writes without it (D-16).
**When to use:** All writes of narrative-ready records. Raw commit/author rows are evidence *sources*, not narrative records, so they don't need `evidence[]` — but their SHAs/paths must exist for evidence refs to resolve.
**Example:**
```typescript
// Source: adapted from ARCHITECTURE.md Pattern 4 + CONTEXT D-15/D-16
import { z } from "zod";

const Evidence = z.discriminatedUnion("type", [
  z.object({ type: z.literal("commit"), sha: z.string().length(40) }),
  z.object({ type: z.literal("file"), path: z.string(), commitSha: z.string().length(40) }),
  // reserved for Phase 5 (must not be required now):
  // z.object({ type: z.literal("hunk"), path, commitSha, startLine, endLine })
]);

const DocSnapshot = z.object({
  path: z.string(),
  commitSha: z.string().length(40),
  contentHash: z.string(),
  content: z.string().nullable(),         // null if path is .gitchangeignore-matched (D-07)
  evidence: z.array(Evidence).min(1),     // EVD-01 / D-16 — enforced
});
```

### Pattern 4: Batched SQLite Transactions
**What:** Stream SHAs from revwalk; accumulate parsed records; flush to SQLite in transactions of 500–1000 rows.
**Why:** better-sqlite3 is synchronous and fast, but per-row inserts across 100k commits thrash. One transaction per batch amortizes fsync.
**How:** `db.transaction((rows) => { for (const r of rows) insert.run(r); })(batch)` (better-sqlite3 sync transaction), or Drizzle's sync transaction. Enable WAL: `sqlite.pragma('journal_mode = WAL')`.

### Anti-Patterns to Avoid
- **Live git in the read path:** No `git log`/`git show` at query time. Index once, read from SQLite. (Pitfall 4)
- **Storing canonical state in `.gitchange/`:** It's a disposable cache; must fully rebuild from `.git` + docs. (Anti-Pattern 3)
- **Loading all commits into memory:** Stream the revwalk; don't materialize 100k `CommitRecord`s before writing. (Performance trap)
- **Persisting raw secrets:** Redact *before* the write boundary; never store raw values even transiently in the DB. (Pitfall 8)
- **Skipping merge commits entirely:** Record them (parent count > 1) for topology; only *ownership* metrics (Phase 2) may skip merges — not the index.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git history walk / commit parse | Custom `child_process` `git log --format` parser | **es-git** revwalk + `getCommit` | Porcelain parsing is fragile; 10–100× slower; misses rename/merge edge cases. |
| Rename detection | Path heuristics on add/delete pairs | **es-git** `diff.findSimilar({ renames: true })` | libgit2 similarity scoring handles copies/renames correctly. |
| SQL schema migrations | Hand-written `ALTER TABLE` scripts | **drizzle-kit generate/migrate** | Schema evolves across 8 phases; manual migrations rot. |
| Glob matching for ignore/doc paths | Custom regex from globs | **minimatch** | Gitignore-style semantics (`**`, negation, `!`) are subtle. |
| Runtime validation | `if`-chains / manual type guards | **zod** | Single source of truth for types + validation; powers evidence contract + golden tests. |
| Conventional-commit parsing | Regex on `feat:`/`fix:` | **conventional-commits-parser** | Handles scopes, breaking-change footers, multi-line bodies. |
| Markdown frontmatter | Manual `---` splitting | **gray-matter** | ADR/changelog frontmatter variants. |
| SQLite driver | `sql.js` / custom bindings | **better-sqlite3** | Synchronous, fastest Node SQLite; WAL support. |

**Secret redaction is the one place to *carefully* hand-roll a rule set** (no mature standalone npm redaction library is a locked dependency, and shelling to `gitleaks` adds an external binary dependency that conflicts with the no-network/self-contained MVP goal). Build a small, well-tested regex + entropy rule set (see §Secret Redaction) covering the common patterns; make the rule set data-driven so it's extensible. Treat gitleaks' published rules as a *reference* for patterns, not a runtime dependency.

## Common Pitfalls

### Pitfall 1: Full-History Rescan Architecture (Pitfall 4 in PITFALLS.md)
**What goes wrong:** Every run re-walks the entire history; cold start takes hours on 100k+ commits; commands time out.
**Why it happens:** Prototyping on small repos; no incremental cursor.
**How to avoid:** Two-phase split from day one. Store `lastIndexedCommit`; incremental runs use `revwalk().pushRange('<cursor>..HEAD')`. Never re-parse committed blobs already indexed (cache by `(path, blob_sha)` if diffing is a bottleneck).
**Warning signs:** Re-running index after one new commit reprocesses everything; memory grows with total commit count.

### Pitfall 2: Secret Leakage into the Index (Pitfall 8)
**What goes wrong:** `.gitchange/index.sqlite` contains raw `.env` values, API keys from old commits.
**Why it happens:** Full-history diff ingestion reads deleted secrets; redaction added late.
**How to avoid:** Redaction gate *before* persistence (D-08); store match type + location only. `.gitchangeignore`-matched paths store metadata only (D-07). Ship default template (D-10). **CI test: grep the built fixture SQLite for `AKIA`, `ghp_`, `sk-`, `BEGIN RSA PRIVATE KEY` — fail if found** (this is a required golden test, not optional).
**Warning signs:** No redaction test in golden fixtures; simulated-secret fixture content appears in DB.

### Pitfall 3: History Integrity Edge Cases (Pitfall 5)
**What goes wrong:** Shallow clone silently produces a partial index treated as complete; force-push appends to a stale index; out-of-order timestamps create impossible orderings.
**Why it happens:** Git allows backdated commits, shallow clones, and history rewrites.
**How to avoid:**
- **Shallow:** detect (`.git/shallow` exists / `repo.isShallow()`), set `indexCompleteness: partial`, warn+continue (D-04).
- **Force-push:** on incremental run, verify stored `lastIndexedCommit` is still reachable from HEAD (an ancestor). If not → warn + halt incremental; require `--full` (D-05).
- **Out-of-order:** prefer committer date, fall back to author date; count and record `out_of_order_count` in warnings. Document which date axis the index uses.
**Warning signs:** Full vs shallow clone of same repo yields different commit counts with no warning; incremental run silently succeeds after a rebase.

### Pitfall 4: Evidence Link Integrity Only Checks JSON Shape (Pitfall 2)
**What goes wrong:** Golden tests validate that `evidence[]` exists but not that the referenced SHA/path actually resolves.
**Why it happens:** Schema-shape testing is easier than referential integrity.
**How to avoid:** Golden tests must assert every `evidence[].sha` exists in the commits table and every `{path, commitSha}` exists in file_changes (EVD-04, D-12). This is a deterministic post-index query, cheap to run.

### Pitfall 5: Native Module CI/Platform Breakage
**What goes wrong:** es-git / better-sqlite3 fail to load on a teammate's OS or in CI (missing prebuilt binary, Node ABI mismatch).
**Why it happens:** Native addons ship per-platform prebuilds; Node major-version changes the ABI.
**How to avoid:** Pin Node via `.nvmrc` (recommend 22.x LTS per STACK, though 20–26 are supported by both addons). Add a CI matrix across the team's OS mix. Rebuild native modules on Node major upgrade. Smoke-test that `openRepository` and a SQLite write succeed on each platform before relying on golden tests.
**Warning signs:** "Module did not self-register" / ABI errors; CI green only on one OS.

## Code Examples

Verified against Context7 `/toss/es-git` and `/drizzle-team/drizzle-orm-docs` (2026-06-30).

### §1 — Walk history and read commit metadata (INGX-01, INGX-02)
```typescript
// Source: Context7 /toss/es-git docs/usage/history.md
import { openRepository } from "es-git";

const repo = await openRepository("/path/to/repo");
const revwalk = repo.revwalk().pushHead();   // newest → oldest from HEAD

for (const sha of revwalk) {
  const commit = repo.getCommit(sha);
  const author = commit.author();       // { name, email, ... } + timestamp
  const committer = commit.committer();
  const summary = commit.summary();     // first line
  const message = commit.message();     // full message
  const id = commit.id();               // sha
  // merge detection: a merge commit has more than one parent.
  // (verify exact accessor in es-git Commit reference: parents()/parentCount())
}
```

### §2 — Diff a commit against its parent, detect renames (INGX-02)
```typescript
// Source: Context7 /toss/es-git docs/reference diffTreeToTree + docs/usage/diff.md
const commit = repo.getCommit(sha);
const commitTree = commit.tree();
const parentSha = /* first parent id */;
const parentTree = parentSha ? repo.getCommit(parentSha).tree() : null;

const diff = repo.diffTreeToTree(parentTree, commitTree);
diff.findSimilar({ renames: true });   // enable rename/copy detection

for (const delta of diff.deltas()) {
  const status = delta.status();         // 'Added' | 'Modified' | 'Deleted' | 'Renamed' | ...
  const oldPath = delta.oldFile().path();
  const newPath = delta.newFile().path();
  // record FileChange { commitSha: sha, path: newPath, oldPath, changeType: status }
}
// Root commit (no parent): diff parentTree=null → all files 'Added'.
```

### §3 — Drizzle + better-sqlite3 client with WAL and batched inserts (INGX-01, SCALE)
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs connect-node-sqlite + transactions
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema/drizzle";

const sqlite = new Database(".gitchange/index.sqlite");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
const db = drizzle({ client: sqlite, schema });

// Batched, synchronous transaction (better-sqlite3 is sync):
function insertCommitBatch(rows: CommitRow[]) {
  db.transaction((tx) => {
    for (const r of rows) tx.insert(schema.commits).values(r).run();
  })(); // note trailing () — sync transaction is invoked immediately
}
// Flush every 500–1000 rows while streaming the revwalk.
```

### §4 — Incremental walk from lastIndexedCommit (INGX-04)
```typescript
// Source: Context7 /toss/es-git docs/reference/Revwalk pushRange + hide
const cursor = manifest.lastIndexedCommit;
// Only commits reachable from HEAD but not from the cursor:
const revwalk = repo.revwalk().pushRange(`${cursor}..HEAD`);
for (const sha of revwalk) {
  // parse + persist only NEW commits
}
// Equivalent: revwalk.pushHead().hide(cursor)
```

### §5 — Force-push / shallow detection (INGX-05)
```typescript
// Force-push: the stored cursor must still be reachable from HEAD.
// If revparseSingle(cursor) fails, or cursor is not an ancestor of HEAD,
// the history was rewritten → halt incremental, require --full (D-05).
function isForcePush(repo, cursor: string): boolean {
  try {
    repo.revparseSingle(cursor);            // cursor still exists?
    // additionally confirm ancestry: cursor reachable from HEAD
    // (walk HEAD..; if cursor never appears as reachable, treat as rewrite)
    return false;
  } catch {
    return true;                            // cursor gone → rewritten history
  }
}
// Shallow: presence of .git/shallow file (or es-git repo.isShallow()) → indexCompleteness=partial, warn+continue (D-04).
```
> `repo.isShallow()` / `Commit.parents()` accessor names should be confirmed against the es-git `Repository` / `Commit` reference during planning; the `.git/shallow` file check is a language-agnostic fallback that always works.

### §6 — Secret redaction gate (PRIV-02)
```typescript
// Data-driven rule set; store match metadata, never raw value.
const SECRET_RULES: Array<{ id: string; re: RegExp }> = [
  { id: "aws_access_key", re: /AKIA[0-9A-Z]{16}/g },
  { id: "github_pat", re: /ghp_[0-9A-Za-z]{36}/g },
  { id: "openai_key", re: /sk-[A-Za-z0-9]{20,}/g },
  { id: "private_key", re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
  { id: "generic_token", re: /(?:token|secret|password|api[_-]?key)\s*[=:]\s*['"]?[A-Za-z0-9\-_]{16,}/gi },
];

function redact(content: string): { redacted: string; findings: Array<{ ruleId: string }> } {
  const findings: Array<{ ruleId: string }> = [];
  let redacted = content;
  for (const { id, re } of SECRET_RULES) {
    redacted = redacted.replace(re, () => { findings.push({ ruleId: id }); return "«redacted»"; });
  }
  return { redacted, findings };   // persist findings metadata + redacted text only (D-08/D-09)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nodegit (node-gyp libgit2 bindings) | **es-git** (napi-rs prebuilt binaries) | 2024–2025 | No compile step, no segfaults; reliable cross-platform install. |
| `git log -p` via child_process | es-git revwalk + `diffTreeToTree` | ongoing | ~11× faster walks; structured objects, no stdout parsing. |
| Raw SQL migrations | drizzle-kit generate/migrate | Drizzle maturity 2024+ | Typed schema evolution; safe multi-phase migrations. |
| Zod 3 | **Zod 4** | 2025 | Faster parsing, `z.discriminatedUnion` ergonomics used in evidence contract. |

**Deprecated/outdated for this phase:**
- isomorphic-git for bulk ingestion — memory traps at scale.
- Committing derived index (`.gitchange/`) as source of truth — cache-only per D-17.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | es-git exposes `repo.isShallow()` and `Commit.parents()`/`parentCount()` accessors | Code Examples §1, §5 | Low — `.git/shallow` file check and diffing against each parent are robust fallbacks; only accessor names differ. Confirm in es-git reference during planning. |
| A2 | `revparseSingle(cursor)` throwing is a sufficient force-push signal; full ancestry check may also be needed | Code Examples §5 | Medium — a rewritten history could keep the cursor SHA reachable in a dangling state; add an explicit "cursor is ancestor of HEAD" check to be safe. |
| A3 | Single-threaded es-git parse is fast enough for MVP; piscina deferred | Standard Stack, Summary | Medium — if the dogfood/100k fixture is slow, workers must be added. Mitigated by keeping the parse step a pure function. |
| A4 | No standalone npm secret-redaction library is worth a runtime dependency; a hand-rolled rule set (gitleaks patterns as reference) is preferred | Don't Hand-Roll, §6 | Medium — regex set may miss exotic secret formats; mitigate with entropy heuristic + extensible rule list + the CI grep test. |
| A5 | Node 22.x LTS is the target despite Node 24 being installed locally | Environment Availability | Low — both native addons support Node 20–26; pin via `.nvmrc` and CI matrix. |

## Open Questions

1. **Exact es-git accessors for parents & shallow status.**
   - What we know: revwalk, `getCommit`, `diffTreeToTree`, `findSimilar`, `pushRange`, `hide`, `revparseSingle` are confirmed via Context7.
   - What's unclear: precise method names for parent enumeration and shallow detection.
   - Recommendation: confirm against es-git `Commit`/`Repository` reference at plan time; `.git/shallow` file check is the guaranteed fallback.

2. **Doc snapshot storage volume.**
   - What we know: D-14 stores doc content at changing commits; docs are small relative to code.
   - What's unclear: dedupe strategy — store full content per snapshot vs content-addressed by `contentHash`.
   - Recommendation: store by `contentHash` with a snapshot→hash reference to avoid duplicating unchanged doc bodies; cheap win, schema-supported now.

3. **piscina activation threshold.**
   - Recommendation: defer entirely for Phase 1; revisit only if the 100k-commit fixture (or dogfood) exceeds an acceptable index time. Keep parse pure to enable later worker adoption without refactor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime, native addons | ✓ | v24.17.0 (installed) | STACK targets 22.x LTS; both es-git & better-sqlite3 support 20–26. **Pin via `.nvmrc`; recommend 22.x LTS.** |
| pnpm | Monorepo package manager | ✓ | 10.2.0 (installed) | STACK recommends 11.9.0; 10.x works. Consider bumping for lockfile consistency. |
| git | Repo under test / dogfood fixture | ✓ | 2.50.0 | — |
| es-git prebuilt binary | Git ingestion | ✓ (npm install resolves) | 0.7.0 | Verify prebuild exists for team OS/arch in CI. |
| better-sqlite3 prebuilt binary | Index store | ✓ (npm install resolves) | 12.11.1 | Rebuild on Node major upgrade. |

**Version notes (not blocking):**
- **Node:** installed v24.17.0; STACK recommends 22.x LTS. Neither addon is blocked on 24, but pin a single version via `.nvmrc` and set a CI matrix to catch ABI/prebuild gaps. Recommend standardizing on **Node 22 LTS**.
- **pnpm:** installed 10.2.0 vs STACK's 11.9.0 — minor; either works for workspace protocol.

**No blocking missing dependencies.** No network services required (local-only, PRIV-01).

## Validation Architecture

*(nyquist_validation is enabled — `.planning/config.json` `workflow.nyquist_validation: true`.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (root) — **Wave 0: does not exist yet** |
| Quick run command | `pnpm vitest run packages/core/src/<area>` (or `turbo test --filter=@gitchange/core`) |
| Full suite command | `turbo test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGX-01 | Index synthetic repo → schema-valid `.gitchange/` with no network | integration/golden | `pnpm vitest run packages/core/src/index` | ❌ Wave 0 |
| INGX-02 | Commits/authors/merges/renames/diffs parsed correctly | golden | `pnpm vitest run packages/core/src/ingestion` | ❌ Wave 0 |
| INGX-03 | Doc snapshots captured for default doc globs | golden | `pnpm vitest run packages/core/src/ingestion/doc` | ❌ Wave 0 |
| INGX-04 | Incremental run indexes only commits after cursor | integration | `pnpm vitest run packages/core/src/index/incremental` | ❌ Wave 0 |
| INGX-05 | Shallow → partial+warn; force-push → halt+require full | integration | `pnpm vitest run packages/core/src/index/freshness` | ❌ Wave 0 |
| PRIV-02 | Simulated secrets never appear in built SQLite | golden + grep | `pnpm vitest run packages/core/src/privacy` | ❌ Wave 0 |
| PRIV-03 | `.gitchangeignore` paths → metadata only, no content | golden | `pnpm vitest run packages/core/src/privacy/ignore` | ❌ Wave 0 |
| EVD-01/EVD-04 | Every narrative record has resolvable `evidence[]` | golden (referential) | `pnpm vitest run packages/core/src/schema/evidence` | ❌ Wave 0 |
| SCALE-03 | Core ingestion covered by golden fixtures | (meta — all above) | `turbo test --filter=@gitchange/core` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** area-scoped `pnpm vitest run packages/core/src/<area>`
- **Per wave merge:** `turbo test --filter=@gitchange/core`
- **Phase gate:** full suite green + secret-grep test green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` (root) + `packages/core` test wiring
- [ ] `tests/fixtures/` synthetic repo builder — programmatically create tiny git repos (merges, renames, conventional commits, ignored paths, simulated secrets) so fixtures are deterministic and don't ship real `.git` dirs. Consider building fixtures at test setup via es-git or a small git helper.
- [ ] Shared fixture helpers/`conftest`-equivalent (setup/teardown of temp repos + temp `.gitchange/`)
- [ ] Framework install: `pnpm add -D vitest -w`

## Security Domain

*(security_enforcement is enabled — absent from config = enabled.)*

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local library; no auth surface in Phase 1. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | partial | File-system only; respect umask when writing `.gitchange/` and interview/index files. |
| V5 Input Validation | yes | Zod at ingest boundary; treat commit messages/diff content as untrusted input (no eval, no shell interpolation of paths). |
| V6 Cryptography | no | No crypto beyond content hashing (use Node `crypto` `createHash('sha256')` for `contentHash` — never hand-roll). |
| V8 Data Protection | yes | **Secret redaction (PRIV-02) is the core control** — never persist raw secrets; store finding metadata only. |
| V12 Files & Resources | yes | Path traversal safety when reading/writing snapshots; cap blob size; skip binaries. |

### Known Threat Patterns for {Node native-addon ingestion + local SQLite}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Historical secret persisted in index | Information Disclosure | Redaction gate before write (D-08); CI grep test on built fixture SQLite. |
| `.gitchangeignore`-matched path content leaks | Information Disclosure | Store metadata only (D-07); test asserts no content for ignored paths. |
| Malicious path in commit (traversal via `../`) | Tampering | Store paths as data only; never resolve/write to them; write outputs only under `.gitchange/`. |
| Oversized/binary blob DoS | Denial of Service | Cap blob size; skip binary (libgit2 flags binary deltas); don't load huge blobs into memory. |
| World-readable `.gitchange/` on shared machine | Information Disclosure | Respect umask; document that `.gitchange/` is gitignored (D-17) and local. |
| SQL injection via commit content | Tampering | Use Drizzle parameterized queries only — never string-concatenate SQL. |

## Sources

### Primary (HIGH confidence)
- Context7 `/toss/es-git` — revwalk (`pushHead`/`pushRange`/`hide`), `getCommit`, `commit.author/committer/summary/message/tree`, `diffTreeToTree`, `diff.deltas()`, `diff.findSimilar({renames:true})`, `revparseSingle`, `mergeCommits`
- Context7 `/drizzle-team/drizzle-orm-docs` — `drizzle/better-sqlite3` client setup, sync transactions, drizzle-kit `generate`/`migrate`/`push`, `defineConfig` dbCredentials
- npm registry (`npm view <pkg> version`, 2026-06-30) — all versions verified
- slopcheck 0.6.1 scan (2026-06-30) — package legitimacy (15 OK, 1 false-positive SUS)
- `.planning/research/{STACK,ARCHITECTURE,SUMMARY,PITFALLS}.md` — stack rationale, layered pipeline, pitfall→phase mapping
- `.planning/phases/01-index-foundation/01-CONTEXT.md` — locked decisions D-01–D-18
- `CLAUDE.md` — embedded stack table + monorepo conventions

### Secondary (MEDIUM confidence)
- [es-git performance benchmarks](https://es-git.dev/performance.html) — revwalk speed vs child_process/nodegit
- [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3) — WAL, sync API
- [agent-sh/agent-analyzer] — two-phase index, `analyzedUpTo`/force-push fallback pattern (per SUMMARY/PITFALLS)
- [gitleaks](https://github.com/gitleaks/gitleaks) — secret pattern reference (patterns only, not a runtime dep)

### Tertiary (verify during planning)
- Exact es-git `Commit.parents()`/`parentCount()` and `Repository.isShallow()` accessor names (A1)
- piscina worker batch size at 100k scale (A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm + Context7; slopcheck clean; matches locked CONTEXT decisions.
- Architecture: HIGH — two-phase + evidence contract corroborated across ARCHITECTURE, SUMMARY, PITFALLS, and CONTEXT.
- es-git API: HIGH for core methods (Context7-confirmed); MEDIUM for shallow/parent accessors (flagged A1).
- Pitfalls: HIGH — multiple corroborating sources; mapped to concrete Phase 1 controls.

**Research date:** 2026-06-30
**Valid until:** ~2026-07-30 (stack is stable; native addon versions are the fastest-moving element — re-verify es-git on any Node major bump)
