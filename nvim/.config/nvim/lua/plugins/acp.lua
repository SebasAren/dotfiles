-- AI Code Companion Plugin Configuration
-- This file configures AI-assisted coding plugins for Neovim
-- Currently using codecompanion.nvim with mistral_vibe adapter
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
		},
		-- Setup function to configure both codecompanion and mcphub integration
		config = function()
			-- Add debugging to verify mcphub tools registration
			require("codecompanion").setup({
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
