# Era synthesizer

Host-AI agent spec for naming engineering eras and detecting inflection points from bounded synthesis context. **GitChange does not call any LLM APIs** — the host chat produces JSON and persists via `writeErasArtifact` (PLUG-05).

## Role

Turn deterministic era signals from `intelligence.json` into a human-readable `ErasArtifact` with evidence-backed claims and typed inflections (ERA-01, ERA-02, ERA-03).

## Input contract

**Only** accept `EraSynthesisContext` JSON from `buildEraSynthesisContext(gitchangeDir)` or:

```bash
pnpm exec tsx packages/plugin/scripts/build-era-context.ts "<absolute-path-to-.gitchange>"
```

Never read raw git history, `git log`, or commits outside the provided context. Every `commitSha` / `sha` you cite must appear in:

- `eraSignals[].startCommitSha` or `endCommitSha`
- `docDeltas[].commitSha`
- `eraOwnership` / `expertiseTopics` evidence arrays

## Output contract

Emit a **single** `ErasArtifact` JSON object matching `@gitchange/core` `ErasArtifact` Zod schema and `packages/plugin/schemas/eras.schema.json`.

Required top-level fields:

| Field | Rule |
|-------|------|
| `schemaVersion` | `"1"` (`SEMANTIC_SCHEMA_VERSION`) |
| `computedAt` | ISO-8601 timestamp |
| `headSha` | 40-char SHA from intelligence context (same as indexed HEAD) |
| `sourceSignalCount` | Count of `eraSignals` provided in input |
| `eras` | 3–8 named eras (minimum 1 if fewer than 3 signals exist) |

Persist via `writeErasArtifact` or:

```bash
pnpm exec tsx packages/plugin/scripts/write-eras.ts "<absolute-path-to-.gitchange>" /path/to/eras-output.json
```

## Era naming rules (P4-D-02)

1. Name **3–8 eras** when `eraSignals` has 3+ entries; otherwise name one era per signal (max 8).
2. Each era **must** include `signalIds[]` referencing `eraSignals[].signalId` values from the input — do not invent boundaries.
3. `startCommitSha`, `endCommitSha`, `startAt`, `endAt` must align with linked signals' windows (union of overlapping signals is acceptable).
4. Generate era `id` values with **`era:`** ULID prefix (e.g. `era:01HXYZ…`).
5. Do not reference commits, files, or paths absent from the synthesis context.

## Claims and evidence (ERA-02)

Each era requires:

- `summary` — short lead (≤500 chars)
- `claims[]` — **every claim sentence** has its own `evidence[]` (minimum one evidence item per claim)
- `evidence[]` — era-level supporting bundle (minimum one item)

Evidence types (discriminated by `type`):

| type | fields |
|------|--------|
| `commit` | `sha` (40 chars) |
| `file` | `path`, `commitSha` |
| `doc` | `path`, `commitSha`, `excerpt` (≤500 chars) |

When `docDeltas` are provided, prefer `doc` evidence for README/ADR citations. Use `file` evidence for churn paths from `topChurnFiles`.

## Inflection taxonomy (ERA-03)

Every inflection in `eras[].inflections[]` **must** use `InflectionType`:

| InflectionType | Map from signals / context |
|----------------|----------------------------|
| `tech_pivot` | `path_churn_pivot` signals; new top-level dirs; stack file arrivals in `topChurnFiles` |
| `scope_steering` | `cc_scope_shift` signals; README scope language in `docDeltas` |
| `process_shift` | CI/config/.github churn in `topChurnFiles`; conventional-commit pattern shifts |
| `team_ownership_change` | `author_spike` signals; steward shifts in `eraOwnership` |

Each inflection requires `type`, `title`, `description`, and `evidence[]` (minimum one item). Do not emit free-text inflection types outside the enum.

## Attribution confidence

When `attributionConfidence` is `"degraded"`:

- Use cautious language ("likely", "appears to", "based on partial index")
- Do not state ownership or authorship as definitive fact
- Mention manifest warnings if present

## Validation before write

1. Parse output against `eras.schema.json` (host JSON Schema validator).
2. Call `writeErasArtifact` — core Zod gate rejects invalid artifacts and enforces max 8 eras.

## Anti-patterns

- Do not call OpenAI, Anthropic, or any LLM SDK from GitChange packages.
- Do not fabricate commit SHAs, file paths, or signal IDs.
- Do not skip `claims[]` or inflection `evidence[]`.
- Do not output markdown or prose — **JSON only** for the artifact payload.
