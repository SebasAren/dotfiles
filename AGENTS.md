# Comprehensive Project Handover Document

## Project Overview
This is a comprehensive dotfiles repository for personal configuration management across multiple development environments and tools. The repository uses GNU stow for symbolic linking and maintains configurations for development tools, window managers, shells, and docker services.

## Repository Structure

### Core Configuration Directories
The repository follows the standard dotfiles structure with each directory containing configuration files for specific tools:

- **`aider/`** - AI assistant configuration
- **`asdf/`** - Version manager configuration
- **`awesome/`** - Awesome window manager configuration with git submodules
- **`docker/`** - Docker services and configurations
- **`kitty/`** - Kitty terminal emulator configuration
- **`nix/`** - Nix package manager configuration
- **`nushell/`** - Nushell configuration
- **`nvim/`** - Neovim configuration with LSP support
- **`picom/`** - Picom compositor configuration
- **`qtile/`** - Qtile window manager configuration with dunst
- **`qutebrowser/`** - Qutebrowser configuration
- **`zsh/`** - Zsh shell configuration

### Docker Services
Located in `docker/docker-services/`, these services are configured with individual docker-compose files:

- **audiobookshelf** - Audio book and podcast management
- **fishnet** - Chess engine analysis service
- **jellyfin** - Media server with jellyfin-vue frontend
- **mysql** - Database service with persistent storage
- **openwebui** - Open WebUI for local LLM interaction
- **python** - Python development environment
- **transmission** - Torrent client with VPN integration

### Key Configuration Files

#### AI Development Tools
- **`aider/.aider.conf.yml`** - Aider AI assistant configuration
  - **Primary model**: qwen (qwen3-coder)
  - **Weak model**: ernie (baidu/ernie-4.5-300b-a47b)
  - **Model aliases**: Support for multiple AI providers (OpenAI, DeepSeek, Moonshot, etc.)
  - **Issue**: Missing `CONVENTIONS.md` file referenced in configuration

#### Git Configuration
- **`.gitignore`** - Excludes build artifacts, data directories, and sensitive files
- **`.gitmodules`** - Git submodules for awesome window manager extensions:
  - `lain.git` - Additional widgets and layouts
  - `freedesktop.git` - Freedesktop.org standard compliance
  - `xmonad-git` and `xmonad-contrib-git` - Xmonad window manager (referenced but directory may not exist)

## Setup Instructions

### Prerequisites
1. **GNU Stow** - Required for dotfile installation
   ```bash
   # Ubuntu/Debian
   sudo apt install stow
   # Arch Linux
   sudo pacman -S stow
   # macOS
   brew install stow
   ```

2. **Git submodules** - Initialize for awesome WM configuration
   ```bash
   git submodule update --init --recursive
   ```

### Installation Process
1. Clone the repository
2. Initialize git submodules
3. Use stow to create symbolic links:
   ```bash
   cd dotfiles
   stow zsh
   stow nvim
   stow awesome
   # etc.
   ```

### Docker Services Setup
Each service has its own docker-compose.yml file. Use these commands:

```bash
# Navigate to service directory
cd docker/docker-services/[service-name]

# Start service
docker-compose up -d

# View logs
docker-compose logs -f
```

## Environment Variables
Several docker services require environment variables:

- **Transmission**: `TZ`, `OPENVPN_PROVIDER`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD`, `OPENVPN_CONFIG`, `LOCAL_NETWORK`, `TRANSMISSION_PEER_PORT`
- **OpenWebUI**: `OLLAMA_BASE_URL` (defaults to local Ollama instance)

## Development Environment Details

### Neovim Configuration
- **Plugin manager**: Lazy.nvim (evidenced by lazy-lock.json)
- **LSP servers**: Pre-configured for multiple languages
  - jsonls (JSON)
  - svelte (Svelte)
  - prismals (Prisma)
  - html (HTML)
  - lua_ls (Lua)
  - graphql (GraphQL)
  - basedpyright (Python)
  - emmet_language_server (Emmet)

### Shell Configuration
- **Primary shell**: Zsh with custom .zshrc and .zprofile
- **Configuration location**: `zsh/.zshrc` and `zsh/.zprofile`

### Window Managers
- **Awesome WM**: Git submodule-based configuration in `awesome/.config/awesome/`
- **Qtile**: Python-based configuration with dunst notifications

## Storage and Data Management

### Docker Volumes
- **OpenWebUI**: Uses external volume `open-webui`
- **Jellyfin**: Mounts media directories `/stash/` and `/stash2/` for content
- **Transmission**: Mounts media directories for downloads and VPN configuration
- **MySQL**: Uses persistent data directory `mysql_data/` (gitignored)

### Gitignore Rules
Key exclusions include:
- Build artifacts and cache files
- Sensitive data directories (`mysql_data/`)
- Personal configuration files (`custom-settings.lua`)
- Aider chat history files

## Known Issues and Considerations

### Critical Issues
1. **Missing CONVENTIONS.md**: The `aider/.aider.conf.yml` references `CONVENTIONS.md` which does not exist
2. **Git submodule paths**: Some submodule paths may reference non-existent directories (xmonad)
3. **Permission issues**: MySQL data directories have restricted access

### Migration Notes
1. **Media directories**: Services expect `/stash/` and `/stash2/` directories to exist
2. **User IDs**: Docker services use user ID 1000:1000 - adjust if your system uses different IDs
3. **VPN configuration**: Transmission requires valid VPN credentials to function

### Dependencies and Requirements
- **GNU Stow** (required for dotfile management)
- **Docker and Docker Compose** (for services)
- **Git with submodule support**
- **Neovim 0.8+** (for nvim configuration)
- **Zsh** (for shell configuration)

## Quick Start for New Developers

1. **Initial Setup**:
   ```bash
   git clone <repository-url>
   cd dotfiles
   git submodule update --init --recursive
   ```

2. **Install dotfiles**:
   ```bash
   # Install specific configs
   stow zsh nvim kitty
   
   # Or install everything
   stow */
   ```

3. **Start essential services**:
   ```bash
   cd docker/docker-services/jellyfin
   docker-compose up -d
   
   cd ../openwebui
   docker-compose up -d
   ```

4. **Fix missing files**:
   ```bash
   # Create missing CONVENTIONS.md
   touch CONVENTIONS.md
   ```

## Maintenance Notes

### Regular Tasks
- Update git submodules: `git submodule update --remote`
- Update neovim plugins: `:Lazy update` in nvim
- Update docker images: `docker-compose pull && docker-compose up -d`
- Review service logs: `docker-compose logs -f [service-name]`

### Backup Considerations
- Docker volumes need separate backup strategy
- Configuration files are version controlled
- Media directories (`/stash/` and `/stash2/`) are external to git
- MySQL data is stored in docker volumes and should be backed up separately

This repository represents a complete development environment setup with media services, AI tools, and development configurations. New developers should focus on understanding the stow-based installation process and service dependencies before making changes.

