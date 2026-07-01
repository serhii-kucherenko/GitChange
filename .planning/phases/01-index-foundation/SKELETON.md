# Phase 1 — Walking Skeleton

**Created:** 2026-07-01
**Purpose:** Record the architectural decisions the thinnest end-to-end slice locks in, so every later phase builds on them without renegotiating.

The skeleton proves one thing end to end: **`@gitchange/core` can index a tiny synthetic local git repo into `.gitchange/` (SQLite + `manifest.json`) with at least one real git read and one real SQLite write, with no network access.** It lands in Plan `01-05`; Plans `01-01`..`01-04` are the minimum foundation that write path requires.

---

## Thinnest End-to-End Path

```
tiny synthetic repo (.git)
      │  es-git openRepository() + revwalk().pushHead()      ← real git read
      ▼
  commit-parse (pure fn) → CommitRecord + FileChange[]
      │
      ▼
  PRIVACY GATE  (.gitchangeignore metadata-only → secret redaction)
      │
      ▼
  Zod validate (evidence[] required on narrative records)
      │  db.transaction(batch of 500–1000)                   ← real SQLite write
      ▼
  .gitchange/index.sqlite   +   .gitchange/manifest.json (written last)
```

`indexFull(repoPath)` runs this path once. `indexIncremental(repoPath)` swaps `pushHead()` for `pushRange('<lastIndexedCommit>..HEAD')`. No live git in any future read path (Pattern 1).

---

## Locked Architectural Decisions

| Decision | Choice | Source |
|----------|--------|--------|
| Language / module system | TypeScript 6.0.3, `strict: true`, `moduleResolution: "bundler"`, ESM | STACK.md, CLAUDE.md |
| Runtime | Node.js 22.x LTS, pinned via `.nvmrc` (installed local is v24 — CI matrix guards ABI) | RESEARCH Pitfall 5, A5 |
| Package manager / orchestration | pnpm workspace + Turborepo | STACK.md |
| Only package built in Phase 1 | `@gitchange/core` (Node-only; never browser-importable) | RESEARCH Project Structure, D-01 |
| Git engine | `es-git` 0.7.0 (libgit2, prebuilt napi-rs binaries) | RESEARCH Standard Stack |
| Index store | `better-sqlite3` 12.11.1, WAL + `synchronous = NORMAL` | D-01, RESEARCH §3 |
| Schema / migrations | `drizzle-orm` 0.45.2 + `drizzle-kit` 0.31.10 (`push` for Phase 1) | RESEARCH Standard Stack |
| Runtime validation | `zod` 4.4.3 at ingest/write boundary | D-16, EVD-01 |
| Test framework | Vitest 4.1.9 (fixtures built programmatically at setup) | D-11, VALIDATION.md |
| Lint / format | Biome 2.5.1 | STACK.md |
| Store path | `.gitchange/index.sqlite` + `.gitchange/manifest.json`; whole dir gitignored | D-01, D-02, D-17 |
| Evidence granularity | commit SHA + file path; hunk fields **reserved, not required** | D-15, D-16 |

---

## Directory Layout (established here, extended by later phases)

```
gitchange/
├── packages/core/                 # @gitchange/core — ONLY package this phase
│   ├── src/
│   │   ├── ingestion/             # git-walk.ts, commit-parse.ts, diff.ts, doc-snapshot.ts
│   │   ├── schema/
│   │   │   ├── drizzle/schema.ts  # tables: authors, commits, file_changes, doc_snapshots, secret_findings
│   │   │   ├── zod/               # evidence.ts, commit.ts, file-change.ts, doc-snapshot.ts
│   │   │   └── manifest.ts        # Manifest zod schema + read/write helpers
│   │   ├── privacy/               # gitchangeignore.ts, redaction.ts, default-gitchangeignore.ts
│   │   ├── artifacts/             # db.ts (client+WAL), writer.ts (batched tx)
│   │   ├── index/                 # full.ts, incremental.ts, freshness.ts
│   │   └── index.ts               # Node-only public exports
│   ├── drizzle.config.ts
│   ├── migrations/
│   ├── package.json
│   └── tsconfig.json
├── tests/fixtures/                # builder.ts (programmatic synthetic repos) + scenarios
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
├── tsconfig.base.json
├── biome.json
├── .nvmrc
└── package.json                   # root
```

Later phases add `packages/cli/`, `packages/server/`, `packages/dashboard/`, `packages/plugin/`. Core exports stay Node-only so a future browser dashboard never bundles es-git / better-sqlite3.

---

## SQLite Table Contract (frozen shape for downstream reads)

- `authors(id, name, email)` — unique `(name, email)`; evidence *source*, no `evidence[]`.
- `commits(sha PK, author_id, committer_id, authored_at, committed_at, summary, message, is_merge, parent_count, parents_json, cc_type, cc_scope, cc_breaking)` — evidence *source*.
- `file_changes(id, commit_sha, path, old_path, change_type, is_binary, content_ignored, content_redacted, evidence_json, hunk_start, hunk_end)` — **narrative-ready**, requires `evidence[]`; `hunk_start`/`hunk_end` nullable + reserved for Phase 5.
- `doc_snapshots(id, commit_sha, path, content_hash, content, frontmatter_json, evidence_json)` — **narrative-ready**, requires `evidence[]`; `content` NULL when `.gitchangeignore`-matched (D-07).
- `secret_findings(id, commit_sha, file_path, rule_id, location)` — redaction metadata only; **never** raw values (D-08).

## Manifest Contract (`.gitchange/manifest.json`, the read-API for later phases)

```
{ schemaVersion, lastIndexedCommit, indexedAt, repo:{head,branch},
  indexCompleteness: "complete"|"partial",
  warnings: [{ code: "shallow_clone"|"force_push_detected"|"out_of_order_commits", message }] }
```

Written **last** on every run. `.gitchange/` is gitignored by default; index adds the `.gitignore` entry if missing (D-17, D-18).

---

## Invariants Later Phases Must Not Break

1. **Two-phase split:** index once → read from `.gitchange/`. No live git walk in any read/UI hot path.
2. **Pipeline order is fixed:** parse → privacy gate → Zod validate → batched write → manifest. Never let raw content reach the writer unredacted.
3. **Evidence contract:** every narrative-ready record carries `evidence[].min(1)`; golden tests check referential resolution, not just shape.
4. **No network in `@gitchange/core`:** local-only (PRIV-01); asserted in tests.
5. **Streaming, not materializing:** stream the revwalk; flush in 500–1000-row batches; never load all commits into memory.
