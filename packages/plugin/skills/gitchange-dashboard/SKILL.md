---
name: gitchange-dashboard
description: Open the GitChange localhost dashboard after an index exists.
schemas:
  - packages/plugin/schemas/snapshot.schema.json
---

# /gitchange-dashboard — Local web UI

Opens the minimal GitChange dashboard at `http://127.0.0.1:9876` (default port; override with `GITCHANGE_PORT`).

**Note:** `/gitchange` runs this flow automatically after a successful index. Use this skill directly only to **re-open** the dashboard or when the index already exists.

## Gate — index required

Before starting the server, confirm `.gitchange/manifest.json` exists under the resolved repo root (walk up from workspace for `.git`, same as `/gitchange`).

If **missing**, stop and tell the user to run `/gitchange` first. Do not serve an empty dashboard.

## Steps

### 1. Resolve repository root

Same as `/gitchange`: walk up for `.git`, use absolute `--repo` path.

For the GitChange install root (`GC_ROOT`), use `resolveGitChangeRoot()` from `packages/plugin/scripts/resolve-root.ts`. Run CLI commands via the plugin runner (see `/gitchange` skill) — no global `gitchange` on PATH required.

### 2. Ensure server is running

Default health check:

```bash
curl -sf http://127.0.0.1:9876/api/health
```

If the health check fails, start the server in the **background**:

```bash
pnpm --dir "<GC_ROOT>" exec tsx packages/plugin/scripts/run-cli.ts serve --repo "<absolute-repo-path>"
```

The serve command binds `127.0.0.1` only. Wait until `/api/health` returns 200.

### 3. Open the dashboard

Open `http://127.0.0.1:9876` in the user's browser using the IDE open-URL capability when available.

The dashboard reads `GET /api/snapshot` (schema: `packages/plugin/schemas/snapshot.schema.json`).

## Security

- Localhost only — do not proxy the dashboard to the public internet.
- Only invoke the plugin CLI runner `serve` subcommand; no remote install scripts.

## On failure

- **Not indexed**: instruct `/gitchange`.
- **Plugin not found:** Cursor — re-run `scripts/install.sh`. Claude Code — install the marketplace plugin.
- **Port in use**: try `GITCHANGE_PORT` or ask the user to stop the conflicting process on 9876.
