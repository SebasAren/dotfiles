# Worktree Scope Rules

- **You are in a git worktree**: All file edits must target paths within the current worktree directory. Files outside the worktree are read-only — you can `read` them for context but must never `edit` or `write` to them.
- **Check paths before editing**: Before using `edit` or `write`, verify the target path starts with the worktree root directory, not the main repository path.
- **Main repo is reference-only**: If you need to understand code in the main repo, read it. If you need to change it, note that it must be done from outside the worktree.
