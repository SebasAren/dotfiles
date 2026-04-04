---
globs:
  - "tmux/**"
description: Tmux-specific conventions and gotchas
---

- **Tmux popup scripts need linuxbrew in PATH**: `wt` and other linuxbrew tools won't be in PATH inside `display-popup`. Source `/home/linuxbrew/.linuxbrew/bin/brew shellenv` or use full paths like `/home/linuxbrew/.linuxbrew/bin/wt`.
- **Config filename is `tmux.conf`** (not `.tmux.conf`), located at `tmux/.config/tmux/tmux.conf`.
- **`display-popup` needs `-c '#{pane_current_path}'`**: Without it, the popup's cwd defaults to where tmux was launched, not the current pane's path. Any script needing repo context (e.g. `wt list`) will fail silently.
- **`wt-common.sh` `_wt_worktree_list()` swallows errors**: `2>/dev/null || echo "[]"` turns `wt list` failures into "no worktrees" — always check the cwd first when debugging empty fzf lists.
