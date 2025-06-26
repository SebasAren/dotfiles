local lsp_servers = { "vue_ls", "vtsls" }

local get_vue_lsp_location = function()
	return vim.fn.expand("$MASON/packages/vue-language-server")
end

vim.lsp.config("vtsls", {
	filetypes = { "javascript", "typescript", "vue" },
	settings = {
		vtsls = {
			tsserver = {
				globalPlugins = {
					{
						name = "@vue/typescript-plugin",
						location = get_vue_lsp_location() .. "/node_modules/@vue/language-server",
						languages = { "vue" },
						configNamespace = "typescript",
						enableForWorkspaceTypeScriptVersions = true,
					},
				},
			},
		},
	},
})

vim.lsp.config("vue_ls", {
	init_options = {
		typescript = {
			tsdk = get_vue_lsp_location() .. "/node_modules/typescript/lib",
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
