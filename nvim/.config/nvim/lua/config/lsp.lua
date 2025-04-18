local lsp_servers = {}

vim.lsp.config("volar", {
	filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" },
	init_options = {
		typescript = {
			tsdk = require("mason-registry").get_package("vue-language-server"):get_install_path()
				.. "/node_modules/typescript/lib",
		},
		vue = {
			hybridMode = false,
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
