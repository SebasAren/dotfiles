return {
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
			"mrshmllow/document-color.nvim",
			"b0o/schemastore.nvim",
			"saghen/blink.cmp",
		},
		config = function()
			--
			-- Setup Mason and Mason-LSPConfig
			local mason = require("mason")
			local mason_lsp = require("mason-lspconfig")
			local lspconfig = require("lspconfig")
			local mason_registry = require("mason-registry")

			mason.setup()
			mason_lsp.setup({
				automatic_installation = true,
				ensure_installed = { "prettierd", "stylua", "black", "isort" },
			})

			-- Set up document-color on attach hook
			require("document-color").setup({
				mode = "background",
			})
			local on_attach = function(client, bufnr)
				if client.server_capabilities.colorProvider then
					-- Attach document colour support
					require("document-color").buf_attach(bufnr)
				end
			end

			-- Define all LSP servers and their configurations in one table
			local servers = {
				ts_ls = {
					init_options = {
						plugins = {
							{
								name = "@vue/typescript-plugin",
								location = mason_registry.get_package("vue-language-server"):get_install_path()
									.. "/node_modules/@vue/language-server",
								languages = { "vue", "javascript", "typescript" },
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
				},
				volar = {},
				basedpyright = {
					settings = {
						basedpyright = {
							analysis = {
								diagnosticSeverityOverrides = {
									reportUnusedCallResult = "none",
								},
							},
						},
					},
				},
				lua_ls = {
					settings = {
						Lua = {
							runtime = {
								version = "LuaJIT",
								path = {
									"?/init.lua",
									"?.lua",
								},
							},
							diagnostics = {
								globals = { "vim", "awesome", "client", "root" },
							},
							workspace = {
								library = {
									vim.api.nvim_get_runtime_file("", true),
									"/usr/share/awesome/lib",
									"/usr/share/lua/5.3/lain",
									"/usr/share/lua/5.3/freedesktop",
								},
							},
							telemetry = {
								enable = false,
							},
						},
					},
				},
				graphql = {},
				html = {
					filetypes = { "html" },
				},
				tailwindcss = {
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
				},
				jsonls = {
					settings = {
						json = {
							schemas = require("schemastore").json.schemas(),
							validate = { enable = true },
						},
					},
				},
				prismals = {},
				svelte = {},
				emmet_language_server = {
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
					init_options = {
						includeLanguages = {},
						excludeLanguages = {},
						extensionsPath = {},
						preferences = {},
						showAbbreviationSuggestions = true,
						showExpandedAbbreviation = "always",
						showSuggestionsAsSnippets = false,
						syntaxProfiles = {},
						variables = {},
					},
				},
				cobol_ls = {},
			}

			-- Setup each LSP server from the servers table
			for server, config in pairs(servers) do
				config.capabilities = require("blink.cmp").get_lsp_capabilities(config.capabilities)
				config.on_attach = on_attach
				lspconfig[server].setup(config)
			end
		end,
	},
}
