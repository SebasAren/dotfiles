local lsp_servers = {}

vim.lsp.config("ts_ls", {
	filetypes = { "vue", "javascript", "typescript", "javascriptreact", "typescriptreact" },
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
