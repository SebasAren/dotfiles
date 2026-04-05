# Dotfiles
Personal dotfiles repository using GNU Stow for configuration management.

## Quick Setup

### Install tools with mise
```bash
mise install
```

### Install dotfiles
```bash
# Install specific tool configs
stow nvim docker bashrc tmux m908 opencode wt pi

# Install Neovim plugins
nvim --headless "+Lazy! sync" +qa

# Start Docker services
cd docker/docker-services/[service] && docker-compose up -d
```

## Development Tools

This repository uses [mise](https://mise.jdx.dev/) for managing development tools.

### Available Tools
| Tool | Purpose |
|------|---------|
| `mise run stylua` | Lua formatter |
| `mise run luacheck` | Lua linter |
| `mise run ruff` | Python linter/formatter |
| `mise run shellcheck` | Shell linter |
| `mise run bun` | JavaScript runtime/testing |
| `mise run npx tsc` | TypeScript type checking |

### Worktrunk Hooks

Hooks are configured in `.config/wt.toml`:
- **Pre-commit**: Fast formatting checks (Lua, Shell, Python)
- **Pre-merge**: Full typecheck + test suite

Run hooks manually:
```bash
./scripts/hooks/pre-commit.sh
./scripts/hooks/pre-merge.sh
```

These can be installed using GNU stow
https://www.gnu.org/software/stow/