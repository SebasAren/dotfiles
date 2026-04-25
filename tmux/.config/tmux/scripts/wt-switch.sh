#!/usr/bin/env bash
set -euo pipefail

# Source common helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/wt-common.sh"

# Get worktree list
worktree_json=$(_wt_worktree_list)
if [[ "$worktree_json" == "[]" ]]; then
    echo "No worktrees found" >&2
    exit 0
fi

# Get current branch
current_branch=$(git branch --show-current 2>/dev/null || echo "")

# Build fzf input: branch names with current marked
# shellcheck disable=SC2016
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
    exit 0
fi

# Strip trailing asterisk and whitespace
selected_branch="${selected% *}"

# Get worktree path
worktree_path=$(_wt_get_worktree_path "$selected_branch")
if [[ -z "$worktree_path" ]]; then
    echo "Could not find worktree path for branch '$selected_branch'" >&2
    exit 1
fi

# Sanitize window name
window_name=$(_wt_sanitize_window_name "$selected_branch")

# Open new tmux window at the worktree path
if _wt_tmux_window_exists "$window_name"; then
    $TMUX_CMD select-window -t "$window_name"
else
    $TMUX_CMD new-window -n "$window_name" -c "$worktree_path"
fi
