#!/usr/bin/env bash
set -euo pipefail

# Source common helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/wt-common.sh"

# Get worktree list
worktree_json=$(_wt_worktree_list)
if [[ "$worktree_json" == "[]" ]]; then
    echo "No worktrees found" >&2
    exit 0
fi

# Get current worktree branch (if any)
current_branch=$(git branch --show-current 2>/dev/null || echo "")

# Build fzf input: branch names with current marked
branches=$(echo "$worktree_json" | $JQ_CMD -r --arg cur "$current_branch" '
    .[] | 
    if .branch == $cur then 
        "\(.branch) *" 
    else 
        .branch 
    end
')

# Present fzf picker
_wt_fzf_opts 50% "switch ▸ "
selected=$(echo "$branches" | fzf "${FZF_OPTS[@]}" --no-preview)
if [[ -z "$selected" ]]; then
    echo "No worktree selected" >&2
    exit 0
fi

# Strip trailing asterisk and whitespace
selected_branch=$(echo "$selected" | sed 's/ *$//')

# Get worktree path
worktree_path=$(_wt_get_worktree_path "$selected_branch")
if [[ -z "$worktree_path" ]]; then
    echo "Could not find worktree path for branch '$selected_branch'" >&2
    exit 1
fi

# Ask for tool
tool=$(_wt_tool_picker)
if [[ -z "$tool" ]]; then
    echo "No tool selected" >&2
    exit 1
fi

# Open worktree in tmux window
_wt_open_worktree "$selected_branch" "$worktree_path" "$tool"

echo "Switched to worktree '$selected_branch'."