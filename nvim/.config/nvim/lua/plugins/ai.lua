return {
	{
		"olimorris/codecompanion.nvim",
		opts = {},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
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
			{
				-- Make sure to set this up properly if you have lazy=true
				"MeanderingProgrammer/render-markdown.nvim",
				opts = {
					file_types = { "markdown", "Avante", "codecompanion" },
				},
				ft = { "markdown", "Avante", "codecompanion" },
			},
		},
		config = function()
			require("codecompanion").setup({
				strategies = {
					chat = {
						adapter = "kimi",
					},
					inline = {
						adapter = "kimi",
					},
				},
				adapters = {
					kimi = function()
						return require("codecompanion.adapters").extend("openai_compatible", {
							env = {
								url = "https://api.moonshot.ai",
								api_key = "MOONSHOT_API_KEY",
								chat_url = "/v1/chat/completions",
							},
							schema = {
								model = {
									default = "kimi-k2-0711-preview",
								},
							},
						})
					end,
				},
				extensions = {
					mcphub = {
						callback = "mcphub.extensions.codecompanion",
						opts = {
							-- MCP Tools
							make_tools = true, -- Make individual tools (@server__tool) and server groups (@server) from MCP servers
							show_server_tools_in_chat = true, -- Show individual tools in chat completion (when make_tools=true)
							add_mcp_prefix_to_tool_names = false, -- Add mcp__ prefix (e.g `@mcp__github`, `@mcp__neovim__list_issues`)
							show_result_in_chat = true, -- Show tool results directly in chat buffer
							format_tool = nil, -- function(tool_name:string, tool: CodeCompanion.Agent.Tool) : string Function to format tool names to show in the chat buffer
							-- MCP Resources
							make_vars = true, -- Convert MCP resources to #variables for prompts
							-- MCP Prompts
							make_slash_commands = true, -- Add MCP prompts as /slash commands
						},
					},
				},
			})
		end,
	},
}
