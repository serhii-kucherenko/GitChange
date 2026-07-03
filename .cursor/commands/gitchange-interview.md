Conduct a maintainer interview to confirm or reject a pending GitChange decision.

1. Read and follow every step in:
   `~/.gitchange-plugin/packages/plugin/skills/gitchange-interview/SKILL.md`
   (In the GitChange monorepo, resolve the skill path via `resolveGitChangeRoot()`.)
2. Requires `.gitchange/decisions.json` with at least one `reviewStatus: pending` decision (or a user-specified `decision:` id).
3. If the skill file is missing, tell the user to run the Cursor install script (same as `/gitchange`).
