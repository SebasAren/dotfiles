# Dotfiles Repository Handover Documentation

This document provides comprehensive handover information for the dotfiles repository, covering architecture, setup, development workflows, and maintenance procedures.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture and Components](#architecture-and-components)
3. [Setup and Installation](#setup-and-installation)
4. [Development Workflow](#development-workflow)
5. [Build, Lint, and Test Commands](#build-lint-and-test-commands)
6. [Code Style Guidelines](#code-style-guidelines)
7. [LSP and Language Support](#lsp-and-language-support)
8. [File Structure Conventions](#file-structure-conventions)
9. [Common Tasks](#common-tasks)
10. [Deployment and Maintenance](#deployment-and-maintenance)
11. [Troubleshooting](#troubleshooting)
12. [Future Roadmap](#future-roadmap)
13. [Important Notes](#important-notes)

## Project Overview

### Purpose
This repository contains personal dotfiles managed using GNU Stow for configuration management. It includes configurations for various development tools, window managers, and services used in a personal development environment.

### Key Features
- **Modular Configuration**: Each tool has its own directory structure
- **GNU Stow Integration**: Symbolic linking for easy management
- **Docker Services**: Pre-configured services for development and media
- **Neovim Setup**: Comprehensive editor configuration with LSP support
- **Qtile Configuration**: Window manager setup with custom widgets
- **AI Development Tools**: Aider and other AI assistant configurations

### Target Environment
- **Operating System**: Linux (tested on Arch/Ubuntu)
- **Window Manager**: Qtile (Wayland/X11)
- **Terminal**: Kitty
- **Shell**: Zsh with custom configuration
- **Editor**: Neovim with extensive plugin ecosystem

## Architecture and Components

### Core Components

#### 1. Neovim Configuration (`nvim/`)
- **Location**: `nvim/.config/nvim/`
- **Entry Point**: `init.lua`
- **Key Modules**:
  - `config/lazy.lua` - Plugin manager (Lazy.nvim)
  - `config/settings.lua` - Core editor settings
  - `config/mappings.lua` - Keybindings
  - `config/lsp.lua` - Language Server Protocol setup
  - `lsp/` - Individual LSP server configurations
  - `lua/plugins/` - Plugin specifications

#### 2. Qtile Configuration (`qtile/`)
- **Location**: `qtile/.config/qtile/`
- **Entry Point**: `config.py`
- **Key Modules**:
  - `utils/bars.py` - Custom status bars
  - `utils/process.py` - Process management
  - `widgets/` - Custom Qtile widgets
  - `autostart/` - Autostart scripts for different environments

#### 3. Docker Services (`docker/`)
- **Location**: `docker/docker-services/`
- **Available Services**:
  - `audiobookshelf/` - Audiobook management
  - `jellyfin/` - Media center
  - `nginx-proxy-manager/` - Reverse proxy with SSL
  - `transmission/` - Torrent client with VPN
  - `wolf/` - Additional service with tailscale integration

#### 4. Shell Configuration (`zsh/` and `bashrc/`)
- **Zsh**: `.zshrc` with custom prompt and aliases
- **Bash**: `.bashrc.d/` with modular configuration
- **Shared**: Environment variables and common settings

#### 5. Other Tools
- **Kitty**: Terminal emulator configuration
- **Picom**: Compositor settings
- **Qutebrowser**: Keyboard-driven browser
- **M908 Mouse**: Custom mouse configuration

### Dependency Graph
```
Dotfiles Repository
├── GNU Stow (symlink management)
├── Neovim (primary editor)
│   ├── Lazy.nvim (plugin manager)
│   ├── LSP servers (language support)
│   └── Various plugins (functionality)
├── Qtile (window manager)
│   ├── Custom widgets
│   └── Autostart scripts
├── Docker (service management)
│   ├── Docker Compose (service orchestration)
│   └── Various containers
└── Shell (zsh/bash)
    ├── Custom prompts
    └── Aliases and functions
```

## Setup and Installation

### Prerequisites
- GNU Stow: `sudo apt install stow` or equivalent
- Docker and Docker Compose: For service management
- Neovim 0.8+: For editor configuration
- Python 3.8+: For Qtile and various tools
- Git: For version control
- Pre-commit: For code quality hooks

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/sebas/dotfiles.git ~/.dotfiles
cd ~/.dotfiles
```

#### 2. Install Pre-commit Hooks
```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files  # Test hooks
```

#### 3. Install Dotfiles with Stow
```bash
# Install specific tool configs
stow nvim zsh docker qtile qutebrowser kitty

# Or install all
stow */
```

#### 4. Set Up Neovim
```bash
nvim --headless "+Lazy! sync" +qa
```

#### 5. Start Docker Services
```bash
cd docker/docker-services/[service]
docker-compose up -d
```

### Post-Installation Configuration
- **Custom Settings**: Create `nvim/.config/nvim/custom-settings.lua` (gitignored)
- **Environment Variables**: Set up `.env` files for Docker services
- **Host-specific Config**: Update hostname checks in Qtile config

## Development Workflow

### Version Control
- **Branching Strategy**: Main branch for stable config, feature branches for changes
- **Commit Messages**: Use conventional commits format
- **Pull Requests**: For significant changes, use PRs even for personal repo

### Configuration Management
- **Stow Workflow**: Edit files in repository, stow creates symlinks
- **Testing**: Test changes before committing
- **Rollback**: Use git for easy rollback of problematic changes

### Update Process
1. Pull latest changes: `git pull origin main`
2. Update plugins: `:Lazy update` in Neovim
3. Update Docker images: `docker-compose pull`
4. Test changes thoroughly
5. Commit and push updates

## Build, Lint, and Test Commands

### Formatting Commands
Auto-formatting runs on save via conform.nvim. Manually format with:
- `:ConformInfo` - View formatters available
- Toggle auto-format with `<leader>tf`

Formatters configured:
- Lua: `stylua`
- Python: `isort`, `black`
- JavaScript/TypeScript/Vue/Prisma/HTML/GraphQL: `prettierd`
- All files: `trim_whitespace`

### Linting Commands
Linting runs automatically on InsertLeave and BufWritePost via nvim-lint. Tools:
- Python: `ruff`
- Lua: `luacheck`
- Dockerfile: `hadolint`

Manual lint: Trigger by leaving insert mode or saving

### Testing Commands
Testing via neotest with these keybindings:
- `<leader>tt` - Run test file
- `<leader>tT` - Run all tests in project
- `<leader>tr` - Run nearest test
- `<leader>tl` - Run last test
- `<leader>ts` - Toggle test summary
- `<leader>to` - Show test output
- `<leader>tS` - Stop running test
- `<leader>tw` - Toggle watch mode
- `<leader>td` - Debug nearest test

### Neovim Plugin Updates
- `:Lazy update` - Update all plugins
- `:Lazy sync` - Sync plugin state

### Docker Services
```bash
cd docker/docker-services/<service-name>
docker-compose up -d    # Start service
docker-compose logs -f   # View logs
docker-compose pull      # Update images
```

## Code Style Guidelines

### Lua (Neovim Config)
- **Indentation**: 2 spaces, expand tabs
- **Imports**: Use `require()` at top of file, group related imports
- **Type hints**: Use `---@type <type>` annotations for LuaLS
- **Variables**: snake_case for local variables
- **Functions**: Define with `local function_name()` or table methods
- **Error handling**: Use `pcall()` for optional module loading:
  ```lua
  pcall(function()
      require("custom-settings")
  end)
  ```
- **Vim options**: Use `vim.o.<option>` or `vim.opt.<option>`
- **Autocommands**: Create augroups with descriptive names:
  ```lua
  local augroup_name = vim.api.nvim_create_augroup("groupname", { clear = true })
  vim.api.nvim_create_autocmd({ "Event" }, {
      group = augroup_name,
      callback = function() end,
  })
  ```

### Python (Qtile Config)
- **Indentation**: 4 spaces
- **Imports**: Standard library → third-party → local imports
- **Type hints**: Use inline type hints with `# type: <type>` for older Python
- **Variables**: snake_case for all variables and functions
- **Classes**: PascalCase for class names
- **Constants**: UPPER_CASE for constants
- **Configuration**: Use descriptive variable names, add comments for clarity

### General Guidelines
- **Comments**: Concise, explain "why" not "what"
- **Line length**: No strict limit, favor readability
- **Whitespace**: No trailing whitespace, trim automatically
- **Files**: Keep configs modular, split into logical directories
- **Keybindings**: Use consistent prefixes (e.g., `<leader>t` for tests)

## LSP and Language Support

### Available LSP Servers
- Python: basedpyright
- Lua: lua_ls
- JavaScript/TypeScript: vtsls with Vue and Astro plugins
- JSON: jsonls
- HTML: htmlls
- GraphQL: graphql
- Prisma: prismals
- Emmet: emmet_language_server
- Svelte: svelte

### LSP Configuration
- Server configs in `nvim/.config/nvim/lsp/`
- Common setup in `nvim/.config/nvim/lua/config/lsp.lua`
- Enable LSP for new servers: Add config file to lsp/ directory

## File Structure Conventions

### Neovim Config
- `init.lua` - Entry point, requires all configs
- `lua/config/` - Core configuration (settings, mappings, LSP, diagnostics)
- `lua/plugins/` - Plugin specifications (one file per plugin or plugin group)
- `lsp/` - Individual LSP server configurations
- `lua/utils/` - Utility functions

### Qtile Config
- `config.py` - Main Qtile configuration
- `utils/` - Helper modules (bars, process management)
- `widgets/` - Custom widgets
- `autostart/` - Autostart scripts

### Docker Services
- Each service in separate directory under `docker/docker-services/`
- Standard structure:
  ```
  service-name/
  ├── docker-compose.yml
  ├── .env (gitignored)
  └── data/ (persistent volumes)
  ```

## Common Tasks

### Adding a Neovim Plugin
1. Create spec in `lua/plugins/<plugin-name>.lua`
2. Use Lazy.nvim format with table return
3. Add keybindings in `keys` table with `desc` field
4. Configure dependencies if needed

### Modifying Dotfiles with Stow
1. Edit files directly in their directories (e.g., `nvim/.config/nvim/`)
2. Symlinks created by stow will automatically reflect changes
3. Test changes before committing

### Docker Service Changes
1. Edit `docker/docker-services/<service>/docker-compose.yml`
2. Restart service: `docker-compose up -d --force-recreate`
3. Check logs: `docker-compose logs -f`

### Adding New Tool Configuration
1. Create directory for tool (e.g., `newtool/`)
2. Place config files in appropriate locations (`.config/newtool/`)
3. Add to stow: `stow newtool`
4. Document in README if significant

## Deployment and Maintenance

### Regular Maintenance Tasks
1. **Plugin Updates**: Monthly `:Lazy update` in Neovim
2. **Docker Updates**: Monthly `docker-compose pull` for services
3. **Dependency Updates**: Quarterly review of all dependencies
4. **Backup**: Regular backup of persistent Docker volumes

### Monitoring and Logging
- **Neovim**: `:Lazy log` for plugin issues, `:checkhealth` for health checks
- **Docker**: `docker-compose logs -f` for service monitoring
- **Qtile**: Check logs in `~/.local/share/qtile/`

### Backup Strategy
- **Repository**: Regular git commits and pushes
- **Docker Volumes**: Regular backups of `/stash/` and `/stash2/` directories
- **Configuration**: Export important configs periodically

## Troubleshooting

### Common Issues and Solutions

#### Neovim Issues
- **Plugin not loading**: Run `:Lazy sync` and check `:Lazy log`
- **LSP not working**: Verify server installation with `:LspInfo`
- **Formatting not working**: Check `:ConformInfo` for available formatters
- **Slow startup**: Profile with `nvim --startuptime /tmp/startup.log`

#### Qtile Issues
- **Config errors**: Test with `qtile check` before reloading
- **Widget problems**: Check widget imports and dependencies
- **Keybinding conflicts**: Review `config.py` keys section
- **Multi-monitor issues**: Verify screens configuration

#### Docker Issues
- **Permission denied**: Add user to docker group: `sudo usermod -aG docker $USER`
- **Port conflicts**: Check running containers with `docker ps`
- **Volume issues**: Verify volume mounts and permissions
- **Network problems**: Check Docker network configuration

#### Stow Issues
- **Conflicting files**: Use `stow -n <package>` to simulate before applying
- **Broken symlinks**: Remove and re-stow: `stow -D <package> && stow <package>`
- **Permission problems**: Ensure proper file permissions

### Debugging Techniques
- **Neovim**: Use `:messages` and `:LspLog` for debugging
- **Qtile**: Run from terminal to see startup errors
- **Docker**: Use `docker-compose config` to validate compose files
- **Shell**: Use `set -x` in scripts for debugging

## Future Roadmap

### Potential Improvements

#### Neovim Enhancements
- **AI Integration**: Better Copilot/GPT integration
- **Debugging**: Enhanced DAP (Debug Adapter Protocol) support
- **Testing**: Expanded test coverage for custom Lua modules
- **Performance**: Optimize startup time

#### Qtile Improvements
- **Wayland Support**: Full Wayland compatibility
- **Widget Library**: More custom widgets
- **Configuration**: Better multi-monitor handling
- **Theming**: Dynamic theming support

#### Infrastructure Upgrades
- **Docker**: Migration to Podman for rootless containers
- **CI/CD**: Automated testing pipeline
- **Backup**: Automated backup solution for Docker volumes
- **Monitoring**: Health monitoring for services

#### Documentation Enhancements
- **Interactive Docs**: Better documentation with examples
- **Video Tutorials**: Screen recordings of setup processes
- **Troubleshooting Guide**: Expanded troubleshooting section
- **API Documentation**: For custom Lua modules

## Important Notes

### Security Considerations
- **Secrets Management**: Never commit secrets, use `.env` files (gitignored)
- **Docker Security**: Regularly update base images
- **Permissions**: Review container permissions regularly
- **Backups**: Ensure critical data is backed up

### Customization Points
- **Custom Settings**: `nvim/.config/nvim/custom-settings.lua` (gitignored)
- **Environment Variables**: Service-specific `.env` files
- **Host-specific Config**: Qtile autostart scripts and hostname checks

### Performance Tips
- **Neovim**: Disable unused plugins for better performance
- **Qtile**: Optimize widget update intervals
- **Docker**: Use appropriate resource limits
- **Shell**: Review startup files for performance

### Migration Notes
- **From Vim**: Gradual migration to Neovim features
- **From Other WMs**: Qtile keybinding adaptation
- **From Different Distros**: Package manager adjustments

### Community Resources
- **Neovim**: [neovim.io](https://neovim.io/)
- **Qtile**: [qtile.org](https://qtile.org/)
- **Lazy.nvim**: [github.com/folke/lazy.nvim](https://github.com/folke/lazy.nvim)
- **GNU Stow**: [gnu.org/software/stow](https://www.gnu.org/software/stow/)

## Handover Checklist

For the incoming developer:
- [ ] Review this entire document
- [ ] Set up development environment as described
- [ ] Test all major components (Neovim, Qtile, Docker services)
- [ ] Familiarize with keybindings and workflows
- [ ] Review recent git history for context
- [ ] Set up monitoring for critical services
- [ ] Schedule regular maintenance tasks
- [ ] Document any new findings or issues

## Contact Information

**Previous Maintainer**: Sebastiaan Arendsen
**Repository**: https://github.com/sebas/dotfiles
**Issues**: Use GitHub Issues for tracking
**Documentation**: This file and related markdown files

---

> "With great power comes great responsibility. Maintain these dotfiles with care, for they are the foundation of a productive development environment."