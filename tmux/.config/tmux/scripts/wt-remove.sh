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

# Get default branch to exclude from removal
default_branch=$(_wt_get_default_branch)

# Build fzf input: branch names with dirty state indicator
branches=$(echo "$worktree_json" | $JQ_CMD -r --arg default "$default_branch" '
    .[] | 
    select(.branch != $default) |
    if (.dirty // false) then 
        "\(.branch) *" 
    else 
        .branch 
    end
')

if [[ -z "$branches" ]]; then
    echo "No removable worktrees (only default branch exists)" >&2
    exit 0
fi

# Present fzf picker
selected=$(echo "$branches" | fzf $(_wt_fzf_opts 50% "remove ▸ ") --no-preview)
if [[ -z "$selected" ]]; then
    echo "No worktree selected" >&2
    exit 0
fi

# Strip trailing asterisk and whitespace (dirty indicator)
selected_branch=$(echo "$selected" | sed 's/ *$//')

# Check for dirty state
is_dirty=$(echo "$worktree_json" | $JQ_CMD -r --arg branch "$selected_branch" '
    .[] | select(.branch == $branch) | (.dirty // false)
')

if [[ "$is_dirty" == "true" ]]; then
    echo "⚠️  Worktree '$selected_branch' has uncommitted changes."
    echo "Type 'yes' to confirm removal:"
    read -r confirmation
    if [[ "$confirmation" != "yes" ]]; then
        echo "Removal cancelled."
        exit 0
    fi
fi

# Remove worktree
echo "Removing worktree '$selected_branch'..."
if ! $WT_CMD remove "$selected_branch"; then
    echo "Failed to remove worktree" >&2
    exit 1
fi

# Kill tmux window if it exists
window_name=$(echo "$selected_branch" | tr './' '--')
if _wt_tmux_window_exists "$window_name"; then
    $TMUX_CMD kill-window -t "$window_name"
fi

echo "Worktree '$selected_branch' removed successfully."
