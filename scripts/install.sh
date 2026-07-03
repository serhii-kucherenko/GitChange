#!/usr/bin/env bash
# GitChange Cursor installer — links /gitchange commands into ~/.cursor/commands/
# Claude Code: use the marketplace plugin (see README), not this script.
set -euo pipefail

readonly OFFICIAL_REPO="https://github.com/serhii-kucherenko/GitChange.git"

script_repo_root() {
  local src="${BASH_SOURCE[0]:-}"
  if [[ -n "$src" && -f "$src" ]]; then
    (cd "$(dirname "$src")/.." && pwd)
  fi
}

readonly SCRIPT_REPO="$(script_repo_root || true)"

GITCHANGE_REPO_URL="${GITCHANGE_REPO_URL:-$OFFICIAL_REPO}"
GITCHANGE_INSTALL_DIR="${GITCHANGE_INSTALL_DIR:-$HOME/.gitchange-plugin}"
LOCAL_INSTALL=false
WITH_CLI=false

usage() {
  cat <<EOF
Usage: install.sh [OPTIONS]

  Cursor one-time setup. Links slash commands and prepares ~/.gitchange-plugin.

Options:
  --local       Use this GitChange checkout as the install root (for development)
  --with-cli    Also link ~/.local/bin/gitchange (optional terminal command)
  -h, --help    Show this help

Examples:
  curl -fsSL .../install.sh | bash
  bash scripts/install.sh --local
EOF
}

error() {
  echo "install.sh: error: $*" >&2
  exit 1
}

warn_unofficial_repo() {
  if [[ "$GITCHANGE_REPO_URL" != "$OFFICIAL_REPO" ]]; then
    echo "install.sh: warning: non-official clone URL — verify the source: $GITCHANGE_REPO_URL" >&2
  fi
}

parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --local) LOCAL_INSTALL=true ;;
      --with-cli) WITH_CLI=true ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        error "unknown option: $arg (try --help)"
        ;;
    esac
  done
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || error "$1 not found on PATH"
}

check_prereqs() {
  require_cmd git
  require_cmd pnpm
  require_cmd node

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$node_major" -lt 22 ]]; then
    error "Node.js 22+ required (found $(node -v))"
  fi
}

resolve_install_dir() {
  if $LOCAL_INSTALL; then
    if [[ -z "$SCRIPT_REPO" || ! -f "$SCRIPT_REPO/.cursor-plugin/plugin.json" ]]; then
      error "--local must be run from the GitChange repository (bash scripts/install.sh --local)"
    fi
    GITCHANGE_INSTALL_DIR="$SCRIPT_REPO"
    echo "Using local GitChange checkout: $GITCHANGE_INSTALL_DIR"
    return
  fi

  if [[ -n "$SCRIPT_REPO" && -f "$SCRIPT_REPO/.cursor-plugin/plugin.json" && "$SCRIPT_REPO" != "$GITCHANGE_INSTALL_DIR" ]]; then
    echo "Linking $GITCHANGE_INSTALL_DIR → $SCRIPT_REPO (this checkout has the latest commands and skills)"
    ln -sfn "$SCRIPT_REPO" "$GITCHANGE_INSTALL_DIR"
    GITCHANGE_INSTALL_DIR="$(cd "$GITCHANGE_INSTALL_DIR" && pwd -P)"
    return
  fi
}

clone_or_update() {
  if $LOCAL_INSTALL; then
    return
  fi

  if [[ -L "$HOME/.gitchange-plugin" ]]; then
    GITCHANGE_INSTALL_DIR="$(cd "$HOME/.gitchange-plugin" && pwd -P)"
    echo "Using linked install at $GITCHANGE_INSTALL_DIR"
    return
  fi

  warn_unofficial_repo

  if [[ -d "$GITCHANGE_INSTALL_DIR/.git" ]]; then
    echo "Updating GitChange in $GITCHANGE_INSTALL_DIR ..."
    git -C "$GITCHANGE_INSTALL_DIR" pull --ff-only || error "git pull failed in $GITCHANGE_INSTALL_DIR"
  elif [[ -e "$GITCHANGE_INSTALL_DIR" ]]; then
    error "$GITCHANGE_INSTALL_DIR exists but is not a git repository (remove it or use --local)"
  else
    echo "Cloning GitChange to $GITCHANGE_INSTALL_DIR ..."
    git clone --depth 1 "$GITCHANGE_REPO_URL" "$GITCHANGE_INSTALL_DIR"
  fi
}

prepare_runtime() {
  echo "Installing dependencies (first /gitchange run builds the CLI if needed) ..."
  (cd "$GITCHANGE_INSTALL_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
}

link_cli() {
  local bin_dir="${HOME}/.local/bin"
  local cli_bin="${GITCHANGE_INSTALL_DIR}/packages/cli/dist/bin.js"
  mkdir -p "$bin_dir"
  ln -sf "$cli_bin" "${bin_dir}/gitchange"
  echo "Linked optional terminal CLI → ${bin_dir}/gitchange"
}

install_cursor_commands() {
  local commands_src=""
  if [[ -n "$SCRIPT_REPO" ]] && compgen -G "${SCRIPT_REPO}/.cursor/commands/"*.md >/dev/null 2>&1; then
    commands_src="${SCRIPT_REPO}/.cursor/commands"
  elif compgen -G "${GITCHANGE_INSTALL_DIR}/.cursor/commands/"*.md >/dev/null 2>&1; then
    commands_src="${GITCHANGE_INSTALL_DIR}/.cursor/commands"
  else
    error "no .cursor/commands/*.md found — update GitChange or run from a full checkout"
  fi

  local commands_dst="${HOME}/.cursor/commands"
  mkdir -p "$commands_dst"
  local linked=0
  for f in "$commands_src"/*.md; do
    [[ -f "$f" ]] || continue
    ln -sf "$f" "${commands_dst}/$(basename "$f")"
    linked=$((linked + 1))
  done

  echo "Linked ${linked} Cursor command(s) → ${commands_dst}/"
}

print_post_install() {
  cat <<EOF

GitChange is ready for Cursor.

  Open any git repository → type /gitchange in chat
  (indexes your repo, summarizes results, and opens the dashboard automatically)

Install root: ${GITCHANGE_INSTALL_DIR}
Commands:     ~/.cursor/commands/

Re-run this script anytime to refresh command links (idempotent).

Updates: each /gitchange run auto-pulls latest GitChange at ~/.gitchange-plugin when you are behind origin. Run /gitchange-update or `gitchange update` anytime for an explicit pull.
EOF

  if $WITH_CLI; then
    cat <<EOF

Optional terminal CLI: ~/.local/bin/gitchange (add ~/.local/bin to PATH)
EOF
  fi
}

main() {
  parse_args "$@"
  check_prereqs
  resolve_install_dir
  clone_or_update
  prepare_runtime
  install_cursor_commands
  if $WITH_CLI; then
    link_cli
  fi
  print_post_install
}

main "$@"
