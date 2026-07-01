# GitChange

Local-first git history analysis — evidence-backed answers about who changed what, how the project evolved, what decisions were made, and what's still in flight.

## Prerequisites

- **Node.js** 22+ (see `.nvmrc`)
- **pnpm** 10+
- **git** 2.x on PATH

## Install

### One-line installer

```bash
curl -fsSL https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.sh | bash
```

This clones or updates GitChange to `~/.gitchange-plugin`, runs `pnpm install && pnpm build`, and installs a `gitchange` CLI wrapper in `~/.local/bin`.

Override the install location:

```bash
GITCHANGE_INSTALL_DIR=~/tools/gitchange curl -fsSL https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Egonex-AI/GitChange/main/scripts/install.ps1 | iex
```

> **Repository URL:** The installer pulls from [github.com/Egonex-AI/GitChange](https://github.com/Egonex-AI/GitChange). Verify the URL before piping any remote script to your shell.

### IDE plugin (Cursor / Claude Code)

After installing:

- **Cursor:** symlink `.cursor-plugin` from the install directory into your Cursor plugins folder, or install via marketplace when listed.
- **Claude Code:** use `.claude-plugin/marketplace.json` for marketplace discovery, or symlink `.claude-plugin`.

Slash commands: `/gitchange` (first analysis) and `/gitchange-dashboard` (localhost UI).

## Verify

```bash
gitchange --version
gitchange status    # run from inside any git repository
```

## Development

From a cloned repository:

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
