---
globs:
  - "tmux/**"
description: Tmux-specific conventions and gotchas
---

- **Tmux popup scripts need linuxbrew in PATH**: `wt` and other linuxbrew tools won't be in PATH inside `display-popup`. Source `/home/linuxbrew/.linuxbrew/bin/brew shellenv` or use full paths like `/home/linuxbrew/.linuxbrew/bin/wt`.
- **Config filename is `tmux.conf`** (not `.tmux.conf`), located at `tmux/.config/tmux/tmux.conf`.
- **`display-popup -d` sets start-directory** (not `-c`). `-c` is `target-client` — using it with a path causes "Can't find client" errors. Always use `-d '#{pane_current_path}'` to set popup cwd.
- **fzf args must use bash arrays, not `echo` + `$(...)`**: When passing options with Unicode/special chars (like `--prompt 'switch ▸ '`), `echo` inside `$(...)` gets word-split by the shell. Use a bash array (`FZF_OPTS=(...)`) and expand with `"${FZF_OPTS[@]}"` instead.
- **`wt-common.sh` `_wt_worktree_list()` swallows errors**: `2>/dev/null || echo "[]"` turns `wt list` failures into "no worktrees" — always check the cwd first when debugging empty fzf lists.
