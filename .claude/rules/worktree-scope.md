---
description: Worktree scope enforcement — always applicable
---

- **Worktree scope enforcement** (only applies when in a git worktree — detect via `git rev-parse --git-path HEAD` containing `worktrees/`): All file edits must target paths within the current worktree directory. Files outside the worktree are read-only — you can `read` them for context but must never `edit` or `write` to them.
- **Check paths before editing**: Before using `edit` or `write`, verify the target path starts with the worktree root (`git rev-parse --show-toplevel`), not the main repository path.
- **Main repo from a worktree**: If you need to understand code in the main repo, read it. If you need to change it, note that it must be done from outside the worktree (i.e., from the main repo checkout, not from within a worktree).
