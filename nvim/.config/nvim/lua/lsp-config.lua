local mason = require("mason")
local mason_lsp = require("mason-lspconfig")
local lspconfig = require('lspconfig')

local capabilities = require('cmp_nvim_lsp').update_capabilities(vim.lsp.protocol.make_client_capabilities())
mason.setup({
  capabilities = capabilities
})
mason_lsp.setup{
  automatic_installation = true
}
lspconfig.volar.setup{
  capabilities = capabilities,
  -- init_options = {
  --   typescript = {
  --     serverPath = vim.fn.stdpath 'data' .. 'mason' .. 'typescript-language-server',
  --   }
  -- }
}
lspconfig.eslint.setup{
  capabilities = capabilities
}
lspconfig.tsserver.setup{
  capabilities = capabilities
}
lspconfig.pyright.setup{
  capabilities = capabilities
}
lspconfig.sumneko_lua.setup{
  settings = {
    Lua = {
      runtime = {
        -- Tell the language server which version of Lua you're using (most likely LuaJIT in the case of Neovim)
        version = 'LuaJIT',
      },
      diagnostics = {
        -- Get the language server to recognize the `vim` global
        globals = {'vim'},
      },
      workspace = {
        -- Make the server aware of Neovim runtime files
        library = vim.api.nvim_get_runtime_file("", true),
      },
      -- Do not send telemetry data containing a randomized but unique identifier
      telemetry = {
        enable = false,
      },
    },
  },
}
lspconfig.graphql.setup{
  capabilities = capabilities
}
lspconfig.html.setup{
  capabilities = capabilities,
  filetypes = {"html", "vue"}
}
lspconfig.tailwindcss.setup{
  capabilities = capabilities
}
lspconfig.jsonls.setup{
  capabilities = capabilities,
  settings = {
    json = {
      schemas = require('schemastore').json.schemas(),
      validate = { enable = true },
    },
  },
}
