-- Plugin spec for git_diff_review module
-- Provides <leader>gD keymap to open the diff review session
return {
	{
		"ibhagwan/fzf-lua",
		optional = true,
		keys = {
			{
				"<leader>gD",
				function()
					require("git_diff_review").open()
				end,
				desc = "Git diff review (all files)",
			},
		},
	},
}
