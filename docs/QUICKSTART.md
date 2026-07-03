# GitChange Quickstart

## Prerequisites

- Node.js 22.x, git 2.x, pnpm 11.x
- A local git repository you want to understand

## Cursor

1. **Install** (once per machine):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/serhii-kucherenko/GitChange/main/scripts/install.sh | bash
   ```

   Developing GitChange itself? From the repo root:

   ```bash
   bash scripts/install.sh --local
   ```

2. **Open your repo** in Cursor.

3. **`/gitchange`** — indexes history, summarizes results, and **opens the dashboard** at `http://127.0.0.1:9876` automatically.

   GitChange checks for updates at `~/.gitchange-plugin` on each run and pulls when behind `origin`.

   Use **`/gitchange-dashboard`** only to re-open the dashboard without re-indexing.

4. **`/gitchange-update`** — pull the latest GitChange version (optional; `/gitchange` also auto-updates when behind).

## Claude Code

1. **Register the marketplace** (once per machine), inside a Claude Code session:

   ```text
   /plugin marketplace add serhii-kucherenko/GitChange
   ```

2. **Install the plugin:**

   ```text
   /plugin install gitchange@gitchange
   ```

3. **Verify:** `/plugin list` — look for `gitchange@gitchange`.

4. **Open your repo**, then run **`/gitchange`** (index + dashboard automatically). Use **`/gitchange-dashboard`** to re-open only.

Full steps, shell commands, and troubleshooting: [README — Claude Code install](../README.md#claude-code-marketplace-plugin).

## Next steps

- [README](../README.md) — optional terminal CLI and monorepo development
