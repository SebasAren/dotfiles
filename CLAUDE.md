# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Personal dotfiles repository using GNU Stow for configuration management. Contains configurations for development tools, media services, and system utilities.

## Key Architecture

### Dotfile Management
- **Tool**: GNU Stow creates symbolic links from tool directories to home directory
- **Structure**: Each tool has its own directory with standard XDG config paths
- **Install**: `stow [tool-name]` to activate configurations

### Core Tools Configured
- **Neovim**: Lazy.nvim-based configuration with AI integration (CodeCompanion + MCP Hub)
- **Zsh**: Oh My Zsh with custom theme and extensive aliases
- **Docker Services**: Individual compose files for media/AI services
- **Qtile**: Window manager configuration
- **Qutebrowser**: Browser configuration

## Essential Commands

### Setup & Installation
```bash
# Install dotfiles for specific tools
stow nvim zsh docker qtile qutebrowser

# Install Neovim plugins
nvim --headless "+Lazy! sync" +qa

# Start Docker services
cd docker/docker-services/[service] && docker-compose up -d
```

### Neovim Operations
- **File search**: `<leader>pp` (fzf-lua)
- **Live grep**: `<leader>pg`
- **LSP actions**: `<leader>gh/ga/gr` for hover/definition/references
- **AI assistance**: CodeCompanion with Claude integration via MCP Hub

### Docker Services
Located in `docker/docker-services/`:
- **Media**: Jellyfin, Audiobookshelf
- **AI**: OpenWebUI (local LLM interface)
- **Network**: Transmission with VPN
- **Database**: MariaDB

### Media Storage
- Standard paths: `/stash/` and `/stash2/` directories
- User context: UID 1000:1000 for Docker services
- Persistent volumes for data/config separation

### AI Development
- **Local LLM**: Ollama via OpenWebUI
- **AI Assistant**: CodeCompanion.nvim with Claude
- **MCP Tools**: Custom servers for testing and git conventions