# GitChange

GitChange analyzes git history from a local clone and helps new teammates and maintainers understand how a project evolved — with evidence you can drill into from a local dashboard.

## Prerequisites

- **Node.js** 22.x LTS
- **pnpm** 11.x (or compatible 10.x)
- **git** 2.x on your PATH

## Install

One-line install (macOS/Linux):

```bash
curl -fsSL https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.ps1 | iex
```

The installer clones or updates GitChange under `~/.gitchange-plugin` by default, runs `pnpm install && pnpm build`, links the `gitchange` CLI into `~/.local/bin`, and prints symlink steps for Cursor and Claude Code plugin manifests.

Override install location:

```bash
GITCHANGE_INSTALL_DIR=~/tools/gitchange curl -fsSL .../install.sh | bash
```

> **Repository URL:** The official source is [github.com/Egonex-AI/GitChange](https://github.com/Egonex-AI/GitChange). The install scripts pin to that URL; overriding `GITCHANGE_REPO_URL` prints a warning.

## Verify

Add `~/.local/bin` and `GITCHANGE_ROOT` to your shell profile, then inside any git repository:

```bash
gitchange --version
gitchange status
```

## IDE plugin

After install, symlink the plugin into your project or IDE plugins folder (the installer prints exact commands):

- **Cursor:** `.cursor-plugin/plugin.json` points at skills under `packages/plugin/skills/`
- **Claude Code:** `.claude-plugin/marketplace.json` for marketplace discovery

Slash commands:

- `/gitchange` — index the workspace repo and summarize manifest + intelligence artifacts
- `/gitchange-dashboard` — open the localhost dashboard at `http://127.0.0.1:9876`

## Monorepo development

From a cloned GitChange repo:

```bash
pnpm install
pnpm build
pnpm test
```

Plugin root resolution order (P3-D-04) is implemented in `packages/plugin/scripts/resolve-root.ts`.

## License

MIT
