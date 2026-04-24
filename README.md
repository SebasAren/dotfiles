# Dotfiles

[![test](https://github.com/SebasAren/dotfiles/actions/workflows/test.yml/badge.svg)](https://github.com/SebasAren/dotfiles/actions/workflows/test.yml)

Personal dotfiles repository for a Linux workstation. Managed with [GNU Stow](https://www.gnu.org/software/stow/) for symlink-based configuration.

## What's Inside

| Directory | Tool | Purpose |
|-----------|------|---------|
| `nvim/` | Neovim | Editor: Lazy.nvim, 17 LSP servers, blink.cmp completion, AI coding |
| `tmux/` | Tmux | Terminal multiplexer: Ctrl+a prefix, vi copy, Tokyo Night theme |
| `bashrc/` | Bash | Modular shell config: aliases, secrets, fzf, mise, worktrunk integration |
| `docker/` | Docker | 5 self-hosted services (media, proxy, VPN, game streaming) |
| `wt/` | Worktrunk | Git worktree management with AI-generated commit messages |
| `pi/` | Pi agent | AI coding assistant extensions, skills, and context7 integration |
| `opencode/` | Opencode | Alternative AI assistant config |
| `m908/` | Redragon M908 | Mouse macro configuration |
| `homebrew/` | Homebrew | `brew-sync` CLI + Brewfile for personal packages |
| `mise/` | mise | Runtime version manager (Python, Lua, Node, Bun) |

## Prerequisites

- **OS**: Linux (Fedora/RHEL preferred — SELinux labels in Docker configs assume `:z` support)
- **Shell**: Bash 4+
- **Git**: 2.30+
- **Docker**: Docker Engine + Compose v2 (for services)
- **Homebrew** (Linuxbrew): installed to `/home/linuxbrew/.linuxbrew/`

## Quick Setup

### 1. Install runtimes with mise

```bash
mise install
```

This installs Python 3.12, Lua 5.4, Node, Bun, and tooling (ruff, StyLua, shellcheck, prettier) as defined in `mise.toml`.

### 2. Stow dotfiles into `~/.config/`

GNU Stow creates symlinks from the repo to your home directory. Each top-level directory is a "package."

```bash
# Install specific tools
stow nvim tmux bashrc

# Install everything
stow */

# Dry run (see what would be linked)
stow -n nvim

# Uninstall a package
stow -D nvim
```

**How it works**: Stow mirrors the directory structure. `nvim/.config/nvim/` gets symlinked to `~/.config/nvim/`, so edits in the repo take effect immediately.

### 3. Set up Neovim

```bash
# Install plugins (headless)
nvim --headless "+Lazy! sync" +qa
```

LSP servers are managed by Mason (`:Mason` in Neovim). The config auto-installs servers on first use.

### 4. Set up shell secrets

Secrets (API keys) are resolved lazily via [Proton Pass CLI](https://proton.me/pass). Install it:

```bash
curl -fsSL https://proton.me/download/pass-cli/install.sh | bash
```

Then create `~/.secrets.tpl` from the template:

```bash
cp bashrc/.secrets.tpl ~/.secrets.tpl
# Edit to add your API keys
```

Secrets are only resolved when tools like `pi`, `nvim`, or `wt` actually need them — not on shell startup.

### 5. Start Docker services

Each service is standalone:

```bash
cd docker/docker-services/jellyfin && docker compose up -d
```

Services requiring VPN or environment variables need a `.env` file (gitignored). See [Docker Services](#docker-services) below.

### 6. Install Tmux plugins

On first launch, TPM auto-installs. If it doesn't:

```
prefix + I    # (Ctrl+a, then Shift+i)
```

## Architecture Decisions

### Why GNU Stow?

Stow is minimal and transparent — it just creates symlinks. No daemons, no complex state. The directory structure _is_ the config. This means:
- Git tracks everything naturally
- No build step or compilation
- Easy to add/remove packages (`stow -D pkg`)
- Works with any XDG-compliant tool

### Why mise instead of asdf/nvm/pyenv?

[mise](https://mise.jdx.dev/) is a single tool that replaces multiple version managers (nvm, pyenv, rbenv, etc.). It's fast, supports `.tool-versions` compatibility, and has built-in task running (`mise run stylua`).

### Why Proton Pass for secrets?

Secrets should never be committed to git. Proton Pass CLI provides encrypted secret injection via templates (`~/.secrets.tpl`). The lazy resolution pattern in `.bashrc.d/secrets` means API keys are only fetched when a tool actually needs them, keeping shell startup fast.

### Why worktrunk (wt)?

Git worktrees let you work on multiple branches simultaneously without stashing or switching. Worktrunk wraps this workflow with:
- Automatic worktree creation/cleanup
- AI-generated conventional commit messages (via pi)
- Pre-commit hooks for formatting and linting
- Squash-merge by default for clean history

## Tool Details

### Neovim

**Plugin manager**: [Lazy.nvim](https://github.com/folke/lazy.nvim) — lazy-loads everything.

**Completion**: [blink.cmp](https://github.com/Saghen/blink.cmp) with AI providers:
- **Codestral** (Mistral) for code completion
- **Minuet-AI** for extended context suggestions

**LSP**: 17 servers managed via `nvim-lspconfig` + Mason. Per-server configs in `lsp/*.lua`. Key servers: basedpyright (Python), vtsls (TypeScript), lua_ls, rust_analyzer, gopls.

**Formatting**: [conform.nvim](https://github.com/stevearc/conform.nvim) — StyLua, prettierd, black+isort. Format on save.

**Linting**: [nvim-lint](https://github.com/mfussenegger/nvim-lint) — ruff, luacheck, hadolint.

**Debugging**: nvim-dap + nvim-dap-ui for JavaScript/TypeScript and Python.

**AI coding**: [CodeCompanion.nvim](https://github.com/olimorris/codecompanion.nvim) with Venice AI adapter.

**Custom overrides**: Create `nvim/.config/nvim/lua/custom-settings.lua` (gitignored) for machine-specific settings. Loaded via `pcall` so it's optional.

### Tmux

- **Prefix**: `Ctrl+a` (not the default `Ctrl+b` — easier to reach)
- **Navigation**: `Alt+hjkl` to switch panes without prefix
- **Windows**: `Alt+1..9` to switch, `Alt+</>` to reorder
- **Splits**: `Alt+v` (horizontal), `Alt+s` (vertical)
- **Copy mode**: vi-style (`v` to select, `y` to yank to clipboard via `wl-copy`)
- **Theme**: Tokyo Night
- **No mouse**: keyboard-only navigation by design
- **Worktrunk integration**: `prefix+W` opens worktree creation popup

### Docker Services

| Service | What it does | Port |
|---------|-------------|------|
| **jellyfin** | Media server (movies, TV, music) | 8096 |
| **audiobookshelf** | Audiobook and podcast server | 13378 |
| **nginx-proxy-manager** | Reverse proxy with web UI | 8000 (HTTP), 8100 (admin) |
| **transmission** | BitTorrent via VPN (OpenVPN) | 9091 |
| **wolf** | Game streaming (Moonlight/Sunshine) | 47984 |

**Network**: jellyfin, audiobookshelf, and nginx-proxy-manager share an external `nginx` network so NPM can proxy to them. Transmission and Wolf use bridge networking.

**Media paths**: `/var/stash/media` and `/var/stash2/media` (mounted read-only in containers).

**VPN**: Transmission uses `haugene/transmission-openvpn`. Set `OPENVPN_PROVIDER`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD` in environment. VPN configs go in `docker/docker-services/transmission/vpn/`.

**SELinux**: Volume mounts use `:U,z` labels for automatic SELinux context. This is Fedora/RHEL-specific; on non-SELinux systems these labels are harmless but ignored.

### Shell (Bash)

Modular config in `bashrc/.bashrc.d/`. Each file handles one concern:

| File | Purpose |
|------|---------|
| `config` | Editor, fzf bindings |
| `alias` | Short aliases |
| `mise` | Activate mise runtime manager |
| `secrets` | Lazy Proton Pass integration |
| `tmux` | Auto-attach/create tmux sessions |
| `wt` | Worktrunk shell integration (directive file pattern) |
| `wpi` | Worktree + Pi agent workflow |
| `fnox` | fnox reencryption helper |

**Key pattern — `wt` shell integration**: Worktrunk commands like `wt switch` need to change the shell's working directory. Since subprocesses can't modify their parent shell, `wt` writes a "directive file" that the shell wrapper sources after the command exits.

### Homebrew

Personal Homebrew packages tracked in a Brewfile, synced between machines via `brew-sync` (stowed to `~/.local/bin/`):

```bash
brew-sync              # export: regenerate Brewfile from installed packages
brew-sync install     # import: install packages from Brewfile
brew-sync full        # both: regenerate + install
```

On Bluefin, system packages from `/usr/share/ublue-os/homebrew/*.Brewfile` are excluded automatically.

### Worktrunk (wt)

Git worktree management. Config at `wt/.config/worktrunk/config.toml`.

**Commit messages**: Generated by pi (AI agent) via `generate-commit-msg.sh`. The hook feeds the diff to pi with conventional commit format instructions, falls back to a simple `chore: update N files` if pi fails.

**Merge workflow**: Squash-merge with rebase by default. `wt merge` verifies and cleans up the worktree after merging.

### Pi Agent

AI coding assistant. Extensions live in `pi/.pi/agent/extensions/`:
- **context7**: Up-to-date library documentation lookup (requires `CONTEXT7_API_KEY`)
- Custom skills for TDD, commits, worktree management

## Development

### Linting and Formatting

Run via mise tasks:

```bash
mise run stylua       # Format Lua
mise run luacheck     # Lint Lua
mise run ruff         # Lint + format Python
mise run shellcheck   # Lint shell scripts
```

### Testing

The TypeScript surface (Pi agent extensions and two standalone CLIs) is covered by **459 tests across 36 files**, all running under [`bun test`](https://bun.sh/docs/cli/test) and executed on every push by GitHub Actions (see [`.github/workflows/test.yml`](.github/workflows/test.yml)).

| Location | Tests | Style |
|----------|-------|-------|
| `pi/.pi/agent/extensions/**/*.test.ts` | 413 | Unit tests co-located with source; `integration.test.ts` per extension covers load/register cycles |
| `pi/.local/bin/tdd-plan.test.ts` | 5 | End-to-end CLI tests via `execSync` against the `tdd-plan` binary |
| `obsidian/.local/lib/wiki-search/wiki-search.test.ts` | 41 | Unit tests with real filesystem fixtures for the `wiki-search` CLI |

**Run locally:**

```bash
# Pi extensions (typecheck + tests)
cd pi/.pi/agent/extensions
for dir in */; do [ -f "$dir/tsconfig.json" ] && npx tsc --noEmit -p "$dir/tsconfig.json"; done
bun test

# Standalone CLIs
bun test pi/.local/bin/tdd-plan.test.ts
bun test obsidian/.local/lib/wiki-search/wiki-search.test.ts
```

**Mocking conventions**: External SDKs (`exa-js`, `@upstash/context7-sdk`, `@mariozechner/pi-coding-agent`) are mocked via shared factories in `pi/.pi/agent/extensions/shared/src/test-mocks.ts` — tests never hit the network and need no API keys. See `.claude/rules/pi-extensions.md` for the full rationale.

### Git Hooks

Pre-commit hooks run fast checks (format validation, YAML/JSON linting, whitespace trimming). Install with:

```bash
git config core.hooksPath .githooks
```

## Repository Structure

```
.
├── nvim/.config/nvim/           # Neovim
│   ├── lua/config/              # Core config (LSP, keymaps, diagnostics)
│   ├── lua/plugins/             # Plugin specs (Lazy.nvim)
│   ├── lsp/                     # Per-server LSP configs
│   └── lua/prompts/             # AI prompt templates
├── tmux/.config/tmux/           # Tmux
│   ├── tmux.conf                # Main config
│   └── scripts/                 # Popup scripts (wt integration)
├── bashrc/                      # Bash
│   ├── .bashenv                 # Global env vars
│   └── .bashrc.d/               # Modular sourced scripts
├── docker/docker-services/      # Docker
│   ├── jellyfin/
│   ├── audiobookshelf/
│   ├── nginx-proxy-manager/
│   ├── transmission/            # Requires VPN .env
│   └── wolf/
├── wt/.config/worktrunk/        # Worktrunk
│   ├── config.toml              # wt configuration
│   └── generate-commit-msg.sh   # AI commit message hook
├── pi/.pi/                      # Pi agent
│   └── agent/extensions/        # Extensions (context7, etc.)
├── homebrew/                    # brew-sync CLI + Brewfile
├── mise.toml                    # Runtime versions
├── scripts/hooks/               # Git hooks
├── install.sh                   # Minimal installer (stow nvim + pass-cli)
├── AGENTS.md                    # Agent-specific guide
└── CONVENTIONS.md               # Development conventions
```

## License

Personal configuration. Use at your own discretion.
