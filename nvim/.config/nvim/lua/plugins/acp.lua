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
		-- version = "^18.0.0",  -- Commented out to use develop branch
		branch = "develop",
		opts = {
			interactions = {
				chat = {
					-- Configure chat interactions to use mistral_vibe adapter
					adapter = "mistral_vibe",
				},
			},
			-- Configure prompt library to include markdown prompts
			prompt_library = {
				markdown = {
					dirs = {
						vim.fn.expand("~/.config/nvim/prompts"),
					},
				},
			},
		},
		-- Required dependencies for codecompanion
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
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
			{ "<leader>agc", "<cmd>CodeCompanion /commit<cr>", desc = "Generate Commit Message" },
			-- Execute commit workflow to actually commit changes
			{ "<leader>agC", "<cmd>CodeCompanion /commit-execute<cr>", desc = "Execute Commit Workflow" },
			-- Interactive step-by-step commit process
			{ "<leader>agS", "<cmd>CodeCompanion /commit-step<cr>", desc = "Step-by-Step Commit" },
		},
	},
}