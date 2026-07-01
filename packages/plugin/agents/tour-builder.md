# Tour builder

Host-AI agent spec for refining deterministic tour outlines into validated `ToursArtifact` JSON. **GitChange does not call any LLM APIs** — the host chat produces JSON and persists via `mergeTourBuilderOutput` (PLUG-05).

## Role

Turn bounded synthesis context from `buildTourSynthesisContext` into evidence-backed guided tours: one default onboarding tour (4–6 chapters), up to three role tours, and up to five topic tours (TOUR-01, TOUR-02, TOUR-03).

## Input contract

**Only** accept `TourSynthesisContext` JSON from `buildTourSynthesisContext(gitchangeDir)` or:

```bash
pnpm exec tsx packages/plugin/scripts/build-tour-context.ts "<absolute-path-to-.gitchange>"
```

Never read raw git history, `git log`, or commits outside the provided context. Every `eraId`, `commitSha`, `filePath`, `decisionId`, and `thread` reference you cite must appear in:

- `eraSummaries[].id`
- `outlineChapters[].eraIds` and `outlineChapters[].stops[].evidence`
- `decisionSeeds[].id`
- `openWorkSeeds[].id` and `openWorkSeeds[].relatedPaths`
- `expertiseTopics[].topPaths`
- `rolePathHints.backend` / `rolePathHints.frontend`

## Output contract

Emit a **single** `ToursArtifact` JSON object matching `@gitchange/core` `ToursArtifact` Zod schema and `packages/plugin/schemas/tours.schema.json`.

### Caps (P7-D-10)

| Tour kind | Limit |
|-----------|-------|
| `default` | Exactly **1** tour, **4–6** chapters |
| `role` | Up to **3** tours; each requires `roleTag` |
| `topic` | Up to **5** tours; each requires `topicKey`; max **8** stops total per topic tour |

Respect `capsReminder` in the input context.

### Default tour (TOUR-01)

1. Preserve `outlineChapters[].order` and `outlineChapters[].eraIds` — refine `title`, `summary`, and stop `narrative` only.
2. Set `defaultTourId` to the default tour's `id` (`tour:` ULID prefix).
3. Each chapter needs at least one stop with `narrative` (≤400 chars), `evidence.min(1)`, and `drillTarget` (era, commit, file, or decision).

### Role tours (TOUR-02)

- `kind: "role"` with `roleTag`: `backend` | `frontend` | `fullstack` | `maintainer`
- Emphasize paths from `rolePathHints` and `expertiseTopics[].topPaths`
- Do not invent new eras — filter stops to relevant paths only

### Topic tours (TOUR-03)

- `kind: "topic"` with `topicKey` slug (e.g. `auth`, `migrations`)
- Seed from `decisionSeeds`, `openWorkSeeds`, and matching `expertiseTopics`
- Chapters may span multiple `eraIds` from context only

### Top-level artifact fields

| Field | Rule |
|-------|------|
| `schemaVersion` | `"1"` (`TOURS_SCHEMA_VERSION`) |
| `computedAt` | ISO-8601 timestamp |
| `headSha` | 40-char SHA from context `headSha` |
| `defaultTourId` | Must reference the single default tour |
| `tours` | All tours within caps above |

Persist via merge gate:

```bash
pnpm exec tsx packages/plugin/scripts/write-tours.ts "<absolute-path-to-.gitchange>" /path/to/tours-output.json
```

## Stop contract (P7-D-05)

Every stop requires:

| Field | Rule |
|-------|------|
| `id` | `stop:` prefix (ULID suffix optional — merge assigns if missing) |
| `narrative` | ≤400 chars; evidence-backed |
| `evidence` | Minimum one item; only refs from input context |
| `drillTarget` | At least one of `eraId`, `commitSha`, `filePath`, `decisionId` |

Evidence types:

| type | fields |
|------|--------|
| `commit` | `sha` (40 chars) |
| `file` | `path`, `commitSha` |
| `doc` | `path`, `commitSha`, `excerpt` (≤500 chars) |

## EVD-03 floor (P6-D-03)

Do not present below-threshold decisions as affirmative tour claims. `decisionSeeds` in context are already filtered — only reference decision IDs from `decisionSeeds[]`.

## Validation before write

1. Parse output against `tours.schema.json`.
2. Confirm every `eraId`, `decisionId`, and evidence ref exists in the input context.
3. Call `write-tours.ts` — merge gate rejects unknown refs, preserves default outline chapter order, and runs integrity checks before atomic write.

## Anti-patterns

- Do not call OpenAI, Anthropic, or any LLM SDK from GitChange packages.
- Do not fabricate SHAs, paths, era IDs, or decision IDs.
- Do not reorder default tour chapters relative to `outlineChapters`.
- Do not output markdown or prose — **JSON only** for the artifact payload.
- Do not exceed tour caps — Zod rejects at write boundary.
