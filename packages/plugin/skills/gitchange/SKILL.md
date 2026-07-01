---
name: gitchange
description: Run the GitChange index pipeline on the workspace repo and present an evidence-backed summary.
schemas:
  - packages/plugin/schemas/manifest.schema.json
  - packages/plugin/schemas/snapshot.schema.json
  - packages/plugin/schemas/intelligence-summary.schema.json
  - packages/plugin/schemas/era-synthesis-context.schema.json
  - packages/plugin/schemas/eras.schema.json
  - packages/plugin/schemas/decision-mining-context.schema.json
  - packages/plugin/schemas/decisions.schema.json
  - packages/plugin/schemas/tour-synthesis-context.schema.json
  - packages/plugin/schemas/tours.schema.json
  - packages/plugin/schemas/status-query-response.schema.json
---

# /gitchange — First analysis

GitChange supplies **artifacts and schemas only**. The host AI reads results and presents them to the user — GitChange does not call any LLM APIs (PLUG-05).

## Prerequisites

- A git repository in the workspace (a `.git` directory reachable by walking up from the workspace root).
- The `gitchange` CLI on PATH, or resolvable via `resolveCliBin()` from `packages/plugin/scripts/resolve-root.ts` (P3-D-04). If missing, tell the user:
  1. Run the one-line installer: `curl -fsSL https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.sh | bash`
  2. Or clone the GitChange repo and run `pnpm install && pnpm build` from the monorepo root.
  3. Verify with `gitchange --version` or `gitchange status`.

## Steps

### 1. Resolve repository root

Walk up from the workspace root until a `.git` directory is found. Use that directory as `--repo` (absolute path). Do **not** assume the plugin install path or monorepo layout.

### 1b. Resolve GitChange install root (CLI + schemas)

When the host needs the GitChange plugin tree (schemas, build hints), resolve the **install root** separately from the git repo root using P3-D-04 precedence:

1. `GITCHANGE_ROOT` environment variable when set and contains `.cursor-plugin/plugin.json`
2. Walk up from cwd for `.cursor-plugin/plugin.json` (cloned / marketplace install)
3. Walk up for `node_modules/.bin/gitchange` at the same root
4. Walk up from the loaded skill/module path (monorepo dev)

Implementation: `packages/plugin/scripts/resolve-root.ts` exports `resolveGitChangeRoot()` and `resolveCliBin()`. Use `resolveCliBin()` before invoking the CLI when PATH may not include `gitchange`.

### 2. Decide full vs incremental index

Read `.gitchange/manifest.json` if it exists (or run `gitchange status --repo <root>`).

- If **no manifest**: run a full index.
- If `manifest.repo.head` equals current `git rev-parse HEAD` at the repo root: index is fresh — run **incremental** by default (still invokes `gitchange index`, which chooses incremental when a manifest exists).
- If HEAD moved since last index: run `gitchange index` (incremental when manifest exists).

```bash
gitchange index --repo "<absolute-repo-path>"
```

Never substitute raw `git log` walks or inline git scripting for the CLI index command.

### 3. Read summary artifacts

On success, gather bounded context for the user:

```bash
gitchange status --repo "<absolute-repo-path>"
```

Optionally read JSON directly (validate against plugin schemas before injecting large payloads into chat):

- `<repo>/.gitchange/manifest.json` — `packages/plugin/schemas/manifest.schema.json`
- `<repo>/.gitchange/intelligence.json` — trim to churn + expertise; see `packages/plugin/schemas/intelligence-summary.schema.json`
- Full API-shaped snapshot — `packages/plugin/schemas/snapshot.schema.json` (matches `GET /api/snapshot` after serve is running)

### 4. Present index summary to the user

Summarize in plain language:

- Commits indexed and index completeness
- Manifest warnings (shallow clone, force push, out-of-order commits) with codes
- Top expertise topics from `intelligence.json` (`expertise.topics`, first 3)
- Top churn files if useful (`churn.files`, highest `changeCount`)

### 5. Phase 2 — Semantic era synthesis

Run **after** index when `intelligence.json` exists. Skip automatic re-synthesis when:

- `.gitchange/eras.json` already validates against `eras.schema.json`, **and**
- `eras.json` `headSha` matches `intelligence.json` `headSha`

Otherwise (missing eras, stale `headSha`, or user asks to refresh), run semantic synthesis:

1. **Verify prerequisites** — `intelligence.json` must exist under `<repo>/.gitchange/`. If missing, stop and ask the user to re-run index.

2. **Build bounded context** — load synthesis input (no live git):

   ```bash
   pnpm exec tsx packages/plugin/scripts/build-era-context.ts "<absolute-path-to-.gitchange>"
   ```

   Validate stdout JSON against `packages/plugin/schemas/era-synthesis-context.schema.json`.

3. **Synthesize eras** — follow `packages/plugin/agents/era-synthesizer.md`. Host AI outputs a single `ErasArtifact` JSON object only.

4. **Validate output** — check against `packages/plugin/schemas/eras.schema.json` before persisting.

5. **Persist** — write via core gate:

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-eras.ts "<absolute-path-to-.gitchange>" /path/to/eras-output.json
   ```

6. **Present to user (ERA-02)** — list era names, era count, and total inflection count from the saved artifact. Offer to drill into claims/evidence on request.

When manifest HEAD is unchanged but intelligence was recomputed, offer re-synthesis if `eras.json` `headSha` differs from current `intelligence.json` `headSha`.

### 5b. Phase 3 — Decision synthesis

Run **after** Phase 2 when `eras.json` and `intelligence.json` exist. Skip automatic re-synthesis when:

- `.gitchange/decisions.json` already validates against `decisions.schema.json`, **and**
- `decisions.json` `headSha` matches `intelligence.json` `headSha`

Otherwise (missing decisions, stale `headSha`, or user asks to refresh), run decision synthesis:

1. **Verify prerequisites** — `intelligence.json` and `eras.json` must exist under `<repo>/.gitchange/`. If either is missing, stop and ask the user to complete index + era synthesis first.

2. **Build bounded context** — load mining input (no live git):

   ```bash
   pnpm exec tsx packages/plugin/scripts/build-decision-context.ts "<absolute-path-to-.gitchange>"
   ```

   Validate stdout JSON against `packages/plugin/schemas/decision-mining-context.schema.json`.

3. **Mine decisions** — follow `packages/plugin/agents/decision-miner.md`. Host AI outputs a single `DecisionsArtifact` JSON object with `candidateId` on each decision.

4. **Validate output** — check against `packages/plugin/schemas/decisions.schema.json` before persisting. Confirm every `candidateId` exists in the context bundle.

5. **Persist** — write via merge gate (validates evidence refs, attaches attribution, sets `reviewStatus: pending`):

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-decisions.ts "<absolute-path-to-.gitchange>" /path/to/decisions-output.json
   ```

6. **Present to user (DEC-02)** — list decision titles, status, and confidence. Note `reviewStatus: pending` on agent-mined rows until maintainer confirms via interview loop (DEC-03). When any decision has `reviewStatus: pending`, offer `/gitchange-interview` to confirm or reject with durable writeback (DEC-04). Explain `supersededBy` / `supersedes` links when present.

When `decisions.json` `headSha` differs from current `intelligence.json` `headSha`, offer re-synthesis.

### 5c. Phase 4 — Tour synthesis

Run **after** decision synthesis when `eras.json`, `decisions.json`, and `open-work.json` exist. Skip automatic re-synthesis when:

- `.gitchange/tours.json` already validates against `tours.schema.json`, **and**
- `tours.json` `headSha` matches `intelligence.json` `headSha`

Otherwise (missing tours, stale `headSha`, or user asks to refresh), run tour synthesis:

1. **Verify prerequisites** — `intelligence.json`, `eras.json`, `decisions.json`, and `open-work.json` must exist under `<repo>/.gitchange/`. If any is missing, stop and ask the user to complete prior phases first.

2. **Build bounded context** — load synthesis input (no live git):

   ```bash
   pnpm exec tsx packages/plugin/scripts/build-tour-context.ts "<absolute-path-to-.gitchange>"
   ```

   Validate stdout JSON against `packages/plugin/schemas/tour-synthesis-context.schema.json`.

3. **Synthesize tours** — follow `packages/plugin/agents/tour-builder.md`. Host AI outputs a single `ToursArtifact` JSON object with one default tour (4–6 chapters) and optional role/topic variants within caps.

4. **Validate output** — check against `packages/plugin/schemas/tours.schema.json` before persisting. Confirm every `eraId` and `decisionId` exists in the context bundle.

5. **Persist** — write via merge gate (preserves default outline order, validates evidence refs, enforces caps):

   ```bash
   pnpm exec tsx packages/plugin/scripts/write-tours.ts "<absolute-path-to-.gitchange>" /path/to/tours-output.json
   ```

6. **Checkpoint manifest** — after `tours.json` is written:

   ```bash
   pnpm exec tsx -e "import { runToursPipeline } from '@gitchange/core'; runToursPipeline(process.argv[1]);" "<absolute-path-to-.gitchange>"
   ```

7. **Present to user (TOUR-01)** — list tour titles, kinds (`default` / `role` / `topic`), and chapter counts. Highlight `defaultTourId` for the onboarding path.

When `tours.json` `headSha` differs from current `intelligence.json` `headSha`, offer re-synthesis.

### Phase 5 — Status queries (STAT-04)

When the user asks about **migration progress**, **what is in flight**, **open work**, or **current status** on ongoing refactors:

1. **Read artifacts** (no live git):
   - `<repo>/.gitchange/open-work.json` — active threads, events, related paths
   - `<repo>/.gitchange/decisions.json` — linked decisions and evidence

2. **Apply EVD-03 floor** — for each related decision, treat as below threshold when `confidence < 0.35` OR `evidence.length < 1`. Use the exact gap string: **`No recorded decision found`** (never paraphrase).

3. **Build a `StatusQueryResponse`** JSON object and validate against `packages/plugin/schemas/status-query-response.schema.json`:

   | Field | Rule |
   |-------|------|
   | `query` | User's question (verbatim or concise restatement) |
   | `answer` | Plain-language status summary **only** when at least one qualifying decision or non-completed thread supports it |
   | `gap` | Set to `No recorded decision found` when no qualifying decision/thread exists — omit `answer` |
   | `confidence` | Lowest confidence among cited decisions/threads, or `0` when gap |
   | `evidence` | Union of commit/file/doc evidence from qualifying artifacts only — never invent SHAs |
   | `relatedThreads` | `thread:` ids for incomplete threads (`open`, `in_progress`, `stale`) |
   | `relatedDecisions` | `decision:` ids that pass the evidence floor |

4. **Cite evidence** — every claim in `answer` must trace to an entry in `evidence[]` (commit SHA, file path + SHA, or doc excerpt).

5. **Never fabricate** when below threshold or when artifacts are missing. Say what is unknown and point to `gitchange index` / decision synthesis if artifacts are stale.

### 6. Follow-up questions

Answer questions using **schemas and artifacts only** (ownership, migrations, era claims) — still **no** embedded model calls from GitChange code.

## Security

- Only run the `gitchange` CLI binary; do not `curl | bash` from remote URLs or execute arbitrary shell beyond resolving the repo root and invoking `gitchange`.
- Do not dump raw SQLite or full file bodies into chat; use schema-bounded JSON slices.

## On failure

- **CLI not found**: installation steps above.
- **Not a git repo**: ask the user to open a folder containing `.git`.
- **Index errors**: show CLI stderr; suggest `gitchange status` after fixing the repo state.
- **Semantic errors**: show `build-era-context` or `write-eras` stderr; verify `intelligence.json` exists and output matches `eras.schema.json`.
- **Decision errors**: show `build-decision-context` or `write-decisions` stderr; verify `eras.json` exists and output matches `decisions.schema.json`.
- **Tour errors**: show `build-tour-context` or `write-tours` stderr; verify `decisions.json` and `open-work.json` exist and output matches `tours.schema.json`.
- **Pending decisions**: direct maintainer to `/gitchange-interview` for confirm/reject; answers persist under `.gitchange/interviews/` and merge into `decisions.json`.
