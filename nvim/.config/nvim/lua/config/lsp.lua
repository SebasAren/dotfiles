local lsp_servers = { "volar", "vtsls" }

vim.lsp.config("vtsls", {
	filetypes = { "javascript", "typescript", "vue" },
	settings = {
		vtsls = {
			tsserver = {
				globalPlugins = {
					{
						name = "@vue/typescript-plugin",
						location = require("mason-registry").get_package("vue-language-server"):get_install_path()
							.. "/node_modules/@vue/language-server",
						languages = { "vue" },
						configNamespace = "typescript",
						enableForWorkspaceTypeScriptVersions = true,
					},
				},
			},
		},
	},
})

vim.lsp.config("volar", {
	init_options = {
		typescript = {
			tsdk = require("mason-registry").get_package("vue-language-server"):get_install_path()
				.. "/node_modules/typescript/lib",
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
