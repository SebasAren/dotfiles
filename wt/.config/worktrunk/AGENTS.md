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

## Commit Message Generation (`generate-commit-msg.sh`)

Called by `wt` to generate conventional commit messages via the pi agent.

Flow:
1. Reads wt's built-in prompt from stdin (includes task, diff, context)
2. Prepends conventional commit format instructions
3. Runs `pi -p --no-tools --no-extensions --no-skills --no-session --no-prompt-templates --thinking off`
4. Uses `CHEAP_MODEL` env var if set (for speed)
5. 30-second timeout
6. Falls back to `chore: update N files` if pi fails

## approvals.toml

Pre-approved commands for worktree operations on this project. Lists formatting, linting, and testing commands that `wt` can run without prompting.

## Shell Integration

The `wt` binary can't change the parent shell's directory. The bash wrapper in `~/.bashrc.d/wt` uses a **directive file** pattern:
- `wt` writes `cd` commands to a temp file
- Shell wrapper sources it after `wt` exits

Don't call the `wt` binary directly from scripts that need directory changes — use the shell wrapper.
