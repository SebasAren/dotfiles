---
name: mise
description: Manage development tools, tasks, and environment variables with mise (mise-en-place). Use when installing or switching tool versions, running project tasks, configuring per-project environments, or editing mise.toml files.
---

# Mise (mise-en-place) Skill

Unified tool version manager, task runner, and environment manager for development projects. Mise replaces tools like asdf, nvm, pyenv, direnv, and make with a single TOML-based configuration.

## When to Use This Skill

- User mentions "mise", "mise.toml", or "mise-en-place"
- User wants to install, update, or switch tool versions (Node, Python, Go, etc.)
- User wants to run or define project tasks
- User wants to set per-project environment variables
- User asks about mise configuration, settings, or backends
- User needs to edit or troubleshoot `mise.toml` files

## Essential Commands

### Tool Version Management

```bash
mise install                        # Install all tools from mise.toml
mise use node@24                    # Add/update tool in project config
mise use --global python@3.12       # Add/update tool in global config
mise ls                             # List installed tools and versions
mise ls-remote node                 # List available versions for a tool
mise upgrade                        # Update all tools to latest versions
mise upgrade --interactive          # Interactively select tools to update
mise prune                          # Remove unused tool versions
```

### Running Tasks

```bash
mise run                            # List all available tasks
mise run build                      # Run a specific task
mise run build -- --flag arg        # Pass arguments to task
mise tasks                          # List tasks with descriptions
mise tasks ls                       # Same as mise tasks
mise watch build                    # Run task when sources change
```

### Environment Variables

```bash
mise env                            # Show environment variables
mise set KEY=value                  # Set env var in project config
```

### Configuration

```bash
mise edit                           # Open interactive config editor (TUI)
mise edit --global                  # Edit global config
mise config                         # Show merged configuration
mise doctor                         # Diagnose configuration issues
mise trust                          # Trust current project config
mise init                           # Initialize mise.toml in current directory
```

### Information

```bash
mise version                        # Show mise version
mise which node                     # Show path to tool binary
mise current                        # Show current tool versions
mise registry                       # Search available tools
mise search jq                      # Search for a tool in registry
```

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Global config | `~/.config/mise/config.toml` | Personal defaults for all projects |
| Project config | `mise.toml` (project root) | Project-specific tools, tasks, env |
| Local config | `mise.local.toml` | Machine-specific overrides (gitignored) |
| Environment config | `mise.{ENV}.toml` | Per-environment config (dev, staging, prod) |

### Config Precedence (lowest to highest)

1. System config (`/etc/mise/`)
2. Global config (`~/.config/mise/config.toml`)
3. Project config (`mise.toml`)
4. Local config (`mise.local.toml`)
5. Environment-specific config (`mise.{ENV}.toml`)

## TOML Structure

### [tools] Section

```toml
[tools]
node = "24"                         # Registry tool
python = "3.12.*"                   # Semver range
go = "latest"                       # Latest version
"aqua:astral-sh/ruff" = "latest"   # Backend-specific tool
"cargo:bat" = "latest"              # Cargo backend
"pipx:black" = "latest"             # pipx backend
```

### [tasks] Section

```toml
[tasks.build]
description = "Build the project"
run = "cargo build"
alias = "b"

[tasks.test]
description = "Run tests"
depends = ["build"]
run = [
  "cargo test",
  "./scripts/e2e.sh",
]

[tasks.lint]
description = "Lint code"
run = '''
#!/usr/bin/env bash
cargo clippy
ruff check .
'''
```

### [env] Section

```toml
[env]
DATABASE_URL = "postgres://localhost/mydb"
NODE_ENV = "development"

# Source from external file
[[env]]
_.source = "./.env"
```

### [settings] Section

```toml
[settings]
experimental = true
idiomatic_version_file = true       # Read .nvmrc, .python-version, etc.
```

### [vars] Section

```toml
[vars]
test_args = "--headless"

[tasks.test]
run = "./scripts/test.sh {{vars.test_args}}"
```

## Task Features

### Dependencies

```toml
[tasks.build]
run = "cargo build"

[tasks.test]
depends = ["build"]                 # Run build first
run = "cargo test"

[tasks.ci]
depends = ["build", "test"]         # Multiple dependencies
```

### Sources and Outputs (caching)

```toml
[tasks.build]
run = "cargo build"
sources = ["Cargo.toml", "src/**/*.rs"]
outputs = ["target/debug/myapp"]
```

### Confirmation Prompts

```toml
[tasks.deploy]
confirm = "Are you sure you want to deploy?"
run = "./deploy.sh"
```

### Arguments (usage field)

```toml
[tasks.deploy]
description = "Deploy application"
usage = '''
arg "<environment>" help="Target environment" { choices "dev" "staging" "prod" }
flag "-v --verbose" help="Enable verbose output"
flag "--region <region>" help="AWS region" default="us-east-1"
'''
run = '''
echo "Deploying to ${usage_environment} in ${usage_region}"
'''
```

### File Tasks

Create executable scripts in `.mise/tasks/` directory:

```bash
#!/usr/bin/env bash
#MISE description="My custom task"
echo "Running custom task"
```

## Backends

Tools can be installed from various backends:

| Backend | Syntax | Example |
|---------|--------|---------|
| Registry | `tool` | `node = "24"` |
| aqua | `aqua:owner/repo` | `"aqua:astral-sh/ruff" = "latest"` |
| cargo | `cargo:crate` | `"cargo:bat" = "latest"` |
| go | `go:module` | `"go:golang.org/x/tools" = "latest"` |
| npm | `npm:package` | `"npm:prettier" = "latest"` |
| pipx | `pipx:package` | `"pipx:black" = "latest"` |
| ubi | `ubi:owner/repo` | `"ubi:BurntSushi/ripgrep" = "latest"` |

## Agent Workflow Patterns

### Pattern: Add a New Tool to Project

```bash
mise use node@24                    # Adds to mise.toml and installs
mise install                        # Install all tools
```

### Pattern: Set Up New Project Environment

```bash
mise init                           # Detect tools from project files
mise edit                           # Fine-tune configuration
mise install                        # Install all tools
mise trust                          # Trust the config file
```

### Pattern: Run Project Tasks

```bash
mise run                            # See available tasks
mise run build                      # Run specific task
mise run test -- --verbose          # Pass arguments
mise tasks                          # List with descriptions
```

### Pattern: Environment-Specific Config

```bash
MISE_ENV=dev mise env               # Load dev environment
MISE_ENV=prod mise run deploy       # Run in production mode
```

### Pattern: Troubleshoot Configuration

```bash
mise doctor                         # Check for issues
mise config                         # Show merged config
mise ls                             # Verify installed versions
```

## Notes

- Shell integration (`eval "$(mise activate bash)"`) is needed for automatic environment loading
- Without shell integration, use `mise env` or `mise exec` to get the environment
- `mise edit` opens an interactive TUI editor with fuzzy search and validation
- Run `mise trust` on new project configs for security
- Use `mise.local.toml` for machine-specific settings that shouldn't be committed
- `mise watch` rebuilds automatically when source files change
- Environment-specific configs activate via `MISE_ENV` variable
- Use `idiomatic_version_file = true` to read `.nvmrc`, `.python-version`, etc.

## Reference

Full documentation: https://mise.jdx.dev
GitHub: https://github.com/jdx/mise
