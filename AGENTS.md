# AGENTS.md

Personal dotfiles repo managed with GNU Stow. 8 tool directories, 128 config files.

## OVERVIEW

Stow creates symlinks from `~/.dotfiles/tool-name/.config/tool/` to `~/.config/tool/`. Edit files in the repo, changes reflect immediately via symlinks.

## STRUCTURE

```
nvim/.config/nvim/         # Neovim: Lazy.nvim, blink.cmp, 17 LSP servers
docker/docker-services/    # 5 services: jellyfin, audiobookshelf, nginx-proxy-manager, transmission+VPN, wolf
bashrc/.bashrc.d/          # Modular bash: alias, config, fnox, mise, tmux
tmux/.config/tmux/         # Tmux: Ctrl+a prefix, vi copy, TPM, tokyo-night
opencode/.config/opencode/ # Opencode AI assistant
m908/.config/m908/         # Mouse config
wt/.config/worktrunk/      # Worktrunk: git worktree management, pi-powered commits
pi/.pi/                    # Pi agent extensions, skills, plans
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add/remove plugin | `nvim/.config/nvim/lua/plugins/` |
| LSP server config | `nvim/.config/nvim/lsp/*.lua` |
| Neovim settings | `nvim/.config/nvim/lua/config/settings.lua` |
| Docker service | `docker/docker-services/<service>/` |
| Shell aliases | `bashrc/.bashrc.d/alias` |
| Tmux plugins | `tmux/.config/tmux/.tmux.conf` |
| Worktrunk config | `wt/.config/worktrunk/config.toml` |

## STOW MANAGEMENT

```bash
stow nvim docker bashrc tmux              # install
stow -D nvim                               # uninstall
stow -n nvim                               # dry-run
stow */                                     # install all
```

## CONVENTIONS

- **Lua**: 2-space indent, StyLua formatting, `---@type` for LuaLS, `snake_case`
- **Python**: 4-space indent, `snake_case` funcs/vars, `PascalCase` classes
- **Git**: conventional commits, atomic changes
- **Docker**: `.env` files gitignored; media at `/stash/` and `/stash2/`; UID 1000:1000
- **Neovim custom settings**: `custom-settings.lua` (gitignored, loaded via `pcall`)

## ANTI-PATTERNS

- **YAML inconsistency**: Some docker services use `.yml`, others `.yaml`. Accept this.
- **Minimal install.sh**: Only runs `stow nvim`. Do not expect it to install everything.

## NOTES

- Neovim `:Lazy sync` updates plugins; `:ConformInfo` shows formatters
- Pre-commit hooks: StyLua (Lua), YAML/JSON validation, whitespace trimming
- Custom Neovim overrides: `custom-settings.lua` (gitignored)

## TMUX

Prefix: `Ctrl+a`, vi copy-mode, TPM plugins, tokyo-night theme.

| Key | Action |
|-----|--------|
| `Alt+h/j/k/l` | Navigate panes (no prefix) |
| `Alt+1..9` | Switch window |
| `prefix+\|` / `-` | Split horizontal/vertical |
| `prefix+HJKL` | Resize panes |

## SHELL

- **Bash**: modular `.bashrc.d/` (alias, config, fnox, mise)
- **EDITOR**: `nvim`; **mise** for runtime version management

## NEOVIM TOOLING

- **Completion**: blink.cmp (Codestral, Minuet-AI)
- **Formatting**: conform.nvim (StyLua, prettierd, black+isort)
- **Linting**: nvim-lint (ruff, luacheck, hadolint)
- **Testing**: neotest (`<leader>t` prefix)
- **AI**: CodeCompanion.nvim with Venice AI adapter
- **Pi extensions**: `pi/.pi/agent/extensions/`
- **Context7 API**: `pi/.pi/agent/extensions/context7/` (requires CONTEXT7_API_KEY)