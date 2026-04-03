---
globs:
  - "*.lua"
  - "nvim/**/*.lua"
description: Neovim Lua conventions
---

- Use 2-space indentation (StyLua formatting)
- Use `---@type` annotations for LuaLS
- Use `snake_case` for variables and functions
- Prefer `vim.keymap.set` over legacy `vim.api.nvim_set_keymap`
- Use `pcall` for requiring optional modules
