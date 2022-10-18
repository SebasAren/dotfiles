local mason = require("mason")
local mason_lsp = require("mason-lspconfig")
local lspconfig = require("lspconfig")

local capabilities = require("cmp_nvim_lsp").default_capabilities()
local on_attach = function(client)
	if client.server_capabilities.colorProvider then
		-- Attach document colour support
		require("document-color").buf_attach(bufnr)
	end
end
mason.setup({
	capabilities = capabilities,
})
mason_lsp.setup({
	automatic_installation = true,
})
lspconfig.volar.setup({
	capabilities = capabilities,
	filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue", "json" },
	-- init_options = {
	--   typescript = {
	--     serverPath = vim.fn.stdpath 'data' .. 'mason' .. 'typescript-language-server',
	--   }
	-- }
})
lspconfig.eslint.setup({
	capabilities = capabilities,
	filetypes = {
		"javascript",
		"javascriptreact",
		"javascript.jsx",
		"typescript",
		"typescriptreact",
		"typescript.tsx",
		"svelte",
		"vue",
	},
})
lspconfig.pyright.setup({
	capabilities = capabilities,
})
lspconfig.sumneko_lua.setup({
	settings = {
		Lua = {
			runtime = {
				-- Tell the language server which version of Lua you're using (most likely LuaJIT in the case of Neovim)
				version = "LuaJIT",
				path = {
					"?/init.lua",
					"?.lua",
				},
			},
			diagnostics = {
				-- Get the language server to recognize the `vim` global
				globals = { "vim", "awesome", "client", "root" },
			},
			workspace = {
				-- Make the server aware of Neovim runtime files
				library = {
					vim.api.nvim_get_runtime_file("", true),
					"/usr/share/awesome/lib",
					"/usr/share/lua/5.3/lain",
					"/usr/share/lua/5.3/freedesktop",
				},
			},
			-- Do not send telemetry data containing a randomized but unique identifier
			telemetry = {
				enable = false,
			},
		},
	},
})
lspconfig.graphql.setup({
	capabilities = capabilities,
})
lspconfig.html.setup({
	capabilities = capabilities,
	filetypes = { "html" },
})
lspconfig.tailwindcss.setup({
	capabilities = capabilities,
	on_attach = on_attach,
})
lspconfig.jsonls.setup({
	capabilities = capabilities,
	settings = {
		json = {
			schemas = require("schemastore").json.schemas(),
			validate = { enable = true },
		},
	},
})
lspconfig.hls.setup({
	capabilities = capabilities,
})
lspconfig.prismals.setup({
	capabilities = capabilities,
})
