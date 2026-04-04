#!/usr/bin/env bash
set -euo pipefail

# Source common helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/wt-common.sh"

# Ensure we're in a git repo
if ! git rev-parse --git-dir &>/dev/null; then
    echo "Error: Not a git repository" >&2
    exit 1
fi

# Get default branch
default_branch=$(_wt_get_default_branch)

# Pick base branch via fzf
echo "Select base branch:"
_wt_fzf_opts 40% "base ▸ "
base_branch=$(git branch -a --format='%(refname:short)' | grep -v 'HEAD' | sort -u | fzf "${FZF_OPTS[@]}" --no-preview)
if [[ -z "$base_branch" ]]; then
    echo "No base branch selected" >&2
    exit 1
fi

# Ask for new branch name via fzf prompt
echo "Enter new branch name:"
_wt_fzf_opts 30% "new branch ▸ "
new_branch=$(echo "" | fzf "${FZF_OPTS[@]}" --print-query --no-preview | tail -1)
if [[ -z "$new_branch" ]]; then
    echo "No branch name provided" >&2
    exit 1
fi

# Pick tool
tool=$(_wt_tool_picker)
if [[ -z "$tool" ]]; then
    echo "No tool selected" >&2
    exit 1
fi

# Create worktree and switch
echo "Creating worktree for branch '$new_branch' based on '$base_branch'..."
if ! wt switch --create "$new_branch" --base "$base_branch"; then
    echo "Failed to create worktree" >&2
    exit 1
fi

# Get worktree path for the new branch
worktree_path=$(_wt_get_worktree_path "$new_branch")
if [[ -z "$worktree_path" ]]; then
    # Fallback: assume worktree created in parent directory with branch name
    worktree_path="$(git rev-parse --show-toplevel)/../$new_branch"
    if [[ ! -d "$worktree_path" ]]; then
        echo "Could not determine worktree path" >&2
        exit 1
    fi
fi

# Open worktree in tmux window
_wt_open_worktree "$new_branch" "$worktree_path" "$tool"

echo "Worktree '$new_branch' created and opened."