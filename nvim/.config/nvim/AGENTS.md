# Neovim Agent Guide

## OVERVIEW
Neovim config with Lazy.nvim, 17 LSP servers, blink.cmp completion, and AI integration via Codestral/Minuet.

## STRUCTURE

```
init.lua
lua/
  config/
    lazy.lua       # Lazy.nvim bootstrap
    settings.lua   # vim.o options
    mappings.lua   # global + LSP keybindings
    lsp.lua        # LSP server registration
    diagnostic.lua # diagnostic config
  plugins/         # 17 plugin specs
  prompts/         # AI prompt helpers (branch_diff, commit, branch_review_helper)
  utils/           # llmtools.lua
lsp/               # Per-server configs (basedpyright.lua, yamlls.lua, etc.)
```

## PLUGIN ARCH

Plugin specs live in `lua/plugins/`. Each returns a Lazy.nvim table.

```lua
return {
  "user/plugin",
  ---@type LazyPluginSpec
  opts = { ... },
  -- extend defaults via opts_extend
  opts_extend = { "settings" },
}
```

Key plugins:
- **completion**: blink.cmp (with Codestral/Minuet)
- **debugging**: nvim-dap, con.nvim (37 keybindings)
- **search**: fzf-lua
- **testing**: neotest
- **folding**: ufo, folds
- **formatting**: conform

## LSP SETUP

Servers registered via `vim.lsp.config` and enabled with `vim.lsp.enable`.

Per-server configs in `lsp/*.lua`:
```lua
return {
  default_config = {
    cmd = { ... },
    root_markers = { ".git" },
    settings = { ... },
  },
}
```

Common servers: basedpyright, vtsls, lua_ls, jsonls, graphql, yamlls, taplo, rust_analyzer, gopls, ts_ls, cssls, html, eslint, lua_ls.

## KEYBINDING CONVENTIONS

Global leader: `<space>`
LSP keybindings defined in `lua/config/mappings.lua`
DAP keybindings in `con.nvim` (37 bindings)

Normal mode defaults:
- `gd` goto definition
- `gr` references
- `<space>ca` code action
- `<space>rn` rename

Insert mode: `<C-x><C-l>` for LSP completion.

## ANTI-PATTERNS

- NO `as any` or `@ts-ignore`
- NO `vim.cmd()` for plugin setup — use `require().setup()`
- NO hardcoded paths — use `vim.fn.stdpath("config")`
- NO `vim.cmd("packadd")` — Lazy.nvim handles plugin loading

## TOOLS

`:Lazy sync` | `:ConformInfo` | `:LspInfo` | `:health#lazy#check`

## CODE

- 2-space indent, StyLua
- `---@type` annotations, `snake_case`
- `opts_extend` pattern for extending defaults
- `pcall(require, "custom-settings")` for optional user config
