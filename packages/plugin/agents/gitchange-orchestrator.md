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

### Phase 3 — Semantic era synthesis

Delegate to `packages/plugin/agents/era-synthesizer.md` after index when intelligence is available.

1. Confirm `<repo>/.gitchange/intelligence.json` exists.
2. Skip if valid `eras.json` exists and `eras.headSha` matches `intelligence.headSha`; otherwise proceed (or when user requests refresh).
3. Build context:

   ```bash
   pnpm exec tsx packages/plugin/scripts/build-era-context.ts "<repo>/.gitchange"
   ```

4. Host AI synthesizes `ErasArtifact` per era-synthesizer spec (3–8 named eras, claims with evidence, typed inflections).
5. Validate against `eras.schema.json`; persist:

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-eras.ts "<repo>/.gitchange" /path/to/eras-output.json
   ```

6. Present era names and inflection count to the user.

### Phase 4 — Decision synthesis

Delegate to `packages/plugin/agents/decision-miner.md` after era synthesis when `eras.json` is available.

1. Confirm `<repo>/.gitchange/intelligence.json` and `eras.json` exist.
2. Skip if valid `decisions.json` exists and `decisions.headSha` matches `intelligence.headSha`; otherwise proceed (or when user requests refresh).
3. Build context:

   ```bash
   pnpm exec tsx packages/plugin/scripts/build-decision-context.ts "<repo>/.gitchange"
   ```

4. Host AI synthesizes `DecisionsArtifact` per decision-miner spec (candidate-bound decisions with evidence, status, supersession).
5. Validate against `decisions.schema.json`; persist via merge gate:

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-decisions.ts "<repo>/.gitchange" /path/to/decisions-output.json
   ```

6. Present decision titles, status, confidence, and `reviewStatus` to the user.

### Phase 5 — Optional follow-up

Answer questions using **schemas and artifacts only**:

- Ownership and expertise → `intelligence.json` (trimmed via `intelligence-summary.schema.json`)
- Era evolution → `eras.json` (validated via `eras.schema.json`)
- Decisions and migrations → `decisions.json` (validated via `decisions.schema.json`)
- Repo snapshot cards → `snapshot.schema.json` fields
- Never invent commit SHAs or file paths not present in evidence arrays

Do not invoke OpenAI, Anthropic, LangChain, or Vercel AI SDK from GitChange packages. Reasoning stays in the host AI.

## Outputs

| Artifact | Path | Schema |
|----------|------|--------|
| Manifest | `.gitchange/manifest.json` | `manifest.schema.json` |
| Intelligence (trimmed) | `.gitchange/intelligence.json` | `intelligence-summary.schema.json` |
| Era synthesis input | `buildEraSynthesisContext()` stdout | `era-synthesis-context.schema.json` |
| Named eras | `.gitchange/eras.json` | `eras.schema.json` |
| Decision mining input | `buildDecisionMiningContext()` stdout | `decision-mining-context.schema.json` |
| Decisions | `.gitchange/decisions.json` | `decisions.schema.json` |
| API snapshot | `GET /api/snapshot` | `snapshot.schema.json` |

## Dashboard handoff

When the user wants visuals, delegate to `/gitchange-dashboard` (manifest gate + `gitchange serve` + open `http://127.0.0.1:9876`).
