#!/usr/bin/env bash
set -euo pipefail

# Source common helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/wt-common.sh"

# Ensure we're in a git repo
if ! git rev-parse --git-dir &>/dev/null; then
    echo "Error: Not a git repository" >&2
    exit 1
fi

start_dir="$(pwd)"

# Pick base branch via fzf
_wt_fzf_opts 40% "base ▸ "
base_branch=$(git branch -a --format='%(refname:short)' | grep -v 'HEAD' | sort -u | fzf "${FZF_OPTS[@]}" --no-preview)
if [[ -z "$base_branch" ]]; then
    exit 1
fi

# Ask for new branch name via fzf prompt
# --disabled: skip filtering so fzf always exits 0 even with typed query
# --print-query: first output line is the user's typed text
# head -1: grab the query (the typed branch name)
_wt_fzf_opts 30% "new branch ▸ "
new_branch=$(echo "" | fzf "${FZF_OPTS[@]}" --disabled --print-query --no-preview | head -1)
if [[ -z "$new_branch" ]]; then
    exit 1
fi

# Sanitize window name
window_name=$(_wt_sanitize_window_name "$new_branch")

# Open new tmux window where wt switch --create executes
if _wt_tmux_window_exists "$window_name"; then
    $TMUX_CMD select-window -t "$window_name"
else
    $TMUX_CMD new-window -n "$window_name" -c "$start_dir" \
        "bash $SCRIPT_DIR/wt-open-create.sh '$new_branch' '$base_branch'"
fi
