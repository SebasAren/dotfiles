#!/usr/bin/env bash
set -euo pipefail

# Ensure linuxbrew is in PATH (for tmux popups)
if [[ -f /home/linuxbrew/.linuxbrew/bin/brew ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# Command paths
WT_CMD="$(command -v wt 2>/dev/null || echo /home/linuxbrew/.linuxbrew/bin/wt)"
JQ_CMD="$(command -v jq 2>/dev/null || echo /usr/bin/jq)"
TMUX_CMD="$(command -v tmux 2>/dev/null || echo /usr/bin/tmux)"

# Tokyo Night palette for fzf
export FZF_DEFAULT_OPTS=" \
  --color=bg+:#292e42,bg:#1a1b26,spinner:#9ece6a,hl:#7aa2f7 \
  --color=fg:#c0caf5,header:#7aa2f7,info:#7dcfff,pointer:#7dcfff \
  --color=marker:#7dcfff,fg+:#c0caf5,prompt:#7dcfff,hl+:#7dcfff \
  --color=border:#292e42,preview-bg:#1a1b26,preview-border:#292e42 \
  --border=rounded --margin=0,1 --padding=1"

# Standard popup dimensions
_wt_popup_size() {
    echo "70% 70%"
}

# FZF options for worktree pickers
_wt_fzf_opts() {
    local height="${1:-70%}"
    local prompt="${2:-▸ }"
    echo "--height ${height} --border --margin=0,1 --padding=1 --prompt '${prompt}' --header-lines 0 --ansi --extended --cycle --reverse"
}

# Tool picker: choose between pi and shell
_wt_tool_picker() {
    local tools=()
    if command -v pi &>/dev/null; then
        tools+=("pi")
    fi
    tools+=("$SHELL")
    
    local selected
    selected=$(printf '%s\n' "${tools[@]}" | fzf $(_wt_fzf_opts 30% "tool ▸ ") --no-preview)
    echo "$selected"
}

# List worktrees as JSON
_wt_worktree_list() {
    $WT_CMD list --format=json 2>/dev/null || echo "[]"
}

# Get default branch (main or master)
_wt_get_default_branch() {
    local json
    json=$(_wt_worktree_list)
    local default_branch
    default_branch=$(echo "$json" | $JQ_CMD -r '.[] | select(.isDefault == true) | .branch' 2>/dev/null | head -1)
    if [[ -z "$default_branch" ]]; then
        # Fallback to main or master
        if git show-ref --verify --quiet refs/heads/main; then
            echo "main"
        elif git show-ref --verify --quiet refs/heads/master; then
            echo "master"
        else
            echo "main"
        fi
    else
        echo "$default_branch"
    fi
}

# Get worktree path for a given branch
_wt_get_worktree_path() {
    local branch="$1"
    local json
    json=$(_wt_worktree_list)
    echo "$json" | $JQ_CMD -r --arg branch "$branch" '.[] | select(.branch == $branch) | .path' 2>/dev/null
}

# Check if a tmux window exists with given name
_wt_tmux_window_exists() {
    local window_name="$1"
    $TMUX_CMD list-windows -F '#{window_name}' 2>/dev/null | grep -q "^${window_name}$"
}

# Open worktree in a new tmux window
_wt_open_worktree() {
    local branch="$1"
    local path="$2"
    local tool="$3"
    local window_name
    # Sanitize branch name for tmux window (replace dots and slashes)
    window_name=$(echo "$branch" | tr './' '--')
    
    if _wt_tmux_window_exists "$window_name"; then
        # Switch to existing window
        $TMUX_CMD select-window -t "$window_name"
    else
        # Create new window
        if [[ "$tool" == "pi" ]]; then
            $TMUX_CMD new-window -n "$window_name" -c "$path" "pi"
        else
            $TMUX_CMD new-window -n "$window_name" -c "$path"
        fi
    fi
}

# Export functions
export -f _wt_fzf_opts _wt_tool_picker _wt_worktree_list _wt_get_default_branch _wt_get_worktree_path _wt_tmux_window_exists _wt_open_worktree _wt_popup_size