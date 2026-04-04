#!/usr/bin/env bash
set -euo pipefail

# Helper script that runs inside the new tmux window.
# Executes `wt switch --create` so the user sees the output,
# then drops into a shell at the worktree path.

# Ensure linuxbrew is in PATH
if [[ -f /home/linuxbrew/.linuxbrew/bin/brew ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

WT_CMD="$(command -v wt 2>/dev/null || echo /home/linuxbrew/.linuxbrew/bin/wt)"
JQ_CMD="$(command -v jq 2>/dev/null || echo /usr/bin/jq)"

branch="$1"
base="$2"

echo "▸ Creating worktree '$branch' from '$base'..."
echo

if $WT_CMD switch --create "$branch" --base "$base" --no-cd; then
    echo
    echo "▸ Switching to worktree directory..."
    worktree_path=$($WT_CMD list --format=json | $JQ_CMD -r ".[] | select(.branch==\"$branch\") | .path")
    if [[ -n "$worktree_path" && -d "$worktree_path" ]]; then
        cd "$worktree_path"
        echo "▸ Now in $worktree_path"
    fi
else
    echo
    echo "⚠ Failed to create worktree. Staying in current directory." >&2
fi

echo
exec "$SHELL"
