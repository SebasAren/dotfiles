# AI Agent Guidelines for Dotfiles Repository

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

## Important Notes
- Custom settings should go in `custom-settings.lua` (gitignored)
- Aider config references `CONVENTIONS.md` which should contain project-specific conventions
- Always test Qtile config changes with `<mod+shift+r` before committing
- Use `<leader>tf` to toggle auto-format if needed during editing
