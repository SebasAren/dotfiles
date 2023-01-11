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

local util = require("lspconfig.util")
local function get_typescript_server_path(root_dir)
	local global_ts = ""
	-- Alternative location if installed as root:
	-- local global_ts = '/usr/local/lib/node_modules/typescript/lib'
	local found_ts = ""
	local function check_dir(path)
		found_ts = util.path.join(path, "node_modules", "typescript", "lib")
		if util.path.exists(found_ts) then
			return path
		end
	end
	if util.search_ancestors(root_dir, check_dir) then
		return found_ts
	else
		return global_ts
	end
end

mason.setup({
	capabilities = capabilities,
})
mason_lsp.setup({
	automatic_installation = true,
})
lspconfig.tsserver.setup({
	capabilities = capabilities,
})
lspconfig.volar.setup({
	capabilities = capabilities,
	on_new_config = function(new_config, new_root_dir)
		new_config.init_options.typescript.tsdk = get_typescript_server_path(new_root_dir)
	end,
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
	settings = {
		tailwindCSS = {
			files = {
				exclude = {
					"**/node_modules/**",
					"**/.hg/**",
					"**/.git/**",
					"**/.svn/**",
					"**/.nuxt/**",
				},
			},
		},
	},
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
lspconfig.jsonnet_ls.setup({
	capabilities = capabilities,
})
