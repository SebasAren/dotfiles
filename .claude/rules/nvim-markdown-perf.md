---
globs:
  - "nvim/.config/nvim/lua/plugins/folds.lua"
  - "nvim/.config/nvim/lua/config/treesitter-autocmd.lua"
  - "nvim/.config/nvim/lua/plugins/tools.lua"
  - "nvim/.config/nvim/lua/plugins/mini.lua"
description: Markdown performance — disable expensive features for large markdown files
---

- **nvim-ufo must exclude markdown from treesitter folding**: The `provider_selector` in folds.lua must return `"indent"` only for markdown. Treesitter fold computation on markdown (both `markdown` and `markdown_inline` grammars) is extremely expensive and freezes Neovim on large files.
- **treesitter-autocmd.lua guard is not enough**: The `if ft ~= "markdown"` guard in treesitter-autocmd.lua correctly skips foldexpr/indentexpr, but nvim-ufo overrides it. Both must be kept in sync.
- **Markdown should also skip treesitter indentexpr**: It provides no benefit for markdown and adds unnecessary overhead.
- **Skip treesitter entirely for large markdown (>3k lines)**: The `markdown_inline` parser is the biggest performance killer — it parses every bold, italic, code-span, and link across the entire document. Use `M.markdown_line_threshold` in treesitter-autocmd.lua to control the cutoff.
- **indent-blankline must exclude markdown**: Markdown has no meaningful indent structure. ibl creates thousands of virtual text extmarks in large files for zero value. Keep `exclude = { filetypes = { "markdown" } }` in ibl setup.
- **mini.cursorword must be disabled for markdown**: It scans the entire buffer for the word under cursor on every cursor move — O(n) per move, devastating in large files. Use `vim.b.minicursorword_disable = true` via FileType autocmd.
