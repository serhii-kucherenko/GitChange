---
name: gitchange-interview
description: Confirm or reject a pending GitChange decision via maintainer interview; persist durable lore and merge into decisions.json.
schemas:
  - packages/plugin/schemas/decisions.schema.json
  - packages/plugin/schemas/interview-record.schema.json
---

# /gitchange-interview — Maintainer decision interview (DEC-03, DEC-04)

GitChange supplies **artifacts and schemas only**. The host AI conducts the interview and persists answers — GitChange does not call any LLM APIs (PLUG-05).

Use this skill when:

- The user asks to **confirm** or **reject** an auto-mined decision
- `/gitchange` surfaces decisions with `reviewStatus: pending` and the maintainer wants to review them
- Evidence is weak and tribal knowledge should become durable lore

## Prerequisites

- `.gitchange/decisions.json` exists and validates against `decisions.schema.json`
- Target decision has `reviewStatus: pending` (or the user explicitly names a `decision:` id to review)

Resolve repo root by walking up for `.git`. The `.gitchange` directory lives at `<repo>/.gitchange`.

## Interview flow

### 1. Load the decision

Read `<repo>/.gitchange/decisions.json`. Locate the decision by `decision:` id (user-provided or first `reviewStatus: pending` when unspecified).

Present to the maintainer:

- `title`, `summary`, `status`, `confidence`
- Full `evidence` list (commit SHAs, file paths, doc excerpts)
- `attribution` block when present (name, rationale)

If the decision is below the EVD-03 threshold (`confidence < 0.35` or no evidence), explain the gap honestly before asking for confirmation — do not paraphrase a hidden summary.

### 2. Ask confirm or reject

Ask the maintainer:

1. **Verdict:** confirm or reject this decision?
2. **Rationale:** optional free-text (why confirm/reject)
3. **Docs export (optional):** only if they want a markdown snippet in `docs/interviews/` — requires explicit opt-in (`writeToDocs: true`)

Record who answered when they identify themselves (`maintainer` field).

### 3. Structure the answer

Follow `packages/plugin/agents/interview-synthesizer.md`. Host AI outputs a single `InterviewRecord` JSON object.

Validate against `packages/plugin/schemas/interview-record.schema.json`.

### 4. Persist interview JSON (DEC-04)

```bash
pnpm exec tsx packages/plugin/scripts/write-interview.ts "<absolute-path-to-.gitchange>" /path/to/interview-record.json
```

Interview files are stored at `.gitchange/interviews/<id>.json` — durable lore independent of re-index.

### 5. Merge into decisions.json

```bash
pnpm exec tsx packages/plugin/scripts/merge-interview.ts "<absolute-path-to-.gitchange>" <interview-id> "<absolute-repo-root>"
```

Effects:

| Verdict | `reviewStatus` | `confidence` | `miningSource` | Evidence |
|---------|----------------|--------------|----------------|----------|
| confirm | `confirmed` | bumped to ≥ 0.7 | `interview` | appends `interview` evidence ref |
| reject | `rejected` | unchanged | unchanged | appends `interview` evidence ref |

Rejected decisions **remain** in `decisions.json` for audit — they are not deleted.

### 6. Present outcome

Summarize:

- Verdict and updated `reviewStatus`
- New confidence (confirm raises above EVD-03 threshold)
- Path to interview JSON: `.gitchange/interviews/<id>.json`
- If `writeToDocs: true`: path to `docs/interviews/<id>.md` and remind the maintainer to **commit manually** — GitChange never auto-commits doc writeback

## Security

- Only read/write under `<repo>/.gitchange/` and optional `<repo>/docs/interviews/` (when opted in)
- Do not dump raw SQLite or full repo file bodies into chat
- Interview ids must not contain `..` or path separators

## On failure

- **decisions.json missing:** ask user to run `/gitchange` decision synthesis first
- **Decision not found:** list pending decisions with ids
- **Schema validation errors:** show field errors; do not persist invalid JSON
- **Merge errors:** show stderr from `merge-interview.ts`; interview JSON may still exist — merge can be retried

## Related

- Main pipeline: `/gitchange` — links here when pending decisions exist after step 5b
- Dashboard: `/gitchange-dashboard` — Decisions tab shows `reviewStatus` after merge
