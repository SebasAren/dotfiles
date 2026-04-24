# AGENTS.md

Dotfiles repo managed with GNU Stow. For human setup, see [README.md](README.md).

## How Stow Works

Files in `tool-name/.config/tool/` symlink to `~/.config/tool/`. Edit files **in the repo** — changes reflect immediately via symlinks.

```bash
stow nvim tmux bashrc    # install
stow -D nvim              # uninstall
stow -n nvim              # dry-run
stow */                    # install all
```

## Structure

```
nvim/.config/nvim/         # Neovim            → nvim/README.md
docker/docker-services/    # Docker services
bashrc/                    # Bash config        → bashrc/AGENTS.md
tmux/.config/tmux/         # Tmux               → tmux/README.md
wt/.config/worktrunk/      # Worktrunk
pi/.pi/                    # Pi agent           → pi/.pi/README.md
opencode/.config/opencode/ # Opencode
m908/.config/mouse_m908/   # Mouse config
homebrew/                  # brew-sync CLI      → homebrew/AGENTS.md
mise.toml                  # Runtime versions
scripts/hooks/             # Git hooks
```

Tool directories may have an `AGENTS.md` (path-scoped agent instructions) or a `README.md` (human-facing details with architecture context). Some have both.

## Global Conventions

- **Edit in repo**, never in symlink targets
- **Lua**: 2-space indent, StyLua, `snake_case`, `---@type` annotations
- **Python**: 4-space indent, ruff, `snake_case` funcs, `PascalCase` classes
- **Shell**: `set -euo pipefail`, one concern per file, lowercase-hyphen filenames
- **Git**: conventional commits (`feat:`, `fix:`, `chore:`), atomic changes
- **Docker**: `.env` gitignored; media at `/stash/`, `/stash2/`; UID 1000:1000
- **Secrets**: never commit; use `~/.secrets.tpl` with Proton Pass CLI

## Global Anti-Patterns

- **DO NOT** add qutebrowser config — it does not exist
- **DO NOT** expect `install.sh` to install everything — it only runs `stow nvim`

## Where to Look

| Task | Location |
|------|----------|
| Neovim plugin | `nvim/.config/nvim/lua/plugins/` |
| Neovim docs | `nvim/README.md` |
| LSP server config | `nvim/.config/nvim/lsp/*.lua` |
| Docker service | `docker/docker-services/<service>/` |
| Shell aliases | `bashrc/.bashrc.d/alias` |
| Shell secrets | `bashrc/.bashrc.d/secrets` |
| Tmux config | `tmux/.config/tmux/tmux.conf` |
| Tmux docs | `tmux/README.md` |
| Worktrunk config | `wt/.config/worktrunk/config.toml` |
| Git hooks | `scripts/hooks/` |
| Pi extensions | `pi/.pi/agent/extensions/` (see its `AGENTS.md`) |
| Pi extension docs | `pi/.pi/README.md` |
| Tests | `pi/.pi/agent/extensions/**/*.test.ts`, `pi/.local/bin/tdd-plan.test.ts`, `obsidian/.local/lib/wiki-search/wiki-search.test.ts` |
| CI | `.github/workflows/test.yml` |
| Homebrew packages | `homebrew/Brewfile` |
| brew-sync CLI | `homebrew/.local/bin/brew-sync` |

## Tools

```bash
stylua .              # Format Lua
luacheck .            # Lint Lua
ruff check .          # Lint Python
ruff format .         # Format Python
shellcheck **/*.sh    # Lint shell scripts
shfmt -w .            # Format shell scripts
```
