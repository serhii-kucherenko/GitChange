---
name: gitchange
description: Run the GitChange index pipeline on the workspace repo and present an evidence-backed summary.
schemas:
  - packages/plugin/schemas/manifest.schema.json
  - packages/plugin/schemas/snapshot.schema.json
  - packages/plugin/schemas/intelligence-summary.schema.json
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

### 4. Present to the user

Summarize in plain language:

- Commits indexed and index completeness
- Manifest warnings (shallow clone, force push, out-of-order commits) with codes
- Top expertise topics from `intelligence.json` (`expertise.topics`, first 3)
- Top churn files if useful (`churn.files`, highest `changeCount`)

Offer follow-up questions grounded in the artifacts (ownership, migrations, open threads) — still **no** embedded model calls from GitChange code.

## Security

- Only run the `gitchange` CLI binary; do not `curl | bash` from remote URLs or execute arbitrary shell beyond resolving the repo root and invoking `gitchange`.
- Do not dump raw SQLite or full file bodies into chat; use schema-bounded JSON slices.

## On failure

- **CLI not found**: installation steps above.
- **Not a git repo**: ask the user to open a folder containing `.git`.
- **Index errors**: show CLI stderr; suggest `gitchange status` after fixing the repo state.
