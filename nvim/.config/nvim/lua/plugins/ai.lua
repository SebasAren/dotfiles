return {
	{
		"yetone/avante.nvim", -- if you want to build from source then do `make BUILD_FROM_SOURCE=true` ⚠️ must add this setting! ! !
		build = "make",
		event = "VeryLazy",
		version = false, -- Never set this value to "*"! Never!
		---@module 'avante'
		---@type avante.Config
		opts = {
			-- add any opts here
			-- for example
			provider = "moonshot-kimi",
			providers = {
				["moonshot-kimi"] = {
					__inherited_from = "openai",
					endpoint = "https://api.moonshot.ai/v1",
					api_key_name = "MOONSHOT_API_KEY",
					model = "kimi-k2-0711-preview",
				},
				kimi = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "moonshotai/kimi-k2",
				},
				["groq-kimi"] = {
					__inherited_from = "openai",
					api_key_name = "GROQ_API_KEY",
					endpoint = "https://api.groq.com/openai/v1/",
					model = "moonshotai/kimi-k2-instruct",
				},
				["aihubmix-kimi"] = {
					__inherited_from = "openai",
					endpoint = "https://aihubmix.com",
					api_key_name = "AIHUBMIX_API_KEY",
					model = "moonshotai/kimi-k2-instruct",
				},
				morph = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "morph/morph-v3-large",
				},
				deepseek = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "deepseek/deepseek-chat-v3-0324",
				},
			},
			behaviour = {
				enable_fastapply = true,
			},
			system_prompt = function()
				local hub = require("mcphub").get_hub_instance()
				return hub and hub:get_active_servers_prompt() or ""
			end,
			custom_tools = function()
				return {
					require("mcphub.extensions.avante").mcp_tool(),
				}
			end,
			-- disable all native avante tools to use only MCP tools
			disabled_tools = {
				"rag_search",
				"python",
				"git_diff",
				"git_commit",
				"glob",
				"search_keyword",
				"read_file_toplevel_symbols",
				"read_file",
				"create_file",
				"move_path",
				"copy_path",
				"delete_path",
				"create_dir",
				"bash",
				"web_search",
				"fetch",
				"run_python",
				"run_bash",
				"str_replace_editor",
				"grep",
				"search",
				"find_file",
				"create",
				"delete",
				"move",
				"rename",
				"insert",
				"replace",
				"copy",
				"write",
			},
			input = {
				provider = "dressing",
				provider_opts = {},
			},
			windows = {
				input = {
					height = 16,
				},
			},
		},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			"stevearc/dressing.nvim",
			{
				-- support for image pasting
				"HakonHarnes/img-clip.nvim",
				event = "VeryLazy",
				opts = {
					-- recommended settings
					default = {
						embed_image_as_base64 = false,
						prompt_for_file_name = false,
						drag_and_drop = {
							insert_mode = true,
						},
						-- required for Windows users
						use_absolute_path = true,
					},
				},
			},
			{
				-- Make sure to set this up properly if you have lazy=true
				"MeanderingProgrammer/render-markdown.nvim",
				opts = {
					file_types = { "markdown", "Avante" },
				},
				ft = { "markdown", "Avante" },
			},
		},
	},
	{
		"ravitemer/mcphub.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
		},
		build = "npm install -g mcp-hub@latest", -- Installs `mcp-hub` node binary globally
		config = function()
			require("mcphub").setup({
				extensions = {
					avante = {
						make_slash_commands = true,
					},
				},
				native_servers = {
					vitest = require("mcphub-native.servers.vitest"),
					conventional_commits = require("mcphub-native.servers.conventional-commits"),
				},
			})
		end,
	},
}
