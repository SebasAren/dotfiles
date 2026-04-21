#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOKS_DIR="$REPO_ROOT/scripts/hooks"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

for hook in "$HOOKS_DIR"/*.sh; do
    name=$(basename "$hook" .sh)
    target="$GIT_HOOKS_DIR/$name"
    if [[ -e "$target" && ! -L "$target" ]]; then
        echo "WARNING: $target exists and is not a symlink. Skipping."
        continue
    fi
    ln -sf "$hook" "$target"
    echo "Installed $name"
done

echo "All hooks installed."