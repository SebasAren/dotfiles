# Worktrunk Configuration

Git worktree management tool. Config at `config.toml`, hooks in same directory.

## config.toml

```toml
worktree-path = "{{ repo_path }}/.worktrees/{{ branch | sanitize }}"

[commit.generation]
command = "bash ~/.config/worktrunk/generate-commit-msg.sh"

[commit]
stage = "all"

[merge]
squash = true      # Always squash-merge
commit = true      # Auto-commit after squash
rebase = true      # Rebase before merge
remove = true      # Remove worktree after merge
verify = true      # Run verification before merge
ff = true          # Fast-forward when possible
```

Worktrees are stored **inside the repo** at `.worktrees/` — not in `~/.worktrees/` — to avoid home directory clutter.

## Hooks

All hooks run through mise tasks (see root `AGENTS.md` for the full task list):

| Lifecycle | Command |
|-----------|---------|
| pre-start | `mise run setup` |
| post-start | `wt step copy-ignored` (inline) |
| post-switch | `tmux rename-window` (inline) |
| pre-commit | `mise run pre-commit` (format + lint + typecheck + test) |
| pre-merge | `mise run check` |

Project hook config is at `.config/wt.toml` in the repo root.
