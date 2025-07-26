# Dotfiles
Personal dotfiles repository using GNU Stow for configuration management.

## Quick Setup

### Install pre-commit hooks
```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files  # Test hooks
```

### Install dotfiles
```bash
# Install specific tool configs
stow nvim zsh docker qtile qutebrowser

# Install Neovim plugins
nvim --headless "+Lazy! sync" +qa

# Start Docker services
cd docker/docker-services/[service] && docker-compose up -d
```

## Development

This repository uses [pre-commit](https://pre-commit.com/) for consistent code formatting:
- **Lua**: StyLua formatting
- **YAML/JSON**: Validation
- **Whitespace**: Trailing whitespace removal

Install hooks once: `pre-commit install`

These can be installed using GNU stow
https://www.gnu.org/software/stow/
