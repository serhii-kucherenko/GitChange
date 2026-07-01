# Phase 1: Index Foundation - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 29 (new — greenfield repository)
**Analogs found:** 29 / 29 (all external-reference analogs — no existing codebase files)

**Greenfield note:** This repository has no `packages/` implementation yet — only `.planning/` artifacts and root scaffolding (`CLAUDE.md`, `README.md`, `.gitignore`). Every "analog" below is an **external reference** (RESEARCH.md verified code examples, ARCHITECTURE.md structural patterns, or the Understand-Anything / Repowise reference architectures) rather than a sibling file in this codebase. The planner should treat these as the pattern source of truth since there is no local prior art to copy from.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|---------------|
| `package.json` (root) | config | — | Understand-Anything monorepo root (`STACK.md` Monorepo Layout) | reference |
| `pnpm-workspace.yaml` | config | — | Understand-Anything pnpm workspace pattern | reference |
| `turbo.json` | config | — | Understand-Anything turbo pipeline (`STACK.md`) | reference |
| `tsconfig.base.json` | config | — | STACK.md TS 6.0.3 `strict`/`moduleResolution: "bundler"` | reference |
| `biome.json` | config | — | STACK.md Biome single-tool lint/format | reference |
| `.nvmrc` | config | — | RESEARCH.md Pitfall 5 (Node pin for native addons) | reference |
| `vitest.config.ts` (root) | config | — | RESEARCH.md Validation Architecture (Wave 0 gap) | reference |
| `packages/core/package.json` | config | — | RESEARCH.md Installation block (`@gitchange/core` deps) | reference |
| `packages/core/tsconfig.json` | config | — | tsconfig.base.json extension (project convention) | reference |
| `packages/core/drizzle.config.ts` | config | — | Drizzle official docs `defineConfig` (RESEARCH.md §3) | exact (Context7-verified) |
| `packages/core/src/ingestion/git-walk.ts` | service | streaming | RESEARCH.md Code Example §1 + §4 (es-git revwalk) | exact (Context7-verified) |
| `packages/core/src/ingestion/commit-parse.ts` | transform | transform | RESEARCH.md Code Example §1 (pure fn over `Commit`) | exact (Context7-verified) |
| `packages/core/src/ingestion/diff.ts` | transform | transform | RESEARCH.md Code Example §2 (`diffTreeToTree` + `findSimilar`) | exact (Context7-verified) |
| `packages/core/src/ingestion/doc-snapshot.ts` | service | file-I/O | ARCHITECTURE.md Doc Ingestion row + CONTEXT D-13/D-14 | role-match |
| `packages/core/src/schema/drizzle/schema.ts` | model | CRUD | RESEARCH.md Code Example §3 (Drizzle table defs) | exact (Context7-verified) |
| `packages/core/src/schema/zod/evidence.ts` | model | transform | RESEARCH.md Pattern 3 (Evidence discriminated union) | exact |
| `packages/core/src/schema/zod/commit.ts` | model | transform | RESEARCH.md Pattern 3 (sibling of `DocSnapshot`) | role-match |
| `packages/core/src/schema/zod/file-change.ts` | model | transform | RESEARCH.md Code Example §2 (`FileChange` shape) | role-match |
| `packages/core/src/schema/zod/doc-snapshot.ts` | model | transform | RESEARCH.md Pattern 3 (`DocSnapshot` schema, verbatim) | exact |
| `packages/core/src/schema/manifest.ts` | model | CRUD | RESEARCH.md Pattern 2 / ARCHITECTURE.md `GitChangeManifest` | exact |
| `packages/core/src/privacy/gitchangeignore.ts` | middleware | request-response | CONTEXT D-07/D-10 + RESEARCH.md Don't-Hand-Roll (minimatch) | role-match |
| `packages/core/src/privacy/redaction.ts` | middleware | transform | RESEARCH.md Code Example §6 (secret redaction gate) | exact |
| `packages/core/src/privacy/default-gitchangeignore.ts` | config | — | CONTEXT D-10 default template list | role-match |
| `packages/core/src/artifacts/db.ts` | service | CRUD | RESEARCH.md Code Example §3 (Drizzle + better-sqlite3 client, WAL) | exact (Context7-verified) |
| `packages/core/src/artifacts/writer.ts` | service | batch | RESEARCH.md Pattern 4 (batched SQLite transactions, 500–1000 rows) | exact |
| `packages/core/src/index/full.ts` | service | event-driven | ARCHITECTURE.md Full Index Flow (cold start) | role-match |
| `packages/core/src/index/incremental.ts` | service | event-driven | RESEARCH.md Code Example §4 (`pushRange`) + ARCHITECTURE.md Incremental Update Flow | exact (Context7-verified) |
| `packages/core/src/index/freshness.ts` | service | event-driven | RESEARCH.md Code Example §5 (shallow/force-push detection) | exact (partially unverified accessors — see A1) |
| `packages/core/src/index.ts` | provider | — | ARCHITECTURE.md Internal Boundaries (`ingestion ↔ intelligence` typed exports) | role-match |
| `tests/fixtures/builder.ts` | test | file-I/O | RESEARCH.md Validation Architecture Wave 0 Gaps (synthetic repo builder) | role-match |

## Pattern Assignments

### Monorepo scaffold (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `.nvmrc`)

**Analog:** Understand-Anything monorepo layout, adapted per `STACK.md` "Monorepo Layout" and RESEARCH.md "Recommended Project Structure."

**Structure to follow** (RESEARCH.md lines 219–248):
```
gitchange/
├── packages/
│   └── core/                      # @gitchange/core — the ONLY package touched in Phase 1
│       ├── src/
│       │   ├── ingestion/
│       │   ├── schema/{drizzle,zod}/ + manifest.ts
│       │   ├── privacy/
│       │   ├── artifacts/
│       │   ├── index/
│       │   └── index.ts
│       ├── drizzle.config.ts
│       ├── migrations/
│       ├── package.json
│       └── tsconfig.json
├── tests/fixtures/
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
├── biome.json
├── tsconfig.base.json
└── .nvmrc
```

**Key constraint:** Only `packages/core` is scaffolded in Phase 1 (no `cli/`, `server/`, `dashboard/`, `plugin/` yet — those are later phases per ARCHITECTURE.md Suggested Build Order). Keep `@gitchange/core` exports Node-only; never import es-git/better-sqlite3 in a way a future dashboard could pull into a browser bundle.

**Install command** (RESEARCH.md line 138–145):
```bash
pnpm add es-git better-sqlite3 drizzle-orm zod conventional-commits-parser gray-matter minimatch -F @gitchange/core
pnpm add -D drizzle-kit @types/better-sqlite3 -F @gitchange/core
pnpm add -D typescript vitest turbo @biomejs/biome tsx -w
```

---

### `packages/core/src/ingestion/git-walk.ts` (service, streaming)

**Analog:** RESEARCH.md Code Example §1 + §4 (Context7 `/toss/es-git`)

**Core pattern — full walk from HEAD:**
```typescript
import { openRepository } from "es-git";

const repo = await openRepository("/path/to/repo");
const revwalk = repo.revwalk().pushHead();   // newest → oldest from HEAD

for (const sha of revwalk) {
  const commit = repo.getCommit(sha);
  // stream, don't materialize the full list in memory (Pitfall 1)
}
```

**Incremental variant** (INGX-04):
```typescript
const cursor = manifest.lastIndexedCommit;
const revwalk = repo.revwalk().pushRange(`${cursor}..HEAD`);
// Equivalent: revwalk.pushHead().hide(cursor)
```

**Constraint:** Never load all commits into memory before writing (RESEARCH.md Anti-Patterns). Stream SHA → parse → accumulate batch → flush at 500–1000 rows (see `writer.ts` pattern below).

---

### `packages/core/src/ingestion/commit-parse.ts` (transform)

**Analog:** RESEARCH.md Code Example §1, kept as a **pure function** per the Architectural Responsibility Map ("Pure functions over es-git objects; deterministic, TDD-covered").

**Pattern:**
```typescript
const commit = repo.getCommit(sha);
const author = commit.author();
const committer = commit.committer();
const summary = commit.summary();
const message = commit.message();
const id = commit.id();
// merge = parent count > 1 — confirm exact accessor (parents()/parentCount()) at implementation time (Open Question A1)
```
Pipe `message` through `conventional-commits-parser` to extract `type`/`scope`/breaking-change footers deterministically (CONTEXT Claude's Discretion; RESEARCH.md Don't Hand-Roll table).

---

### `packages/core/src/ingestion/diff.ts` (transform)

**Analog:** RESEARCH.md Code Example §2 (Context7 `/toss/es-git`)

**Core pattern:**
```typescript
const commitTree = commit.tree();
const parentTree = parentSha ? repo.getCommit(parentSha).tree() : null;
const diff = repo.diffTreeToTree(parentTree, commitTree);
diff.findSimilar({ renames: true });

for (const delta of diff.deltas()) {
  const status = delta.status();          // 'Added' | 'Modified' | 'Deleted' | 'Renamed' | ...
  const oldPath = delta.oldFile().path();
  const newPath = delta.newFile().path();
}
// Root commit (no parent): parentTree = null → all files 'Added'
```
**Do not** hand-roll rename detection via add/delete path heuristics — use `findSimilar({renames:true})` (RESEARCH.md Don't Hand-Roll).

---

### `packages/core/src/ingestion/doc-snapshot.ts` (service, file-I/O)

**Analog:** ARCHITECTURE.md "Doc ingestion" component row + CONTEXT D-13/D-14 (no verified code example — first-of-kind for this phase).

**Pattern to establish:**
- Filter diff deltas against default doc globs (`README*`, `CHANGELOG*`, `docs/**`, `**/adr/**`, root `*.md`) using `minimatch` (D-13).
- On match, snapshot blob content at that commit boundary; store by `contentHash` (SHA-256 via Node `crypto.createHash`) rather than duplicating unchanged bodies (RESEARCH.md Open Question 2).
- Parse frontmatter with `gray-matter` for ADR/changelog metadata.
- Every snapshot record carries `evidence: [{ type: "file", path, commitSha }]` (D-16) — validated by the `zod/doc-snapshot.ts` schema below.

---

### `packages/core/src/schema/drizzle/schema.ts` (model, CRUD)

**Analog:** RESEARCH.md Code Example §3 (Context7 `/drizzle-team/drizzle-orm-docs`)

**Tables required (D-01):** `commits`, `authors`, `file_changes`, `doc_snapshots` — plus reserved columns for Phase 5 hunk-level evidence (D-15, must not be required now).

```typescript
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema/drizzle";

const sqlite = new Database(".gitchange/index.sqlite");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
const db = drizzle({ client: sqlite, schema });
```
Use `drizzle-kit generate`/`migrate` for schema evolution — never hand-written `ALTER TABLE` (RESEARCH.md Don't Hand-Roll).

---

### `packages/core/src/schema/zod/evidence.ts`, `commit.ts`, `file-change.ts`, `doc-snapshot.ts` (model, transform)

**Analog:** RESEARCH.md Pattern 3 "Evidence Contract Enforced at Write Boundary" (verbatim source for `evidence.ts` and `doc-snapshot.ts`).

```typescript
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
**Critical rule (D-16):** Every *narrative-ready* record (doc snapshot, file-change summary) requires `evidence: z.array(Evidence).min(1)`. Raw `commits`/`authors` rows are evidence *sources*, not narrative records — they don't need an `evidence[]` field themselves, but their SHA/path values must be the things evidence refs resolve against (RESEARCH.md Pattern 3 "When to use").

---

### `packages/core/src/schema/manifest.ts` (model, CRUD)

**Analog:** RESEARCH.md Pattern 2 "Incremental Checkpoint via Manifest" (adapted from ARCHITECTURE.md `GitChangeManifest`).

```typescript
interface Manifest {
  schemaVersion: string;
  lastIndexedCommit: string;
  indexedAt: string;
  repo: { head: string; branch: string | null };
  indexCompleteness: "complete" | "partial";
  warnings: Array<{
    code: "shallow_clone" | "force_push_detected" | "out_of_order_commits";
    message: string;
  }>;
}
```
Follow the `typescript-exhaustive-switch` workspace rule wherever `warnings[].code` or `indexCompleteness` is switched on downstream — add a `never` default case.

---

### `packages/core/src/privacy/gitchangeignore.ts` (middleware, request-response)

**Analog:** CONTEXT D-07/D-10 + RESEARCH.md Don't Hand-Roll table (`minimatch` for gitignore-style glob semantics).

**Pattern:** Path-matched via `minimatch` against `.gitchangeignore` patterns (default template: `.env*`, `**/secrets/**`, `*credentials*`, `*.pem`, `*.key`). On match: record `{ path, changeType }` only — **never** persist file content or diff hunks (D-07). This gate runs *before* the Zod validation boundary in the pipeline (RESEARCH.md System Architecture Diagram — "PRIVACY GATE").

---

### `packages/core/src/privacy/redaction.ts` (middleware, transform)

**Analog:** RESEARCH.md Code Example §6 (secret redaction gate) — the one component RESEARCH.md explicitly flags as *hand-rolled by necessity* (no mature standalone redaction npm package; gitleaks patterns used as reference only, not a runtime dependency).

```typescript
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
**Rule (D-09):** Never drop whole commits for touching secrets — only redact content, always keep SHA/author/timestamp/path. Make the rule set data-driven/extensible (CONTEXT Claude's Discretion) so it can grow without touching call sites.

---

### `packages/core/src/artifacts/db.ts` (service, CRUD)

**Analog:** RESEARCH.md Code Example §3 (same source as `schema/drizzle/schema.ts` above — this file owns the client instantiation half; `schema.ts` owns table defs).

```typescript
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../schema/drizzle";

const sqlite = new Database(".gitchange/index.sqlite");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
export const db = drizzle({ client: sqlite, schema });
```

---

### `packages/core/src/artifacts/writer.ts` (service, batch)

**Analog:** RESEARCH.md Pattern 4 "Batched SQLite Transactions."

```typescript
function insertCommitBatch(rows: CommitRow[]) {
  db.transaction((tx) => {
    for (const r of rows) tx.insert(schema.commits).values(r).run();
  })(); // note trailing () — sync transaction is invoked immediately
}
// Flush every 500–1000 rows while streaming the revwalk.
```
**Rule:** All writes pass through Zod validation (evidence contract) *before* this writer is called — the privacy gate → Zod validate → batched insert ordering in the pipeline diagram must not be reordered.

---

### `packages/core/src/index/full.ts` (service, event-driven — cold start)

**Analog:** ARCHITECTURE.md "Full Index Flow (cold start)" + RESEARCH.md System Architecture Diagram.

**Flow to implement:** `openRepository` → `revwalk().pushHead()` → per-commit parse (pure fn) → privacy gate → Zod validate → batched Drizzle transaction → write `manifest.json` (last step, always).

---

### `packages/core/src/index/incremental.ts` (service, event-driven — warm)

**Analog:** RESEARCH.md Code Example §4 + ARCHITECTURE.md "Incremental Update Flow (warm)."

```typescript
const cursor = manifest.lastIndexedCommit;
const revwalk = repo.revwalk().pushRange(`${cursor}..HEAD`);
for (const sha of revwalk) {
  // parse + persist only NEW commits
}
```
**Foundational rule (Pattern 1, "locked"):** Never full-rescan on every run. This file is the primary safeguard against Pitfall 1 (Full-History Rescan Architecture).

---

### `packages/core/src/index/freshness.ts` (service, event-driven)

**Analog:** RESEARCH.md Code Example §5 + Pitfall 3 (History Integrity Edge Cases).

```typescript
function isForcePush(repo, cursor: string): boolean {
  try {
    repo.revparseSingle(cursor);
    // additionally confirm ancestry: cursor reachable from HEAD
    return false;
  } catch {
    return true;                            // cursor gone → rewritten history
  }
}
// Shallow: .git/shallow file presence, or es-git repo.isShallow() — set indexCompleteness: partial, warn+continue (D-04)
```
**Open item (A1/A2 in RESEARCH.md):** Confirm exact es-git accessor names (`parents()`/`parentCount()`, `isShallow()`) during implementation; the `.git/shallow` file check is the guaranteed cross-version fallback if the accessor doesn't exist as named.
**Decision routing:** shallow → warn + continue, `indexCompleteness: "partial"` (D-04). Force-push → warn + **halt** incremental merge, require `--full` rebuild (D-05). These are two distinct code paths — do not conflate them into one warning type.

---

### `packages/core/src/index.ts` (provider — package exports)

**Analog:** ARCHITECTURE.md "Internal Boundaries" table (`ingestion ↔ intelligence`: typed `CommitRecord[]`/file stats, pure functions, no side effects) and STACK.md's explicit constraint: "Node-only; no browser imports of es-git/better-sqlite3."

**Rule:** Public exports must be composable by Phase 3 CLI and Phase 5 server without re-implementing pipeline wiring. Per the workspace no-inline-imports rule, all re-exports live at module top level.

---

### `tests/fixtures/builder.ts` + fixture scenarios (test, file-I/O)

**Analog:** RESEARCH.md Validation Architecture "Wave 0 Gaps" + CONTEXT D-11 (both fixture strategies).

**Pattern:** Programmatically build tiny synthetic git repos (3–8 commits) at test setup — do not ship real `.git` directories as fixtures. Cover: merges, renames, conventional commits, `.gitchangeignore`-matched paths, simulated secrets (for the required CI grep test in Pitfall 2). Pair with GitChange's own repo as a slower dogfood integration fixture (required locally pre-milestone, optional in CI per D-11).

## Shared Patterns

### Two-Phase Index / Query Split (foundational — applies to all `ingestion/` and `index/` files)
**Source:** RESEARCH.md Pattern 1; ARCHITECTURE.md Anti-Pattern 2
**Apply to:** `git-walk.ts`, `full.ts`, `incremental.ts`
Index once into `.gitchange/index.sqlite`; every future read (Phase 5 dashboard, Phase 3 CLI `status`) queries the cache — **never** a live git walk in the read path.

### Evidence Contract (applies to all narrative-ready record schemas)
**Source:** RESEARCH.md Pattern 3 / D-16
**Apply to:** `zod/doc-snapshot.ts`, `zod/file-change.ts`, any future "summary" record
Every write of a narrative-ready record includes `evidence: z.array(Evidence).min(1)`, rejected by Zod otherwise. Golden tests additionally verify **referential** integrity — not just shape (Pitfall 4): every `evidence[].sha` must exist in `commits`; every `{path, commitSha}` must exist in `file_changes` (D-12, EVD-04).

### Privacy Gate Before Persistence (applies to ingestion → artifacts boundary)
**Source:** RESEARCH.md System Architecture Diagram; Pitfall 2
**Apply to:** `privacy/gitchangeignore.ts`, `privacy/redaction.ts`, `artifacts/writer.ts`
Pipeline order is fixed: parse → privacy gate (ignore-path metadata-only, then secret redaction) → Zod validate → batched write. Never reorder so raw content reaches the writer unredacted.

### Batched Synchronous Transactions (applies to all SQLite writes)
**Source:** RESEARCH.md Pattern 4
**Apply to:** `artifacts/writer.ts`, `index/full.ts`, `index/incremental.ts`
Accumulate 500–1000 parsed rows per `db.transaction(...)` flush; WAL + `synchronous = NORMAL` pragmas set once at `db.ts` client init.

### Manifest as the Read-API Contract (applies to all index/ orchestrators)
**Source:** RESEARCH.md Pattern 2; CONTEXT D-02/D-06/D-17
**Apply to:** `index/full.ts`, `index/incremental.ts`, `index/freshness.ts`, `schema/manifest.ts`
`manifest.json` is written last on every run; it is the only human-readable output in Phase 1 (D-02) and the thing downstream phases (CLI, server) read to know if/how to trust the index. `.gitchange/` itself is gitignored by default (D-17).

## No Analog Found

None — every file has at least a `role-match` external reference. This is expected for a greenfield phase: all patterns are sourced from RESEARCH.md's Context7-verified code examples and ARCHITECTURE.md's structural diagrams rather than sibling code, since no `packages/` implementation exists yet.

## Metadata

**Analog search scope:** `.planning/phases/01-index-foundation/01-CONTEXT.md`, `.planning/phases/01-index-foundation/01-RESEARCH.md`, `.planning/research/ARCHITECTURE.md`, `CLAUDE.md` (no source tree exists to search — confirmed via `ls`/`find` against repo root and `.planning/`)
**Files scanned:** 0 existing source files (greenfield); 4 planning documents read in full
**Pattern extraction date:** 2026-06-30

## PATTERN MAPPING COMPLETE

**Phase:** 1 - Index Foundation
**Files classified:** 29
**Analogs found:** 29 / 29 (all external-reference — greenfield repo)

### Coverage
- Files with exact analog (Context7-verified code example): 13
- Files with role-match analog (architecture pattern, no verified snippet yet): 16
- Files with no analog: 0

### Key Patterns Identified
- Two-phase index/query split is locked and foundational — `git-walk.ts`/`full.ts`/`incremental.ts` must stream via es-git revwalk (`pushHead`/`pushRange`) and never re-walk indexed history.
- Every narrative-ready Zod schema (`doc-snapshot.ts`, `file-change.ts`) requires a `evidence[].min(1)` discriminated-union field, enforced at the write boundary before the batched Drizzle transaction.
- Pipeline order is fixed: parse → privacy gate (`.gitchangeignore` metadata-only, then secret redaction) → Zod validate → batched SQLite write → manifest checkpoint — this ordering is safety-critical (Pitfall 2) and must not be reordered by the planner.

### File Created
`.planning/phases/01-index-foundation/01-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns (all sourced from RESEARCH.md Context7-verified examples and ARCHITECTURE.md structural diagrams) in PLAN.md files.
