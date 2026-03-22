# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Personal dotfiles managed with **GNU Stow**. Each tool has its own directory following the pattern `tool-name/.config/tool-name/...` so that `stow tool-name` creates the correct symlinks.

## Common Commands

```bash
# Install/uninstall configs via stow
stow nvim zsh docker qtile kitty tmux
stow -D nvim                        # unlink

# Sync Neovim plugins headlessly
nvim --headless "+Lazy! sync" +qa

# Docker services
cd docker/docker-services/<service> && docker-compose up -d

# Pre-commit hooks (StyLua, YAML/JSON validation, whitespace)
pre-commit install
pre-commit run --all-files
```

## Architecture

### Neovim (`nvim/.config/nvim/`)

Entry point: `init.lua` → requires modules from `lua/config/`.

- **`lua/config/`** — Core config: `settings.lua`, `mappings.lua`, `lsp.lua`, `diagnostic.lua`, `lazy.lua` (Lazy.nvim bootstrap)
- **`lua/plugins/`** — Plugin specs (one file per plugin/group), each returns a Lazy.nvim table
- **`lsp/`** — Individual LSP server configs (basedpyright, vtsls, lua_ls, jsonls, etc.). Add a new file here to enable a new LSP server.
- **`lua/prompts/`** — AI-assisted workflows (commit generation, branch review)
- **`lua/utils/`** — Shared utilities
- **`custom-settings.lua`** — User overrides (gitignored), loaded via `pcall`

Key Neovim details:
- Plugin manager: Lazy.nvim
- Completion: blink.cmp with AI completions (Codestral, Minuet-AI)
- Formatting: conform.nvim (StyLua for Lua, prettierd for JS/TS/Vue, black+isort for Python)
- Linting: nvim-lint (ruff for Python, luacheck for Lua, hadolint for Dockerfiles)
- Testing: neotest (`<leader>t` prefix)
- AI: CodeCompanion.nvim with Venice AI adapter

### Qtile (`qtile/.config/qtile/`)

- `config.py` — Main config with hostname-based branching (`henk` = home)
- `utils/bars.py`, `utils/process.py` — Custom bars and process helpers
- `widgets/` — Custom widgets (e.g., wireplumber volume)
- `autostart/` — Per-host startup scripts (`home.sh`, `work.sh`, `base.sh`)

### Docker Services (`docker/docker-services/`)

Services: audiobookshelf, jellyfin, nginx-proxy-manager, transmission (with VPN), wolf (with Tailscale). Each has its own `docker-compose.y[a]ml`. Media mounts at `/var/stash/` and `/var/stash2/`, services run as UID 1000:1000, secrets go in `.env` files (gitignored).

### Tmux (`tmux/.config/tmux/`)

- Prefix: `Ctrl+a`, vi copy-mode, TPM for plugins (tokyo-night theme)
- `Alt+h/j/k/l` — pane navigation (no prefix), `Alt+1..9` — window switching
- `prefix+|`/`-` for splits, `prefix+HJKL` for resize

### Shell (`zsh/`, `bashrc/`)

- Zsh: `.zshrc` + `.zprofile`
- Bash: modular `.bashrc.d/` directory (alias, config, fnox, mise)
- EDITOR is set to `nvim`; mise is used for runtime version management

## Code Style

- **Lua**: 2-space indent, StyLua formatting, `---@type` annotations for LuaLS, `snake_case` variables
- **Python**: 4-space indent, `snake_case` functions/vars, `PascalCase` classes
- **Git**: Conventional commits, atomic changes
