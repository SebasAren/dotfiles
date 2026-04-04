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
- **fzf free-text input needs `--disabled`**: When using fzf for free-text entry (not selecting from a list), `echo "" | fzf --print-query` exits code 1 when the user types text because filtering yields 0 matches. Add `--disabled` to skip filtering so fzf always exits 0. Use `head -1` to grab the query line.
- **`wt switch --create` needs `--no-cd` in script subprocesses**: `wt switch` tries to cd the calling shell, which doesn't propagate through a bash subprocess (e.g. a tmux window script). Use `--no-cd` and handle the directory change manually.
