Run the GitChange first-analysis pipeline on the workspace repository, then **open the dashboard automatically**.

1. Resolve `GC_ROOT` — the GitChange install root (`~/.gitchange-plugin`, or walk up for the GitChange monorepo when developing).
2. Read and follow every step in:
   `<GC_ROOT>/packages/plugin/skills/gitchange/SKILL.md`
3. Use the plugin CLI runner documented in that skill — not raw `git log`.
4. **Do not stop after indexing.** The skill requires opening the dashboard when index succeeds (unless the user said "index only" or "no dashboard").
5. If the skill file is missing, tell the user to run:
   `bash /path/to/GitChange/scripts/install.sh --local`
   or from any machine:
   `curl -fsSL https://raw.githubusercontent.com/serhii-kucherenko/GitChange/main/scripts/install.sh | bash`

GitChange supplies artifacts and schemas only; the host chat presents results.
