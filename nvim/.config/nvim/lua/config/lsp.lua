local lsp_servers = { "vtsls", "astro" }

vim.lsp.config("vtsls", {
	filetypes = { "javascript", "typescript", "vue", "typescriptreact", "javascriptreact" },
	settings = {
		vtsls = {
			autoUseWorkspaceTsdk = true,
			tsserver = {
				globalPlugins = {
					{
						name = "@vue/typescript-plugin",
						location = vim.fn.getcwd() .. "/node_modules/@vue/typescript-plugin",
						languages = { "vue" },
						configNamespace = "typescript",
						enableForWorkspaceTypeScriptVersions = true,
					},
				},
			},
		},
	},
})

vim.lsp.config("astro", {
	init_options = {
		typescript = {
			tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
		},
	},
})

for _, file in ipairs(vim.fn.readdir(vim.fn.stdpath("config") .. "/lsp")) do
	local server_name = file:match("(.+)%..+$")
	if server_name then
		table.insert(lsp_servers, server_name)
	end
end

vim.lsp.enable(lsp_servers)

require("mason-lspconfig").setup()
