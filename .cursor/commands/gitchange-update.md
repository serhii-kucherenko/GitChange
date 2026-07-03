Run **`gitchange update`** (or the plugin runner equivalent) to pull the latest GitChange from origin, install dependencies, and rebuild the CLI.

1. Resolve `GC_ROOT` via `resolveGitChangeRoot()` from `packages/plugin/scripts/resolve-root.ts`.
2. Run:

```bash
pnpm --dir "<GC_ROOT>" exec tsx packages/plugin/scripts/run-cli.ts update
```

Optional: pass `--rebuild` to rebuild the CLI even when already on latest upstream.

3. Report the result to the user (updated, already latest, or error reason).

For dev checkouts, set `GITCHANGE_ROOT` to the GitChange monorepo or pass `--root` via terminal `gitchange update --root /path/to/GitChange`.

Set `GITCHANGE_SKIP_UPDATE=1` only to disable **automatic** updates before other commands; `/gitchange-update` always runs an explicit update.
