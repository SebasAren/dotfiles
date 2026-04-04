---
globs:
  - "tmux/**"
description: Tmux-specific conventions and gotchas
---

- **Tmux popup scripts need linuxbrew in PATH**: `wt` and other linuxbrew tools won't be in PATH inside `display-popup`. Source `/home/linuxbrew/.linuxbrew/bin/brew shellenv` or use full paths like `/home/linuxbrew/.linuxbrew/bin/wt`.
- **Config filename is `tmux.conf`** (not `.tmux.conf`), located at `tmux/.config/tmux/tmux.conf`.
