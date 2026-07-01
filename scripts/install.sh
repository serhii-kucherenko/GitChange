#!/usr/bin/env bash
# GitChange one-line installer (IDE plugin pattern)
# Official repository: https://github.com/serhii-kucherenko/GitChange
set -euo pipefail

readonly OFFICIAL_REPO="https://github.com/serhii-kucherenko/GitChange.git"
GITCHANGE_REPO_URL="${GITCHANGE_REPO_URL:-$OFFICIAL_REPO}"
GITCHANGE_INSTALL_DIR="${GITCHANGE_INSTALL_DIR:-$HOME/.gitchange-plugin}"

error() {
  echo "install.sh: error: $*" >&2
  exit 1
}

warn_unofficial_repo() {
  if [[ "$GITCHANGE_REPO_URL" != "$OFFICIAL_REPO" ]]; then
    echo "install.sh: warning: non-official clone URL — verify the source before continuing: $GITCHANGE_REPO_URL" >&2
  fi
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

clone_or_update() {
  warn_unofficial_repo

  if [[ -d "$GITCHANGE_INSTALL_DIR/.git" ]]; then
    echo "Updating GitChange in $GITCHANGE_INSTALL_DIR ..."
    if git -C "$GITCHANGE_INSTALL_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git -C "$GITCHANGE_INSTALL_DIR" pull --ff-only || error "git pull failed in $GITCHANGE_INSTALL_DIR"
    else
      error "$GITCHANGE_INSTALL_DIR exists but is not a git repository"
    fi
  else
    echo "Cloning GitChange to $GITCHANGE_INSTALL_DIR ..."
    git clone --depth 1 "$GITCHANGE_REPO_URL" "$GITCHANGE_INSTALL_DIR"
  fi
}

build_install() {
  echo "Installing dependencies ..."
  (cd "$GITCHANGE_INSTALL_DIR" && pnpm install)
  echo "Building ..."
  (cd "$GITCHANGE_INSTALL_DIR" && pnpm build)
}

link_cli() {
  local bin_dir="${HOME}/.local/bin"
  local cli_bin="${GITCHANGE_INSTALL_DIR}/packages/cli/dist/bin.js"
  mkdir -p "$bin_dir"
  ln -sf "$cli_bin" "${bin_dir}/gitchange"
  echo "Linked gitchange → ${bin_dir}/gitchange"
}

print_post_install() {
  cat <<EOF

GitChange is ready at: ${GITCHANGE_INSTALL_DIR}

Add to your shell profile (~/.zshrc or ~/.bashrc):

  export GITCHANGE_ROOT="${GITCHANGE_INSTALL_DIR}"
  export PATH="\${HOME}/.local/bin:\${PATH}"

Cursor — symlink the plugin into a project (or global plugins dir):

  ln -sf "${GITCHANGE_INSTALL_DIR}/.cursor-plugin" .cursor-plugin

Claude Code — symlink marketplace plugin:

  ln -sf "${GITCHANGE_INSTALL_DIR}/.claude-plugin" ~/.claude/plugins/gitchange

Verify (inside any git repository):

  gitchange --version
  gitchange status

Re-run this script anytime to update and rebuild (idempotent).

EOF
}

main() {
  check_prereqs
  clone_or_update
  build_install
  link_cli
  print_post_install
}

main "$@"
