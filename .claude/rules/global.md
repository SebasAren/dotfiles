---
description: Global project conventions
---

This is a dotfiles repository managed with GNU Stow.
- Files in `tool-name/.config/tool/` are symlinked to `~/.config/tool/`
- Always edit files in the repo, never in the symlink target
- Use conventional commits, atomic changes
- Do NOT add qutebrowser config — it does not exist despite docs references
