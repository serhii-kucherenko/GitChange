Open (or re-open) the GitChange localhost dashboard for the workspace repository.

Use this when the index already exists and you only need the dashboard — for example after a previous `/gitchange`, or to refresh the browser tab.

1. Resolve `GC_ROOT` (`~/.gitchange-plugin` or GitChange monorepo root).
2. Read and follow:
   `<GC_ROOT>/packages/plugin/skills/gitchange-dashboard/SKILL.md`
3. If `.gitchange/manifest.json` is missing, run `/gitchange` instead (full index + dashboard).

Default URL: `http://127.0.0.1:9876`
