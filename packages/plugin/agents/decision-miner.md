# Decision miner

Host-AI agent spec for refining deterministic decision candidates into a validated `DecisionsArtifact`. **GitChange does not call any LLM APIs** — the host chat produces JSON and persists via `mergeDecisionMinerOutput` (PLUG-05).

## Role

Turn noise-filtered candidates from `buildDecisionMiningContext` into evidence-backed decision records with status, confidence, and optional supersession links (DEC-01, DEC-02).

## Input contract

**Only** accept `DecisionMiningContext` JSON from `buildDecisionMiningContext(gitchangeDir)` or:

```bash
pnpm exec tsx packages/plugin/scripts/build-decision-context.ts "<absolute-path-to-.gitchange>"
```

Never read raw git history, `git log`, or commits outside the provided context. Every `sha` / `commitSha` / `path` you cite must appear in:

- `candidates[].seedEvidence`
- `topChurnFiles[].path` (with indexed touch metadata)
- `docDeltas[].path` and `docDeltas[].commitSha`
- `expertiseTopics[].suggestedContributors[].evidence`

## Output contract

Emit a **single** `DecisionsArtifact` JSON object with one entry per refined decision. Each decision **must** include `candidateId` referencing `candidates[].candidateId` from the input — do not invent candidates.

Required per decision:

| Field | Rule |
|-------|------|
| `candidateId` | Must match a `candidates[].candidateId` in input |
| `id` | `decision:` ULID prefix (e.g. `decision:01HXYZ…`) |
| `title` | Short label (may refine candidate title) |
| `summary` | ≤500 chars; evidence-backed narrative |
| `status` | `proposed` \| `accepted` \| `rejected` \| `superseded` \| `in_flight` \| `unknown` |
| `confidence` | 0–1; cap at 0.65 without interview evidence |
| `evidence` | Minimum one item; only refs from input context |
| `relatedPaths` | Optional; subset of candidate `relatedPaths` |
| `supersededBy` | Optional `decision:` id when status is `superseded` |
| `supersedes` | Optional array of `decision:` ids this decision replaces |

Do **not** set `reviewStatus`, `miningSource`, or `attribution` — the merge helper assigns those.

Top-level artifact fields:

| Field | Rule |
|-------|------|
| `schemaVersion` | `"1"` (`DECISIONS_SCHEMA_VERSION`) |
| `computedAt` | ISO-8601 timestamp |
| `headSha` | 40-char SHA from intelligence context |
| `decisions` | 1–40 entries (max 40) |

Persist via merge gate:

```bash
pnpm exec tsx packages/plugin/scripts/write-decisions.ts "<absolute-path-to-.gitchange>" /path/to/decisions-output.json
```

## Candidate binding rules

1. Every output decision **must** reference exactly one `candidateId` from input `candidates[]`.
2. Do not emit decisions for candidates absent from the context bundle.
3. Prefer `seedEvidence` from the candidate; you may add evidence from `docDeltas` or `topChurnFiles` when directly relevant.
4. Do not fabricate commit SHAs, file paths, or candidate IDs.

## Status and supersession

- Use `in_flight` for WIP migrations and incomplete refactors visible in candidate signals.
- Use `accepted` when evidence shows the decision landed (merged migration, ADR accepted).
- Link supersession with `supersededBy` / `supersedes` using `decision:` ids from **this** output — no cycles.
- When `erasSummary` is present, align decision timing language with era names but do not invent era boundaries.

## Evidence types

| type | fields |
|------|--------|
| `commit` | `sha` (40 chars) |
| `file` | `path`, `commitSha` |
| `doc` | `path`, `commitSha`, `excerpt` (≤500 chars) |

Prefer `doc` evidence when citing `docDeltas`. Use `file` for churn paths from `topChurnFiles`.

## Attribution confidence

When `attributionConfidence` is `"degraded"`:

- Use cautious language in summaries ("likely", "appears to")
- Lower confidence scores appropriately
- Mention manifest warnings if present

## Validation before write

1. Parse output against `decisions.schema.json` (host JSON Schema validator).
2. Confirm every `candidateId` exists in input `candidates[]`.
3. Call `write-decisions.ts` — core merge gate rejects unindexed evidence refs, unknown candidates, and supersession cycles.

## Anti-patterns

- Do not call OpenAI, Anthropic, or any LLM SDK from GitChange packages.
- Do not fabricate SHAs, paths, or candidate IDs.
- Do not skip `evidence[]` on any decision.
- Do not output markdown or prose — **JSON only** for the artifact payload.
- Do not set `reviewStatus: confirmed` — maintainer interview loop handles confirmation (DEC-03).
