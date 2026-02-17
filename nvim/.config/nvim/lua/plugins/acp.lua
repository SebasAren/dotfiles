-- AI Code Companion Plugin Configuration
-- This file configures AI-assisted coding plugins for Neovim
-- Currently using codecompanion.nvim with mistral_vibe adapter
-- Also includes Venice AI adapter configuration (community edition with web search)
-- Alternative avante.nvim configuration is commented out below

return {
	-- CodeCompanion.nvim - Active AI companion plugin
	-- Uses mistral_vibe adapter for AI interactions
	-- Note: Using develop branch for latest features (may be less stable)
	{
		"olimorris/codecompanion.nvim",
		branch = "develop",
		-- Required dependencies for codecompanion
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			{
				"ravitemer/mcphub.nvim",
				build = "npm install -g mcp-hub@latest",
				config = function()
					require("mcphub").setup()
				end,
			},
		},
		-- Setup function to configure both codecompanion and mcphub integration
		config = function()
			-- Add debugging to verify mcphub tools registration
			require("codecompanion").setup({
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
				interactions = {
					chat = {
						adapter = "mistral_vibe",
						variables = {}, -- Initialize variables table for mcphub extension
						tools = {}, -- Initialize tools table for mcphub extension
					},
				},
				prompt_library = {
					markdown = {
						dirs = {
							vim.fn.stdpath("config") .. "/lua/prompts",
						},
					},
				},
				display = {
					action_palette = {
						opts = {
							show_prompt_library_builtins = false,
						},
					},
				},
				-- Add Venice AI adapter configuration (community version)
				adapters = {
					http = {
						venice = require("providers.venice"),
					},
				},
			})
		end,
		-- AI Code Companion Hotkeys using <leader>a prefix
		keys = {
			-- Toggle chat buffer
			{ "<leader>aa", "<cmd>CodeCompanionChat Toggle<cr>", desc = "Toggle AI Chat" },
			-- Open inline assistant
			{ "<leader>ai", "<cmd>CodeCompanion<cr>", desc = "Inline AI Assistant" },
			-- Open action palette
			{ "<leader>ap", "<cmd>CodeCompanionActions<cr>", desc = "AI Action Palette" },
			-- Add selected text to chat (visual mode)
			{ "<leader>ac", "<cmd>CodeCompanionChat Add<cr>", mode = "v", desc = "Add to AI Chat" },
			-- Refresh chat cache
			{ "<leader>ar", "<cmd>CodeCompanionChat RefreshCache<cr>", desc = "Refresh AI Chat Cache" },
			-- Generate commit message for current changes
			{ "<leader>agc", "<cmd>CodeCompanion /commit-full<cr>", desc = "Generate Commit Message" },
			-- Perform code review between branches
			{
				"<leader>agr",
				function()
					require("prompts.code_review.branch_review_helper").collect_branch_input()
				end,
				desc = "Review Branch Changes",
			},
		},
	},
}
