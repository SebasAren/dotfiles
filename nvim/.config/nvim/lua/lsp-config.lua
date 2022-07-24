local mason = require("mason")
local mason_lsp = require("mason-lspconfig")
local lspconfig = require('lspconfig')

mason.setup()
mason_lsp.setup({
  automatic_installation = true
})
lspconfig.volar.setup{ }
lspconfig.eslint.setup{ }
lspconfig.tsserver.setup{ }
lspconfig.pyright.setup{ }
lspconfig.sumneko_lua.setup{ }
lspconfig.graphql.setup{ }

vim.cmd [[autocmd! ColorScheme * highlight NormalFloat guibg=#1f2335]]
vim.cmd [[autocmd! ColorScheme * highlight FloatBorder guifg=white guibg=#1f2335]]

local border = {
      {"🭽", "FloatBorder"},
      {"▔", "FloatBorder"},
      {"🭾", "FloatBorder"},
      {"▕", "FloatBorder"},
      {"🭿", "FloatBorder"},
      {"▁", "FloatBorder"},
      {"🭼", "FloatBorder"},
      {"▏", "FloatBorder"},
}

-- To instead override globally
local orig_util_open_floating_preview = vim.lsp.util.open_floating_preview
function vim.lsp.util.open_floating_preview(contents, syntax, opts, ...)
  opts = opts or {}
  opts.border = opts.border or border
  return orig_util_open_floating_preview(contents, syntax, opts, ...)
end

vim.diagnostic.config({
  virtual_text = true,
  signs = true,
  underline = true,
  update_in_insert = false,
  severity_sort = false,
})
