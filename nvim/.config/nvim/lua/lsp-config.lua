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
lspconfig.ts_ls.setup({
	capabilities = capabilities,
})
lspconfig.volar.setup({
	capabilities = capabilities,
	on_new_config = function(new_config, new_root_dir)
		new_config.init_options.typescript.tsdk = get_typescript_server_path(new_root_dir)
	end,
})
lspconfig.basedpyright.setup({
	capabilities = capabilities,
	settings = {
		basedpyright = {
			analysis = {
				diagnosticSeverityOverrides = {
					reportUnusedCallResult = "none",
				},
			},
		},
	},
})
lspconfig.lua_ls.setup({
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
lspconfig.prismals.setup({
	capabilities = capabilities,
})
lspconfig.svelte.setup({
	capabilities = capabilities,
})
lspconfig.emmet_language_server.setup({
	capabilities = capabilities,

	filetypes = {
		"css",
		"eruby",
		"html",
		"javascript",
		"javascriptreact",
		"less",
		"sass",
		"scss",
		"pug",
		"typescriptreact",
		"vue",
	},
	-- Read more about this options in the [vscode docs](https://code.visualstudio.com/docs/editor/emmet#_emmet-configuration).
	-- **Note:** only the options listed in the table are supported.
	init_options = {
		---@type table<string, string>
		includeLanguages = {},
		--- @type string[]
		excludeLanguages = {},
		--- @type string[]
		extensionsPath = {},
		--- @type table<string, any> [Emmet Docs](https://docs.emmet.io/customization/preferences/)
		preferences = {},
		--- @type boolean Defaults to `true`
		showAbbreviationSuggestions = true,
		--- @type "always" | "never" Defaults to `"always"`
		showExpandedAbbreviation = "always",
		--- @type boolean Defaults to `false`
		showSuggestionsAsSnippets = false,
		--- @type table<string, any> [Emmet Docs](https://docs.emmet.io/customization/syntax-profiles/)
		syntaxProfiles = {},
		--- @type table<string, string> [Emmet Docs](https://docs.emmet.io/customization/snippets/#variables)
		variables = {},
	},
})
lspconfig.cobol_ls.setup({
	capabilities = capabilities,
})
