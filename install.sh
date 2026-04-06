#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Interactive TUI installer ────────────────────────────────────
# Uses @mariozechner/pi-tui for a slick terminal interface.
# Falls back to plain stow if bun/node aren't available.

install_interactive() {
  local install_dir="$DOTFILES_DIR/install"

  # Check prerequisites
  if ! command -v bun &>/dev/null; then
    echo "bun not found. Falling back to manual stow."
    echo "Install bun for the interactive installer: https://bun.sh"
    echo
    install_manual
    return
  fi

  # Install deps if needed
  if [[ ! -d "$install_dir/node_modules" ]]; then
    echo "Installing installer dependencies..."
    if ! (cd "$install_dir" && bun install --frozen-lockfile 2>/dev/null); then
      (cd "$install_dir" && bun install)
    fi
  fi

  echo "Starting interactive installer..."
  echo
  cd "$install_dir" && bun run src/index.ts
}

# ─── Manual fallback ──────────────────────────────────────────────
install_manual() {
  echo "Available packages:"
  echo

  local packages=()
  for dir in "$DOTFILES_DIR"/*/; do
    local pkg
    pkg="$(basename "$dir")"
    [[ "$pkg" == "install" || "$pkg" == ".git" || "$pkg" == ".worktrees" ]] && continue
    [[ "$pkg" == ".claude" || "$pkg" == ".github" ]] && continue
    packages+=("$pkg")
  done

  echo "  ${packages[*]}"
  echo
  echo "Usage:"
  echo "  stow <package>          Install a package"
  echo "  stow -D <package>       Uninstall a package"
  echo "  stow -n <package>       Dry run"
  echo "  stow */                 Install all"
  echo
  echo "Examples:"
  echo "  stow nvim tmux bashrc"
  echo "  stow */"
}

# ─── Main ─────────────────────────────────────────────────────────
case "${1:-}" in
  --manual|-m)
    install_manual
    ;;
  --help|-h)
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Interactive dotfiles installer."
    echo
    echo "Options:"
    echo "  --manual, -m    Show manual stow commands instead of TUI"
    echo "  --help, -h      Show this help"
    ;;
  *)
    install_interactive
    ;;
esac
