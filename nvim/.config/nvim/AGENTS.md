# Neovim Configuration

Lazy.nvim-based config with 17 LSP servers, AI-powered completion, and modular plugin specs.

## Structure

```
init.lua
lua/
  config/
    lazy.lua         # Lazy.nvim bootstrap
    settings.lua     # vim.o options
    mappings.lua     # Global + LSP keybindings
    lsp.lua          # LSP server registration
    diagnostic.lua   # Diagnostic display config
  plugins/           # Plugin specs (one file per plugin/group)
  prompts/           # AI prompt helpers (branch_diff, commit, review)
  utils/             # LLM tools
lsp/                 # Per-server configs (basedpyright.lua, yamlls.lua, etc.)
```

## Plugin Specs

Each file in `lua/plugins/` returns a Lazy.nvim table:

```lua
return {
  "user/plugin",
  ---@type LazyPluginSpec
  opts = { ... },
  opts_extend = { "settings" },  -- for extending defaults
}
```

## Key Plugins

| Plugin | Purpose |
|--------|---------|
| blink.cmp | Completion (Codestral + Minuet-AI providers) |
| conform.nvim | Formatting (StyLua, prettierd, black, isort) |
| nvim-lint | Linting (ruff, luacheck, hadolint) |
| nvim-dap + nvim-dap-ui | Debugging (JS/TS, Python) |
| neotest | Testing (`<leader>t` prefix) |
| fzf-lua | Fuzzy finder |
| CodeCompanion.nvim | AI chat (Venice AI adapter) |

## LSP

Servers registered via `vim.lsp.config` and enabled with `vim.lsp.enable`. Per-server configs in `lsp/*.lua`:

```lua
return {
  default_config = {
    cmd = { ... },
    root_markers = { ".git" },
    settings = { ... },
  },
}
```

Key servers: basedpyright (Python), vtsls (TypeScript), lua_ls, rust_analyzer, gopls, jsonls, graphql, yamlls, eslint, html, cssls, taplo.

## Keybindings

- Leader: `<space>`
- `gd` — goto definition
- `gr` — references
- `<space>ca` — code action
- `<space>rn` — rename
- `<C-x><C-l>` — LSP completion (insert mode)

## Conventions

- 2-space indent, StyLua formatting
- `---@type` annotations for LuaLS
- `snake_case` for functions and variables
- `opts_extend` pattern for extending plugin defaults
- `pcall(require, "custom-settings")` for machine-specific overrides (gitignored)

## Anti-Patterns

- NO `vim.cmd()` for plugin setup — use `require().setup()`
- NO `vim.cmd("packadd")` — Lazy.nvim handles loading
- NO hardcoded paths — use `vim.fn.stdpath("config")`
- NO `as any` or `@ts-ignore` in TypeScript

## Commands

| Command | Purpose |
|---------|---------|
| `:Lazy sync` | Update all plugins |
| `:ConformInfo` | Show formatter status |
| `:LspInfo` | Show LSP server status |
| `:Mason` | Manage LSP/formatter/linter servers |
| `:lua =vim.lsp.get_clients()` | List active LSP clients |
