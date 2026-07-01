# Phase 1: Index Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 1-Index Foundation
**Areas discussed:** Index artifact shape, Freshness on shallow clone / force-push, Secret & sensitive path policy, Golden fixture repos

---

## Index artifact shape

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite primary + manifest.json only | SQLite for OLTP; human-readable manifest only, no commit JSON dumps | ✓ |
| SQLite + JSON sidecars | Dual write commits/docs to inspectable JSON files | |
| JSON-only MVP | Defer SQLite to Phase 8 scale work | |

**User's choice:** SQLite primary + manifest.json only
**Notes:** Matches 100k+ commit OLTP requirement from stack research; JSON reserved for semantic artifacts in later phases.

---

## Freshness on shallow clone / force-push

| Option | Description | Selected |
|--------|-------------|----------|
| Warn + continue with degraded badge | Index available history; mark partial completeness; persist warnings | ✓ |
| Block until --force-full | Refuse to index until user explicitly forces full rebuild | |
| Silent partial index | Index without prominent warnings; badge only in status | |

**User's choice:** Warn + continue with degraded badge
**Notes:** Incremental merge halts on force-push detection; full rebuild requires explicit flag. Shallow clones allowed on cold start.

---

## Secret & sensitive path policy

| Option | Description | Selected |
|--------|-------------|----------|
| Redact content, keep metadata | Strip secret substrings; retain SHA, author, path, timestamps | ✓ |
| Drop ignored files entirely | No record of ignored path changes | |
| Exclude whole commits | Omit commits touching secrets from index | |

**User's choice:** Redact content, keep commit/file metadata
**Notes:** `.gitchangeignore` paths store change metadata without content. Default ignore template for common secret patterns.

---

## Golden fixture repos

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic CI + GitChange dogfood | Fast synthetic repos in CI; self-repo integration test locally | ✓ |
| Synthetic only | No real-repo fixture until later | |
| Dogfood only | GitChange repo as sole golden fixture | |

**User's choice:** Synthetic CI fixtures + GitChange dogfood integration
**Notes:** Golden tests assert schema conformance and evidence-link integrity, not JSON shape alone.

---

## Skipped follow-ups (defaults applied)

User skipped second-round questions. Recommended defaults recorded in CONTEXT.md:

| Topic | Default applied |
|-------|-----------------|
| Doc ingestion scope | README*, CHANGELOG*, docs/**, **/adr/**, root *.md |
| `.gitchange/` git policy | Gitignore entire directory by default; opt-in manifest-only commit |
| Evidence granularity | Commit SHA + file path in Phase 1; hunk-level deferred to Phase 5 |

---

## Claude's Discretion

- User initially selected "whatever" for area selection — all four gray areas discussed with explicit confirmation on core choices
- SQLite schema layout, batch sizes, piscina threshold, redaction regex details, fixture directory layout

## Deferred Ideas

- JSON sidecar exports for human inspection
- Hunk-level evidence in ingestion layer
- Auto-watch reindex (chokidar)
- Multi-repo unified index
