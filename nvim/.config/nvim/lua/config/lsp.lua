local lsp_servers = { "astro" }

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

require("mason-lspconfig").setup({
  ensure_installed = { "svelte", "volar" },
})
