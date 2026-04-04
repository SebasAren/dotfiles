---
globs:
  - "nvim/.config/nvim/lua/plugins/folds.lua"
  - "nvim/.config/nvim/lua/config/treesitter-autocmd.lua"
description: Markdown performance — exclude markdown from treesitter folding
---

- **nvim-ufo must exclude markdown from treesitter folding**: The `provider_selector` in folds.lua must return `"indent"` only for markdown. Treesitter fold computation on markdown (both `markdown` and `markdown_inline` grammars) is extremely expensive and freezes Neovim on large files.
- **treesitter-autocmd.lua guard is not enough**: The `if ft ~= "markdown"` guard in treesitter-autocmd.lua correctly skips foldexpr/indentexpr, but nvim-ufo overrides it. Both must be kept in sync.
- **Markdown should also skip treesitter indentexpr**: It provides no benefit for markdown and adds unnecessary overhead.
