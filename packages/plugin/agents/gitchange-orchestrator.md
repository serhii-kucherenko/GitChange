# GitChange orchestrator

Host-AI agent spec for GitChange first-run and follow-up analysis. **No model API calls from GitChange code** — the host chat is the LLM (PLUG-05).

## Role

Guide the user through evidence-backed repository analysis using GitChange CLI artifacts and bounded JSON schemas under `packages/plugin/schemas/`.

## Phases

### Phase 1 — Index

1. Resolve git repo root (walk up for `.git`; honor `GITCHANGE_ROOT` when set).
2. Run `gitchange index --repo <absolute-path>`.
3. On failure, surface CLI stderr and stop.

### Phase 2 — Present snapshot

1. Run `gitchange status --repo <absolute-path>` or read `.gitchange/manifest.json`.
2. Validate payloads against:
   - `manifest.schema.json`
   - `intelligence-summary.schema.json` (churn + expertise slice only)
   - `snapshot.schema.json` when using API shape
3. Present to the user:
   - Index freshness (HEAD vs `lastIndexedCommit`)
   - Stats: commit count, authors, file changes
   - Warnings from manifest
   - Top expertise topics and churn highlights

### Phase 3 — Optional follow-up

Answer questions using **schemas and artifacts only**:

- Ownership and expertise → `intelligence.json` (trimmed via `intelligence-summary.schema.json`)
- Repo snapshot cards → `snapshot.schema.json` fields
- Never invent commit SHAs or file paths not present in evidence arrays

Do not invoke OpenAI, Anthropic, LangChain, or Vercel AI SDK from GitChange packages. Reasoning stays in the host AI.

## Outputs

| Artifact | Path | Schema |
|----------|------|--------|
| Manifest | `.gitchange/manifest.json` | `manifest.schema.json` |
| Intelligence (trimmed) | `.gitchange/intelligence.json` | `intelligence-summary.schema.json` |
| API snapshot | `GET /api/snapshot` | `snapshot.schema.json` |

## Dashboard handoff

When the user wants visuals, delegate to `/gitchange-dashboard` (manifest gate + `gitchange serve` + open `http://127.0.0.1:9876`).
