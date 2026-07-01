# GitChange Quickstart

Get from install to a working dashboard in five steps. No config files required.

**Requirements covered:** [INST-04](../.planning/REQUIREMENTS.md) (install → first analysis → dashboard in under five steps). See the [requirements traceability table](../.planning/REQUIREMENTS.md#traceability) for how this maps to Phase 3.

## Prerequisites

- Node.js 22.x, git 2.x, and pnpm 11.x (the installer runs `pnpm install` and `pnpm build` for you)
- A local git repository you want to understand

## Steps

1. **Install GitChange.** Run the one-line installer (macOS/Linux):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/serhii-kucherenko/GitChange/main/scripts/install.sh | bash
   ```

   Or install the plugin from the Cursor or Claude Code marketplace using the manifests in this repo. Add `~/.local/bin` to your PATH if the installer prints that step.

2. **Open your repository** in your IDE, or `cd` into it in a terminal. GitChange works on any folder that contains a `.git` directory.

3. **Run your first analysis.** In the chat panel, run `/gitchange`. From the terminal you can run `gitchange index` instead. GitChange walks commit history, builds a local index under `.gitchange/`, and computes ownership and churn highlights — no manual setup.

4. **Open the dashboard.** Run `/gitchange-dashboard` in chat, or run `gitchange serve` and open `http://127.0.0.1:9876` in your browser (override the port with `GITCHANGE_PORT` if needed). You will see index freshness, commit counts, and top churn and expertise highlights.

5. **Explore what you have.** Read the expertise topics and churn file list on the dashboard. They are backed by evidence in your local index. Full era → commit → file drill-down arrives in a later release; this first-run view is enough to orient a new teammate.

## Verify from the terminal

```bash
gitchange status
```

You should see repository head, last indexed commit, and commit/file/author counts.

## Next steps

- [README](../README.md) — install options, IDE plugin symlinks, and monorepo development
- [REQUIREMENTS](../.planning/REQUIREMENTS.md) — full product requirements and traceability
