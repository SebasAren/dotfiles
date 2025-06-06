return {
	"neovim/nvim-lspconfig",
	{
		"mrshmllow/document-color.nvim",
		config = function()
			-- Set up document-color on attach hook
			require("document-color").setup({
				mode = "background",
			})
			vim.api.nvim_create_autocmd("LspAttach", {
				group = vim.api.nvim_create_augroup("my.lsp", {}),
				callback = function(args)
					local client = assert(vim.lsp.get_client_by_id(args.data.client_id), "Client not found")
					if client.server_capabilities.colorProvider then
						require("document-color").buf_attach(args.buf)
					end
				end,
			})
		end,
	},
	{
		"williamboman/mason.nvim",
		dependencies = {
			"neovim/nvim-lspconfig",
			"b0o/schemastore.nvim",
			"saghen/blink.cmp",
		},
		lazy = false,
		config = function()
			--
			-- Setup Mason and Mason-LSPConfig
			require("mason").setup()
			require("lspconfig").cobol_ls.setup({})
		end,
	},
}
