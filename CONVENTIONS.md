# Development Conventions

## Code Style Guidelines

### General Principles
- Write clean, readable code
- Use consistent indentation and formatting
- Prefer meaningful variable and function names
- Keep functions short and focused on a single responsibility
- Document complex logic and non-obvious decisions

### File Organization
- Use lowercase filenames with hyphens for multi-word names
- Group related functionality in directories
- Keep configuration files in their respective tool directories
- Use `.gitignore` to exclude sensitive data and build artifacts

### Git Workflow
- Use descriptive commit messages
- Create atomic commits that represent single logical changes
- Use conventional commit format when possible
- Keep the main branch stable and deployable

### Docker Services
- Each service should have its own docker-compose.yml file
- Use environment variables for configuration
- Mount persistent volumes for data that needs to survive container restarts
- Use health checks for critical services

### Security Considerations
- Never commit secrets or credentials
- Use environment variables for sensitive configuration
- Regularly update dependencies and base images
- Review container permissions and user contexts

## Repository-Specific Conventions

### Dotfile Management
- Use GNU Stow for symbolic linking configurations
- Each tool gets its own directory matching the tool name
- Configuration files go in their standard locations within tool directories
- Avoid hard-coded paths that assume specific user environments

### Media Services
- Expect `/stash/` and `/stash2/` directories for media storage
- Use user ID 1000:1000 for Docker services when possible
- Configure VPN credentials for transmission service
- Set up persistent storage for databases and user data

### AI Development Tools
- Configure Aider with appropriate model aliases
- Use local LLM services when possible for privacy
- Document AI model configurations and usage patterns
- Keep AI assistant configurations version controlled

## Environment Setup

### Required Tools
- GNU Stow for dotfile management
- Docker and Docker Compose for services
- Git for version control
- Neovim 0.8+ for editor configuration
- Zsh for shell configuration

### Directory Structure
```
dotfiles/
├── [tool-name]/          # Each tool gets its own directory
│   └── .config/[tool]/   # Standard XDG config location
├── docker/
│   └── docker-services/  # Individual service configurations
├── .gitignore           # Repository exclusions
└── CONVENTIONS.md       # This file
```