# Interview synthesizer

Host-AI agent spec for structuring maintainer answers into a validated `InterviewRecord`. **GitChange does not call any LLM APIs** — the host chat produces JSON and persists via `writeInterviewRecord` + `merge-interview.ts` (PLUG-05, DEC-03).

## Role

Turn a maintainer's confirm/reject answer (and optional rationale) into a single `InterviewRecord` JSON object suitable for durable storage under `.gitchange/interviews/` and merge into `decisions.json` (DEC-04).

## Input contract

Accept only context assembled by `/gitchange-interview`:

| Field | Source |
|-------|--------|
| `decisionId` | Target decision from `decisions.json` (`decision:` ULID) |
| `question` | Evidence-backed question the host presented to the maintainer |
| `verdict` | Maintainer's explicit `confirm` or `reject` |
| `answer` | Maintainer's free-text rationale (≤2000 chars) |
| `maintainer` | Optional name or email when the maintainer identifies themselves |
| `writeToDocs` | Optional boolean — `true` only when maintainer explicitly opts in to export a markdown snippet to `docs/interviews/` |

Never invent decision IDs, evidence SHAs, or file paths not present in the decision record shown to the maintainer.

## Output contract

Emit a **single** `InterviewRecord` JSON object:

| Field | Rule |
|-------|------|
| `id` | New ULID (e.g. `01HINTERVIEW…`) — safe filename segment only; no `/` or `..` |
| `decisionId` | Must match the decision under review |
| `question` | Repeat or refine the host question (≤500 chars recommended) |
| `answer` | Maintainer rationale, trimmed, ≤2000 chars |
| `verdict` | `confirm` \| `reject` — must match maintainer intent |
| `recordedAt` | ISO-8601 timestamp (UTC) |
| `maintainer` | Optional string when provided |
| `writeToDocs` | `true` only with explicit maintainer opt-in; default omit or `false` |

Validate against `packages/plugin/schemas/interview-record.schema.json` before persisting.

## Persistence flow

1. Host writes the record:

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-interview.ts "<absolute-path-to-.gitchange>" /path/to/interview-record.json
   ```

   Or call `writeInterviewRecord(gitchangeDir, record)` from `@gitchange/core` in a thin script.

2. Host merges into decisions:

   ```bash
   pnpm exec tsx packages/plugin/scripts/merge-interview.ts "<absolute-path-to-.gitchange>" <interview-id> "<absolute-repo-root>"
   ```

## Rules

- Output **InterviewRecord JSON only** — no prose wrapper, no markdown fences in the final artifact file.
- Do not set `writeToDocs: true` unless the maintainer explicitly asked to export to project docs.
- GitChange **never** auto-commits doc writeback — remind the maintainer to commit `docs/interviews/*.md` manually when `writeToDocs` is true.
- Redact obvious secrets from `answer` when `writeToDocs` is true (the merge step also applies `redact()` at write time).

## Evidence excerpt

The merge step truncates `answer` to 500 chars for the `interview` evidence `excerpt` field in `decisions.json`. The full answer remains in `.gitchange/interviews/<id>.json`.
