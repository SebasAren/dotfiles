return {
	{
		"olimorris/codecompanion.nvim",
		keys = {
			{ "<leader>ac", ":CodeCompanionChat<CR>", desc = "Open AI Chat" },
			{ "<leader>ai", ":CodeCompanionInline<CR>", desc = "Start Inline Chat" },
			{ "<leader>aa", ":CodeCompanionActions<CR>", desc = "Start Codecompanion actions" },
			{ "<leader>ax", ":CodeCompanionStop<CR>", desc = "Stop AI Request" },
		},
		lazy = false,
		opts = {
			strategies = {
				chat = {
					adapter = {
						name = "zai",
						model = "glm-4.5-air",
					},
					tools = {
						opts = {
							auto_submit_errors = true,
							auto_submit_success = true,
							default_tools = {
								"tavily",
								"neovim",
								"filesystem",
								"vectorcode",
								"context7",
							},
						},
					},
				},
				inline = {
					adapter = {
						name = "zai",
						model = "glm-4.5",
					},
				},
			},
			adapters = {
				zai = function()
					return require("codecompanion.adapters").extend("openai_compatible", {
						name = "Z-AI",
						env = {
							url = "https://api.z.ai/api/paas",
							chat_url = "/v4/chat/completions",
							models_endpoint = "/v4/models",
							api_key = "ZAI_API_KEY",
						},
						schema = {
							model = {
								default = "glm-4.5-air",
								choices = {
									["glm-4.5"] = { opts = { can_reason = true } },
									["glm-4.5-air"] = { opts = { can_reason = true } },
									["glm-4.5-flash"] = { opts = { can_reason = true } },
								},
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
		},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			"j-hui/fidget.nvim",
			{
				"MeanderingProgrammer/render-markdown.nvim",
				ft = { "markdown", "codecompanion" },
			},
			{
				"Davidyz/VectorCode",
				version = "*", -- optional, depending on whether you're on nightly or release
				dependencies = { "nvim-lua/plenary.nvim" },
				cmd = "VectorCode", -- if you're lazy-loading VectorCode
			},
		},
	},
}
