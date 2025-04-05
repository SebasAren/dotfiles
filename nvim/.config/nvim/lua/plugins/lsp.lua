return {
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
			"hrsh7th/cmp-nvim-lsp",
			"mrshmllow/document-color.nvim",
		},
		config = function()
			local mason = require("mason")
			local mason_lsp = require("mason-lspconfig")
			local lspconfig = require("lspconfig")

			local capabilities = require("cmp_nvim_lsp").default_capabilities()
			require("document-color").setup({
				mode = "background",
			})
			local on_attach = function(client, bufnr)
				if client.server_capabilities.colorProvider then
					-- Attach document colour support
					require("document-color").buf_attach(bufnr)
				end
			end
			local mason_registry = require("mason-registry")

			mason.setup({
				capabilities = capabilities,
			})
			mason_lsp.setup({
				automatic_installation = true,
			})
			lspconfig.ts_ls.setup({
				capabilities = capabilities,
				init_options = {
					plugins = {
						{
							name = "@vue/typescript-plugin",
							location = mason_registry.get_package("vue-language-server"):get_install_path()
								.. "/node_modules/@vue/language-server",
							languages = { "vue" },
						},
					},
				},
				filetypes = {
					"javascript",
					"typescript",
					"vue",
					"javascriptreact",
					"typescriptreact",
				},
			})
			lspconfig.volar.setup({
				capabilities = capabilities,
				-- on_new_config = function(new_config, new_root_dir)
				-- 	new_config.init_options.typescript.tsdk = get_typescript_server_path(new_root_dir)
				-- end,
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
		end,
	},
	{ "b0o/schemastore.nvim" },
	{
		"glepnir/lspsaga.nvim",
		event = "LspAttach",
		config = function()
			require("lspsaga").setup({})
			local keymap = vim.keymap.set

			-- Lsp finder find the symbol definition implement reference
			-- if there is no implement it will hide
			-- when you use action in finder like open vsplit then you can
			-- use <C-t> to jump back
			keymap("n", "gh", "<cmd>Lspsaga finder<CR>", { silent = true })

			-- Code action
			keymap({ "n", "v" }, "<leader>ca", "<cmd>Lspsaga code_action<CR>", { silent = true })

			-- Rename
			keymap("n", "gr", "<cmd>Lspsaga rename<CR>", { silent = true })

			-- Peek Definition
			-- you can edit the definition file in this flaotwindow
			-- also support open/vsplit/etc operation check definition_action_keys
			-- support tagstack C-t jump back
			keymap("n", "gd", "<cmd>Lspsaga peek_definition<CR>", { silent = true })

			-- Show line diagnostics
			keymap("n", "<leader>cd", "<cmd>Lspsaga show_line_diagnostics<CR>", { silent = true })

			-- Show cursor diagnostic
			keymap("n", "<leader>cd", "<cmd>Lspsaga show_cursor_diagnostics<CR>", { silent = true })

			-- Diagnsotic jump can use `<c-o>` to jump back
			keymap("n", "[e", "<cmd>Lspsaga diagnostic_jump_prev<CR>", { silent = true })
			keymap("n", "]e", "<cmd>Lspsaga diagnostic_jump_next<CR>", { silent = true })

			-- Only jump to error
			keymap("n", "[E", function()
				require("lspsaga.diagnostic").goto_prev({ severity = vim.diagnostic.severity.ERROR })
			end, { silent = true })
			keymap("n", "]E", function()
				require("lspsaga.diagnostic").goto_next({ severity = vim.diagnostic.severity.ERROR })
			end, { silent = true })

			-- Outline
			keymap("n", "<leader>o", "<cmd>LSoutlineToggle<CR>", { silent = true })

			-- Hover Doc
			keymap("n", "K", "<cmd>Lspsaga hover_doc<CR>", { silent = true })
		end,
	},
	{
		"ray-x/lsp_signature.nvim",
		config = function()
			require("lsp_signature").setup()
		end,
	},
}
