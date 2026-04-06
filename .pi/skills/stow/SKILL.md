---
name: stow
description: Manage GNU Stow dotfiles packages — install, uninstall, handle conflicts, add new stowable scripts, and resolve AGENTS.md symlink collisions. Use when installing/uninstalling stow packages, debugging symlink issues, or adding new tools to the dotfiles repo.
---

# Stow Skill

GNU Stow management for this dotfiles repository. Files in `tool-name/.config/tool/` symlink to `~/.config/tool/` via `stow`.

## When to Use This Skill

- Installing or uninstalling stow packages
- Adding a new tool to the dotfiles repo
- Debugging symlink or stow conflicts
- Adding stowable scripts or `.stow-local-ignore` files

## Essential Commands

```bash
stow nvim tmux bashrc       # Install packages (create symlinks)
stow -D nvim                # Uninstall package (remove symlinks)
stow -n nvim                # Dry-run — show what would happen
stow */                     # Install all packages
```

**Always edit files in the repo**, never in the symlink target (`~/.config/...`). Changes reflect immediately via symlinks.

## Adding a New Stow Package

1. Create the directory structure: `tool-name/.config/tool/`
2. Add a root `AGENTS.md` with `.stow-local-ignore` (see below)
3. Add an `AGENTS.md` in the package with path-specific gotchas
4. Run `stow tool-name` to install

## Stowable Scripts

Put executables at `<pkg>/.local/bin/<name>` — they symlink to `~/.local/bin/<name>`, which is already in PATH. Drop the `.sh` extension; the filename becomes the command name.

## Handling AGENTS.md Conflicts

Root-level `AGENTS.md` in a stow package symlinks to `~/AGENTS.md`. When multiple packages have one, stow fails with a conflict.

**Fix**: Add `.stow-local-ignore` to the package root with `AGENTS\.md` (Perl regex, one pattern per line). Currently `bashrc/` and `homebrew/` have ignores.

## Bluefin / ujust Conventions

- `ujust` only imports custom recipes from `/usr/share/ublue-os/just/60-custom.just` (immutable `/usr` partition)
- `~/.config/ublue-os/justfile` is NOT picked up — use shell aliases for user-level commands
- System Brewfiles live at `/usr/share/ublue-os/homebrew/*.Brewfile` — diff against these when creating personal Brewfiles
- `brew leaves` gives top-level (explicitly installed) formulas, excluding dependencies
