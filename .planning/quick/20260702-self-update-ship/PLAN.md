# Quick Task: Ship self-update / auto-update

## Goal

End users at `~/.gitchange-plugin` automatically pull latest GitChange on each CLI run; explicit `/gitchange-update` and `gitchange update` for manual refresh.

## Tasks

1. Core self-update module with tests
2. Plugin runner auto-update + ensure-ready bootstrap
3. CLI `update` subcommand
4. Cursor `/gitchange-update` command + install script linking
5. CI validation for new command and tests
6. CHANGELOG entry

## Success

- All self-update unit tests pass
- Build succeeds for CLI/core
- Pushed to origin/main
