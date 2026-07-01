# Tour builder

Host-AI agent spec for synthesizing evidence-backed guided tours into a validated `ToursArtifact`. **GitChange does not call any LLM APIs** — the host chat produces JSON and persists via `mergeTourBuilderOutput` (PLUG-05).

## Role

Turn bounded `TourSynthesisContext` into onboarding narratives: one default tour (4–6 chapters), up to 3 role tours, and up to 5 topic tours (TOUR-01, TOUR-02, TOUR-03).

## Input contract

**Only** accept `TourSynthesisContext` JSON from `buildTourSynthesisContext(gitchangeDir)` or:

```bash
pnpm exec tsx packages/plugin/scripts/build-tour-context.ts "<absolute-path-to-.gitchange>"
```

Never read raw git history, `git log`, or commits outside the provided context. Every `eraId`, `commitSha`, `filePath`, and `decisionId` you cite must appear in:

- `eraSummaries[].id`
- `outlineChapters[].eraIds` and stop evidence from outline
- `decisionSeeds[].id`
- `openWorkSeeds[].id` (topic tours seeded from thread titles)
- `expertiseTopics[].topic` and `expertiseTopics[].topPaths`
- `rolePathHints.backend` / `rolePathHints.frontend`

## Output contract

Emit a **single** `ToursArtifact` JSON object.

### Caps (enforced at merge + Zod)

| Kind | Limit |
|------|-------|
| `default` | exactly 1 tour, 4–6 chapters |
| `role` | up to 3 tours |
| `topic` | up to 5 tours, max 8 stops total per tour |

See `capsReminder` in context for current limits.

### Default tour

| Field | Rule |
|-------|------|
| `kind` | `"default"` |
| `id` | `tour:` ULID prefix (e.g. `tour:01HXYZ…`) |
| `title` | Onboarding-oriented label |
| `description` | 1–2 sentences for new contributors |
| `chapters` | **4–6** chapters aligned with `outlineChapters` order and `eraIds` — refine titles, summaries, and stop narratives; do not invent new era boundaries |

The merge gate **preserves outline chapter order and eraIds** for the default tour. Your narratives overlay the deterministic skeleton.

### Role tours (`kind: "role"`)

| Field | Rule |
|-------|------|
| `roleTag` | **Required** — one of `backend`, `frontend`, `fullstack`, `maintainer` |
| `chapters` | Emphasize paths from `rolePathHints` for the matching role |
| stops | Evidence from indexed paths only |

### Topic tours (`kind: "topic"`)

| Field | Rule |
|-------|------|
| `topicKey` | **Required** — slug from `expertiseTopics[].topic` or open-work thread theme |
| `chapters` | May span multiple `eraIds`; max 8 stops total |
| stops | Link decisions via `drillTarget.decisionId` when citing `decisionSeeds` |

### Every stop

| Field | Rule |
|-------|------|
| `id` | `stop:` prefix (merge assigns ULID if missing) |
| `narrative` | ≤400 chars; evidence-backed |
| `evidence` | Minimum one item; only refs from input context |
| `drillTarget` | At least one of `eraId`, `commitSha`, `filePath`, `decisionId` |

### Top-level artifact

| Field | Rule |
|-------|------|
| `schemaVersion` | `"1"` (`TOURS_SCHEMA_VERSION`) |
| `computedAt` | ISO-8601 timestamp |
| `headSha` | 40-char SHA from context `headSha` |
| `defaultTourId` | Must match the default kind tour `id` |
| `tours` | All tours within caps |

Persist via merge gate:

```bash
pnpm exec tsx packages/plugin/scripts/write-tours.ts "<absolute-path-to-.gitchange>" /path/to/tours-output.json
```

## Binding rules

1. Default tour chapters must match `outlineChapters` **order** and `eraIds` — refine text only.
2. Do not emit era, decision, or thread IDs absent from the context bundle.
3. Role tours **must** include `roleTag`; topic tours **must** include `topicKey`.
4. Do not fabricate commit SHAs, file paths, or era/decision IDs.
5. Do not surface below-threshold decisions as affirmative claims (EVD-03).

## Evidence types

| type | fields |
|------|--------|
| `commit` | `sha` (40 chars) |
| `file` | `path`, `commitSha` |
| `doc` | `path`, `commitSha`, `excerpt` (≤500 chars) |

Prefer `file` evidence when citing `rolePathHints` or `expertiseTopics[].topPaths`.

## Validation before write

1. Parse output against `tours.schema.json` (host JSON Schema validator).
2. Confirm every `eraId` exists in `eraSummaries[]`.
3. Confirm every `decisionId` in drill targets exists in `decisionSeeds[]`.
4. Call `write-tours.ts` — core merge gate rejects unindexed evidence refs, unknown IDs, and cap violations.

## Anti-patterns

- Do not call OpenAI, Anthropic, or any LLM SDK from GitChange packages.
- Do not fabricate SHAs, paths, or era/decision IDs.
- Do not skip `evidence[]` on any stop.
- Do not reorder default tour chapters relative to `outlineChapters`.
- Do not output markdown or prose — **JSON only** for the artifact payload.
