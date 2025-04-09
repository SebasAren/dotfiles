return {
	"epwalsh/obsidian.nvim",
	version = "*",
	lazy = false,
	dependencies = {
		"nvim-lua/plenary.nvim",
	},
	opts = {
		workspaces = {
			{
				name = "personal",
				path = "~/vaults/personal",
			},
			{
				name = "tetra",
				path = "~/vaults/tetra",
			},
		},
	},
}
