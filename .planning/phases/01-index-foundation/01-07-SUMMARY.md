---
phase: 01-index-foundation
plan: 07
subsystem: ingestion
tags: [doc-snapshot, gray-matter, minimatch, sha256, evidence, privacy, vitest]

requires:
  - phase: 01-index-foundation
    provides: diff deltas, privacy gate, doc-snapshot Zod schema, index writer
provides:
  - Default doc glob matching (README*, CHANGELOG*, docs/**, **/adr/**, root *.md)
  - Content-addressed doc snapshots at changing commits
  - Frontmatter parsing via gray-matter
  - Evidence-linked doc_snapshots rows in SQLite via index walk
affects: [01-08, phase-5-decisions, phase-6-tours]

tech-stack:
  added: []
  patterns:
    - "Doc capture in ingestion layer; privacy + Zod validation at process-commit/write boundary"
    - "contentHash from stored body (or raw bytes when metadata-only)"

key-files:
  created:
    - packages/core/src/ingestion/doc-snapshot.ts
    - packages/core/src/ingestion/doc-snapshot.test.ts
  modified:
    - packages/core/src/index/process-commit.ts
    - packages/core/src/index/full.ts
    - packages/core/src/index/incremental.ts
    - packages/core/src/artifacts/writer.ts
    - packages/core/src/artifacts/writer.test.ts
    - packages/core/src/index/full.test.ts
    - packages/core/src/ingestion/index.ts

key-decisions:
  - "Ignored doc paths store content null but contentHash from raw blob bytes for dedupe metadata"
  - "Gray-matter body trimmed before storage and hashing"
  - "Per (commitSha, path) rows store full body even when contentHash repeats across commits"

patterns-established:
  - "captureDocSnapshots reads blobs at commit boundary; applyPrivacy runs in process-commit before writer.addDocSnapshot"
  - "Doc secret findings use location doc with metadata-only storage (D-08)"

requirements-completed: [INGX-03]

duration: 18min
completed: 2026-07-01
---

# Phase 1 Plan 07: Doc Snapshot Ingestion Summary

**Content-addressed doc history (README, CHANGELOG, docs/, ADRs) snapshotted at changing commits with frontmatter, evidence refs, and privacy redaction wired into full and incremental indexing**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T01:13:00Z
- **Completed:** 2026-07-01T01:31:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `isDocPath` and `captureDocSnapshots` match default doc globs, skip deleted/binary blobs, cap size, and hash with Node `crypto` SHA-256
- `processCommit` captures doc snapshots after diff, applies `applyPrivacy`, records `location: doc` secret findings, and writes Zod-validated `doc_snapshots` rows
- `BASIC_SCENARIO` full index populates `doc_snapshots` with resolvable `evidence[]` on every row

## Task Commits

1. **Task 1: doc path matching + content-addressed snapshot capture** - `796c5ef` (feat)
2. **Task 2: wire doc snapshots into the index walk + writer** - `5e6f252` (feat)

## Files Created/Modified

- `packages/core/src/ingestion/doc-snapshot.ts` - Doc glob matching and blob capture at commit boundaries
- `packages/core/src/ingestion/doc-snapshot.test.ts` - Golden tests for paths, hashing, ignored metadata, frontmatter
- `packages/core/src/index/process-commit.ts` - Shared pipeline step for doc snapshot privacy + persistence
- `packages/core/src/artifacts/writer.ts` - `addDocSnapshot` with batched `doc_snapshots` inserts
- `packages/core/src/index/full.ts` / `incremental.ts` - Pass `maxBlobBytes` into `processCommit`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/core/src/ingestion/doc-snapshot.ts
- FOUND: packages/core/src/ingestion/doc-snapshot.test.ts
- FOUND: 796c5ef
- FOUND: 5e6f252
